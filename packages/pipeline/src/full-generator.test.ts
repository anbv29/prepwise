import { describe, expect, it } from 'vitest';

import { KitSchema } from '@prep-kit/contracts';

import type {
  StructuredGenerationRequest,
  StructuredGenerationResult,
  StructuredLlmProvider,
} from './llm/provider.js';
import type { DiscussionSearchProvider } from './research/discussion-search.js';
import type { ResearchConfig } from './research/config.js';
import { ResearchFetchError, type SafeTextResponse } from './research/safe-fetch.js';
import { createFullKitGenerator } from './full-generator.js';

const researchConfig: ResearchConfig = {
  allowPrivateNetworks: false,
  cacheFailureTtlMs: 300_000,
  cacheSuccessTtlMs: 86_400_000,
  maxPages: 3,
  maxRedirects: 2,
  maxResponseBytes: 100_000,
  maxTextCharsPerPage: 20_000,
  requestTimeoutMs: 5_000,
  userAgent: 'InterviewPrepResearchBot/1.0',
};

const requirementDraft = {
  location: 'Bengaluru or remote',
  requirements: [
    {
      evidence: 'TypeScript is required',
      kind: 'technical',
      priority: 'must',
      text: 'TypeScript',
    },
    {
      evidence: 'Payments experience is preferred',
      kind: 'domain',
      priority: 'nice',
      text: 'Payments domain knowledge',
    },
  ],
  responsibilities: ['Build reliable payment APIs'],
  seniority: 'senior',
  title: 'Senior Platform Engineer',
};

const companyDraft = {
  source_ids: ['company-source-001'],
  summary: 'Example builds infrastructure that helps businesses process payments reliably.',
  what_they_do: 'The company provides payment infrastructure and APIs for other businesses.',
};

const questionDraft = {
  questions: [
    {
      answer_outline:
        'Cover validation, typed boundaries, idempotency, failure recovery, and tradeoffs.',
      category: 'system-design',
      difficulty: 3,
      prompt: 'How would you design a reliable TypeScript payment-processing API?',
      requirement_ids: ['req-001', 'req-002'],
    },
  ],
};

const flashcardDraft = {
  flashcards: [
    {
      back: 'Use typed boundaries, runtime validation, idempotency, and explicit failure handling.',
      front: 'Which controls make a TypeScript payment API reliable?',
      requirement_ids: ['req-001', 'req-002'],
    },
  ],
};

class QueuedProvider implements StructuredLlmProvider {
  readonly schemaNames: string[] = [];

  constructor(private readonly outputs: unknown[]) {}

  async generateObject<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const output = this.outputs.shift();
    this.schemaNames.push(request.schemaName);

    if (output === undefined) {
      throw new Error('Test provider ran out of responses.');
    }

    return {
      data: request.schema.parse(output),
      metadata: {
        inputTokens: 100,
        model: 'test-model',
        outputTokens: 50,
        provider: 'openai',
        responseId: `response-${this.schemaNames.length}`,
      },
    };
  }
}

describe('createFullKitGenerator', () => {
  it('assembles researched and generated sections into a validated Appendix A kit', async () => {
    const provider = new QueuedProvider([
      requirementDraft,
      companyDraft,
      questionDraft,
      flashcardDraft,
    ]);
    const fetchText = async (url: string): Promise<SafeTextResponse> => ({
      contentType: url.endsWith('/robots.txt') ? 'text/plain' : 'text/html',
      finalUrl: url,
      status: 200,
      text: url.endsWith('/robots.txt')
        ? 'User-agent: *\nAllow: /'
        : '<html><head><title>Example</title></head><body><main>Payment infrastructure for businesses.</main></body></html>',
    });
    const discussionProvider: DiscussionSearchProvider = {
      search: async () => [
        {
          description: 'Candidates discuss API and system design.',
          title: 'Example interview experience',
          url: 'https://reddit.com/r/interviews/comments/123/example',
        },
      ],
    };
    const generator = createFullKitGenerator({
      discussionProvider,
      fetchText,
      provider,
      researchConfig,
    });
    const stages: string[] = [];
    let reportedWarnings: readonly { code: string }[] = [];
    const kit = await generator(
      {
        companyUrl: 'https://example.com/',
        daysAvailable: 3,
        jobDescription:
          'Senior Platform Engineer. TypeScript is required. Payments experience is preferred.',
      },
      {
        researchedAt: '2026-09-09T10:00:00.000Z',
        onProgress: (progress) => {
          stages.push(progress.stage);
        },
        onWarnings: (warnings) => {
          reportedWarnings = warnings;
        },
      },
    );

    expect(KitSchema.safeParse(kit).success).toBe(true);
    expect(kit.source).toMatchObject({
      company: 'Example',
      location: 'Bengaluru or remote',
      role: 'Senior Platform Engineer',
      pages_used: ['https://example.com/', 'https://reddit.com/r/interviews/comments/123/example'],
    });
    expect(kit.company_brief.sources).toEqual(['https://example.com/']);
    expect(kit.source.requirement_evidence).toEqual({
      'req-001': 'TypeScript is required',
      'req-002': 'Payments experience is preferred',
    });
    expect(kit.source.generation_calls).toEqual([
      expect.objectContaining({ stage: 'extracting_requirements', responseId: 'response-1' }),
      expect.objectContaining({ stage: 'company_brief', responseId: 'response-2' }),
      expect.objectContaining({ stage: 'questions', responseId: 'response-3' }),
      expect.objectContaining({ stage: 'flashcards', responseId: 'response-4' }),
    ]);
    expect(kit.coverage).toEqual({ uncovered_requirement_ids: [], passes: 1 });
    expect(kit.schedule.days).toHaveLength(3);
    expect(stages).toEqual([
      'researching_company',
      'searching_discussions',
      'generating_company_brief',
      'generating_questions',
      'checking_coverage',
      'generating_flashcards',
      'building_schedule',
      'validating',
    ]);
    expect(reportedWarnings).toEqual([]);
    expect(provider.schemaNames).toEqual([
      'job_description_analysis',
      'company_brief',
      'interview_questions',
      'study_flashcards',
    ]);
  });

  it('continues with explicit fallbacks when optional research is unavailable', async () => {
    const provider = new QueuedProvider([requirementDraft, questionDraft, flashcardDraft]);
    const generator = createFullKitGenerator({
      fetchText: async (url) => {
        throw new ResearchFetchError('REQUEST_TIMEOUT', 'Company research timed out.', url, true);
      },
      provider,
      researchConfig,
    });
    let warningCodes: string[] = [];
    const kit = await generator(
      {
        companyUrl: 'https://example.com/',
        daysAvailable: 2,
        jobDescription:
          'Senior Platform Engineer. TypeScript is required. Payments experience is preferred.',
      },
      {
        researchedAt: '2026-09-09T10:00:00.000Z',
        onWarnings: (warnings) => {
          warningCodes = warnings.map((warning) => warning.code);
        },
      },
    );

    expect(kit.company_brief.sources).toEqual([]);
    expect(kit.company_brief.summary).toContain('No public company pages');
    expect(warningCodes).toEqual([
      'REQUEST_TIMEOUT',
      'DISCUSSION_SEARCH_NOT_CONFIGURED',
      'GENERATION_SANITIZED',
    ]);
    expect(provider.schemaNames).toEqual([
      'job_description_analysis',
      'interview_questions',
      'study_flashcards',
    ]);
  });
});
