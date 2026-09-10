import { ObjectId, type Collection, type Document } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

import type {
  GenerationJobDocument,
  KitDocument,
  PracticeProgressDocument,
  ResearchCacheDocument,
  SessionDocument,
  UserDocument,
} from './models.js';
import {
  GenerationJobRepository,
  KitRepository,
  PracticeProgressRepository,
  ResearchCacheRepository,
  SessionRepository,
  UserRepository,
} from './repositories.js';

const now = new Date('2026-09-09T10:00:00.000Z');
const clock = () => now;
const profile = { firstName: 'Ada', lastName: 'Lovelace', dateOfBirth: '1995-12-10' };

function collectionWithMethods<T extends Document>(methods: Record<string, unknown>) {
  return methods as unknown as Collection<T>;
}

describe('UserRepository', () => {
  it('normalizes email before inserting a user', async () => {
    const insertOne = vi.fn(async () => ({ acknowledged: true }));
    const repository = new UserRepository(
      collectionWithMethods<UserDocument>({ insertOne }),
      clock,
    );

    const user = await repository.create(' Engineer@Example.COM ', 'password-hash', profile);

    expect(user.email).toBe('engineer@example.com');
    expect(user.plan).toBe('free');
    expect(user).toMatchObject(profile);
    expect(insertOne).toHaveBeenCalledWith(user);
  });

  it('updates a subscription plan using a server-side repository operation', async () => {
    const userId = new ObjectId();
    const updatedUser: UserDocument = {
      _id: userId,
      email: 'engineer@example.com',
      passwordHash: 'password-hash',
      plan: 'focus',
      createdAt: now,
      updatedAt: now,
    };
    const findOneAndUpdate = vi.fn(async () => updatedUser);
    const repository = new UserRepository(
      collectionWithMethods<UserDocument>({ findOneAndUpdate }),
      clock,
    );

    await expect(repository.updatePlan(userId, 'focus')).resolves.toEqual(updatedUser);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId },
      { $set: { plan: 'focus', updatedAt: now } },
      { returnDocument: 'after' },
    );
  });
});

describe('SessionRepository', () => {
  it('only finds a session whose expiry is in the future', async () => {
    const findOne = vi.fn(async () => null);
    const repository = new SessionRepository(
      collectionWithMethods<SessionDocument>({ findOne }),
      clock,
    );

    await repository.findValidByTokenHash('a'.repeat(64));

    expect(findOne).toHaveBeenCalledWith({
      tokenHash: 'a'.repeat(64),
      expiresAt: { $gt: now },
    });
  });
});

