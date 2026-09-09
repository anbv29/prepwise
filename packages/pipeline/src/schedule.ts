import {
  ScheduleSchema,
  type Question,
  type QuestionCategory,
  type Requirement,
  type Schedule,
} from '@prep-kit/contracts';

import { checkCoverage } from './coverage.js';

export type ScheduleInputErrorCode =
  | 'INVALID_DAYS_AVAILABLE'
  | 'INVALID_QUESTION_DIFFICULTY'
  | 'UNCOVERED_MUST_REQUIREMENTS'
  | 'UNKNOWN_REQUIREMENT_REFERENCE';

export class ScheduleInputError extends Error {
  readonly code: ScheduleInputErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: ScheduleInputErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ScheduleInputError';
    this.code = code;
    this.details = details;
  }
}

export type ScheduleQuestion = Pick<Question, 'id' | 'requirement_ids' | 'category' | 'difficulty'>;

export interface BuildScheduleInput {
  daysAvailable: number;
  requirements: readonly Requirement[];
  questions: readonly ScheduleQuestion[];
}

interface ScheduledQuestion {
  question: ScheduleQuestion;
  estimatedMinutes: number;
  priorityRank: number;
  originalIndex: number;
}

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  technical: 'Technical practice',
  behavioural: 'Behavioural practice',
  'system-design': 'System design practice',
  'company-fit': 'Company fit practice',
};

function validateDaysAvailable(daysAvailable: number) {
  if (!Number.isInteger(daysAvailable) || daysAvailable < 1) {
    throw new ScheduleInputError(
      'INVALID_DAYS_AVAILABLE',
      'daysAvailable must be a positive integer.',
      { daysAvailable },
    );
  }
}

function estimateQuestionMinutes(difficulty: number) {
  switch (difficulty) {
    case 1:
      return 20;
    case 2:
      return 30;
    case 3:
      return 45;
    default:
      throw new ScheduleInputError(
        'INVALID_QUESTION_DIFFICULTY',
        'Question difficulty must be an integer from 1 to 3.',
        { difficulty },
      );
  }
}

function estimateReviewMinutes(difficulty: number) {
  switch (difficulty) {
    case 1:
      return 15;
    case 2:
      return 20;
    case 3:
      return 25;
    default:
      throw new ScheduleInputError(
        'INVALID_QUESTION_DIFFICULTY',
        'Question difficulty must be an integer from 1 to 3.',
        { difficulty },
      );
  }
}

function getFocus(questions: readonly ScheduleQuestion[]) {
  const categories = [...new Set(questions.map((question) => question.category))];

  if (categories.length === 0) {
    return 'Role and company review';
  }

  if (categories.length === 1) {
    const category = categories[0];
    return category === undefined ? 'Interview practice' : CATEGORY_LABELS[category];
  }

  if (categories.length === 2) {
    const firstCategory = categories[0];
    const secondCategory = categories[1];

    if (firstCategory !== undefined && secondCategory !== undefined) {
      return `${CATEGORY_LABELS[firstCategory]} and ${CATEGORY_LABELS[secondCategory]}`;
    }
  }

  return 'Mixed interview practice';
}

function rankQuestions(
  requirements: readonly Requirement[],
  questions: readonly ScheduleQuestion[],
) {
  const priorityByRequirementId = new Map(
    requirements.map((requirement) => [requirement.id, requirement.priority]),
  );

  return questions
    .map((question, originalIndex): ScheduledQuestion => {
      const priorities = question.requirement_ids.map((requirementId) =>
        priorityByRequirementId.get(requirementId),
      );
      const priorityRank = priorities.includes('must') ? 2 : priorities.includes('nice') ? 1 : 0;

      return {
        question,
        estimatedMinutes: estimateQuestionMinutes(question.difficulty),
        priorityRank,
        originalIndex,
      };
    })
    .sort((left, right) => {
      if (left.priorityRank !== right.priorityRank) {
        return right.priorityRank - left.priorityRank;
      }

      if (left.question.difficulty !== right.question.difficulty) {
        return right.question.difficulty - left.question.difficulty;
      }

      return left.originalIndex - right.originalIndex;
    });
}

