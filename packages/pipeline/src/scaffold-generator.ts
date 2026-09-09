import { KitSchema, type Kit } from '@prep-kit/contracts';

import {
  type KitGenerationContext,
  type KitGenerationInput,
  type KitGenerator,
} from './batch-evaluation.js';
import { checkCoverage, createCoverageSection } from './coverage.js';
import { buildSchedule } from './schedule.js';

function deriveCompanyName(companyUrl: string) {
  try {
    const hostname = new URL(companyUrl).hostname.replace(/^www\./u, '');
    const firstHostnamePart = hostname.split('.')[0] ?? hostname;
    const words = firstHostnamePart.split(/[-_]/u).filter(Boolean);
    const name = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');

    return name || 'Unknown company';
  } catch {
    return 'Unknown company';
  }
}

function deriveRoleTitle(jobDescription: string) {
  const firstMeaningfulLine = jobDescription
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstMeaningfulLine?.slice(0, 120) || 'Unspecified role';
}

export const createScaffoldKit: KitGenerator = async (
  input: KitGenerationInput,
  context: KitGenerationContext,
): Promise<Kit> => {
  const company = deriveCompanyName(input.companyUrl);
  const roleTitle = deriveRoleTitle(input.jobDescription);
  const requirements: Kit['role']['requirements'] = [];
  const questions: Kit['questions'] = [];
  const coverageReport = checkCoverage(requirements, questions);

  return KitSchema.parse({
    source: {
      company,
      company_url: input.companyUrl,
      role: roleTitle,
      location: '',
      jd_chars: input.jobDescription.length,
      researched_at: context.researchedAt,
      pages_used: [],
    },
    company_brief: {
      summary: 'Company research has not been run yet.',
      what_they_do: 'No company information has been retrieved yet.',
      sources: [],
    },
    role: {
      title: roleTitle,
      seniority: '',
      responsibilities: [],
      requirements,
    },
    questions,
    flashcards: [],
    schedule: buildSchedule({
      daysAvailable: input.daysAvailable,
      requirements,
      questions,
    }),
    coverage: createCoverageSection(coverageReport, 0),
  });
};