describe('KitRepository', () => {
  it('scopes kit reads by both owner and kit id', async () => {
    const findOne = vi.fn(async () => null);
    const repository = new KitRepository(collectionWithMethods<KitDocument>({ findOne }), clock);
    const ownerId = new ObjectId();
    const kitId = new ObjectId();

    await repository.findOwnedById(ownerId, kitId);

    expect(findOne).toHaveBeenCalledWith({ _id: kitId, ownerId });
  });

  it('creates a validated draft with initial progress', async () => {
    const insertOne = vi.fn(async () => ({ acknowledged: true }));
    const repository = new KitRepository(collectionWithMethods<KitDocument>({ insertOne }), clock);
    const ownerId = new ObjectId();

    const document = await repository.createDraft({
      ownerId,
      input: {
        jobDescription: 'Senior Engineer',
        companyUrl: 'https://example.com',
        daysAvailable: 5,
      },
      inputFingerprint: 'fingerprint',
    });

    expect(document).toMatchObject({
      ownerId,
      status: 'draft',
      kit: null,
      version: 1,
      progress: {
        stage: 'queued',
        percent: 0,
      },
    });
    expect(insertOne).toHaveBeenCalledWith(document);
  });

  it('rejects inconsistent failed kit progress before writing', async () => {
    const updateOne = vi.fn(async () => ({ matchedCount: 1 }));
    const repository = new KitRepository(collectionWithMethods<KitDocument>({ updateOne }), clock);

    await expect(
      repository.updateProgress(new ObjectId(), new ObjectId(), 'failed', {
        stage: 'generating_questions',
        percent: 50,
        message: 'Still generating',
      }),
    ).rejects.toThrowError(RangeError);
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe('GenerationJobRepository', () => {
  it('claims a queued owned job and increments attempts once', async () => {
    const updateOne = vi.fn(async () => ({ matchedCount: 1 }));
    const repository = new GenerationJobRepository(
      collectionWithMethods<GenerationJobDocument>({ updateOne }),
      clock,
    );
    const ownerId = new ObjectId();
    const jobId = new ObjectId();

    expect(await repository.markRunning(ownerId, jobId)).toBe(true);
    expect(updateOne).toHaveBeenCalledWith(
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
  });

  it('atomically claims the oldest queued job below the attempt limit', async () => {
    const findOneAndUpdate = vi.fn(async () => null);
    const repository = new GenerationJobRepository(
      collectionWithMethods<GenerationJobDocument>({ findOneAndUpdate }),
      clock,
    );

    await expect(repository.claimNext(3)).resolves.toBeNull();
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { status: 'queued', attempts: { $lt: 3 } },
      {
        $set: {
          status: 'running',
          stage: 'extracting_requirements',
          progressPercent: 5,
          error: null,
          updatedAt: now,
          startedAt: now,
          completedAt: null,
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
  });

  it('retries only an owned, retryable failed job below the attempt limit', async () => {
    const findOneAndUpdate = vi.fn(async () => null);
    const repository = new GenerationJobRepository(
      collectionWithMethods<GenerationJobDocument>({ findOneAndUpdate }),
      clock,
    );
    const ownerId = new ObjectId();
    const jobId = new ObjectId();

    await repository.retryOwned(ownerId, jobId, 3);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: jobId,
        ownerId,
        status: 'failed',
        attempts: { $lt: 3 },
        'error.retryable': true,
      },
      {
        $set: {
          status: 'queued',
          stage: 'queued',
          progressPercent: 0,
          error: null,
          updatedAt: now,
          startedAt: null,
          completedAt: null,
        },
      },
      { returnDocument: 'after' },
    );
  });
});

describe('ResearchCacheRepository', () => {
  it('only returns an unexpired cached response', async () => {
    const findOne = vi.fn(async () => null);
    const repository = new ResearchCacheRepository(
      collectionWithMethods<ResearchCacheDocument>({ findOne }),
      clock,
    );

    await repository.findFreshByUrlHash('hash');

    expect(findOne).toHaveBeenCalledWith({
      urlHash: 'hash',
      expiresAt: { $gt: now },
    });
  });

  it('preserves the existing MongoDB id when upserting cached content', async () => {
    const updateOne = vi.fn(async () => ({ acknowledged: true }));
    const repository = new ResearchCacheRepository(
      collectionWithMethods<ResearchCacheDocument>({ updateOne }),
      clock,
    );
    const document: ResearchCacheDocument = {
      _id: new ObjectId(),
      urlHash: 'hash',
      url: 'https://example.com/careers',
      status: 'ok',
      content: 'Careers at Example',
      contentType: 'text/html',
      failure: null,
      fetchedAt: now,
      expiresAt: new Date('2026-09-10T10:00:00.000Z'),
    };

    await repository.save(document);

    expect(updateOne).toHaveBeenCalledWith(
      { urlHash: 'hash' },
      {
        $set: {
          urlHash: 'hash',
          url: 'https://example.com/careers',
          status: 'ok',
          content: 'Careers at Example',
          contentType: 'text/html',
          failure: null,
          fetchedAt: now,
          expiresAt: new Date('2026-09-10T10:00:00.000Z'),
        },
        $setOnInsert: { _id: document._id },
      },
      { upsert: true },
    );
  });
});

describe('PracticeProgressRepository', () => {
  it('scopes progress reads by owner and kit', async () => {
    const findOne = vi.fn(async () => null);
    const repository = new PracticeProgressRepository(
      collectionWithMethods<PracticeProgressDocument>({ findOne }),
      clock,
    );
    const ownerId = new ObjectId();
    const kitId = new ObjectId();

    await repository.findForKit(ownerId, kitId);

    expect(findOne).toHaveBeenCalledWith({ ownerId, kitId });
  });

  it('creates an empty progress document with an immutable insert id', async () => {
    const updateOne = vi.fn(async () => ({ acknowledged: true }));
    const repository = new PracticeProgressRepository(
      collectionWithMethods<PracticeProgressDocument>({ updateOne }),
      clock,
    );
    const ownerId = new ObjectId();
    const kitId = new ObjectId();

    const document = await repository.createEmpty(ownerId, kitId);

    expect(document.cards).toEqual([]);
    expect(updateOne).toHaveBeenCalledWith(
      { ownerId, kitId },
      {
        $set: {
          ownerId,
          kitId,
          cards: [],
          createdAt: now,
          updatedAt: now,
        },
        $setOnInsert: { _id: document._id },
      },
      { upsert: true },
    );
  });
});
