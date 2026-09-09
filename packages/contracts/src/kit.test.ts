import { describe, expect, it } from 'vitest';

import { createValidKit } from '../../../tests/fixtures/valid-kit.js';
import { KitSchema } from './kit.js';

describe('KitSchema', () => {
  it('accepts a complete Appendix A kit', () => {
    expect(KitSchema.safeParse(createValidKit()).success).toBe(true);
  });

  it('rejects a kit with a missing required top-level section', () => {
    const candidate: Record<string, unknown> = { ...createValidKit() };
    delete candidate.coverage;

    expect(KitSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([
    ['requirement kind', { kind: 'leadership' }],
    ['requirement priority', { priority: 'optional' }],
  ])('rejects an invalid %s', (_label, requirementChanges) => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      role: {
        ...kit.role,
        requirements: [{ ...kit.role.requirements[0], ...requirementChanges }],
      },
    };

    expect(KitSchema.safeParse(candidate).success).toBe(false);
  });

  it.each([0, 4, 1.5])('rejects question difficulty %s', (difficulty) => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      questions: [{ ...kit.questions[0], difficulty }],
    };

    expect(KitSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects duplicate ids within a collection', () => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      questions: [kit.questions[0], { ...kit.questions[1], id: 'q1' }],
    };

    expect(KitSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects references to requirements that do not exist', () => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      questions: [{ ...kit.questions[0], requirement_ids: ['missing-requirement'] }],
      schedule: {
        days_available: 2,
        days: [
          { ...kit.schedule.days[0], question_ids: ['q1'] },
          { ...kit.schedule.days[1], question_ids: [] },
        ],
      },
    };

    expect(KitSchema.safeParse(candidate).success).toBe(false);
  });

  it('rejects references to questions that do not exist', () => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      schedule: {
        ...kit.schedule,
        days: [
          { ...kit.schedule.days[0], question_ids: ['missing-question'] },
          kit.schedule.days[1],
        ],
      },
    };

    expect(KitSchema.safeParse(candidate).success).toBe(false);
  });

  it('requires exactly days_available sequential schedule entries', () => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      schedule: {
        days_available: 3,
        days: [kit.schedule.days[0], { ...kit.schedule.days[1], day: 3 }],
      },
    };

    const result = KitSchema.safeParse(candidate);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        'Schedule must contain exactly days_available entries.',
      );
    }
  });

  it('preserves genuine extensions while requiring the prescribed fields', () => {
    const kit = createValidKit();
    const candidate = {
      ...kit,
      research_warnings: ['No public interview discussions were found.'],
      role: {
        ...kit.role,
        requirements: [
          { ...kit.role.requirements[0], evidence: 'Required skills section' },
          ...kit.role.requirements.slice(1),
        ],
      },
    };

    const parsed = KitSchema.parse(candidate);

    expect(parsed.research_warnings).toEqual(['No public interview discussions were found.']);
    expect(parsed.role.requirements[0]?.evidence).toBe('Required skills section');
  });
});
