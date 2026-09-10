import { z } from 'zod';

const integerStringSchema = z.string().regex(/^\d+$/u).transform(Number);

export interface OpenAiLlmConfig {
  apiKey: string;
  maxRetries: number;
  model: string;
  timeoutMs: number;
}

export interface GeminiLlmConfig {
  apiKey: string;
  maxRetries: number;
  model: string;
  timeoutMs: number;
}

export type LlmProviderName = 'gemini' | 'openai';

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

export function readGeminiLlmConfig(
  environment: Record<string, string | undefined> = process.env,
): GeminiLlmConfig {
  const apiKey = environment.GEMINI_API_KEY?.trim();
  const model = environment.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';

  if (!apiKey) {
    throw new LlmConfigError('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
  }

  if (model.length > 100 || !/^[A-Za-z0-9._:-]+$/u.test(model)) {
    throw new LlmConfigError('GEMINI_MODEL contains invalid characters.');
  }

  return {
    apiKey,
    maxRetries: boundedInteger(environment.LLM_MAX_RETRIES, 2, 0, 5, 'LLM_MAX_RETRIES'),
    model,
    timeoutMs: boundedInteger(environment.LLM_TIMEOUT_MS, 60_000, 1_000, 120_000, 'LLM_TIMEOUT_MS'),
  };
}

export function readLlmProviderName(
  environment: Record<string, string | undefined> = process.env,
): LlmProviderName {
  const value = environment.LLM_PROVIDER?.trim().toLowerCase() || 'openai';

  if (value !== 'openai' && value !== 'gemini') {
    throw new LlmConfigError('LLM_PROVIDER must be either openai or gemini.');
  }

  return value;
}
