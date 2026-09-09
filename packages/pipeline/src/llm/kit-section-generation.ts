import type { CompanyBrief, Flashcard, Question, Role } from '@prep-kit/contracts';

import type { CoverageReport } from '../coverage.js';
import type { CompanyResearchPage } from '../research/company-crawler.js';
import type { DiscussionSignal } from '../research/discussion-search.js';
import { generateCompanyBrief } from './company-brief-generation.js';
import { generateFlashcards } from './flashcard-generation.js';
import type { GenerationCallMetadata } from './generation-shared.js';
import type { StructuredLlmProvider } from './provider.js';
import { generateInterviewQuestions } from './question-generation.js';

export interface KitSectionGenerationInput {
  company: string;
  companyPages: readonly CompanyResearchPage[];
  discussionSignals: readonly DiscussionSignal[];
  role: Role;
}

export interface GeneratedKitSections {
  calls: GenerationCallMetadata[];
  companyBrief: CompanyBrief;
  coverage: CoverageReport;
  flashcards: Flashcard[];
  questions: Question[];
  warnings: string[];
}

export async function generateKitSections(
  input: KitSectionGenerationInput,
  provider: StructuredLlmProvider,
): Promise<GeneratedKitSections> {
  const company = await generateCompanyBrief(input.company, input.companyPages, provider);
  const questions = await generateInterviewQuestions(
    {
      companyBrief: company.companyBrief,
      discussionSignals: input.discussionSignals,
      role: input.role,
    },
    provider,
  );
  const flashcards = await generateFlashcards(
    { questions: questions.questions, role: input.role },
    provider,
  );

  return {
    calls: [...company.calls, ...questions.calls, ...flashcards.calls],
    companyBrief: company.companyBrief,
    coverage: questions.coverage,
    flashcards: flashcards.flashcards,
    questions: questions.questions,
    warnings: [...company.warnings, ...questions.warnings, ...flashcards.warnings],
  };
}
