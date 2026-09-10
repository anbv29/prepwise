import { randomUUID } from 'node:crypto';

import { waitUntil } from '@vercel/functions';
import type { Kit, Question } from '@prep-kit/contracts';
import {
  connectDatabase,
  createDatabaseRepositories,
  readDatabaseConfig,
  type DatabaseConnection,
  type KitDocument,
} from '@prep-kit/database';
import {
  BraveDiscussionSearchProvider,
  buildSchedule,
  createFullKitGenerator,
  OpenAiStructuredLlmProvider,
  readBraveSearchConfig,
  readOpenAiLlmConfig,
  readResearchConfig,
  safeFetchText,
  type KitGenerator,
} from '@prep-kit/pipeline';

import { createApp } from './app.js';
import { readAuthConfig } from './auth/config.js';
import type { RegenerationTarget } from './auth/http.js';
import { AuthService } from './auth/service.js';
import { readWorkerConfig } from './generation/config.js';
import { CachedResearchFetcher } from './generation/research-cache.js';
import { GenerationRequestService } from './generation/requests.js';
import { GenerationWorker } from './generation/worker.js';

export interface ApiRuntime {
  app: ReturnType<typeof createApp>;
  close: () => Promise<void>;
  worker: GenerationWorker;
}

let runtimePromise: Promise<ApiRuntime> | undefined;

function remapRequirementIds(question: Question, original: Kit, fresh: Kit): Question {
  const originalRequirementById = new Map(
    original.role.requirements.map((requirement) => [
      requirement.id,
      requirement.text.trim().toLowerCase(),
    ]),
  );
  const freshRequirementByText = new Map(
    fresh.role.requirements.map((requirement) => [
      requirement.text.trim().toLowerCase(),
      requirement.id,
    ]),
  );

  return {
    ...question,
    requirement_ids: question.requirement_ids.flatMap((requirementId) => {
      const text = originalRequirementById.get(requirementId);
      const freshId = text ? freshRequirementByText.get(text) : undefined;
      return freshId ? [freshId] : [];
    }),
  };
}

function mergeRegeneratedKit(current: Kit, fresh: Kit, target: RegenerationTarget): Kit {
  if (target.type === 'company_brief') {
    return {
      ...current,
      source: {
        ...current.source,
        researched_at: fresh.source.researched_at,
        pages_used: fresh.source.pages_used,
      },
      company_brief: fresh.company_brief,
    };
  }

  const preservedEdited = current.questions
    .filter((question) => question.category === target.category && question.edited === true)
    .map((question) => remapRequirementIds(question, current, fresh));
  const generatedTarget = fresh.questions.filter(
    (question) => question.category === target.category,
  );
  const usedIds = new Set(
    current.questions
      .filter((question) => question.category !== target.category)
      .map((question) => question.id),
  );
  const replacementQuestions = [...preservedEdited, ...generatedTarget].map((question) => {
    if (!usedIds.has(question.id)) {
      usedIds.add(question.id);
      return question;
    }

    const replacement = { ...question, id: `regenerated-${randomUUID()}` };
    usedIds.add(replacement.id);
    return replacement;
  });
  const questions = [
    ...current.questions.filter((question) => question.category !== target.category),
    ...replacementQuestions,
  ];
  const coveredRequirementIds = new Set(questions.flatMap((question) => question.requirement_ids));

  return {
    ...current,
    questions,
    schedule: buildSchedule({
      daysAvailable: current.schedule.days_available,
      questions,
      requirements: current.role.requirements,
    }),
    coverage: {
      uncovered_requirement_ids: current.role.requirements
        .filter((requirement) => !coveredRequirementIds.has(requirement.id))
        .map((requirement) => requirement.id),
      passes: current.coverage.passes + 1,
    },
  };
}

async function createRuntime(): Promise<ApiRuntime> {
  const databaseConnection: DatabaseConnection = await connectDatabase(readDatabaseConfig());
  const repositories = createDatabaseRepositories(databaseConnection.database);
  const authConfig = readAuthConfig();
  const workerConfig = readWorkerConfig();
  const researchConfig = readResearchConfig();
  const llmProvider = new OpenAiStructuredLlmProvider(readOpenAiLlmConfig());
  const cachedResearch = new CachedResearchFetcher(
    repositories.researchCache,
    (url) => safeFetchText(url, researchConfig),
    researchConfig,
  );
  const hasDiscussionSearchKey = Boolean(
    process.env.BRAVE_SEARCH_API_KEY?.trim() || process.env.SEARCH_API_KEY?.trim(),
  );
  const generateKit: KitGenerator = createFullKitGenerator({
    provider: llmProvider,
    researchConfig,
    fetchText: (url) => cachedResearch.fetch(url),
    ...(hasDiscussionSearchKey
      ? { discussionProvider: new BraveDiscussionSearchProvider(readBraveSearchConfig()) }
      : {}),
  });
  const authService = new AuthService(
    repositories.users,
    repositories.sessions,
    authConfig.sessionTtlMs,
  );
  const generationRequests = new GenerationRequestService(
    repositories.kits,
    repositories.generationJobs,
    workerConfig.maxAttempts,
  );
  const worker = new GenerationWorker(repositories, generateKit, workerConfig);
  const runQueuedGeneration = async () => {
    await worker.recoverStale();
    await worker.runOnce();
  };
  const onGenerationQueued = () => {
    const work = runQueuedGeneration().catch((error: unknown) => {
      console.error('Queued generation invocation failed.', error);
    });

    if (process.env.VERCEL === '1') {
      waitUntil(work);
    } else {
      void work;
    }
  };
  const regenerateKit = async (document: KitDocument, target: RegenerationTarget) => {
    if (!document.kit) {
      throw new Error('A non-ready kit cannot be regenerated.');
    }

    const fresh = await generateKit(document.input, {
      researchedAt: new Date().toISOString(),
    });
    return mergeRegeneratedKit(document.kit, fresh, target);
  };
  const app = createApp({
    authConfig,
    authService,
    generationRequests,
    onGenerationQueued,
    regenerateKit,
    repositories,
  });

  return {
    app,
    worker,
    close: () => databaseConnection.close(),
  };
}

export function getApiRuntime() {
  runtimePromise ??= createRuntime().catch((error: unknown) => {
    runtimePromise = undefined;
    throw error;
  });
  return runtimePromise;
}
