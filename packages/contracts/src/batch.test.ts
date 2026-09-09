import { describe, expect, it } from 'vitest';

import { createValidKit } from '../../../tests/fixtures/valid-kit.js';
import { BatchInputSchema, BatchOutputSchema } from './batch.js';

describe('BatchInputSchema', () => {
  it('accepts Appendix B input cases', () => {
    const input = [
      {
        id: 'case-01',
        jd: 'Senior Backend Engineer\n\nWe are looking for...',
        company_url: 'http://localhost:8099/acme/',
        days: 5,
      },
    ];

    expect(BatchInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects duplicate case ids', () => {
    const batchCase = {
      id: 'case-01',
      jd: 'Software Engineer',
      company_url: 'https://example.com',
      days: 3,
    };

    expect(BatchInputSchema.safeParse([batchCase, batchCase]).success).toBe(false);
  });
});

describe('BatchOutputSchema', () => {
  it('accepts successful and failed results in the same output', () => {
    const output = {
      version: '1.0',
      generated_at: '2026-09-08T10:30:00.000Z',
      kits: [
        {
          id: 'case-01',
          status: 'ok',
          kit: createValidKit(),
          error: null,
        },
        {
          id: 'case-02',
          status: 'failed',
          kit: null,
          error: {
            code: 'GENERATION_FAILED',
            message: 'A kit could not be produced.',
          },
        },
      ],
    };

    expect(BatchOutputSchema.safeParse(output).success).toBe(true);
  });

  it('rejects an ok result without a kit', () => {
    const output = {
      version: '1.0',
      generated_at: '2026-09-08T10:30:00.000Z',
      kits: [
        {
          id: 'case-01',
          status: 'ok',
          kit: null,
          error: null,
        },
      ],
    };

    expect(BatchOutputSchema.safeParse(output).success).toBe(false);
  });

  it('rejects a failed result without a structured error', () => {
    const output = {
      version: '1.0',
      generated_at: '2026-09-08T10:30:00.000Z',
      kits: [
        {
          id: 'case-01',
          status: 'failed',
          kit: null,
          error: null,
        },
      ],
    };

    expect(BatchOutputSchema.safeParse(output).success).toBe(false);
  });

  it('rejects duplicate result ids', () => {
    const result = {
      id: 'case-01',
      status: 'ok',
      kit: createValidKit(),
      error: null,
    };

    const output = {
      version: '1.0',
      generated_at: '2026-09-08T10:30:00.000Z',
      kits: [result, result],
    };

    expect(BatchOutputSchema.safeParse(output).success).toBe(false);
  });
});
