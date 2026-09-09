import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionDocument, UserDocument } from '@prep-kit/database';

import { verifyPassword } from '../src/auth/password.js';
import {
  AuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from '../src/auth/service.js';
import { hashSessionToken } from '../src/auth/session-token.js';

const NOW = new Date('2026-09-09T08:00:00.000Z');
const TTL = 60 * 60 * 1000;

function createRepositories() {
  const users: UserDocument[] = [];
  const sessions: SessionDocument[] = [];

  return {
    records: { sessions, users },
    users: {
      create: vi.fn(async (email: string, passwordHash: string) => {
        const user: UserDocument = {
          _id: new ObjectId(),
          email: email.trim().toLowerCase(),
          passwordHash,
          createdAt: NOW,
          updatedAt: NOW,
        };
        users.push(user);
        return user;
      }),
      findByEmail: vi.fn(async (email: string) => {
        return users.find((user) => user.email === email.trim().toLowerCase()) ?? null;
      }),
      findById: vi.fn(async (userId: ObjectId) => {
        return users.find((user) => user._id.equals(userId)) ?? null;
      }),
    },
    sessions: {
      create: vi.fn(async (userId: ObjectId, tokenHash: string, expiresAt: Date) => {
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
      }),
      findValidByTokenHash: vi.fn(async (tokenHash: string) => {
        return (
          sessions.find((session) => session.tokenHash === tokenHash && session.expiresAt > NOW) ??
          null
        );
      }),
      deleteByTokenHash: vi.fn(async (tokenHash: string) => {
        const index = sessions.findIndex((session) => session.tokenHash === tokenHash);

        if (index < 0) {
          return false;
        }

        sessions.splice(index, 1);
        return true;
      }),
    },
  };
}

describe('AuthService', () => {
  let repositories: ReturnType<typeof createRepositories>;
  let authService: AuthService;

  beforeEach(() => {
    repositories = createRepositories();
    authService = new AuthService(repositories.users, repositories.sessions, TTL, () => NOW);
  });

  it('registers a normalized user, hashes the password, and issues a hashed session', async () => {
    const result = await authService.register(' Person@Example.COM ', 'correct-horse-battery');
    const user = repositories.records.users[0];
    const session = repositories.records.sessions[0];

    expect(user?.email).toBe('person@example.com');
    expect(user?.passwordHash).not.toBe('correct-horse-battery');
    await expect(verifyPassword('correct-horse-battery', user?.passwordHash ?? '')).resolves.toBe(
      true,
    );
    expect(session?.tokenHash).toBe(hashSessionToken(result.token));
    expect(session?.tokenHash).toHaveLength(64);
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + TTL));
  });

  it('rejects duplicate registration', async () => {
    await authService.register('person@example.com', 'correct-horse-battery');

    await expect(
      authService.register('PERSON@example.com', 'another-safe-password'),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it('returns the same safe error for an unknown email and a wrong password', async () => {
    await authService.register('person@example.com', 'correct-horse-battery');

    await expect(
      authService.login('unknown@example.com', 'wrong-password-value'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      authService.login('person@example.com', 'wrong-password-value'),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('authenticates and revokes a session using only its token hash', async () => {
    const session = await authService.register('person@example.com', 'correct-horse-battery');

    await expect(authService.authenticate(session.token)).resolves.toEqual(session.user);
    await authService.logout(session.token);
    await expect(authService.authenticate(session.token)).resolves.toBeNull();
  });
});
