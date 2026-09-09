import {
  CoverageSchema,
  type Coverage,
  type Question,
  type Requirement,
  type RequirementPriority,
} from '@prep-kit/contracts';

export type CoverageInputErrorCode = 'DUPLICATE_REQUIREMENT_ID' | 'DUPLICATE_QUESTION_ID';

export class CoverageInputError extends Error {
  readonly code: CoverageInputErrorCode;
  readonly duplicateId: string;

  constructor(code: CoverageInputErrorCode, duplicateId: string) {
    const subject = code === 'DUPLICATE_REQUIREMENT_ID' ? 'requirement' : 'question';
    super(`Cannot check coverage with duplicate ${subject} id: ${duplicateId}`);
    this.name = 'CoverageInputError';
    this.code = code;
    this.duplicateId = duplicateId;
  }
}

export interface RequirementCoverage {
  requirementId: string;
  priority: RequirementPriority;
  questionIds: string[];
  covered: boolean;
}

export interface UnknownRequirementReference {
  questionId: string;
  requirementId: string;
}

export interface CoverageReport {
  requirements: RequirementCoverage[];
  coveredRequirementIds: string[];
  uncoveredRequirementIds: string[];
  uncoveredMustRequirementIds: string[];
  uncoveredNiceRequirementIds: string[];
  unknownReferences: UnknownRequirementReference[];
  isComplete: boolean;
  isMustCoverageComplete: boolean;
}

export type CoverageQuestion = Pick<Question, 'id' | 'requirement_ids'>;

function assertUniqueIds(items: readonly { id: string }[], duplicateCode: CoverageInputErrorCode) {
  const seenIds = new Set<string>();

  for (const item of items) {
    if (seenIds.has(item.id)) {
      throw new CoverageInputError(duplicateCode, item.id);
    }

    seenIds.add(item.id);
  }
}

export function checkCoverage(
  requirements: readonly Requirement[],
  questions: readonly CoverageQuestion[],
): CoverageReport {
  assertUniqueIds(requirements, 'DUPLICATE_REQUIREMENT_ID');
  assertUniqueIds(questions, 'DUPLICATE_QUESTION_ID');

  const requirementIds = new Set(requirements.map((requirement) => requirement.id));
  const questionIdsByRequirementId = new Map<string, string[]>();
  const unknownReferences: UnknownRequirementReference[] = [];

  for (const requirement of requirements) {
    questionIdsByRequirementId.set(requirement.id, []);
  }

  for (const question of questions) {
    const referencesSeenInQuestion = new Set<string>();

    for (const requirementId of question.requirement_ids) {
      if (referencesSeenInQuestion.has(requirementId)) {
        continue;
      }

      referencesSeenInQuestion.add(requirementId);

      if (!requirementIds.has(requirementId)) {
        unknownReferences.push({
          questionId: question.id,
          requirementId,
        });
        continue;
      }

      questionIdsByRequirementId.get(requirementId)?.push(question.id);
    }
  }

  const requirementCoverage = requirements.map((requirement): RequirementCoverage => {
    const questionIds = questionIdsByRequirementId.get(requirement.id) ?? [];

    return {
      requirementId: requirement.id,
      priority: requirement.priority,
      questionIds,
      covered: questionIds.length > 0,
    };
  });

  const coveredRequirementIds = requirementCoverage
    .filter((coverage) => coverage.covered)
    .map((coverage) => coverage.requirementId);
  const uncoveredRequirementIds = requirementCoverage
    .filter((coverage) => !coverage.covered)
    .map((coverage) => coverage.requirementId);
  const uncoveredMustRequirementIds = requirementCoverage
    .filter((coverage) => !coverage.covered && coverage.priority === 'must')
    .map((coverage) => coverage.requirementId);
  const uncoveredNiceRequirementIds = requirementCoverage
    .filter((coverage) => !coverage.covered && coverage.priority === 'nice')
    .map((coverage) => coverage.requirementId);

  return {
    requirements: requirementCoverage,
    coveredRequirementIds,
    uncoveredRequirementIds,
    uncoveredMustRequirementIds,
    uncoveredNiceRequirementIds,
    unknownReferences,
    isComplete: uncoveredRequirementIds.length === 0,
    isMustCoverageComplete: uncoveredMustRequirementIds.length === 0,
  };
}

export function createCoverageSection(report: CoverageReport, passes: number): Coverage {
  return CoverageSchema.parse({
    uncovered_requirement_ids: [...report.uncoveredRequirementIds],
    passes,
  });
}
