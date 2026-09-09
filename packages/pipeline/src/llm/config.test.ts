import { describe, expect, it } from 'vitest';

import { LlmConfigError, readOpenAiLlmConfig } from './config.js';

describe('OpenAI LLM configuration', () => {
  it('reads explicit server-side credentials and model selection', () => {
    expect(readOpenAiLlmConfig({ OPENAI_API_KEY: 'secret-key', OPENAI_MODEL: 'gpt-5.5' })).toEqual({
      apiKey: 'secret-key',
      maxRetries: 2,
      model: 'gpt-5.5',
      timeoutMs: 60_000,
    });
  });

  it('supports the original generic environment names', () => {
    expect(
      readOpenAiLlmConfig({ LLM_API_KEY: 'secret-key', LLM_MODEL: 'configured-model' }),
    ).toMatchObject({ apiKey: 'secret-key', model: 'configured-model' });
  });

  it('requires both a key and an explicit model', () => {
    expect(() => readOpenAiLlmConfig({ OPENAI_MODEL: 'gpt-5.5' })).toThrow(LlmConfigError);
    expect(() => readOpenAiLlmConfig({ OPENAI_API_KEY: 'secret-key' })).toThrow(LlmConfigError);
  });

  it('rejects invalid bounds and model names', () => {
    expect(() =>
      readOpenAiLlmConfig({
        OPENAI_API_KEY: 'secret-key',
        OPENAI_MODEL: 'model with spaces',
      }),
    ).toThrow(LlmConfigError);
    expect(() =>
      readOpenAiLlmConfig({
        OPENAI_API_KEY: 'secret-key',
        OPENAI_MODEL: 'gpt-5.5',
        LLM_MAX_RETRIES: '10',
      }),
    ).toThrow(LlmConfigError);
  });
});
