import { ObjectId } from 'mongodb';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import type {
  GenerationJobDocument,
  GenerationJobRepository,
  KitDocument,
  KitRepository,
} from '@prep-kit/database';

import type { AuthConfig } from './config.js';
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from './service.js';
import type { AuthService, AuthenticatedUser, IssuedSession } from './service.js';
import {
  GenerationRetryUnavailableError,
  IdempotencyConflictError,
  type GenerationRequestResult,
} from '../generation/requests.js';

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

const kitIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/iu, 'Kit id must be a 24-character hexadecimal id.')
  .transform((value) => new ObjectId(value));
const jobIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/iu, 'Job id must be a 24-character hexadecimal id.')
  .transform((value) => new ObjectId(value));

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export interface ApiRepositories {
  kits: Pick<KitRepository, 'findOwnedById' | 'listForOwner'>;
  generationJobs: Pick<GenerationJobRepository, 'findOwnedById'>;
}

export interface GenerationRequestOperations {
  create: (
    ownerId: ObjectId,
    input: unknown,
    idempotencyKey?: string,
  ) => Promise<GenerationRequestResult>;
  retry: (ownerId: ObjectId, jobId: ObjectId) => Promise<GenerationJobDocument | null>;
}

export interface AuthHttpDependencies {
  authConfig: AuthConfig;
  authService: AuthService;
  generationRequests: GenerationRequestOperations;
  repositories: ApiRepositories;
}

interface AuthenticationLocals {
  authenticatedUser?: AuthenticatedUser;
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const separatorIndex = part.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const candidateName = part.slice(0, separatorIndex).trim();

    if (candidateName === name) {
      const value = part.slice(separatorIndex + 1).trim();

      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

function writeSessionCookie(response: Response, session: IssuedSession, config: AuthConfig) {
  response.cookie(config.cookieName, session.token, {
    expires: session.expiresAt,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: config.secureCookies,
  });
}

function clearSessionCookie(response: Response, config: AuthConfig) {
  response.clearCookie(config.cookieName, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: config.secureCookies,
  });
}

function serializeUser(user: AuthenticatedUser) {
  return { id: user.id.toHexString(), email: user.email };
}

function serializeKit(document: KitDocument) {
  return {
    id: document._id.toHexString(),
    input: document.input,
    status: document.status,
    progress: document.progress,
    kit: document.kit,
    warnings: document.warnings,
    version: document.version,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function serializeGenerationJob(document: GenerationJobDocument) {
  return {
    id: document._id.toHexString(),
    kitId: document.kitId.toHexString(),
    status: document.status,
    stage: document.stage,
    progressPercent: document.progressPercent,
    attempts: document.attempts,
    error: document.error,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    startedAt: document.startedAt?.toISOString() ?? null,
    completedAt: document.completedAt?.toISOString() ?? null,
  };
}

function requireAuthentication(authService: AuthService, config: AuthConfig) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const token = readCookie(request, config.cookieName);
      const user = await authService.authenticate(token);

      if (!user) {
        response.status(401).json({
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Please sign in to continue.' },
        });
        return;
      }

      (response.locals as AuthenticationLocals).authenticatedUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function currentUser(response: Response) {
  const user = (response.locals as AuthenticationLocals).authenticatedUser;

  if (!user) {
    throw new Error('Authenticated route was reached without an authenticated user.');
  }

  return user;
}

export function createApiRouter({
  authConfig,
  authService,
  generationRequests,
  repositories,
}: AuthHttpDependencies) {
  const router = Router();
  const requireAuth = requireAuthentication(authService, authConfig);

  router.post('/auth/register', async (request, response) => {
    const credentials = credentialsSchema.parse(request.body);
    const session = await authService.register(credentials.email, credentials.password);
    writeSessionCookie(response, session, authConfig);
    response.status(201).json({ user: serializeUser(session.user) });
  });

  router.post('/auth/login', async (request, response) => {
    const credentials = credentialsSchema.parse(request.body);
    const session = await authService.login(credentials.email, credentials.password);
    writeSessionCookie(response, session, authConfig);
    response.status(200).json({ user: serializeUser(session.user) });
  });

  router.post('/auth/logout', async (request, response) => {
    await authService.logout(readCookie(request, authConfig.cookieName));
    clearSessionCookie(response, authConfig);
    response.status(204).send();
  });

  router.get('/auth/me', requireAuth, (_request, response) => {
    response.status(200).json({ user: serializeUser(currentUser(response)) });
  });

  router.post('/kits', requireAuth, async (request, response) => {
    const user = currentUser(response);
    const result = await generationRequests.create(
      user.id,
      request.body,
      request.get('Idempotency-Key'),
    );

    response.status(202).json({
      idempotencyKey: result.idempotencyKey,
      reused: result.reused,
      kit: serializeKit(result.kit),
      job: serializeGenerationJob(result.job),
    });
  });

  router.get('/kits', requireAuth, async (request, response) => {
    const { limit } = listQuerySchema.parse(request.query);
    const user = currentUser(response);
    const kits = await repositories.kits.listForOwner(user.id, limit);
    response.status(200).json({ kits: kits.map(serializeKit) });
  });

  router.get('/kits/:kitId', requireAuth, async (request, response) => {
    const kitId = kitIdSchema.parse(request.params.kitId);
    const user = currentUser(response);
    const kit = await repositories.kits.findOwnedById(user.id, kitId);

    if (!kit) {
      response.status(404).json({
        error: { code: 'KIT_NOT_FOUND', message: 'Kit not found.' },
      });
      return;
    }

    response.status(200).json({ kit: serializeKit(kit) });
  });

  router.get('/jobs/:jobId', requireAuth, async (request, response) => {
    const jobId = jobIdSchema.parse(request.params.jobId);
    const user = currentUser(response);
    const job = await repositories.generationJobs.findOwnedById(user.id, jobId);

    if (!job) {
      response.status(404).json({
        error: { code: 'JOB_NOT_FOUND', message: 'Generation job not found.' },
      });
      return;
    }

    response.status(200).json({ job: serializeGenerationJob(job) });
  });

  router.post('/jobs/:jobId/retry', requireAuth, async (request, response) => {
    const jobId = jobIdSchema.parse(request.params.jobId);
    const user = currentUser(response);
    const job = await generationRequests.retry(user.id, jobId);

    if (!job) {
      response.status(404).json({
        error: { code: 'JOB_NOT_FOUND', message: 'Generation job not found.' },
      });
      return;
    }

    response.status(202).json({ job: serializeGenerationJob(job) });
  });

  return router;
}

export function authenticationErrorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof z.ZodError) {
    response.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request data is invalid.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof EmailAlreadyRegisteredError) {
    response.status(409).json({
      error: { code: 'EMAIL_ALREADY_REGISTERED', message: error.message },
    });
    return;
  }

  if (error instanceof InvalidCredentialsError) {
    response.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: error.message },
    });
    return;
  }

  if (error instanceof IdempotencyConflictError) {
    response.status(409).json({
      error: { code: 'IDEMPOTENCY_CONFLICT', message: error.message },
    });
    return;
  }

  if (error instanceof GenerationRetryUnavailableError) {
    response.status(409).json({
      error: { code: 'GENERATION_RETRY_UNAVAILABLE', message: error.message },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  });
}
