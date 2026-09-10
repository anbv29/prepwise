import type { ObjectId } from 'mongodb';

import type {
  SessionDocument,
  SessionRepository,
  UserDocument,
  UserRepository,
} from '@prep-kit/database';

import { hashPassword, verifyPassword } from './password.js';
import { createSessionToken, hashSessionToken } from './session-token.js';

const DUMMY_PASSWORD_HASH = hashPassword('dummy-password-used-only-for-login-timing');

type AuthUserRepository = Pick<UserRepository, 'create' | 'findByEmail' | 'findById'>;
type AuthSessionRepository = Pick<
  SessionRepository,
  'create' | 'deleteByTokenHash' | 'findValidByTokenHash'
>;

export interface AuthenticatedUser {
  id: ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  plan: UserDocument['plan'];
}

export interface RegistrationProfile {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('An account with that email already exists.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

function publicUser(user: UserDocument): AuthenticatedUser {
  return {
    id: user._id,
    email: user.email,
    ...(user.firstName ? { firstName: user.firstName } : {}),
    ...(user.lastName ? { lastName: user.lastName } : {}),
    ...(user.dateOfBirth ? { dateOfBirth: user.dateOfBirth } : {}),
    plan: user.plan,
  };
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export class AuthService {
  constructor(
    private readonly users: AuthUserRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly sessionTtlMs: number,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async register(
    email: string,
    password: string,
    profile: RegistrationProfile,
  ): Promise<IssuedSession> {
    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      throw new EmailAlreadyRegisteredError();
    }

    const passwordHash = await hashPassword(password);
    let user: UserDocument;

    try {
      user = await this.users.create(email, passwordHash, profile);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new EmailAlreadyRegisteredError();
      }

      throw error;
    }

    return this.issueSession(user);
  }

  async login(email: string, password: string): Promise<IssuedSession> {
    const user = await this.users.findByEmail(email);
    const candidateHash = user?.passwordHash ?? (await DUMMY_PASSWORD_HASH);
    const passwordMatches = await verifyPassword(password, candidateHash);

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return this.issueSession(user);
  }

  async authenticate(rawToken: string | undefined): Promise<AuthenticatedUser | null> {
    if (!rawToken) {
      return null;
    }

    const session = await this.sessions.findValidByTokenHash(hashSessionToken(rawToken));

    if (!session) {
      return null;
    }

    const user = await this.users.findById(session.userId);
    return user ? publicUser(user) : null;
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.sessions.deleteByTokenHash(hashSessionToken(rawToken));
    }
  }

  private async issueSession(user: UserDocument): Promise<IssuedSession> {
    const token = createSessionToken();
    const expiresAt = new Date(this.clock().getTime() + this.sessionTtlMs);
    const session: SessionDocument = await this.sessions.create(user._id, token.hash, expiresAt);

    return {
      token: token.raw,
      expiresAt: session.expiresAt,
      user: publicUser(user),
    };
  }
}
