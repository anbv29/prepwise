import type { Db } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

import { COLLECTION_NAMES, DATABASE_INDEXES, ensureDatabaseIndexes } from './indexes.js';

describe('database indexes', () => {
  it('defines ownership, uniqueness, queue, and TTL indexes', () => {
    const indexNames = DATABASE_INDEXES.flatMap((plan) =>
      plan.indexes.map((index) => index.options.name),
    );

    expect(indexNames).toContain('users_email_unique');
    expect(indexNames).toContain('sessions_expiry_ttl');
    expect(indexNames).toContain('kits_owner_updated');
    expect(indexNames).toContain('jobs_owner_idempotency_unique');
    expect(indexNames).toContain('jobs_status_created');
    expect(indexNames).toContain('research_expiry_ttl');
    expect(indexNames).toContain('practice_owner_kit_unique');
  });

  it('configures session and research expiry as MongoDB TTL indexes', () => {
    const ttlIndexes = DATABASE_INDEXES.flatMap((plan) => plan.indexes).filter(
      (index) => index.options.expireAfterSeconds === 0,
    );

    expect(ttlIndexes.map((index) => index.options.name)).toEqual([
      'sessions_expiry_ttl',
      'research_expiry_ttl',
    ]);
  });

  it('creates every declared index on its intended collection', async () => {
    const createIndex = vi.fn(async () => 'created-index');
    const collection = vi.fn(() => ({ createIndex }));
    const database = { collection } as unknown as Db;

    await ensureDatabaseIndexes(database);

    expect(collection).toHaveBeenCalledTimes(Object.keys(COLLECTION_NAMES).length);
    expect(createIndex).toHaveBeenCalledTimes(12);
  });
});
