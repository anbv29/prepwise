import { createHash, randomUUID } from 'node:crypto';
import type { ObjectId } from 'mongodb';
import { z } from 'zod';

import type {
  GenerationJobDocument,
  GenerationJobRepository,
  KitDocument,
  KitRepository,
} from '@prep-kit/database';

export const CreateKitInputSchema = z.object({
  jobDescription: z.string().trim().min(20).max(100_000),
  companyUrl: z
    .string()
    .url()
    .max(2_048)
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
      message: 'Company URL must use HTTP or HTTPS.',
    }),
  daysAvailable: z.number().int().min(1).max(30),
});

const idempotencyKeySchema = z.string().trim().min(8).max(128);

export type CreateKitInput = z.infer<typeof CreateKitInputSchema>;

type RequestKitRepository = Pick<
  KitRepository,
  'createDraft' | 'deleteOwnedPending' | 'findOwnedById' | 'updateProgress'
>;
type RequestJobRepository = Pick<
  GenerationJobRepository,
  'create' | 'findOwnedById' | 'findOwnedByIdempotencyKey' | 'retryOwned'
>;

export interface GenerationRequestResult {
  idempotencyKey: string;
  job: GenerationJobDocument;
  kit: KitDocument;
  reused: boolean;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('That idempotency key was already used with different input.');
    this.name = 'IdempotencyConflictError';
  }
}

export class GenerationRetryUnavailableError extends Error {
  constructor() {
    super('This generation job cannot be retried.');
    this.name = 'GenerationRetryUnavailableError';
  }
}

function inputFingerprint(input: CreateKitInput) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        companyUrl: input.companyUrl,
        daysAvailable: input.daysAvailable,
        jobDescription: input.jobDescription,
      }),
    )
    .digest('hex');
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export class GenerationRequestService {
  constructor(
    private readonly kits: RequestKitRepository,
    private readonly jobs: RequestJobRepository,
    private readonly maxAttempts: number,
  ) {}

  async create(
    ownerId: ObjectId,
    unparsedInput: unknown,
    requestedIdempotencyKey?: string,
  ): Promise<GenerationRequestResult> {
    const input = CreateKitInputSchema.parse(unparsedInput);
    const idempotencyKey = idempotencyKeySchema.parse(requestedIdempotencyKey ?? randomUUID());
    const fingerprint = inputFingerprint(input);
    const existingJob = await this.jobs.findOwnedByIdempotencyKey(ownerId, idempotencyKey);

    if (existingJob) {
      return this.resolveExisting(ownerId, existingJob, fingerprint, idempotencyKey);
    }

    const kit = await this.kits.createDraft({
      ownerId,
      input,
      inputFingerprint: fingerprint,
    });
    let job: GenerationJobDocument;

    try {
      const wasQueued = await this.kits.updateProgress(ownerId, kit._id, 'queued', {
        stage: 'queued',
        percent: 0,
        message: 'Waiting for a generation worker.',
      });

      if (!wasQueued) {
        throw new Error('New kit draft could not be queued.');
      }

      job = await this.jobs.create({ ownerId, kitId: kit._id, idempotencyKey });
    } catch (error) {
      await this.kits.deleteOwnedPending(ownerId, kit._id);

      if (isDuplicateKeyError(error)) {
        const racedJob = await this.jobs.findOwnedByIdempotencyKey(ownerId, idempotencyKey);

        if (racedJob) {
          return this.resolveExisting(ownerId, racedJob, fingerprint, idempotencyKey);
        }
      }

      throw error;
    }

    const queuedKit = await this.kits.findOwnedById(ownerId, kit._id);

    if (!queuedKit) {
      throw new Error('Queued kit could not be reloaded.');
    }

    return { idempotencyKey, job, kit: queuedKit, reused: false };
  }

  async retry(ownerId: ObjectId, jobId: ObjectId) {
    const job = await this.jobs.findOwnedById(ownerId, jobId);

    if (!job) {
      return null;
    }

    const retried = await this.jobs.retryOwned(ownerId, jobId, this.maxAttempts);

    if (!retried) {
      throw new GenerationRetryUnavailableError();
    }

    const kitQueued = await this.kits.updateProgress(ownerId, retried.kitId, 'queued', {
      stage: 'queued',
      percent: 0,
      message: 'Waiting for a generation retry.',
    });

    if (!kitQueued) {
      throw new Error('The kit belonging to this retry could not be requeued.');
    }

    return retried;
  }

  private async resolveExisting(
    ownerId: ObjectId,
    job: GenerationJobDocument,
    fingerprint: string,
    idempotencyKey: string,
  ): Promise<GenerationRequestResult> {
    const kit = await this.kits.findOwnedById(ownerId, job.kitId);

    if (!kit) {
      throw new Error('An idempotent job references a missing kit.');
    }

    if (kit.inputFingerprint !== fingerprint) {
      throw new IdempotencyConflictError();
    }

    return { idempotencyKey, job, kit, reused: true };
  }
}
