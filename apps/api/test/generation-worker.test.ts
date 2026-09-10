import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GenerationJobDocument, KitDocument } from '@prep-kit/database';

import { createValidKit } from '../../../tests/fixtures/valid-kit.js';
import type { WorkerConfig } from '../src/generation/config.js';
import {
  GenerationExecutionError,
  GenerationWorker,
  type GenerationWorkerRepositories,
} from '../src/generation/worker.js';

const NOW = new Date('2026-09-09T10:00:00.000Z');
const CONFIG: WorkerConfig = {
  maxAttempts: 3,
  pollIntervalMs: 1_000,
  staleAfterMs: 15 * 60 * 1_000,
};

function createJob(): GenerationJobDocument {
  return {
    _id: new ObjectId(),
    ownerId: new ObjectId(),
    kitId: new ObjectId(),
    idempotencyKey: 'worker-request-123',
    status: 'running',
    stage: 'extracting_requirements',
    progressPercent: 5,
    attempts: 1,
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
    startedAt: NOW,
    completedAt: null,
  };
}

function createKit(job: GenerationJobDocument): KitDocument {
  return {
    _id: job.kitId,
    ownerId: job.ownerId,
    input: {
      jobDescription: 'Senior software engineer building TypeScript platform services.',
      companyUrl: 'https://example.com',
      daysAvailable: 5,
    },
    inputFingerprint: 'a'.repeat(64),
    status: 'queued',
    progress: { stage: 'queued', percent: 0, message: 'Waiting.' },
    kit: null,
    warnings: [],
    version: 2,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function createRepositories(job: GenerationJobDocument, kit: KitDocument) {
  const claimNext = vi.fn<GenerationWorkerRepositories['generationJobs']['claimNext']>(
    async () => job,
  );
  const recoverStale = vi.fn<GenerationWorkerRepositories['generationJobs']['recoverStale']>(
    async () => ({ requeuedJobs: [], failedJobs: [] }),
  );

  return {
    generationJobs: {
      claimNext,
      complete: vi.fn(async () => true),
      fail: vi.fn(async () => true),
      recoverStale,
      updateProgress: vi.fn(async () => true),
    },
    kits: {
      findOwnedById: vi.fn(async () => kit),
      saveGeneratedKit: vi.fn(async () => true),
      updateProgress: vi.fn(async () => true),
    },
  } satisfies GenerationWorkerRepositories;
}

describe('GenerationWorker', () => {
  let job: GenerationJobDocument;
  let kit: KitDocument;
  let repositories: ReturnType<typeof createRepositories>;

  beforeEach(() => {
    job = createJob();
    kit = createKit(job);
    repositories = createRepositories(job, kit);
  });

  it('generates, validates, saves, and completes one claimed job', async () => {
    const generatedKit = createValidKit();
    const generateKit = vi.fn(async () => generatedKit);
    const worker = new GenerationWorker(repositories, generateKit, CONFIG, () => NOW);

    await expect(worker.runOnce()).resolves.toBe(true);

    expect(generateKit).toHaveBeenCalledWith(
      kit.input,
      expect.objectContaining({
        researchedAt: NOW.toISOString(),
        onProgress: expect.any(Function),
        onWarnings: expect.any(Function),
      }),
    );
    expect(repositories.generationJobs.updateProgress).toHaveBeenNthCalledWith(
      1,
      job.ownerId,
      job._id,
      'extracting_requirements',
      5,
    );
    expect(repositories.kits.saveGeneratedKit).toHaveBeenCalledWith(
      job.ownerId,
      job.kitId,
      generatedKit,
      [],
    );
    expect(repositories.generationJobs.complete).toHaveBeenCalledWith(job.ownerId, job._id);
    expect(repositories.generationJobs.fail).not.toHaveBeenCalled();
  });

  it('uses the standard generator when the owner has the free plan', async () => {
    const standard = vi.fn(async () => createValidKit());
    const grounded = vi.fn(async () => createValidKit());
    const hasGroundedResearchAccess = vi.fn(async () => false);
    const worker = new GenerationWorker(
      repositories,
      { grounded, hasGroundedResearchAccess, standard },
      CONFIG,
      () => NOW,
    );

    await worker.runOnce();

    expect(hasGroundedResearchAccess).toHaveBeenCalledWith(job.ownerId);
    expect(standard).toHaveBeenCalledOnce();
    expect(grounded).not.toHaveBeenCalled();
  });

  it('uses grounded research only when the owner has a paid plan', async () => {
    const standard = vi.fn(async () => createValidKit());
    const grounded = vi.fn(async () => createValidKit());
    const hasGroundedResearchAccess = vi.fn(async () => true);
    const worker = new GenerationWorker(
      repositories,
      { grounded, hasGroundedResearchAccess, standard },
      CONFIG,
      () => NOW,
    );

    await worker.runOnce();

    expect(grounded).toHaveBeenCalledOnce();
    expect(standard).not.toHaveBeenCalled();
  });

  it('persists a structured retryable failure on both records', async () => {
    const generateKit = vi.fn(async () => {
      throw new GenerationExecutionError('UPSTREAM_TIMEOUT', 'Research timed out.', true);
    });
    const worker = new GenerationWorker(repositories, generateKit, CONFIG, () => NOW);

    await expect(worker.runOnce()).resolves.toBe(true);

    expect(repositories.generationJobs.fail).toHaveBeenCalledWith(job.ownerId, job._id, {
      code: 'UPSTREAM_TIMEOUT',
      message: 'Research timed out.',
      retryable: true,
    });
    expect(repositories.kits.updateProgress).toHaveBeenLastCalledWith(
      job.ownerId,
      job.kitId,
      'failed',
      {
        stage: 'failed',
        percent: 5,
        message: 'Research timed out.',
      },
    );
  });

  it('preserves provider retryability and the latest reported progress on failure', async () => {
    const providerError = Object.assign(
      new Error('The language model is temporarily unavailable.'),
      {
        code: 'LLM_TEMPORARILY_UNAVAILABLE',
        retryable: true,
      },
    );
    const generateKit = vi.fn(async (_input, context) => {
      await context.onProgress?.({
        stage: 'generating_questions',
        percent: 55,
        message: 'Generating interview questions.',
      });
      throw providerError;
    });
    const worker = new GenerationWorker(repositories, generateKit, CONFIG, () => NOW);

    await worker.runOnce();

    expect(repositories.generationJobs.fail).toHaveBeenCalledWith(job.ownerId, job._id, {
      code: 'LLM_TEMPORARILY_UNAVAILABLE',
      message: 'The language model is temporarily unavailable.',
      retryable: true,
    });
    expect(repositories.kits.updateProgress).toHaveBeenLastCalledWith(
      job.ownerId,
      job.kitId,
      'failed',
      {
        stage: 'failed',
        percent: 55,
        message: 'The language model is temporarily unavailable.',
      },
    );
  });

  it('forwards pipeline progress and warnings into persistent records', async () => {
    const generatedKit = createValidKit();
    const generateKit = vi.fn(async (_input, context) => {
      await context.onProgress?.({
        stage: 'researching_company',
        percent: 18,
        message: 'Researching the company website.',
      });
      await context.onWarnings?.([
        {
          code: 'ROBOTS_UNAVAILABLE',
          message: 'robots.txt could not be loaded.',
          sourceUrl: 'https://example.com/robots.txt',
        },
      ]);
      return generatedKit;
    });
    const worker = new GenerationWorker(repositories, generateKit, CONFIG, () => NOW);

    await worker.runOnce();

    expect(repositories.generationJobs.updateProgress).toHaveBeenLastCalledWith(
      job.ownerId,
      job._id,
      'researching_company',
      18,
    );
    expect(repositories.kits.saveGeneratedKit).toHaveBeenCalledWith(
      job.ownerId,
      job.kitId,
      generatedKit,
      [
        {
          code: 'ROBOTS_UNAVAILABLE',
          message: 'robots.txt could not be loaded.',
          sourceUrl: 'https://example.com/robots.txt',
        },
      ],
    );
  });

  it('returns false without doing work when the queue is empty', async () => {
    repositories.generationJobs.claimNext.mockResolvedValue(null);
    const worker = new GenerationWorker(
      repositories,
      vi.fn(async () => createValidKit()),
      CONFIG,
      () => NOW,
    );

    await expect(worker.runOnce()).resolves.toBe(false);
    expect(repositories.kits.findOwnedById).not.toHaveBeenCalled();
  });

  it('synchronizes kit status when stale jobs are recovered', async () => {
    const requeuedJob = { ...job, status: 'queued' as const, stage: 'queued' as const };
    const failedJob: GenerationJobDocument = {
      ...job,
      status: 'failed',
      stage: 'failed',
      error: {
        code: 'WORKER_RETRY_LIMIT_REACHED',
        message: 'Attempts exhausted.',
        retryable: false,
      },
      completedAt: NOW,
    };
    repositories.generationJobs.recoverStale.mockResolvedValue({
      requeuedJobs: [requeuedJob],
      failedJobs: [failedJob],
    });
    const worker = new GenerationWorker(
      repositories,
      vi.fn(async () => createValidKit()),
      CONFIG,
      () => NOW,
    );

    await worker.recoverStale();

    expect(repositories.generationJobs.recoverStale).toHaveBeenCalledWith(
      new Date(NOW.getTime() - CONFIG.staleAfterMs),
      CONFIG.maxAttempts,
    );
    expect(repositories.kits.updateProgress).toHaveBeenCalledWith(
      job.ownerId,
      job.kitId,
      'queued',
      expect.objectContaining({ stage: 'queued', percent: 0 }),
    );
    expect(repositories.kits.updateProgress).toHaveBeenCalledWith(
      job.ownerId,
      job.kitId,
      'failed',
      expect.objectContaining({ stage: 'failed', message: 'Attempts exhausted.' }),
    );
  });
});
