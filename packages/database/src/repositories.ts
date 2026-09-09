import { ObjectId, type Collection, type Db } from 'mongodb';
import type { ZodError, ZodType } from 'zod';

import { KitSchema, type Kit } from '@prep-kit/contracts';

import { COLLECTION_NAMES } from './indexes.js';
import {
  GenerationErrorSchema,
  GenerationJobDocumentSchema,
  GenerationProgressSchema,
  KitDocumentSchema,
  KitInputSchema,
  PracticeProgressDocumentSchema,
  ResearchCacheDocumentSchema,
  ResearchWarningSchema,
  SessionDocumentSchema,
  UserDocumentSchema,
  type FlashcardPractice,
  type GenerationError,
  type GenerationJobDocument,
  type GenerationProgress,
  type GenerationStage,
  type KitDocument,
  type KitInput,
  type PracticeProgressDocument,
  type ResearchCacheDocument,
  type ResearchWarning,
  type SessionDocument,
  type UserDocument,
} from './models.js';

type Clock = () => Date;

export class DatabaseRecordError extends Error {
  readonly entityName: string;

  constructor(entityName: string, cause: ZodError) {
    super(`Stored ${entityName} document failed validation.`, { cause });
    this.name = 'DatabaseRecordError';
    this.entityName = entityName;
  }
}

function parseRecord<T>(schema: ZodType<T>, value: unknown, entityName: string): T {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new DatabaseRecordError(entityName, parsed.error);
  }

  return parsed.data;
}

