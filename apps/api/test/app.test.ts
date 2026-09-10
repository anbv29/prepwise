import { ObjectId } from 'mongodb';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  GenerationJobDocument,
  KitDocument,
  SessionDocument,
  UserDocument,
} from '@prep-kit/database';

import { createApp } from '../src/app.js';
import type { AuthConfig } from '../src/auth/config.js';
import type { ApiRepositories, GenerationRequestOperations } from '../src/auth/http.js';
import { AuthService } from '../src/auth/service.js';

const NOW = new Date('2030-01-01T08:00:00.000Z');
const authConfig: AuthConfig = {
  cookieName: 'prep_session',
  secureCookies: false,
  sessionTtlMs: 60 * 60 * 1000,
  webOrigin: 'http://localhost:3000',
};

function createAuthService() {
  const users: UserDocument[] = [];
  const sessions: SessionDocument[] = [];
  const userRepository = {
    async create(email: string, passwordHash: string) {
      const user: UserDocument = {
        _id: new ObjectId(),
        email: email.trim().toLowerCase(),
        passwordHash,
        plan: 'free',
        createdAt: NOW,
        updatedAt: NOW,
      };
      users.push(user);
      return user;
    },
    async findByEmail(email: string) {
      return users.find((user) => user.email === email.trim().toLowerCase()) ?? null;
    },
    async findById(userId: ObjectId) {
      return users.find((user) => user._id.equals(userId)) ?? null;
    },
  };
  const sessionRepository = {
    async create(userId: ObjectId, tokenHash: string, expiresAt: Date) {
      const session: SessionDocument = {
        _id: new ObjectId(),
        userId,
        tokenHash,
        expiresAt,
        createdAt: NOW,
        lastSeenAt: NOW,
      };
      sessions.push(session);
      return session;
    },
    async findValidByTokenHash(tokenHash: string) {
      return sessions.find((session) => session.tokenHash === tokenHash) ?? null;
    },
    async deleteByTokenHash(tokenHash: string) {
      const index = sessions.findIndex((session) => session.tokenHash === tokenHash);

      if (index < 0) {
        return false;
      }

      sessions.splice(index, 1);
      return true;
    },
  };

  return new AuthService(userRepository, sessionRepository, authConfig.sessionTtlMs, () => NOW);
}

