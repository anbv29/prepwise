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

    expect(generateKit).toHaveBeenCalledWith(kit.input, { researchedAt: NOW.toISOString() });
    expect(repositories.generationJobs.updateProgress).toHaveBeenNthCalledWith(
      1,
      job.ownerId,
      job._id,
      'extracting_requirements',
      5,
    );
    expect(repositories.generationJobs.updateProgress).toHaveBeenNthCalledWith(
      2,
      job.ownerId,
      job._id,
      'validating',
      90,
    );
    expect(repositories.kits.saveGeneratedKit).toHaveBeenCalledWith(
      job.ownerId,
      job.kitId,
      generatedKit,
    );
    expect(repositories.generationJobs.complete).toHaveBeenCalledWith(job.ownerId, job._id);
    expect(repositories.generationJobs.fail).not.toHaveBeenCalled();
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