function distributeInitialQuestions(tasks: readonly ScheduledQuestion[], dayCount: number) {
  const buckets = Array.from({ length: dayCount }, () => [] as ScheduledQuestion[]);

  if (dayCount === 0) {
    return buckets;
  }

  let bucketIndex = 0;
  let currentMinutes = 0;
  let remainingMinutes = tasks.reduce((total, task) => total + task.estimatedMinutes, 0);
  let remainingDays = dayCount;

  tasks.forEach((task, taskIndex) => {
    const currentBucket = buckets[bucketIndex];

    if (currentBucket === undefined) {
      throw new Error('Schedule allocation reached an unavailable day bucket.');
    }

    const tasksRemaining = tasks.length - taskIndex;
    const emptyDaysAfterCurrent = dayCount - bucketIndex - 1;
    const targetMinutes = Math.ceil(remainingMinutes / remainingDays);
    const mustReserveTasksForLaterDays =
      currentBucket.length > 0 && tasksRemaining <= emptyDaysAfterCurrent;
    const shouldBalanceCurrentDay =
      currentBucket.length > 0 && currentMinutes + task.estimatedMinutes > targetMinutes;

    if (bucketIndex < dayCount - 1 && (mustReserveTasksForLaterDays || shouldBalanceCurrentDay)) {
      remainingMinutes -= currentMinutes;
      remainingDays -= 1;
      bucketIndex += 1;
      currentMinutes = 0;
    }

    const destinationBucket = buckets[bucketIndex];

    if (destinationBucket === undefined) {
      throw new Error('Schedule allocation reached an unavailable destination bucket.');
    }

    destinationBucket.push(task);
    currentMinutes += task.estimatedMinutes;
  });

  return buckets;
}

export function buildSchedule({
  daysAvailable,
  requirements,
  questions,
}: BuildScheduleInput): Schedule {
  validateDaysAvailable(daysAvailable);

  const coverage = checkCoverage(requirements, questions);

  if (coverage.unknownReferences.length > 0) {
    throw new ScheduleInputError(
      'UNKNOWN_REQUIREMENT_REFERENCE',
      'Questions contain references to requirements that do not exist.',
      { references: coverage.unknownReferences },
    );
  }

  if (!coverage.isMustCoverageComplete) {
    throw new ScheduleInputError(
      'UNCOVERED_MUST_REQUIREMENTS',
      'Every must-have requirement needs a question before a schedule can be built.',
      { requirementIds: coverage.uncoveredMustRequirementIds },
    );
  }

  const rankedQuestions = rankQuestions(requirements, questions);
  const initialDayCount = Math.min(daysAvailable, rankedQuestions.length);
  const initialBuckets = distributeInitialQuestions(rankedQuestions, initialDayCount);
  const days: Schedule['days'] = initialBuckets.map((bucket, index) => ({
    day: index + 1,
    focus: getFocus(bucket.map((task) => task.question)),
    question_ids: bucket.map((task) => task.question.id),
    minutes: bucket.reduce((total, task) => total + task.estimatedMinutes, 0),
  }));

  while (days.length < daysAvailable) {
    const dayNumber = days.length + 1;

    if (rankedQuestions.length === 0) {
      days.push({
        day: dayNumber,
        focus: 'Role and company review',
        question_ids: [],
        minutes: 15,
      });
      continue;
    }

    const reviewIndex = (dayNumber - initialDayCount - 1) % rankedQuestions.length;
    const reviewTask = rankedQuestions[reviewIndex];

    if (reviewTask === undefined) {
      throw new Error('Schedule review allocation could not select a question.');
    }

    days.push({
      day: dayNumber,
      focus: `Review: ${getFocus([reviewTask.question])}`,
      question_ids: [reviewTask.question.id],
      minutes: estimateReviewMinutes(reviewTask.question.difficulty),
    });
  }

  return ScheduleSchema.parse({
    days_available: daysAvailable,
    days,
  });
}
