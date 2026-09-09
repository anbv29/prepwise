import { companyUnreachableKit, fixtureKitRecords, thinKit } from '@/lib/fixtures/kits';
import type { ApiUser, GenerationJob, KitRecord } from '@/types/kit';

import { ApiClientError, type ApiClient, type CreateKitInput, type CreateKitResult } from './types';

const SESSION_KEY = 'prep-kit-demo-user';
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
    return JSON.parse(stored) as ApiUser;
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

function writeUser(email: string) {
  const user = { id: 'demo-user', email: email.trim().toLowerCase() };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

    if (credentials.password.length < 12) {
      throw new ApiClientError('INVALID_CREDENTIALS', 'Use at least 12 characters for the demo.');
    }

    return writeUser(credentials.email);
  },

  async register(credentials) {
    await wait();
    return writeUser(credentials.email);
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
    const record = records.find((candidate) => candidate.id === kitId);

    if (!record) {
      throw new ApiClientError('KIT_NOT_FOUND', 'Kit not found.');
    }

    return structuredClone(record);
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
};
