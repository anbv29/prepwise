import {
  BatchOutputSchema,
  KitSchema,
  type BatchInputCase,
  type BatchOutput,
  type BatchResult,
  type Kit,
} from '@prep-kit/contracts';

export interface KitGenerationInput {
  jobDescription: string;
  companyUrl: string;
  daysAvailable: number;
}

export interface KitGenerationContext {
  researchedAt: string;
}

export type KitGenerator = (
  input: KitGenerationInput,
  context: KitGenerationContext,
) => Promise<Kit>;

export interface EvaluateBatchOptions {
  now?: () => Date;
}

export class BatchCaseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BatchCaseError';
    this.code = code;
  }
}

function normaliseCaseError(error: unknown) {
  if (error instanceof BatchCaseError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: unknown };

    return {
      code:
        typeof errorWithCode.code === 'string' && errorWithCode.code.length > 0
          ? errorWithCode.code
          : 'GENERATION_FAILED',
      message: error.message || 'A kit could not be produced.',
    };
  }

  return {
    code: 'GENERATION_FAILED',
    message: 'A kit could not be produced.',
  };
}

export async function evaluateBatch(
  cases: readonly BatchInputCase[],
  generateKit: KitGenerator,
  options: EvaluateBatchOptions = {},
): Promise<BatchOutput> {
  const generatedAt = (options.now ?? (() => new Date()))().toISOString();
  const results: BatchResult[] = [];

  for (const batchCase of cases) {
    try {
      const generatedKit = await generateKit(
        {
          jobDescription: batchCase.jd,
          companyUrl: batchCase.company_url,
          daysAvailable: batchCase.days,
        },
        { researchedAt: generatedAt },
      );
      const parsedKit = KitSchema.safeParse(generatedKit);

      if (!parsedKit.success) {
        throw new BatchCaseError(
          'KIT_VALIDATION_FAILED',
          'The generated kit did not match the required structure.',
        );
      }

      results.push({
        id: batchCase.id,
        status: 'ok',
        kit: parsedKit.data,
        error: null,
      });
    } catch (error) {
      results.push({
        id: batchCase.id,
        status: 'failed',
        kit: null,
        error: normaliseCaseError(error),
      });
    }
  }

  return BatchOutputSchema.parse({
    version: '1.0',
    generated_at: generatedAt,
    kits: results,
  });
}
