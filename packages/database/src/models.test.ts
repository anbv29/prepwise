import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { createValidKit } from '../../../tests/fixtures/valid-kit.js';
import {
  GenerationJobDocumentSchema,
  KitDocumentSchema,
  PracticeProgressDocumentSchema,
  ResearchCacheDocumentSchema,
  SessionDocumentSchema,
  UserDocumentSchema,
} from './models.js';

const now = new Date('2026-09-09T10:00:00.000Z');

describe('database document schemas', () => {
  it('accepts a valid user document', () => {
    const result = UserDocumentSchema.safeParse({
      _id: new ObjectId(),
      email: 'engineer@example.com',
      passwordHash: 'argon2-hash',
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(true);
  });

  it('requires session tokens to be stored as SHA-256-style hashes', () => {
    const validSession = {
      _id: new ObjectId(),
      userId: new ObjectId(),
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date('2026-09-10T10:00:00.000Z'),
      createdAt: now,
      lastSeenAt: now,
    };

    expect(SessionDocumentSchema.safeParse(validSession).success).toBe(true);
    expect(
      SessionDocumentSchema.safeParse({ ...validSession, tokenHash: 'raw-token' }).success,
    ).toBe(false);
    expect(SessionDocumentSchema.safeParse({ ...validSession, expiresAt: now }).success).toBe(
      false,
    );
  });

  it('requires a ready kit document to contain a valid generated kit', () => {
    const baseDocument = {
      _id: new ObjectId(),
      ownerId: new ObjectId(),
      input: {
        jobDescription: 'Senior Software Engineer',
        companyUrl: 'https://example.com',
        daysAvailable: 2,
      },
      inputFingerprint: 'fingerprint',
      status: 'ready',
      progress: {
        stage: 'complete',
        percent: 100,
        message: 'Complete',
      },
      warnings: [],
      version: 2,
      createdAt: now,
      updatedAt: now,
    };

    expect(KitDocumentSchema.safeParse({ ...baseDocument, kit: null }).success).toBe(false);
    expect(KitDocumentSchema.safeParse({ ...baseDocument, kit: createValidKit() }).success).toBe(
      true,
    );
  });

  it('requires completed jobs to have complete stage and progress', () => {
    const completedJob = {
      _id: new ObjectId(),
      ownerId: new ObjectId(),
      kitId: new ObjectId(),
      idempotencyKey: 'request-1',
      status: 'completed',
      stage: 'complete',
      progressPercent: 100,
      attempts: 1,
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: now,
    };

    expect(GenerationJobDocumentSchema.safeParse(completedJob).success).toBe(true);
    expect(
      GenerationJobDocumentSchema.safeParse({ ...completedJob, progressPercent: 90 }).success,
    ).toBe(false);
    expect(
      GenerationJobDocumentSchema.safeParse({ ...completedJob, completedAt: null }).success,
    ).toBe(false);
  });

  it('requires failed jobs to include a structured error', () => {
    const result = GenerationJobDocumentSchema.safeParse({
      _id: new ObjectId(),
      ownerId: new ObjectId(),
      kitId: new ObjectId(),
      idempotencyKey: 'request-1',
      status: 'failed',
      stage: 'failed',
      progressPercent: 40,
      attempts: 1,
      error: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: now,
    });

    expect(result.success).toBe(false);
  });

  it('keeps successful and failed research cache entries internally consistent', () => {
    const baseEntry = {
      _id: new ObjectId(),
      urlHash: 'url-hash',
      url: 'https://example.com/careers',
      contentType: 'text/html',
      fetchedAt: now,
      expiresAt: new Date('2026-09-10T10:00:00.000Z'),
    };

    expect(
      ResearchCacheDocumentSchema.safeParse({
        ...baseEntry,
        status: 'ok',
        content: 'Careers at Example',
        failure: null,
      }).success,
    ).toBe(true);
    expect(
      ResearchCacheDocumentSchema.safeParse({
        ...baseEntry,
        status: 'failed',
        content: null,
        failure: null,
      }).success,
    ).toBe(false);
    expect(
      ResearchCacheDocumentSchema.safeParse({
        ...baseEntry,
        status: 'ok',
        content: 'Careers at Example',
        failure: {
          code: 'FETCH_FAILED',
          message: 'Unexpected failure state.',
          retryable: true,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate flashcard progress entries', () => {
    const card = {
      flashcardId: 'f1',
      confidence: 3,
      attempts: 1,
      lastPracticedAt: now,
    };
    const result = PracticeProgressDocumentSchema.safeParse({
      _id: new ObjectId(),
      ownerId: new ObjectId(),
      kitId: new ObjectId(),
      cards: [card, card],
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(false);
  });
});
