import type { ObjectId } from 'mongodb';

import type {
  GenerationError,
  GenerationJobDocument,
  GenerationJobRepository,
  GenerationProgress,
  GenerationStage,
  KitRepository,
  ResearchWarning,
} from '@prep-kit/database';
import type { KitGenerator } from '@prep-kit/pipeline';

import type { WorkerConfig } from './config.js';

type WorkerJobRepository = Pick<
  GenerationJobRepository,
  'claimNext' | 'complete' | 'fail' | 'recoverStale' | 'updateProgress'
>;
type WorkerKitRepository = Pick<
  KitRepository,
  'findOwnedById' | 'saveGeneratedKit' | 'updateProgress'
>;

export interface GenerationWorkerRepositories {
  generationJobs: WorkerJobRepository;
  kits: WorkerKitRepository;
}

export interface GenerationWorkerGenerators {
  grounded: KitGenerator;
  hasGroundedResearchAccess: (ownerId: ObjectId) => Promise<boolean>;
  standard: KitGenerator;
}

type GenerationWorkerGeneratorInput = GenerationWorkerGenerators | KitGenerator;

export class GenerationExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'GenerationExecutionError';
    this.code = code;
    this.retryable = retryable;
  }
}

function normalizeGenerationError(error: unknown): GenerationError {
  if (error instanceof GenerationExecutionError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }

  if (error instanceof Error) {
    const structured = error as Error & { code?: unknown; retryable?: unknown };

    if (typeof structured.code === 'string' && typeof structured.retryable === 'boolean') {
      return {
        code: structured.code,
        message: structured.message || 'Kit generation failed.',
        retryable: structured.retryable,
      };
    }

    const retryableInfrastructureError = [
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongoServerSelectionError',
    ].includes(error.name);

    return {
      code: retryableInfrastructureError ? 'INFRASTRUCTURE_UNAVAILABLE' : 'GENERATION_FAILED',
      message: error.message || 'Kit generation failed.',
      retryable: retryableInfrastructureError,
    };
  }

  return {
    code: 'GENERATION_FAILED',
    message: 'Kit generation failed.',
    retryable: false,
  };
}

export class GenerationWorker {
  private activeCycle: Promise<void> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private started = false;
  private lastRecoveryAt = 0;

  constructor(
    private readonly repositories: GenerationWorkerRepositories,
    private readonly generators: GenerationWorkerGeneratorInput,
    private readonly config: WorkerConfig,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async generatorFor(ownerId: ObjectId) {
    if (typeof this.generators === 'function') return this.generators;

    return (await this.generators.hasGroundedResearchAccess(ownerId))
      ? this.generators.grounded
      : this.generators.standard;
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.schedule(0);
  }

  async stop() {
    this.started = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    await this.activeCycle;
  }

  async runOnce() {
    const job = await this.repositories.generationJobs.claimNext(this.config.maxAttempts);

    if (!job) {
      return false;
    }

    await this.process(job);
    return true;
  }

  async recoverStale() {
    const staleBefore = new Date(this.clock().getTime() - this.config.staleAfterMs);
    const recovered = await this.repositories.generationJobs.recoverStale(
      staleBefore,
      this.config.maxAttempts,
    );

    for (const job of recovered.requeuedJobs) {
      await this.repositories.kits.updateProgress(job.ownerId, job.kitId, 'queued', {
        stage: 'queued',
        percent: 0,
        message: 'Recovered after an interrupted generation attempt.',
      });
    }

    for (const job of recovered.failedJobs) {
      await this.repositories.kits.updateProgress(job.ownerId, job.kitId, 'failed', {
        stage: 'failed',
        percent: job.progressPercent,
        message: job.error?.message ?? 'Generation retry limit reached.',
      });
    }

    this.lastRecoveryAt = this.clock().getTime();
    return recovered;
  }

  private schedule(delay: number) {
    this.timer = setTimeout(() => {
      this.activeCycle = this.cycle().finally(() => {
        this.activeCycle = null;

        if (this.started) {
          this.schedule(this.config.pollIntervalMs);
        }
      });
    }, delay);
  }

  private async cycle() {
    try {
      if (this.clock().getTime() - this.lastRecoveryAt >= 60_000) {
        await this.recoverStale();
      }

      while (this.started && (await this.runOnce())) {
        // Drain all currently queued jobs before returning to polling.
      }
    } catch (error) {
      console.error('Generation worker cycle failed.', error);
    }
  }

  private async process(job: GenerationJobDocument) {
    let latestProgressPercent = job.progressPercent;
    const warnings: ResearchWarning[] = [];

    try {
      const kitDocument = await this.repositories.kits.findOwnedById(job.ownerId, job.kitId);

      if (!kitDocument) {
        throw new GenerationExecutionError(
          'KIT_NOT_FOUND',
          'The kit belonging to this generation job no longer exists.',
          false,
        );
      }

      await this.report(job, {
        stage: 'extracting_requirements',
        percent: 5,
        message: 'Starting kit generation.',
      });
      const generateKit = await this.generatorFor(job.ownerId);
      const generatedKit = await generateKit(kitDocument.input, {
        researchedAt: this.clock().toISOString(),
        onProgress: async (progress) => {
          await this.report(job, progress);
          latestProgressPercent = progress.percent;
        },
        onWarnings: (reportedWarnings) => {
          warnings.splice(0, warnings.length, ...reportedWarnings);
        },
      });

      const kitSaved = await this.repositories.kits.saveGeneratedKit(
        job.ownerId,
        job.kitId,
        generatedKit,
        warnings,
      );

      if (!kitSaved) {
        throw new GenerationExecutionError(
          'KIT_SAVE_CONFLICT',
          'The generated kit could not be saved.',
          true,
        );
      }

      const jobCompleted = await this.repositories.generationJobs.complete(job.ownerId, job._id);

      if (!jobCompleted) {
        throw new Error('The generation job could not be marked complete.');
      }
    } catch (error) {
      const normalized = normalizeGenerationError(error);
      await this.repositories.generationJobs.fail(job.ownerId, job._id, normalized);
      await this.repositories.kits.updateProgress(job.ownerId, job.kitId, 'failed', {
        stage: 'failed',
        percent: latestProgressPercent,
        message: normalized.message,
      });
    }
  }

  private async report(job: GenerationJobDocument, progress: GenerationProgress) {
    const stage: GenerationStage = progress.stage;
    const [jobUpdated, kitUpdated] = await Promise.all([
      this.repositories.generationJobs.updateProgress(
        job.ownerId,
        job._id,
        stage,
        progress.percent,
      ),
      this.repositories.kits.updateProgress(job.ownerId, job.kitId, 'generating', progress),
    ]);

    if (!jobUpdated || !kitUpdated) {
      throw new Error('Generation progress could not be persisted.');
    }
  }
}
