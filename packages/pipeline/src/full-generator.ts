import { KitSchema, type Kit } from '@prep-kit/contracts';

import type {
  KitGenerationContext,
  KitGenerationInput,
  KitGenerationProgress,
  KitGenerationWarning,
  KitGenerator,
} from './batch-evaluation.js';
import { createCoverageSection } from './coverage.js';
import { generateCompanyBrief } from './llm/company-brief-generation.js';
import { generateFlashcards } from './llm/flashcard-generation.js';
import type { StructuredLlmProvider } from './llm/provider.js';
import { generateInterviewQuestions } from './llm/question-generation.js';
import { extractRoleRequirements } from './llm/requirement-extraction.js';
import {
  CompanyResearchError,
  crawlCompanySite,
  type CompanyResearchResult,
} from './research/company-crawler.js';
import type { ResearchConfig } from './research/config.js';
import {
  researchInterviewDiscussions,
  type DiscussionResearchResult,
  type DiscussionSearchProvider,
} from './research/discussion-search.js';
import type { SafeTextResponse } from './research/safe-fetch.js';
import { buildSchedule } from './schedule.js';

export interface FullKitGeneratorDependencies {
  discussionSearchDisabled?: boolean;
  discussionProvider?: DiscussionSearchProvider;
  fetchText?: (url: string) => Promise<SafeTextResponse>;
  provider: StructuredLlmProvider;
  researchConfig: ResearchConfig;
}

function deriveCompanyName(companyUrl: string) {
  const hostname = new URL(companyUrl).hostname.replace(/^www\./u, '');
  const meaningfulPart = hostname.split('.')[0] ?? hostname;
  const words = meaningfulPart.split(/[-_]/u).filter(Boolean);
  const company = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
  return company || hostname;
}

async function report(context: KitGenerationContext, progress: KitGenerationProgress) {
  await context.onProgress?.(progress);
}

async function researchCompany(
  companyUrl: string,
  dependencies: FullKitGeneratorDependencies,
): Promise<CompanyResearchResult> {
  try {
    return await crawlCompanySite(companyUrl, dependencies.researchConfig, {
      ...(dependencies.fetchText ? { fetchText: dependencies.fetchText } : {}),
    });
  } catch (error) {
    if (error instanceof CompanyResearchError) {
      return {
        pages: [],
        requestedUrl: companyUrl,
        warnings: [{ code: error.code, message: error.message, url: error.url }],
      };
    }

    throw error;
  }
}

async function researchDiscussions(
  company: string,
  roleTitle: string,
  provider?: DiscussionSearchProvider,
  disabled = false,
): Promise<DiscussionResearchResult> {
  if (!provider) {
    return {
      queries: [],
      signals: [],
      warnings: disabled
        ? []
        : [
            {
              code: 'DISCUSSION_SEARCH_NOT_CONFIGURED',
              message:
                'Public interview discussion search was skipped because no search API key is configured.',
              query: '',
            },
          ],
    };
  }

  return researchInterviewDiscussions(company, roleTitle, provider);
}