describe('authentication HTTP API', () => {
  let listForOwner: ReturnType<typeof vi.fn<ApiRepositories['kits']['listForOwner']>>;
  let findOwnedById: ReturnType<typeof vi.fn<ApiRepositories['kits']['findOwnedById']>>;
  let findOwnedJobById: ReturnType<
    typeof vi.fn<ApiRepositories['generationJobs']['findOwnedById']>
  >;
  let generationRequests: GenerationRequestOperations;
  let createGeneration: ReturnType<typeof vi.fn<GenerationRequestOperations['create']>>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    listForOwner = vi.fn(async () => []);
    findOwnedById = vi.fn(async () => null);
    findOwnedJobById = vi.fn(async () => null);
    createGeneration = vi.fn(async () => {
      throw new Error('Generation creation was not expected in this test.');
    });
    generationRequests = {
      create: createGeneration,
      retry: vi.fn(async () => null),
    };
    app = createApp({
      authConfig,
      authService: createAuthService(),
      generationRequests,
      regenerateKit: vi.fn(async () => {
        throw new Error('Regeneration was not expected in this test.');
      }),
      repositories: {
        kits: {
          findOwnedById,
          listForOwner,
          updateOwnedReadyKit: vi.fn(async () => null),
        },
        generationJobs: { findOwnedById: findOwnedJobById },
        practiceProgress: {
          findForKit: vi.fn(async () => null),
          recordAttempt: vi.fn(async () => {
            throw new Error('Practice progress was not expected in this test.');
          }),
        },
      },
    });
  });

  it('keeps health public and applies security headers', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
  });

  it('registers, sets an HTTP-only cookie, and returns the current user', async () => {
    const agent = request.agent(app);
    const registerResponse = await agent
      .post('/api/auth/register')
      .send({ email: 'Person@Example.com', password: 'correct-horse-battery' })
      .expect(201);

    expect(registerResponse.body.user.email).toBe('person@example.com');
    expect(registerResponse.body.user.plan).toBe('free');
    expect(registerResponse.body.user).not.toHaveProperty('passwordHash');
    const setCookie = registerResponse.headers['set-cookie'] as unknown as string[];
    expect(setCookie[0]).toContain('HttpOnly');
    expect(setCookie[0]).toContain('SameSite=Lax');

    const meResponse = await agent.get('/api/auth/me').expect(200);
    expect(meResponse.body.user).toEqual(registerResponse.body.user);
  });

  it('validates credentials before doing authentication work', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_REQUEST');
    expect(response.body.error.details).toHaveLength(2);
  });

  it('protects private routes and scopes kit queries to the authenticated owner', async () => {
    await request(app).get('/api/kits').expect(401);
    const agent = request.agent(app);
    const registration = await agent
      .post('/api/auth/register')
      .send({ email: 'owner@example.com', password: 'correct-horse-battery' })
      .expect(201);
    const ownerId = registration.body.user.id as string;

    await agent.get('/api/kits?limit=10').expect(200, { kits: [] });
    expect(listForOwner).toHaveBeenCalledWith(expect.objectContaining({}), 10);
    expect(listForOwner.mock.calls[0]?.[0].toHexString()).toBe(ownerId);

    const missingKitId = new ObjectId().toHexString();
    await agent.get(`/api/kits/${missingKitId}`).expect(404);
    expect(findOwnedById.mock.calls[0]?.[0].toHexString()).toBe(ownerId);
    expect(findOwnedById.mock.calls[0]?.[1].toHexString()).toBe(missingKitId);
  });

  it('accepts a generation request and returns pollable kit and job ids', async () => {
    const agent = request.agent(app);
    const registration = await agent
      .post('/api/auth/register')
      .send({ email: 'owner@example.com', password: 'correct-horse-battery' })
      .expect(201);
    const ownerId = new ObjectId(registration.body.user.id as string);
    const kitId = new ObjectId();
    const jobId = new ObjectId();
    const kit: KitDocument = {
      _id: kitId,
      ownerId,
      input: {
        jobDescription: 'Senior engineer building TypeScript backend platform services.',
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
    const job: GenerationJobDocument = {
      _id: jobId,
      ownerId,
      kitId,
      idempotencyKey: 'browser-request-123',
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
    createGeneration.mockResolvedValue({
      idempotencyKey: 'browser-request-123',
      reused: false,
      kit,
      job,
    });

    const response = await agent
      .post('/api/kits')
      .set('Idempotency-Key', 'browser-request-123')
      .send(kit.input)
      .expect(202);

    expect(createGeneration).toHaveBeenCalledWith(
      expect.objectContaining({}),
      kit.input,
      'browser-request-123',
    );
    expect(response.body).toMatchObject({
      idempotencyKey: 'browser-request-123',
      reused: false,
      kit: { id: kitId.toHexString(), status: 'queued' },
      job: { id: jobId.toHexString(), kitId: kitId.toHexString(), status: 'queued' },
    });

    findOwnedJobById.mockResolvedValue(job);
    const pollResponse = await agent.get(`/api/jobs/${jobId.toHexString()}`).expect(200);
    expect(pollResponse.body.job.progressPercent).toBe(0);
    expect(findOwnedJobById.mock.calls[0]?.[0].toHexString()).toBe(ownerId.toHexString());
  });

  it('rejects state-changing requests from an untrusted browser origin', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://attacker.example')
      .send({ email: 'person@example.com', password: 'correct-horse-battery' })
      .expect(403);

    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('revokes the server-side session during logout', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ email: 'person@example.com', password: 'correct-horse-battery' })
      .expect(201);

    const logoutResponse = await agent.post('/api/auth/logout').expect(204);
    const setCookie = logoutResponse.headers['set-cookie'] as unknown as string[];
    expect(setCookie[0]).toContain('Expires=Thu, 01 Jan 1970');
    await agent.get('/api/auth/me').expect(401);
  });
});
