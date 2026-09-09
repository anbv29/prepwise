import { describe, expect, it } from 'vitest';

import type { Question, Requirement } from '@prep-kit/contracts';

import { checkCoverage, CoverageInputError, createCoverageSection } from './coverage.js';

const requirements: Requirement[] = [
  {
    id: 'r1',
    text: 'Build services with TypeScript',
    kind: 'technical',
    priority: 'must',
  },
  {
    id: 'r2',
    text: 'Mentor junior engineers',
    kind: 'behavioural',
    priority: 'must',
  },
  {
    id: 'r3',
    text: 'Experience in financial services',
    kind: 'domain',
    priority: 'nice',
  },
];

function createQuestion(
  id: string,
  requirementIds: string[],
): Pick<Question, 'id' | 'requirement_ids'> {
  return {
    id,
    requirement_ids: requirementIds,
  };
}

describe('checkCoverage', () => {
  it('marks every requirement uncovered when there are no questions', () => {
    const report = checkCoverage(requirements, []);

    expect(report.coveredRequirementIds).toEqual([]);
    expect(report.uncoveredRequirementIds).toEqual(['r1', 'r2', 'r3']);
    expect(report.uncoveredMustRequirementIds).toEqual(['r1', 'r2']);
    expect(report.uncoveredNiceRequirementIds).toEqual(['r3']);
    expect(report.isComplete).toBe(false);
    expect(report.isMustCoverageComplete).toBe(false);
  });

  it('covers a requirement through an explicit question reference', () => {
    const questions = [createQuestion('q1', ['r1']), createQuestion('q2', ['r3'])];

    const report = checkCoverage(requirements, questions);

    expect(report.coveredRequirementIds).toEqual(['r1', 'r3']);
    expect(report.uncoveredRequirementIds).toEqual(['r2']);
    expect(report.uncoveredMustRequirementIds).toEqual(['r2']);
    expect(report.uncoveredNiceRequirementIds).toEqual([]);
    expect(report.requirements).toEqual([
      {
        requirementId: 'r1',
        priority: 'must',
        questionIds: ['q1'],
        covered: true,
      },
      {
        requirementId: 'r2',
        priority: 'must',
        questionIds: [],
        covered: false,
      },
      {
        requirementId: 'r3',
        priority: 'nice',
        questionIds: ['q2'],
        covered: true,
      },
    ]);
  });

  it('allows one question to cover multiple requirements', () => {
    const report = checkCoverage(requirements, [createQuestion('q1', ['r1', 'r2', 'r3'])]);

    expect(report.uncoveredRequirementIds).toEqual([]);
    expect(report.isComplete).toBe(true);
    expect(report.isMustCoverageComplete).toBe(true);
  });

  it('does not count a duplicate reference twice', () => {
    const report = checkCoverage(requirements, [createQuestion('q1', ['r1', 'r1'])]);

    expect(report.requirements[0]?.questionIds).toEqual(['q1']);
  });

  it('reports unknown references without treating them as coverage', () => {
    const report = checkCoverage(requirements, [
      createQuestion('q1', ['r1', 'missing', 'missing']),
    ]);

    expect(report.coveredRequirementIds).toEqual(['r1']);
    expect(report.unknownReferences).toEqual([
      {
        questionId: 'q1',
        requirementId: 'missing',
      },
    ]);
  });

  it('preserves requirement and question order in its report', () => {
    const reorderedRequirements = [requirements[2], requirements[0], requirements[1]].filter(
      (requirement): requirement is Requirement => requirement !== undefined,
    );
    const questions = [createQuestion('q2', ['r1']), createQuestion('q1', ['r1'])];

    const report = checkCoverage(reorderedRequirements, questions);

    expect(report.requirements.map((item) => item.requirementId)).toEqual(['r3', 'r1', 'r2']);
    expect(report.requirements[1]?.questionIds).toEqual(['q2', 'q1']);
  });

  it('reports complete coverage for an empty requirement list', () => {
    const report = checkCoverage([], []);

    expect(report.isComplete).toBe(true);
    expect(report.isMustCoverageComplete).toBe(true);
  });

  it('throws a structured error for duplicate requirement ids', () => {
    const duplicateRequirements: Requirement[] = [requirements[0], requirements[0]].filter(
      (requirement): requirement is Requirement => requirement !== undefined,
    );

    expect(() => checkCoverage(duplicateRequirements, [])).toThrowError(
      new CoverageInputError('DUPLICATE_REQUIREMENT_ID', 'r1'),
    );
  });

  it('throws a structured error for duplicate question ids', () => {
    const questions = [createQuestion('q1', ['r1']), createQuestion('q1', ['r2'])];

    expect(() => checkCoverage(requirements, questions)).toThrowError(
      new CoverageInputError('DUPLICATE_QUESTION_ID', 'q1'),
    );
  });

  it('does not mutate its input arrays', () => {
    const originalRequirements = structuredClone(requirements);
    const questions = [createQuestion('q1', ['r1'])];
    const originalQuestions = structuredClone(questions);

    checkCoverage(requirements, questions);

    expect(requirements).toEqual(originalRequirements);
    expect(questions).toEqual(originalQuestions);
  });
});

describe('createCoverageSection', () => {
  it('converts a report into the exact Appendix A coverage shape', () => {
    const report = checkCoverage(requirements, [createQuestion('q1', ['r1'])]);

    expect(createCoverageSection(report, 2)).toEqual({
      uncovered_requirement_ids: ['r2', 'r3'],
      passes: 2,
    });
  });

  it.each([-1, 1.5])('rejects an invalid pass count of %s', (passes) => {
    const report = checkCoverage(requirements, []);

    expect(() => createCoverageSection(report, passes)).toThrow();
  });
});
