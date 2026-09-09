import type { CreateIndexesOptions, Db, IndexSpecification } from 'mongodb';

export const COLLECTION_NAMES = {
  users: 'users',
  sessions: 'sessions',
  kits: 'kits',
  generationJobs: 'generation_jobs',
  researchCache: 'research_cache',
  practiceProgress: 'practice_progress',
} as const;

export interface DatabaseIndexDefinition {
  key: IndexSpecification;
  options: CreateIndexesOptions;
}

export interface CollectionIndexPlan {
  collectionName: string;
  indexes: readonly DatabaseIndexDefinition[];
}

export const DATABASE_INDEXES: readonly CollectionIndexPlan[] = [
  {
    collectionName: COLLECTION_NAMES.users,
    indexes: [
      {
        key: { email: 1 },
        options: { name: 'users_email_unique', unique: true },
      },
    ],
  },
  {
    collectionName: COLLECTION_NAMES.sessions,
    indexes: [
      {
        key: { tokenHash: 1 },
        options: { name: 'sessions_token_hash_unique', unique: true },
      },
      {
        key: { expiresAt: 1 },
        options: { name: 'sessions_expiry_ttl', expireAfterSeconds: 0 },
      },
      {
        key: { userId: 1 },
        options: { name: 'sessions_user' },
      },
    ],
  },
  {
    collectionName: COLLECTION_NAMES.kits,
    indexes: [
      {
        key: { ownerId: 1, updatedAt: -1 },
        options: { name: 'kits_owner_updated' },
      },
      {
        key: { ownerId: 1, inputFingerprint: 1 },
        options: { name: 'kits_owner_fingerprint' },
      },
    ],
  },
  {
    collectionName: COLLECTION_NAMES.generationJobs,
    indexes: [
      {
        key: { ownerId: 1, idempotencyKey: 1 },
        options: { name: 'jobs_owner_idempotency_unique', unique: true },
      },
      {
        key: { status: 1, createdAt: 1 },
        options: { name: 'jobs_status_created' },
      },
      {
        key: { ownerId: 1, kitId: 1, createdAt: -1 },
        options: { name: 'jobs_owner_kit_created' },
      },
    ],
  },
  {
    collectionName: COLLECTION_NAMES.researchCache,
    indexes: [
      {
        key: { urlHash: 1 },
        options: { name: 'research_url_hash_unique', unique: true },
      },
      {
        key: { expiresAt: 1 },
        options: { name: 'research_expiry_ttl', expireAfterSeconds: 0 },
      },
    ],
  },
  {
    collectionName: COLLECTION_NAMES.practiceProgress,
    indexes: [
      {
        key: { ownerId: 1, kitId: 1 },
        options: { name: 'practice_owner_kit_unique', unique: true },
      },
    ],
  },
];

export async function ensureDatabaseIndexes(database: Db) {
  for (const collectionPlan of DATABASE_INDEXES) {
    const collection = database.collection(collectionPlan.collectionName);

    for (const index of collectionPlan.indexes) {
      await collection.createIndex(index.key, index.options);
    }
  }
}
