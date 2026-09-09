import { z } from 'zod';

const integerStringSchema = z.string().regex(/^\d+$/u).transform(Number);

export interface OpenAiLlmConfig {
  apiKey: string;
  maxRetries: number;
  model: string;
  timeoutMs: number;
}

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmConfigError';
  }
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  const result = integerStringSchema
    .pipe(z.number().int().min(minimum).max(maximum))
    .safeParse(value?.trim() || String(fallback));

  if (!result.success) {
    throw new LlmConfigError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }

  return result.data;
}

export function readOpenAiLlmConfig(
  environment: Record<string, string | undefined> = process.env,
): OpenAiLlmConfig {
  const apiKey = environment.OPENAI_API_KEY?.trim() || environment.LLM_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim() || environment.LLM_MODEL?.trim();

  if (!apiKey) {
    throw new LlmConfigError('OPENAI_API_KEY is required.');
  }

  if (!model) {
    throw new LlmConfigError('OPENAI_MODEL is required.');
  }

  if (model.length > 100 || !/^[A-Za-z0-9._:-]+$/u.test(model)) {
    throw new LlmConfigError('OPENAI_MODEL contains invalid characters.');
  }

  return {
    apiKey,
    maxRetries: boundedInteger(environment.LLM_MAX_RETRIES, 2, 0, 5, 'LLM_MAX_RETRIES'),
    model,
    timeoutMs: boundedInteger(environment.LLM_TIMEOUT_MS, 60_000, 1_000, 120_000, 'LLM_TIMEOUT_MS'),
  };
}
