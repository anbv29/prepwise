import { z, type RefinementCtx } from 'zod';

const identifierSchema = z.string().min(1, 'An id cannot be empty.');
const isoTimestampSchema = z.string().datetime({ offset: true });

export const RequirementKindSchema = z.enum(['technical', 'behavioural', 'domain']);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const RequirementPrioritySchema = z.enum(['must', 'nice']);
export type RequirementPriority = z.infer<typeof RequirementPrioritySchema>;

export const QuestionCategorySchema = z.enum([
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

export const KitSourceSchema = z
  .object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: isoTimestampSchema,
    pages_used: z.array(z.string()),
  })
  .passthrough();
export type KitSource = z.infer<typeof KitSourceSchema>;

export const CompanyBriefSchema = z
  .object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  })
  .passthrough();
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const RequirementSchema = z
  .object({
    id: identifierSchema,
    text: z.string(),
    kind: RequirementKindSchema,
    priority: RequirementPrioritySchema,
  })
  .passthrough();
export type Requirement = z.infer<typeof RequirementSchema>;

export const RoleSchema = z
  .object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(RequirementSchema),
  })
  .passthrough();
export type Role = z.infer<typeof RoleSchema>;

export const QuestionSchema = z
  .object({
    id: identifierSchema,
    requirement_ids: z.array(identifierSchema),
    category: QuestionCategorySchema,
    prompt: z.string(),
    answer_outline: z.string(),
    difficulty: z.number().int().min(1).max(3),
  })
  .passthrough();
export type Question = z.infer<typeof QuestionSchema>;

export const FlashcardSchema = z
  .object({
    id: identifierSchema,
    front: z.string(),
    back: z.string(),
    requirement_ids: z.array(identifierSchema),
  })
  .passthrough();
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const ScheduleDaySchema = z
  .object({
    day: z.number().int().positive(),
    focus: z.string(),
    question_ids: z.array(identifierSchema),
    minutes: z.number().int().nonnegative(),
  })
  .passthrough();
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;

export const ScheduleSchema = z
  .object({
    days_available: z.number().int().positive(),
    days: z.array(ScheduleDaySchema),
  })
  .passthrough();
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CoverageSchema = z
  .object({
    uncovered_requirement_ids: z.array(identifierSchema),
    passes: z.number().int().nonnegative(),
  })
  .passthrough();
export type Coverage = z.infer<typeof CoverageSchema>;

const KitObjectSchema = z
  .object({
    source: KitSourceSchema,
    company_brief: CompanyBriefSchema,
    role: RoleSchema,
    questions: z.array(QuestionSchema),
    flashcards: z.array(FlashcardSchema),
    schedule: ScheduleSchema,
    coverage: CoverageSchema,
  })
  .passthrough();

type IdentifiedItem = { id: string };

function validateUniqueIds(
  items: IdentifiedItem[],
  collectionPath: readonly PropertyKey[],
  itemLabel: string,
  context: RefinementCtx,
) {
  const seenIds = new Set<string>();

  items.forEach((item, index) => {
    if (seenIds.has(item.id)) {
      context.addIssue({
        code: 'custom',
        path: [...collectionPath, index, 'id'],
        message: `Duplicate ${itemLabel} id: ${item.id}`,
      });
    }

    seenIds.add(item.id);
  });
}

export const KitSchema = KitObjectSchema.superRefine((kit, context) => {
  validateUniqueIds(kit.role.requirements, ['role', 'requirements'], 'requirement', context);
  validateUniqueIds(kit.questions, ['questions'], 'question', context);
  validateUniqueIds(kit.flashcards, ['flashcards'], 'flashcard', context);

  const requirementIds = new Set(kit.role.requirements.map((requirement) => requirement.id));
  const questionIds = new Set(kit.questions.map((question) => question.id));

  kit.questions.forEach((question, questionIndex) => {
    question.requirement_ids.forEach((requirementId, referenceIndex) => {
      if (!requirementIds.has(requirementId)) {
        context.addIssue({
          code: 'custom',
          path: ['questions', questionIndex, 'requirement_ids', referenceIndex],
          message: `Question references unknown requirement id: ${requirementId}`,
        });
      }
    });
  });

  kit.flashcards.forEach((flashcard, flashcardIndex) => {
    flashcard.requirement_ids.forEach((requirementId, referenceIndex) => {
      if (!requirementIds.has(requirementId)) {
        context.addIssue({
          code: 'custom',
          path: ['flashcards', flashcardIndex, 'requirement_ids', referenceIndex],
          message: `Flashcard references unknown requirement id: ${requirementId}`,
        });
      }
    });
  });

  kit.schedule.days.forEach((scheduleDay, dayIndex) => {
    if (scheduleDay.day !== dayIndex + 1) {
      context.addIssue({
        code: 'custom',
        path: ['schedule', 'days', dayIndex, 'day'],
        message: `Schedule day must be ${dayIndex + 1}.`,
      });
    }

    scheduleDay.question_ids.forEach((questionId, referenceIndex) => {
      if (!questionIds.has(questionId)) {
        context.addIssue({
          code: 'custom',
          path: ['schedule', 'days', dayIndex, 'question_ids', referenceIndex],
          message: `Schedule references unknown question id: ${questionId}`,
        });
      }
    });
  });

  if (kit.schedule.days.length !== kit.schedule.days_available) {
    context.addIssue({
      code: 'custom',
      path: ['schedule', 'days'],
      message: 'Schedule must contain exactly days_available entries.',
    });
  }

  kit.coverage.uncovered_requirement_ids.forEach((requirementId, referenceIndex) => {
    if (!requirementIds.has(requirementId)) {
      context.addIssue({
        code: 'custom',
        path: ['coverage', 'uncovered_requirement_ids', referenceIndex],
        message: `Coverage references unknown requirement id: ${requirementId}`,
      });
    }
  });
});

export type Kit = z.infer<typeof KitSchema>;