function parseOptionalRecord<T>(
  schema: ZodType<T>,
  value: unknown | null,
  entityName: string,
): T | null {
  return value === null ? null : parseRecord(schema, value, entityName);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export interface DatabaseCollections {
  users: Collection<UserDocument>;
  sessions: Collection<SessionDocument>;
  kits: Collection<KitDocument>;
  generationJobs: Collection<GenerationJobDocument>;
  researchCache: Collection<ResearchCacheDocument>;
  practiceProgress: Collection<PracticeProgressDocument>;
}

export function createDatabaseCollections(database: Db): DatabaseCollections {
  return {
    users: database.collection<UserDocument>(COLLECTION_NAMES.users),
    sessions: database.collection<SessionDocument>(COLLECTION_NAMES.sessions),
    kits: database.collection<KitDocument>(COLLECTION_NAMES.kits),
    generationJobs: database.collection<GenerationJobDocument>(COLLECTION_NAMES.generationJobs),
    researchCache: database.collection<ResearchCacheDocument>(COLLECTION_NAMES.researchCache),
    practiceProgress: database.collection<PracticeProgressDocument>(
      COLLECTION_NAMES.practiceProgress,
    ),
  };
}

export class UserRepository {
  constructor(
    private readonly users: Collection<UserDocument>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async create(email: string, passwordHash: string) {
    const now = this.clock();
    const document = UserDocumentSchema.parse({
      _id: new ObjectId(),
      email: normalizeEmail(email),
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    await this.users.insertOne(document);
    return document;
  }

  async findByEmail(email: string) {
    const document = await this.users.findOne({ email: normalizeEmail(email) });
    return parseOptionalRecord(UserDocumentSchema, document, 'user');
  }

  async findById(userId: ObjectId) {
    const document = await this.users.findOne({ _id: userId });
    return parseOptionalRecord(UserDocumentSchema, document, 'user');
  }
}

export class SessionRepository {
  constructor(
    private readonly sessions: Collection<SessionDocument>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async create(userId: ObjectId, tokenHash: string, expiresAt: Date) {
    const now = this.clock();
    const document = SessionDocumentSchema.parse({
      _id: new ObjectId(),
      userId,
      tokenHash,
      expiresAt,
      createdAt: now,
      lastSeenAt: now,
    });

    await this.sessions.insertOne(document);
    return document;
  }

  async findValidByTokenHash(tokenHash: string) {
    const document = await this.sessions.findOne({
      tokenHash,
      expiresAt: { $gt: this.clock() },
    });
    return parseOptionalRecord(SessionDocumentSchema, document, 'session');
  }

  async deleteByTokenHash(tokenHash: string) {
    const result = await this.sessions.deleteOne({ tokenHash });
    return result.deletedCount > 0;
  }

  async deleteForUser(userId: ObjectId) {
    const result = await this.sessions.deleteMany({ userId });
    return result.deletedCount;
  }
}

export interface CreateKitDocumentInput {
  ownerId: ObjectId;
  input: KitInput;
  inputFingerprint: string;
}

export type KitProgressStatus = 'queued' | 'generating' | 'failed';

export class KitRepository {
  constructor(
    private readonly kits: Collection<KitDocument>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async createDraft({ ownerId, input, inputFingerprint }: CreateKitDocumentInput) {
    const now = this.clock();
    const document = KitDocumentSchema.parse({
      _id: new ObjectId(),
      ownerId,
      input: KitInputSchema.parse(input),
      inputFingerprint,
      status: 'draft',
      progress: {
        stage: 'queued',
        percent: 0,
        message: 'Draft created.',
      },
      kit: null,
      warnings: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    await this.kits.insertOne(document);
    return document;
  }

  async findOwnedById(ownerId: ObjectId, kitId: ObjectId) {
    const document = await this.kits.findOne({ _id: kitId, ownerId });
    return parseOptionalRecord(KitDocumentSchema, document, 'kit');
  }

  async listForOwner(ownerId: ObjectId, limit = 50) {
    const documents = await this.kits
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    return documents.map((document) => parseRecord(KitDocumentSchema, document, 'kit'));
  }

  async updateProgress(
    ownerId: ObjectId,
    kitId: ObjectId,
    status: KitProgressStatus,
    progress: GenerationProgress,
  ) {
    const parsedProgress = GenerationProgressSchema.parse(progress);

    if ((status === 'failed') !== (parsedProgress.stage === 'failed')) {
      throw new RangeError('Failed kit status and failed progress stage must be updated together.');
    }

    const result = await this.kits.updateOne(
      { _id: kitId, ownerId },
      {
        $set: {
          status,
          progress: parsedProgress,
          updatedAt: this.clock(),
        },
        $inc: { version: 1 },
      },
    );

    return result.matchedCount > 0;
  }

  async saveGeneratedKit(
    ownerId: ObjectId,
    kitId: ObjectId,
    generatedKit: Kit,
    warnings: readonly ResearchWarning[] = [],
  ) {
    const result = await this.kits.updateOne(
      { _id: kitId, ownerId },
      {
        $set: {
          status: 'ready',
          progress: {
            stage: 'complete',
            percent: 100,
            message: 'Kit generation complete.',
          },
          kit: KitSchema.parse(generatedKit),
          warnings: warnings.map((warning) => ResearchWarningSchema.parse(warning)),
          updatedAt: this.clock(),
        },
        $inc: { version: 1 },
      },
    );

    return result.matchedCount > 0;
  }
}

export interface CreateGenerationJobInput {
  ownerId: ObjectId;
  kitId: ObjectId;
  idempotencyKey: string;
}

export class GenerationJobRepository {
  constructor(
    private readonly jobs: Collection<GenerationJobDocument>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async create({ ownerId, kitId, idempotencyKey }: CreateGenerationJobInput) {
    const now = this.clock();
    const document = GenerationJobDocumentSchema.parse({
      _id: new ObjectId(),
      ownerId,
      kitId,
      idempotencyKey,
      status: 'queued',
      stage: 'queued',
      progressPercent: 0,
      attempts: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    });

    await this.jobs.insertOne(document);
    return document;
  }

  async findOwnedById(ownerId: ObjectId, jobId: ObjectId) {
    const document = await this.jobs.findOne({ _id: jobId, ownerId });
    return parseOptionalRecord(GenerationJobDocumentSchema, document, 'generation job');
  }

  async markRunning(ownerId: ObjectId, jobId: ObjectId) {
    const now = this.clock();
    const result = await this.jobs.updateOne(
      { _id: jobId, ownerId, status: 'queued' },
      {
        $set: {
          status: 'running',
          updatedAt: now,
          startedAt: now,
        },
        $inc: { attempts: 1 },
      },
    );

    return result.matchedCount > 0;
  }

  async updateProgress(
    ownerId: ObjectId,
    jobId: ObjectId,
    stage: GenerationStage,
    progressPercent: number,
  ) {
    const progress = GenerationProgressSchema.parse({
      stage,
      percent: progressPercent,
      message: '',
    });
    const result = await this.jobs.updateOne(
      { _id: jobId, ownerId, status: 'running' },
      {
        $set: {
          stage: progress.stage,
          progressPercent: progress.percent,
          updatedAt: this.clock(),
        },
      },
    );

    return result.matchedCount > 0;
  }

  async complete(ownerId: ObjectId, jobId: ObjectId) {
    const now = this.clock();
    const result = await this.jobs.updateOne(
      { _id: jobId, ownerId, status: 'running' },
      {
        $set: {
          status: 'completed',
          stage: 'complete',
          progressPercent: 100,
          error: null,
          updatedAt: now,
          completedAt: now,
        },
      },
    );

    return result.matchedCount > 0;
  }

  async fail(ownerId: ObjectId, jobId: ObjectId, error: GenerationError) {
    const now = this.clock();
    const result = await this.jobs.updateOne(
      { _id: jobId, ownerId, status: { $in: ['queued', 'running'] } },
      {
        $set: {
          status: 'failed',
          stage: 'failed',
          error: GenerationErrorSchema.parse(error),
          updatedAt: now,
          completedAt: now,
        },
      },
    );

    return result.matchedCount > 0;
  }
}

export class ResearchCacheRepository {
  constructor(
    private readonly cache: Collection<ResearchCacheDocument>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async findFreshByUrlHash(urlHash: string) {
    const document = await this.cache.findOne({
      urlHash,
      expiresAt: { $gt: this.clock() },
    });
    return parseOptionalRecord(ResearchCacheDocumentSchema, document, 'research cache');
  }

  async save(document: ResearchCacheDocument) {
    const parsed = ResearchCacheDocumentSchema.parse(document);
    const { _id, ...fields } = parsed;
    await this.cache.updateOne(
      { urlHash: parsed.urlHash },
      {
        $set: fields,
        $setOnInsert: { _id },
      },
      { upsert: true },
    );
  }
}

export class PracticeProgressRepository {
  constructor(
    private readonly progress: Collection<PracticeProgressDocument>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async findForKit(ownerId: ObjectId, kitId: ObjectId) {
    const document = await this.progress.findOne({ ownerId, kitId });
    return parseOptionalRecord(PracticeProgressDocumentSchema, document, 'practice progress');
  }

  async save(document: PracticeProgressDocument) {
    const parsed = PracticeProgressDocumentSchema.parse(document);
    const { _id, ...fields } = parsed;
    await this.progress.updateOne(
      { ownerId: parsed.ownerId, kitId: parsed.kitId },
      {
        $set: fields,
        $setOnInsert: { _id },
      },
      { upsert: true },
    );
  }

  async createEmpty(ownerId: ObjectId, kitId: ObjectId) {
    const now = this.clock();
    const document = PracticeProgressDocumentSchema.parse({
      _id: new ObjectId(),
      ownerId,
      kitId,
      cards: [] as FlashcardPractice[],
      createdAt: now,
      updatedAt: now,
    });

    await this.save(document);
    return document;
  }
}

export interface DatabaseRepositories {
  users: UserRepository;
  sessions: SessionRepository;
  kits: KitRepository;
  generationJobs: GenerationJobRepository;
  researchCache: ResearchCacheRepository;
  practiceProgress: PracticeProgressRepository;
}

export function createDatabaseRepositories(
  database: Db,
  clock: Clock = () => new Date(),
): DatabaseRepositories {
  const collections = createDatabaseCollections(database);

  return {
    users: new UserRepository(collections.users, clock),
    sessions: new SessionRepository(collections.sessions, clock),
    kits: new KitRepository(collections.kits, clock),
    generationJobs: new GenerationJobRepository(collections.generationJobs, clock),
    researchCache: new ResearchCacheRepository(collections.researchCache, clock),
    practiceProgress: new PracticeProgressRepository(collections.practiceProgress, clock),
  };
}
