import { companyUnreachableKit, fixtureKitRecords, thinKit } from '@/lib/fixtures/kits';
import type {
  ApiUser,
  GenerationJob,
  Kit,
  KitRecord,
  PracticeConfidence,
  PracticeProgress,
} from '@/types/kit';

import {
  ApiClientError,
  type ApiClient,
  type CreateKitInput,
  type CreateKitResult,
  type RegenerationTarget,
} from './types';

const SESSION_KEY = 'prep-kit-demo-user';
const PRACTICE_KEY_PREFIX = 'prep-kit-demo-practice-';
const records = structuredClone(fixtureKitRecords);
const jobs = new Map<string, GenerationJob>();

function wait(milliseconds = 220) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function readUser(): ApiUser | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(SESSION_KEY);

  if (!stored) {
    return null;
  }

  try {
    const user = JSON.parse(stored) as Partial<ApiUser>;

    if (typeof user.id !== 'string' || typeof user.email !== 'string') return null;

    return {
      id: user.id,
      email: user.email,
      ...(typeof user.firstName === 'string' ? { firstName: user.firstName } : {}),
      ...(typeof user.lastName === 'string' ? { lastName: user.lastName } : {}),
      ...(typeof user.dateOfBirth === 'string' ? { dateOfBirth: user.dateOfBirth } : {}),
      plan: ['focus', 'pro'].includes(user.plan ?? '') ? (user.plan as 'focus' | 'pro') : 'free',
    };
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function requireUser() {
  if (!readUser()) {
    throw new ApiClientError('AUTHENTICATION_REQUIRED', 'Please sign in to continue.');
  }
}

function readPracticeProgress(kitId: string): PracticeProgress {
  const empty: PracticeProgress = { cards: [], kitId, updatedAt: null };
  if (typeof window === 'undefined') return empty;

  const stored = window.localStorage.getItem(`${PRACTICE_KEY_PREFIX}${kitId}`);
  if (!stored) return empty;

  try {
    return JSON.parse(stored) as PracticeProgress;
  } catch {
    window.localStorage.removeItem(`${PRACTICE_KEY_PREFIX}${kitId}`);
    return empty;
  }
}

function writePracticeProgress(kitId: string, flashcardId: string, confidence: PracticeConfidence) {
  const previous = readPracticeProgress(kitId);
  const now = new Date().toISOString();
  const existing = previous.cards.find((card) => card.flashcardId === flashcardId);
  const next: PracticeProgress = {
    cards: existing
      ? previous.cards.map((card) =>
          card.flashcardId === flashcardId
            ? { ...card, attempts: card.attempts + 1, confidence, lastPracticedAt: now }
            : card,
        )
      : [...previous.cards, { attempts: 1, confidence, flashcardId, lastPracticedAt: now }],
    kitId,
    updatedAt: now,
  };
  window.localStorage.setItem(`${PRACTICE_KEY_PREFIX}${kitId}`, JSON.stringify(next));
  return next;
}

function writeUser(
  email: string,
  profile?: { firstName: string; lastName: string; dateOfBirth: string },
) {
  const user: ApiUser = {
    id: 'demo-user',
    email: email.trim().toLowerCase(),
    ...(profile ?? {}),
    plan: 'free',
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function findRecord(kitId: string) {
  const record = records.find((candidate) => candidate.id === kitId);

  if (!record) {
    throw new ApiClientError('KIT_NOT_FOUND', 'Kit not found.');
  }

  return record;
}

function normalizeEditedKit(kit: Kit) {
  const validRequirements = new Set(kit.role.requirements.map((requirement) => requirement.id));
  const validQuestions = new Set(kit.questions.map((question) => question.id));
  const normalized = structuredClone(kit);

  normalized.questions = normalized.questions.map((question) => ({
    ...question,
    requirement_ids: question.requirement_ids.filter((requirementId) =>
      validRequirements.has(requirementId),
    ),
  }));
  normalized.flashcards = normalized.flashcards.map((card) => ({
    ...card,
    requirement_ids: card.requirement_ids.filter((requirementId) =>
      validRequirements.has(requirementId),
    ),
  }));
  normalized.schedule.days = normalized.schedule.days.map((day) => ({
    ...day,
    question_ids: day.question_ids.filter((questionId) => validQuestions.has(questionId)),
  }));
  normalized.coverage.uncovered_requirement_ids = normalized.role.requirements
    .filter(
      (requirement) =>
        !normalized.questions.some((question) => question.requirement_ids.includes(requirement.id)),
    )
    .map((requirement) => requirement.id);

  return normalized;
}

function saveKitRecord(record: KitRecord, kit: Kit) {
  record.kit = normalizeEditedKit(kit);
  record.version += 1;
  record.updatedAt = new Date().toISOString();
  return structuredClone(record);
}

function regenerationPreview(record: KitRecord, target: RegenerationTarget) {
  if (!record.kit) {
    throw new ApiClientError('KIT_NOT_READY', 'This kit is not ready to edit yet.');
  }

  if (target.type === 'company_brief') {
    return {
      title: 'Refresh the company brief?',
      summary:
        'The latest verified company sources will be used to rewrite the summary and company overview.',
      changes: [
        'Replace the interview summary',
        'Refresh what the company does',
        'Keep the verified source links visible',
      ],
      preservedEditedItems: 0,
    };
  }

  const categoryQuestions = record.kit.questions.filter(
    (question) => question.category === target.category,
  );
  const preservedEditedItems = categoryQuestions.filter((question) => question.edited).length;

  return {
    title: `Regenerate ${target.category.replace('-', ' ')} questions?`,
    summary:
      'Fresh questions will be generated from the role requirements while your edited questions remain exactly as they are.',
    changes: [
      `Replace ${categoryQuestions.length - preservedEditedItems} generated question${categoryQuestions.length - preservedEditedItems === 1 ? '' : 's'}`,
      `Preserve ${preservedEditedItems} edited question${preservedEditedItems === 1 ? '' : 's'}`,
      'Recalculate requirement coverage after the update',
    ],
    preservedEditedItems,
  };
}

function regenerateRecord(record: KitRecord, target: RegenerationTarget) {
  if (!record.kit) {
    throw new ApiClientError('KIT_NOT_READY', 'This kit is not ready to edit yet.');
  }

  const next = structuredClone(record.kit);

  if (target.type === 'company_brief') {
    next.company_brief.summary = next.company_brief.summary.replace(/\s*Preparation focus:.*$/, '');
    next.company_brief.summary +=
      ' Preparation focus: connect your experience to the company’s current product and operating priorities.';
  } else {
    next.questions = next.questions.map((question) => {
      if (question.category !== target.category || question.edited) return question;
      return {
        ...question,
        answer_outline: `${question.answer_outline.replace(/\s*Close by.*$/i, '')} Close by naming the tradeoff you would validate first.`,
      };
    });
  }

  return saveKitRecord(record, next);
}

function createRecord(input: CreateKitInput): CreateKitResult {
  const now = new Date();
  const kitId = id('kit');
  const jobId = id('job');
  const record: KitRecord = {
    id: kitId,
    input,
    status: 'generating',
    progress: { stage: 'extracting_requirements', percent: 5, message: 'Reading the role.' },
    kit: input.jobDescription.length < 180 ? structuredClone(thinKit) : null,
    warnings: [],
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    interviewDate: new Date(
      now.getTime() + input.daysAvailable * 24 * 60 * 60 * 1_000,
    ).toISOString(),
  };
  const job: GenerationJob = {
    id: jobId,
    kitId,
    status: 'running',
    stage: 'extracting_requirements',
    progressPercent: 5,
    attempts: 1,
    error: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    startedAt: now.toISOString(),
    completedAt: null,
  };
  records.unshift(record);
  jobs.set(jobId, job);
  return { idempotencyKey: id('request'), reused: false, kit: record, job };
}

const stageTimeline = [
  ['extracting_requirements', 8],
  ['researching_company', 22],
  ['searching_discussions', 36],
  ['generating_questions', 58],
  ['checking_coverage', 74],
  ['generating_flashcards', 84],
  ['building_schedule', 92],
  ['complete', 100],
] as const;

function advanceJob(job: GenerationJob) {
  const started = new Date(job.startedAt ?? job.createdAt).getTime();
  const elapsed = Date.now() - started;
  const index = Math.min(Math.floor(elapsed / 1_600), stageTimeline.length - 1);
  const [stage, progressPercent] = stageTimeline[index]!;
  const completed = stage === 'complete';
  const updated: GenerationJob = {
    ...job,
    status: completed ? 'completed' : 'running',
    stage,
    progressPercent,
    updatedAt: new Date().toISOString(),
    completedAt: completed ? new Date().toISOString() : null,
  };
  jobs.set(job.id, updated);

  const record = records.find((candidate) => candidate.id === job.kitId);

  if (record) {
    record.status = completed ? 'ready' : 'generating';
    record.progress = {
      stage,
      percent: progressPercent,
      message: completed ? 'Kit generation complete.' : 'Building your interview kit.',
    };
    record.updatedAt = updated.updatedAt;

    if (completed && !record.kit) {
      record.kit = structuredClone(companyUnreachableKit);
      record.kit.source.company =
        new URL(record.input.companyUrl).hostname.split('.')[0] ?? 'Company';
      record.kit.source.company_url = record.input.companyUrl;
      record.kit.source.role = 'Software Engineer';
      record.kit.schedule.days_available = record.input.daysAvailable;
      record.kit.schedule.days = Array.from({ length: record.input.daysAvailable }, (_, day) => ({
        day: day + 1,
        focus: day === 0 ? 'Core role preparation' : 'Interview review',
        question_ids: ['question-001'],
        minutes: day === 0 ? 30 : 15,
      }));
    }
  }

  return updated;
}

export const mockApi: ApiClient = {
  async getCurrentUser() {
    await wait(120);
    return readUser();
  },

  async login(credentials) {
    await wait();

    if (credentials.password.length < 8) {
      throw new ApiClientError('INVALID_CREDENTIALS', 'Use at least 8 characters.');
    }

    return writeUser(credentials.email);
  },

  async register(credentials) {
    await wait();
    return writeUser(credentials.email, {
      firstName: credentials.firstName,
      lastName: credentials.lastName,
      dateOfBirth: credentials.dateOfBirth,
    });
  },

  async logout() {
    await wait(120);
    window.localStorage.removeItem(SESSION_KEY);
  },

  async listKits() {
    requireUser();
    await wait();
    return structuredClone(records);
  },

  async getKit(kitId) {
    requireUser();
    await wait();
    return structuredClone(findRecord(kitId));
  },

  async getPracticeProgress(kitId) {
    requireUser();
    await wait(160);
    findRecord(kitId);
    return structuredClone(readPracticeProgress(kitId));
  },

  async createKit(input) {
    requireUser();
    await wait(350);
    return structuredClone(createRecord(input));
  },

  async createBatch(items) {
    requireUser();
    await wait(450);
    return items.map((item) => createRecord(item));
  },

  async getJob(jobId) {
    requireUser();
    await wait(180);
    const job = jobs.get(jobId);

    if (!job) {
      throw new ApiClientError('JOB_NOT_FOUND', 'Generation job not found.');
    }

    return structuredClone(advanceJob(job));
  },

  async retryJob(jobId) {
    requireUser();
    await wait();
    const job = jobs.get(jobId);

    if (!job) {
      throw new ApiClientError('JOB_NOT_FOUND', 'Generation job not found.');
    }

    const now = new Date().toISOString();
    const retried: GenerationJob = {
      ...job,
      attempts: job.attempts + 1,
      completedAt: null,
      error: null,
      progressPercent: 0,
      stage: 'queued',
      startedAt: now,
      status: 'running',
      updatedAt: now,
    };
    jobs.set(jobId, retried);
    return structuredClone(retried);
  },

  async updateKit(kitId, kit) {
    requireUser();
    await wait(260);
    return saveKitRecord(findRecord(kitId), kit);
  },

  async previewRegeneration(kitId, target) {
    requireUser();
    await wait(260);
    return regenerationPreview(findRecord(kitId), target);
  },

  async regenerateKitSection(kitId, target) {
    requireUser();
    await wait(620);
    return regenerateRecord(findRecord(kitId), target);
  },

  async saveFlashcardConfidence(kitId, flashcardId, confidence) {
    requireUser();
    await wait(180);
    const record = findRecord(kitId);
    if (!record.kit?.flashcards.some((card) => card.id === flashcardId)) {
      throw new ApiClientError('FLASHCARD_NOT_FOUND', 'Flashcard not found.');
    }
    return structuredClone(writePracticeProgress(kitId, flashcardId, confidence));
  },
};
