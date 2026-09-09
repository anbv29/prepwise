import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  GenerationJobDocument,
  GenerationJobRepository,
  KitDocument,
  KitInput,
  KitRepository,
} from '@prep-kit/database';

import {
  GenerationRequestService,
  GenerationRetryUnavailableError,
  IdempotencyConflictError,
} from '../src/generation/requests.js';

const NOW = new Date('2026-09-09T10:00:00.000Z');
const OWNER_ID = new ObjectId();
const INPUT: KitInput = {
  jobDescription: 'Senior TypeScript engineer building reliable backend services.',
  companyUrl: 'https://example.com',
  daysAvailable: 5,
};

function kitDocument(input: KitInput = INPUT): KitDocument {
  return {
    _id: new ObjectId(),
    ownerId: OWNER_ID,
    input,
    inputFingerprint: 'a'.repeat(64),
    status: 'draft',
    progress: { stage: 'queued', percent: 0, message: 'Draft created.' },
    kit: null,
    warnings: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function jobDocument(kitId: ObjectId, idempotencyKey: string): GenerationJobDocument {
  return {
    _id: new ObjectId(),
    ownerId: OWNER_ID,
    kitId,
    idempotencyKey,
    status: 'queued',
    stage: 'queued',
    progressPercent: 0,
    attempts: 0,
    error: null,
    createdAt: NOW,
    updatedAt: NOW,
    startedAt: null,
    completedAt: null,
  };
}

describe('GenerationRequestService', () => {
  let draft: KitDocument;
  let queuedKit: KitDocument;
  let job: GenerationJobDocument;
  let createDraft: ReturnType<typeof vi.fn<KitRepository['createDraft']>>;
  let deleteOwnedPending: ReturnType<typeof vi.fn<KitRepository['deleteOwnedPending']>>;
  let findOwnedKitById: ReturnType<typeof vi.fn<KitRepository['findOwnedById']>>;
  let updateKitProgress: ReturnType<typeof vi.fn<KitRepository['updateProgress']>>;
  let createJob: ReturnType<typeof vi.fn<GenerationJobRepository['create']>>;
  let findOwnedJobById: ReturnType<typeof vi.fn<GenerationJobRepository['findOwnedById']>>;
  let findByIdempotencyKey: ReturnType<
    typeof vi.fn<GenerationJobRepository['findOwnedByIdempotencyKey']>
  >;
  let retryOwned: ReturnType<typeof vi.fn<GenerationJobRepository['retryOwned']>>;
  let kits: Pick<
    KitRepository,
    'createDraft' | 'deleteOwnedPending' | 'findOwnedById' | 'updateProgress'
  >;
  let jobs: Pick<
    GenerationJobRepository,
    'create' | 'findOwnedById' | 'findOwnedByIdempotencyKey' | 'retryOwned'
  >;

  beforeEach(() => {
    draft = kitDocument();
    queuedKit = {
      ...draft,
      status: 'queued',
      progress: { stage: 'queued', percent: 0, message: 'Waiting for a generation worker.' },
      version: 2,
    };
    job = jobDocument(draft._id, 'request-key-123');
    createDraft = vi.fn(async () => draft);
    deleteOwnedPending = vi.fn(async () => true);
    findOwnedKitById = vi.fn(async () => queuedKit);
    updateKitProgress = vi.fn(async () => true);
    kits = {
      createDraft,
      deleteOwnedPending,
      findOwnedById: findOwnedKitById,
      updateProgress: updateKitProgress,
    };
    createJob = vi.fn(async () => job);
    findOwnedJobById = vi.fn(async () => job);
    findByIdempotencyKey = vi.fn(async () => null);
    retryOwned = vi.fn(async () => null);
    jobs = {
      create: createJob,
      findOwnedById: findOwnedJobById,
      findOwnedByIdempotencyKey: findByIdempotencyKey,
      retryOwned,
    };
  });

  it('creates a queued kit and persistent job', async () => {
    const service = new GenerationRequestService(kits, jobs, 3);
    const result = await service.create(OWNER_ID, INPUT, 'request-key-123');

    expect(result).toMatchObject({ idempotencyKey: 'request-key-123', reused: false });
    expect(createDraft).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      input: INPUT,
      inputFingerprint: expect.stringMatching(/^[a-f\d]{64}$/u),
    });
    expect(updateKitProgress).toHaveBeenCalledWith(OWNER_ID, draft._id, 'queued', {
      stage: 'queued',
      percent: 0,
      message: 'Waiting for a generation worker.',
    });
    expect(createJob).toHaveBeenCalledWith({
      ownerId: OWNER_ID,
      kitId: draft._id,
      idempotencyKey: 'request-key-123',
    });
  });

  it('returns the original job for an identical idempotent request', async () => {
    const firstService = new GenerationRequestService(kits, jobs, 3);
    await firstService.create(OWNER_ID, INPUT, 'request-key-123');
    const createdFingerprint = createDraft.mock.calls[0]?.[0].inputFingerprint as string;
    queuedKit.inputFingerprint = createdFingerprint;
    findByIdempotencyKey.mockResolvedValue(job);

    const result = await firstService.create(OWNER_ID, INPUT, 'request-key-123');

    expect(result.reused).toBe(true);
    expect(createDraft).toHaveBeenCalledTimes(1);
  });

  it('rejects an idempotency key reused for different input', async () => {
    findByIdempotencyKey.mockResolvedValue(job);
    const service = new GenerationRequestService(kits, jobs, 3);

    await expect(service.create(OWNER_ID, INPUT, 'request-key-123')).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it('removes a pending kit when job creation fails', async () => {
    createJob.mockRejectedValue(new Error('database unavailable'));
    const service = new GenerationRequestService(kits, jobs, 3);

    await expect(service.create(OWNER_ID, INPUT, 'request-key-123')).rejects.toThrow(
      'database unavailable',
    );
    expect(deleteOwnedPending).toHaveBeenCalledWith(OWNER_ID, draft._id);
  });

  it('only retries a failed job when the repository confirms it is retryable', async () => {
    const service = new GenerationRequestService(kits, jobs, 3);

    await expect(service.retry(OWNER_ID, job._id)).rejects.toBeInstanceOf(
      GenerationRetryUnavailableError,
    );

    const retriedJob = { ...job, status: 'queued' as const, attempts: 1 };
    retryOwned.mockResolvedValue(retriedJob);
    await expect(service.retry(OWNER_ID, job._id)).resolves.toBe(retriedJob);
    expect(retryOwned).toHaveBeenLastCalledWith(OWNER_ID, job._id, 3);
  });
});
