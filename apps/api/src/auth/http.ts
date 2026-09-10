import { ObjectId } from 'mongodb';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { KitSchema, QuestionCategorySchema, type Kit } from '@prep-kit/contracts';
import type {
  GenerationJobDocument,
  GenerationJobRepository,
  KitDocument,
  KitRepository,
  PracticeProgressDocument,
  PracticeProgressRepository,
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
const batchCreateSchema = z.object({
  items: z.array(z.unknown()).min(1).max(10),
});
const updateKitSchema = z.object({ kit: KitSchema });
const regenerationTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('company_brief') }),
  z.object({ type: z.literal('question_category'), category: QuestionCategorySchema }),
]);
const practiceAttemptSchema = z.object({
  confidence: z.number().int().min(1).max(4),
});
const flashcardIdSchema = z.string().trim().min(1).max(256);

export type RegenerationTarget = z.infer<typeof regenerationTargetSchema>;

export interface ApiRepositories {
  kits: Pick<KitRepository, 'findOwnedById' | 'listForOwner' | 'updateOwnedReadyKit'>;
  generationJobs: Pick<GenerationJobRepository, 'findOwnedById'>;
  practiceProgress: Pick<PracticeProgressRepository, 'findForKit' | 'recordAttempt'>;
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
  onGenerationQueued?: () => void;
  regenerateKit: (document: KitDocument, target: RegenerationTarget) => Promise<Kit>;
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
  return { id: user.id.toHexString(), email: user.email, plan: user.plan };
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

function serializePracticeProgress(kitId: ObjectId, document: PracticeProgressDocument | null) {
  return {
    kitId: kitId.toHexString(),
    cards:
      document?.cards.map((card) => ({
        flashcardId: card.flashcardId,
        confidence: card.confidence,
        attempts: card.attempts,
        lastPracticedAt: card.lastPracticedAt.toISOString(),
      })) ?? [],
    updatedAt: document?.updatedAt.toISOString() ?? null,
  };
}

function ensureReadyKit(
  document: KitDocument | null,
  response: Response,
): (KitDocument & { kit: Kit }) | null {
  if (!document) {
    response.status(404).json({
      error: { code: 'KIT_NOT_FOUND', message: 'Kit not found.' },
    });
    return null;
  }

  if (document.status !== 'ready' || !document.kit) {
    response.status(409).json({
      error: { code: 'KIT_NOT_READY', message: 'This kit is not ready yet.' },
    });
    return null;
  }

  return document as KitDocument & { kit: Kit };
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
  onGenerationQueued,
  regenerateKit,
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
    onGenerationQueued?.();
  });

  router.post('/kits/batch', requireAuth, async (request, response) => {
    const { items } = batchCreateSchema.parse(request.body);
    const user = currentUser(response);
    const results = await Promise.all(
      items.map((item) => generationRequests.create(user.id, item)),
    );

    response.status(202).json(
      results.map((result) => ({
        idempotencyKey: result.idempotencyKey,
        reused: result.reused,
        kit: serializeKit(result.kit),
        job: serializeGenerationJob(result.job),
      })),
    );

    for (let index = 0; index < results.length; index += 1) {
      onGenerationQueued?.();
    }
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

  router.patch('/kits/:kitId', requireAuth, async (request, response) => {
    const kitId = kitIdSchema.parse(request.params.kitId);
    const { kit } = updateKitSchema.parse(request.body);
    const user = currentUser(response);
    const updated = await repositories.kits.updateOwnedReadyKit(user.id, kitId, kit);

    if (!updated) {
      const existing = await repositories.kits.findOwnedById(user.id, kitId);
      ensureReadyKit(existing, response);
      return;
    }

    response.status(200).json({ kit: serializeKit(updated) });
  });

  router.post('/kits/:kitId/regenerate/preview', requireAuth, async (request, response) => {
    const kitId = kitIdSchema.parse(request.params.kitId);
    const target = regenerationTargetSchema.parse(request.body);
    const user = currentUser(response);
    const document = ensureReadyKit(
      await repositories.kits.findOwnedById(user.id, kitId),
      response,
    );

    if (!document) return;

    if (target.type === 'company_brief') {
      response.status(200).json({
        title: 'Refresh the company brief?',
        summary: 'The company website will be researched again before the brief is rewritten.',
        changes: [
          'Refresh the company summary',
          'Refresh the company overview',
          'Update the verified source links',
        ],
        preservedEditedItems: 0,
      });
      return;
    }

    const categoryQuestions = document.kit.questions.filter(
      (question) => question.category === target.category,
    );
    const preservedEditedItems = categoryQuestions.filter(
      (question) => question.edited === true,
    ).length;
    const replaceCount = categoryQuestions.length - preservedEditedItems;
    response.status(200).json({
      title: `Regenerate ${target.category.replace('-', ' ')} questions?`,
      summary:
        'Fresh questions will be generated from the source role while manually edited questions stay unchanged.',
      changes: [
        `Replace ${replaceCount} generated question${replaceCount === 1 ? '' : 's'}`,
        `Preserve ${preservedEditedItems} edited question${preservedEditedItems === 1 ? '' : 's'}`,
        'Recalculate the study schedule and requirement coverage',
      ],
      preservedEditedItems,
    });
  });

  router.post('/kits/:kitId/regenerate', requireAuth, async (request, response) => {
    const kitId = kitIdSchema.parse(request.params.kitId);
    const target = regenerationTargetSchema.parse(request.body);
    const user = currentUser(response);
    const document = ensureReadyKit(
      await repositories.kits.findOwnedById(user.id, kitId),
      response,
    );

    if (!document) return;

    const regenerated = await regenerateKit(document, target);
    const updated = await repositories.kits.updateOwnedReadyKit(user.id, kitId, regenerated);

    if (!updated) {
      response.status(409).json({
        error: { code: 'KIT_UPDATE_CONFLICT', message: 'The regenerated kit could not be saved.' },
      });
      return;
    }

    response.status(200).json({ kit: serializeKit(updated) });
  });

  router.get('/kits/:kitId/practice', requireAuth, async (request, response) => {
    const kitId = kitIdSchema.parse(request.params.kitId);
    const user = currentUser(response);
    const document = ensureReadyKit(
      await repositories.kits.findOwnedById(user.id, kitId),
      response,
    );

    if (!document) return;

    const progress = await repositories.practiceProgress.findForKit(user.id, kitId);
    response.status(200).json({ progress: serializePracticeProgress(kitId, progress) });
  });

  router.put('/kits/:kitId/practice/:flashcardId', requireAuth, async (request, response) => {
    const kitId = kitIdSchema.parse(request.params.kitId);
    const flashcardId = flashcardIdSchema.parse(request.params.flashcardId);
    const { confidence } = practiceAttemptSchema.parse(request.body);
    const user = currentUser(response);
    const document = ensureReadyKit(
      await repositories.kits.findOwnedById(user.id, kitId),
      response,
    );

    if (!document) return;

    if (!document.kit.flashcards.some((flashcard) => flashcard.id === flashcardId)) {
      response.status(404).json({
        error: { code: 'FLASHCARD_NOT_FOUND', message: 'Flashcard not found.' },
      });
      return;
    }

    const progress = await repositories.practiceProgress.recordAttempt(
      user.id,
      kitId,
      flashcardId,
      confidence,
    );
    response.status(200).json({ progress: serializePracticeProgress(kitId, progress) });
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

    if (job.status === 'queued') {
      onGenerationQueued?.();
    }
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
    onGenerationQueued?.();
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
