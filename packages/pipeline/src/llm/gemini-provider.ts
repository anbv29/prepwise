import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { z } from 'zod';

import type { GeminiLlmConfig } from './config.js';
import {
  LlmProviderError,
  type StructuredGenerationRequest,
  type StructuredGenerationResult,
  type StructuredLlmProvider,
} from './provider.js';

export interface GeminiResponse {
  modelVersion?: string;
  responseId?: string;
  text?: string;
  usageMetadata?: {
    candidatesTokenCount?: number;
    promptTokenCount?: number;
  };
}

export interface GeminiClient {
  models: {
    generateContent: (request: {
      model: string;
      contents: string;
      config: {
        abortSignal: AbortSignal;
        maxOutputTokens: number;
        responseJsonSchema: unknown;
        responseMimeType: string;
        systemInstruction: string;
        thinkingConfig: {
          includeThoughts: boolean;
          thinkingLevel: ThinkingLevel;
        };
      };
    }) => Promise<GeminiResponse>;
  };
}

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

function normalizeGeminiError(error: unknown) {
  if (error instanceof LlmProviderError) return error;

  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return new LlmProviderError(
      'LLM_INVALID_OUTPUT',
      'Gemini returned structured output that did not match the required schema.',
      true,
      null,
      { cause: error },
    );
  }

  const status = statusFromError(error);
  const name = error instanceof Error ? error.name : '';
  const retryable =
    status === 408 ||
    status === 409 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    ['AbortError', 'TypeError'].includes(name);

  return new LlmProviderError(
    retryable ? 'LLM_TEMPORARILY_UNAVAILABLE' : 'LLM_REQUEST_FAILED',
    retryable ? 'The Gemini model is temporarily unavailable.' : 'The Gemini model request failed.',
    retryable,
    status,
    error instanceof Error ? { cause: error } : undefined,
  );
}

function jsonSchemaForGemini(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema: _draftDeclaration, ...supportedSchema } = jsonSchema;

  const removeUnsupportedSizeConstraints = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(removeUnsupportedSizeConstraints);
      return;
    }

    if (typeof value !== 'object' || value === null) return;

    const record = value as Record<string, unknown>;
    delete record.maxItems;
    delete record.maxLength;
    delete record.minItems;
    delete record.minLength;
    Object.values(record).forEach(removeUnsupportedSizeConstraints);
  };

  removeUnsupportedSizeConstraints(supportedSchema);
  return supportedSchema;
}

export class GeminiStructuredLlmProvider implements StructuredLlmProvider {
  private readonly client: GeminiClient;

  constructor(
    private readonly config: GeminiLlmConfig,
    client?: GeminiClient,
    private readonly sleep: Sleep = defaultSleep,
  ) {
    this.client = client ?? (new GoogleGenAI({ apiKey: config.apiKey }) as GeminiClient);
  }

  async generateObject<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>> {
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.client.models.generateContent({
          model: this.config.model,
          contents: request.input,
          config: {
            abortSignal: controller.signal,
            maxOutputTokens: request.maxOutputTokens,
            responseJsonSchema: jsonSchemaForGemini(request.schema),
            responseMimeType: 'application/json',
            systemInstruction: request.instructions,
            thinkingConfig: {
              includeThoughts: false,
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        });
        const output = response.text;

        if (!output) {
          throw new LlmProviderError(
            'LLM_OUTPUT_MISSING',
            'The Gemini model did not return the required structured output.',
            true,
          );
        }

        return {
          data: request.schema.parse(JSON.parse(output)),
          metadata: {
            inputTokens: response.usageMetadata?.promptTokenCount ?? null,
            model: response.modelVersion ?? this.config.model,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
            provider: 'gemini',
            responseId: response.responseId ?? 'unavailable',
          },
        };
      } catch (error) {
        const normalized = normalizeGeminiError(error);

        if (!normalized.retryable || attempt === this.config.maxRetries) {
          throw normalized;
        }

        await this.sleep(250 * 2 ** attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new LlmProviderError('LLM_REQUEST_FAILED', 'Gemini model request failed.', false);
  }
}
