import { describe, expect, it } from 'vitest';

import { ScheduleSchema, type Question, type Requirement } from '@prep-kit/contracts';

import { buildSchedule, ScheduleInputError, type ScheduleQuestion } from './schedule.js';

const requirements: Requirement[] = [
  {
    id: 'r1',
    text: 'Design distributed systems',
    kind: 'technical',
    priority: 'must',
  },
  {
    id: 'r2',
    text: 'Build services with TypeScript',
    kind: 'technical',
    priority: 'must',
  },
  {
    id: 'r3',
    text: 'Mentor junior engineers',
    kind: 'behavioural',
    priority: 'nice',
  },
];

function createQuestion(
  id: string,
  requirementIds: string[],
  category: Question['category'],
  difficulty: number,
): ScheduleQuestion {
  return {
    id,
    requirement_ids: requirementIds,
    category,
    difficulty,
  };
}

const questions: ScheduleQuestion[] = [
  createQuestion('q-nice-hard', ['r3'], 'behavioural', 3),
  createQuestion('q-must-easy', ['r2'], 'technical', 1),
  createQuestion('q-must-hard', ['r1'], 'system-design', 3),
  createQuestion('q-company', [], 'company-fit', 2),
];

describe('buildSchedule', () => {
  it('creates exactly the requested number of sequential days', () => {
    const schedule = buildSchedule({
      daysAvailable: 3,
      requirements,
      questions,
    });

    expect(schedule.days_available).toBe(3);
    expect(schedule.days).toHaveLength(3);
    expect(schedule.days.map((day) => day.day)).toEqual([1, 2, 3]);
    expect(ScheduleSchema.safeParse(schedule).success).toBe(true);
  });

  it('places must-have and harder questions earlier', () => {
    const schedule = buildSchedule({
      daysAvailable: 4,
      requirements,
      questions,
    });

    expect(schedule.days.flatMap((day) => day.question_ids)).toEqual([
      'q-must-hard',
      'q-must-easy',
      'q-nice-hard',
      'q-company',
    ]);
  });

  it('schedules every generated question at least once', () => {
    const schedule = buildSchedule({
      daysAvailable: 2,
      requirements,
      questions,
    });
    const scheduledIds = new Set(schedule.days.flatMap((day) => day.question_ids));

    expect(scheduledIds).toEqual(new Set(questions.map((question) => question.id)));
  });

  it('schedules every must-have requirement through a referenced question', () => {
    const schedule = buildSchedule({
      daysAvailable: 2,
      requirements,
      questions,
    });
    const scheduledIds = new Set(schedule.days.flatMap((day) => day.question_ids));
    const scheduledQuestions = questions.filter((question) => scheduledIds.has(question.id));
    const scheduledRequirementIds = new Set(
      scheduledQuestions.flatMap((question) => question.requirement_ids),
    );

    expect(scheduledRequirementIds).toContain('r1');
    expect(scheduledRequirementIds).toContain('r2');
  });

  it('puts every question into a one-day schedule', () => {
    const schedule = buildSchedule({
      daysAvailable: 1,
      requirements,
      questions,
    });

    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0]?.question_ids).toEqual([
      'q-must-hard',
      'q-must-easy',
      'q-nice-hard',
      'q-company',
    ]);
    expect(schedule.days[0]?.minutes).toBe(140);
  });

  it('creates review sessions when there are more days than questions', () => {
    const schedule = buildSchedule({
      daysAvailable: 6,
      requirements,
      questions,
    });
    const validQuestionIds = new Set(questions.map((question) => question.id));

    expect(schedule.days).toHaveLength(6);
    expect(schedule.days.slice(4).every((day) => day.focus.startsWith('Review:'))).toBe(true);
    expect(
      schedule.days.every((day) =>
        day.question_ids.every((questionId) => validQuestionIds.has(questionId)),
      ),
    ).toBe(true);
  });

  it('handles a 60-day schedule with valid integer durations', () => {
    const schedule = buildSchedule({
      daysAvailable: 60,
      requirements,
      questions,
    });

    expect(schedule.days).toHaveLength(60);
    expect(schedule.days[59]?.day).toBe(60);
    expect(schedule.days.every((day) => Number.isInteger(day.minutes))).toBe(true);
    expect(schedule.days.every((day) => day.minutes > 0)).toBe(true);
  });

  it('creates honest review-only days when there is no extracted material', () => {
    const schedule = buildSchedule({
      daysAvailable: 3,
      requirements: [],
      questions: [],
    });

    expect(schedule.days).toEqual([
      { day: 1, focus: 'Role and company review', question_ids: [], minutes: 15 },
      { day: 2, focus: 'Role and company review', question_ids: [], minutes: 15 },
      { day: 3, focus: 'Role and company review', question_ids: [], minutes: 15 },
    ]);
  });

  it('rejects a schedule when a must-have requirement is uncovered', () => {
    const incompleteQuestions = [createQuestion('q1', ['r1'], 'system-design', 3)];

    expect(() =>
      buildSchedule({
        daysAvailable: 2,
        requirements,
        questions: incompleteQuestions,
      }),
    ).toThrowError(
      new ScheduleInputError(
        'UNCOVERED_MUST_REQUIREMENTS',
        'Every must-have requirement needs a question before a schedule can be built.',
        { requirementIds: ['r2'] },
      ),
    );
  });

  it('rejects unknown requirement references', () => {
    const invalidQuestions = [
      createQuestion('q1', ['r1', 'unknown'], 'system-design', 3),
      createQuestion('q2', ['r2'], 'technical', 2),
    ];

    expect(() =>
      buildSchedule({
        daysAvailable: 2,
        requirements,
        questions: invalidQuestions,
      }),
    ).toThrowError(ScheduleInputError);
  });

  it.each([0, -1, 1.5])('rejects invalid daysAvailable value %s', (daysAvailable) => {
    expect(() =>
      buildSchedule({
        daysAvailable,
        requirements,
        questions,
      }),
    ).toThrowError(ScheduleInputError);
  });

  it.each([0, 4, 1.5])('rejects invalid question difficulty %s', (difficulty) => {
    const invalidQuestions = [
      createQuestion('q1', ['r1'], 'system-design', difficulty),
      createQuestion('q2', ['r2'], 'technical', 2),
    ];

    expect(() =>
      buildSchedule({
        daysAvailable: 2,
        requirements,
        questions: invalidQuestions,
      }),
    ).toThrowError(ScheduleInputError);
  });

  it('is deterministic for the same input', () => {
    const input = {
      daysAvailable: 5,
      requirements,
      questions,
    };

    expect(buildSchedule(input)).toEqual(buildSchedule(input));
  });

  it('does not mutate requirements or questions', () => {
    const originalRequirements = structuredClone(requirements);
    const originalQuestions = structuredClone(questions);

    buildSchedule({
      daysAvailable: 3,
      requirements,
      questions,
    });

    expect(requirements).toEqual(originalRequirements);
    expect(questions).toEqual(originalQuestions);
  });
});
