import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { ZodType } from 'zod';

import type { OpenAiLlmConfig } from './config.js';

export interface StructuredGenerationRequest<T> {
  input: string;
  instructions: string;
  maxOutputTokens: number;
  schema: ZodType<T>;
  schemaName: string;
}

export interface LlmGenerationMetadata {
  inputTokens: number | null;
  model: string;
  outputTokens: number | null;
  provider: 'gemini' | 'openai';
  responseId: string;
}

export interface StructuredGenerationResult<T> {
  data: T;
  metadata: LlmGenerationMetadata;
}

export interface StructuredLlmProvider {
  generateObject: <T>(
    request: StructuredGenerationRequest<T>,
  ) => Promise<StructuredGenerationResult<T>>;
}

export class LlmProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    code: string,
    message: string,
    retryable: boolean,
    status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'LlmProviderError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

type OpenAiClient = Pick<OpenAI, 'responses'>;
type Sleep = (milliseconds: number) => Promise<void>;

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function statusFromError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  return null;
}

function codeFromError(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function normalizeProviderError(error: unknown) {
  if (error instanceof LlmProviderError) {
    return error;
  }

  const status = statusFromError(error);
  const providerCode = codeFromError(error);
  const name = error instanceof Error ? error.name : '';

  if (
    status === 429 &&
    ['credit_balance_exhausted', 'insufficient_quota'].includes(providerCode ?? '')
  ) {
    return new LlmProviderError(
      'LLM_QUOTA_EXHAUSTED',
      'The OpenAI API account has no credits remaining. Add API credits and retry the job.',
      false,
      status,
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  if (status === 401) {
    return new LlmProviderError(
      'LLM_AUTHENTICATION_FAILED',
      'The OpenAI API key was rejected. Replace the server-side key and retry the job.',
      false,
      status,
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  if (status === 403) {
    return new LlmProviderError(
      'LLM_ACCESS_DENIED',
      'The OpenAI project cannot access the configured model.',
      false,
      status,
      error instanceof Error ? { cause: error } : undefined,
    );
  }

  const retryable =
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    ['APIConnectionError', 'APIConnectionTimeoutError'].includes(name);

  return new LlmProviderError(
    retryable ? 'LLM_TEMPORARILY_UNAVAILABLE' : 'LLM_REQUEST_FAILED',
    retryable
      ? 'The language model is temporarily unavailable.'
      : 'The language model request failed.',
    retryable,
    status,
    error instanceof Error ? { cause: error } : undefined,
  );
}

export class OpenAiStructuredLlmProvider implements StructuredLlmProvider {
  private readonly client: OpenAiClient;

  constructor(
    private readonly config: OpenAiLlmConfig,
    client?: OpenAiClient,
    private readonly sleep: Sleep = defaultSleep,
  ) {
    this.client =
      client ??
      new OpenAI({
        apiKey: config.apiKey,
        maxRetries: 0,
        timeout: config.timeoutMs,
      });
  }

  async generateObject<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>> {
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const response = await this.client.responses.parse({
          input: request.input,
          instructions: request.instructions,
          max_output_tokens: request.maxOutputTokens,
          model: this.config.model,
          store: false,
          text: {
            format: zodTextFormat(request.schema, request.schemaName),
          },
        });

        if (response.output_parsed === null) {
          throw new LlmProviderError(
            'LLM_OUTPUT_MISSING',
            'The language model did not return the required structured output.',
            false,
          );
        }

        return {
          data: request.schema.parse(response.output_parsed),
          metadata: {
            inputTokens: response.usage?.input_tokens ?? null,
            model: response.model,
            outputTokens: response.usage?.output_tokens ?? null,
            provider: 'openai',
            responseId: response.id,
          },
        };
      } catch (error) {
        const normalized = normalizeProviderError(error);

        if (!normalized.retryable || attempt === this.config.maxRetries) {
          throw normalized;
        }

        await this.sleep(250 * 2 ** attempt);
      }
    }

    throw new LlmProviderError('LLM_REQUEST_FAILED', 'Language model request failed.', false);
  }
}
