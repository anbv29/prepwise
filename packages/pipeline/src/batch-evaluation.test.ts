import { describe, expect, it, vi } from 'vitest';

import type { BatchInputCase, Kit } from '@prep-kit/contracts';

import { createValidKit } from '../../../tests/fixtures/valid-kit.js';
import { BatchCaseError, evaluateBatch, type KitGenerator } from './batch-evaluation.js';

const cases: BatchInputCase[] = [
  {
    id: 'case-01',
    jd: 'Senior Software Engineer',
    company_url: 'https://example.com',
    days: 2,
  },
  {
    id: 'case-02',
    jd: 'Backend Engineer',
    company_url: 'https://example.org',
    days: 2,
  },
];

const fixedNow = () => new Date('2026-09-09T08:00:00.000Z');

describe('evaluateBatch', () => {
  it('returns one successful result per case in input order', async () => {
    const generator: KitGenerator = vi.fn(async () => createValidKit());

    const output = await evaluateBatch(cases, generator, { now: fixedNow });

    expect(output.version).toBe('1.0');
    expect(output.generated_at).toBe('2026-09-09T08:00:00.000Z');
    expect(output.kits.map((result) => result.id)).toEqual(['case-01', 'case-02']);
    expect(output.kits.every((result) => result.status === 'ok')).toBe(true);
    expect(generator).toHaveBeenCalledTimes(2);
  });

  it('passes each case and the shared research timestamp to the generator', async () => {
    const generator: KitGenerator = vi.fn(async () => createValidKit());

    await evaluateBatch(
      [cases[0]].filter((item): item is BatchInputCase => item !== undefined),
      generator,
      {
        now: fixedNow,
      },
    );

    expect(generator).toHaveBeenCalledWith(
      {
        jobDescription: 'Senior Software Engineer',
        companyUrl: 'https://example.com',
        daysAvailable: 2,
      },
      {
        researchedAt: '2026-09-09T08:00:00.000Z',
      },
    );
  });

  it('continues processing after one case fails', async () => {
    const generator: KitGenerator = async (input) => {
      if (input.jobDescription === 'Senior Software Engineer') {
        throw new BatchCaseError(
          'PROVIDER_UNAVAILABLE',
          'The provider is temporarily unavailable.',
        );
      }

      return createValidKit();
    };

    const output = await evaluateBatch(cases, generator, { now: fixedNow });

    expect(output.kits).toEqual([
      {
        id: 'case-01',
        status: 'failed',
        kit: null,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'The provider is temporarily unavailable.',
        },
      },
      {
        id: 'case-02',
        status: 'ok',
        kit: createValidKit(),
        error: null,
      },
    ]);
  });

  it('records invalid generated structures as a case failure', async () => {
    const generator: KitGenerator = async () => ({ source: {} }) as Kit;

    const output = await evaluateBatch(
      [cases[0]].filter((item): item is BatchInputCase => item !== undefined),
      generator,
      { now: fixedNow },
    );

    expect(output.kits[0]).toEqual({
      id: 'case-01',
      status: 'failed',
      kit: null,
      error: {
        code: 'KIT_VALIDATION_FAILED',
        message: 'The generated kit did not match the required structure.',
      },
    });
  });

  it('normalises non-error throws without aborting the batch', async () => {
    const generator: KitGenerator = async () => {
      throw 'provider stopped';
    };

    const output = await evaluateBatch(
      [cases[0]].filter((item): item is BatchInputCase => item !== undefined),
      generator,
      { now: fixedNow },
    );

    expect(output.kits[0]?.status).toBe('failed');
    expect(output.kits[0]?.error).toEqual({
      code: 'GENERATION_FAILED',
      message: 'A kit could not be produced.',
    });
  });
});
