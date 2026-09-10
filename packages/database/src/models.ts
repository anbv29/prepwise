import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { KitSchema } from '@prep-kit/contracts';

const objectIdSchema = z.instanceof(ObjectId);
const timestampSchema = z.date();

export const KitStatusSchema = z.enum(['draft', 'queued', 'generating', 'ready', 'failed']);
export type KitStatus = z.infer<typeof KitStatusSchema>;

export const GenerationJobStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export type GenerationJobStatus = z.infer<typeof GenerationJobStatusSchema>;

export const GenerationStageSchema = z.enum([
  'queued',
  'extracting_requirements',
  'researching_company',
  'searching_discussions',
  'generating_company_brief',
  'generating_questions',
  'checking_coverage',
  'generating_flashcards',
  'building_schedule',
  'validating',
  'complete',
  'failed',
]);
export type GenerationStage = z.infer<typeof GenerationStageSchema>;

export const GenerationErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});
export type GenerationError = z.infer<typeof GenerationErrorSchema>;

export const ResearchWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  sourceUrl: z.string().optional(),
});
export type ResearchWarning = z.infer<typeof ResearchWarningSchema>;

export const SubscriptionPlanSchema = z.enum(['free', 'focus', 'pro']);
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

export const KitInputSchema = z.object({
  jobDescription: z.string(),
  companyUrl: z.string(),
  daysAvailable: z.number().int().positive(),
});
export type KitInput = z.infer<typeof KitInputSchema>;

export const GenerationProgressSchema = z.object({
  stage: GenerationStageSchema,
  percent: z.number().int().min(0).max(100),
  message: z.string(),
});
export type GenerationProgress = z.infer<typeof GenerationProgressSchema>;

export const UserDocumentSchema = z.object({
  _id: objectIdSchema,
  email: z.string().email(),
  passwordHash: z.string().min(1),
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  dateOfBirth: z.string().date().optional(),
  plan: SubscriptionPlanSchema.default('free'),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});
export type UserDocument = z.infer<typeof UserDocumentSchema>;

export const SessionDocumentSchema = z
  .object({
    _id: objectIdSchema,
    userId: objectIdSchema,
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/u),
    expiresAt: timestampSchema,
    createdAt: timestampSchema,
    lastSeenAt: timestampSchema,
  })
  .superRefine((document, context) => {
    if (document.expiresAt <= document.createdAt) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Session expiry must be later than its creation time.',
      });
    }
  });
export type SessionDocument = z.infer<typeof SessionDocumentSchema>;

export const KitDocumentSchema = z
  .object({
    _id: objectIdSchema,
    ownerId: objectIdSchema,
    input: KitInputSchema,
    inputFingerprint: z.string().min(1),
    status: KitStatusSchema,
    progress: GenerationProgressSchema,
    kit: KitSchema.nullable(),
    warnings: z.array(ResearchWarningSchema),
    version: z.number().int().positive(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((document, context) => {
    if (document.status === 'ready' && document.kit === null) {
      context.addIssue({
        code: 'custom',
        path: ['kit'],
        message: 'A ready kit document must contain a generated kit.',
      });
    }

    if (
      document.status === 'ready' &&
      (document.progress.stage !== 'complete' || document.progress.percent !== 100)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['progress'],
        message: 'A ready kit must have complete progress at 100 percent.',
      });
    }

    if (document.status === 'failed' && document.progress.stage !== 'failed') {
      context.addIssue({
        code: 'custom',
        path: ['progress', 'stage'],
        message: 'A failed kit must have failed progress.',
      });
    }
  });
export type KitDocument = z.infer<typeof KitDocumentSchema>;

export const GenerationJobDocumentSchema = z
  .object({
    _id: objectIdSchema,
    ownerId: objectIdSchema,
    kitId: objectIdSchema,
    idempotencyKey: z.string().min(1),
    status: GenerationJobStatusSchema,
    stage: GenerationStageSchema,
    progressPercent: z.number().int().min(0).max(100),
    attempts: z.number().int().nonnegative(),
    error: GenerationErrorSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    startedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
  })
  .superRefine((document, context) => {
    if (
      document.status === 'completed' &&
      (document.stage !== 'complete' || document.progressPercent !== 100)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'A completed job must be at the complete stage with 100 percent progress.',
      });
    }

    if (document.status === 'failed' && document.error === null) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'A failed job must contain a structured error.',
      });
    }

    if (document.status === 'running' && document.startedAt === null) {
      context.addIssue({
        code: 'custom',
        path: ['startedAt'],
        message: 'A running job must have a start time.',
      });
    }

    if (
      (document.status === 'completed' || document.status === 'failed') &&
      document.completedAt === null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'A terminal job must have a completion time.',
      });
    }
  });
export type GenerationJobDocument = z.infer<typeof GenerationJobDocumentSchema>;

export const ResearchCacheStatusSchema = z.enum(['ok', 'failed']);
export type ResearchCacheStatus = z.infer<typeof ResearchCacheStatusSchema>;

export const ResearchCacheDocumentSchema = z
  .object({
    _id: objectIdSchema,
    urlHash: z.string().min(1),
    url: z.string().min(1),
    status: ResearchCacheStatusSchema,
    content: z.string().nullable(),
    contentType: z.string().nullable(),
    failure: GenerationErrorSchema.nullable(),
    fetchedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .superRefine((document, context) => {
    if (document.status === 'ok' && document.content === null) {
      context.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'A successful research cache entry must contain content.',
      });
    }

    if (document.status === 'ok' && document.failure !== null) {
      context.addIssue({
        code: 'custom',
        path: ['failure'],
        message: 'A successful research cache entry cannot contain a failure.',
      });
    }

    if (document.status === 'failed' && document.failure === null) {
      context.addIssue({
        code: 'custom',
        path: ['failure'],
        message: 'A failed research cache entry must contain a structured failure.',
      });
    }

    if (document.status === 'failed' && document.content !== null) {
      context.addIssue({
        code: 'custom',
        path: ['content'],
        message: 'A failed research cache entry cannot contain fetched content.',
      });
    }

    if (document.expiresAt <= document.fetchedAt) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Research cache expiry must be later than its fetch time.',
      });
    }
  });
export type ResearchCacheDocument = z.infer<typeof ResearchCacheDocumentSchema>;

export const FlashcardPracticeSchema = z.object({
  flashcardId: z.string().min(1),
  confidence: z.number().int().min(1).max(5),
  attempts: z.number().int().positive(),
  lastPracticedAt: timestampSchema,
});
export type FlashcardPractice = z.infer<typeof FlashcardPracticeSchema>;

export const PracticeProgressDocumentSchema = z
  .object({
    _id: objectIdSchema,
    ownerId: objectIdSchema,
    kitId: objectIdSchema,
    cards: z.array(FlashcardPracticeSchema),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine((document, context) => {
    const seenFlashcardIds = new Set<string>();

    document.cards.forEach((card, index) => {
      if (seenFlashcardIds.has(card.flashcardId)) {
        context.addIssue({
          code: 'custom',
          path: ['cards', index, 'flashcardId'],
          message: `Duplicate practice flashcard id: ${card.flashcardId}`,
        });
      }

      seenFlashcardIds.add(card.flashcardId);
    });
  });
export type PracticeProgressDocument = z.infer<typeof PracticeProgressDocumentSchema>;