function deduplicateWarnings(warnings: readonly KitGenerationWarning[]) {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = `${warning.code}\u0000${warning.message}\u0000${warning.sourceUrl ?? ''}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function createFullKitGenerator(dependencies: FullKitGeneratorDependencies): KitGenerator {
  return async (input: KitGenerationInput, context: KitGenerationContext): Promise<Kit> => {
    const company = deriveCompanyName(input.companyUrl);
    const requirementResult = await extractRoleRequirements(
      input.jobDescription,
      dependencies.provider,
    );

    await report(context, {
      stage: 'researching_company',
      percent: 18,
      message: 'Researching the company website.',
    });
    const companyResearchPromise = researchCompany(input.companyUrl, dependencies);

    await report(context, {
      stage: 'searching_discussions',
      percent: 30,
      message: dependencies.discussionSearchDisabled
        ? 'Preparing the role and company context.'
        : 'Searching public interview discussions.',
    });
    const discussionResearchPromise = researchDiscussions(
      company,
      requirementResult.role.title,
      dependencies.discussionProvider,
      dependencies.discussionSearchDisabled,
    );
    const [companyResearch, discussionResearch] = await Promise.all([
      companyResearchPromise,
      discussionResearchPromise,
    ]);

    await report(context, {
      stage: 'generating_company_brief',
      percent: 42,
      message: 'Generating the grounded company brief.',
    });
    const companyBrief = await generateCompanyBrief(
      company,
      companyResearch.pages,
      dependencies.provider,
    );

    await report(context, {
      stage: 'generating_questions',
      percent: 55,
      message: 'Generating interview questions and answer outlines.',
    });
    const questions = await generateInterviewQuestions(
      {
        companyBrief: companyBrief.companyBrief,
        discussionSignals: discussionResearch.signals,
        role: requirementResult.role,
      },
      dependencies.provider,
    );

    await report(context, {
      stage: 'checking_coverage',
      percent: 72,
      message: 'Checking must-have requirement coverage.',
    });
    await report(context, {
      stage: 'generating_flashcards',
      percent: 78,
      message: 'Generating study flashcards.',
    });
    const flashcards = await generateFlashcards(
      { questions: questions.questions, role: requirementResult.role },
      dependencies.provider,
    );

    await report(context, {
      stage: 'building_schedule',
      percent: 88,
      message: 'Building the preparation schedule.',
    });
    const schedule = buildSchedule({
      daysAvailable: input.daysAvailable,
      questions: questions.questions,
      requirements: requirementResult.role.requirements,
    });
    const warningList = deduplicateWarnings([
      ...companyResearch.warnings.map((warning) => ({
        code: warning.code,
        message: warning.message,
        sourceUrl: warning.url,
      })),
      ...discussionResearch.warnings.map((warning) => ({
        code: warning.code,
        message: warning.message,
      })),
      ...requirementResult.warnings.map((message) => ({
        code: 'REQUIREMENT_EXTRACTION_WARNING',
        message,
      })),
      ...companyBrief.warnings.map((message) => ({
        code: 'GENERATION_SANITIZED',
        message,
      })),
      ...questions.warnings.map((message) => ({
        code: 'GENERATION_SANITIZED',
        message,
      })),
      ...flashcards.warnings.map((message) => ({
        code: 'GENERATION_SANITIZED',
        message,
      })),
    ]);
    await context.onWarnings?.(warningList);

    await report(context, {
      stage: 'validating',
      percent: 95,
      message: 'Validating the complete interview kit.',
    });
    const sectionCalls = [...companyBrief.calls, ...questions.calls, ...flashcards.calls];
    const coveragePasses = sectionCalls.filter((call) =>
      ['questions', 'question_coverage_repair'].includes(call.stage),
    ).length;
    const pagesUsed = [
      ...companyResearch.pages.map((page) => page.url),
      ...discussionResearch.signals.map((signal) => signal.url),
    ].filter((url, index, urls) => urls.indexOf(url) === index);

    return KitSchema.parse({
      source: {
        company,
        company_url: input.companyUrl,
        role: requirementResult.role.title,
        location: requirementResult.location,
        jd_chars: input.jobDescription.length,
        researched_at: context.researchedAt,
        pages_used: pagesUsed,
        generation_calls: [
          { ...requirementResult.metadata, stage: 'extracting_requirements' },
          ...sectionCalls,
        ],
        requirement_evidence: requirementResult.evidenceByRequirementId,
        research_warnings: warningList,
      },
      company_brief: companyBrief.companyBrief,
      role: requirementResult.role,
      questions: questions.questions,
      flashcards: flashcards.flashcards,
      schedule,
      coverage: createCoverageSection(questions.coverage, coveragePasses),
    });
  };
}
