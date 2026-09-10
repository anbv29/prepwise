import { describe, expect, it, vi } from 'vitest';

import type { GeminiLlmConfig } from '../llm/config.js';
import type { DiscussionSearchError } from './discussion-search.js';
import {
  GeminiDiscussionSearchProvider,
  type GeminiGroundedSearchClient,
} from './gemini-discussion-search.js';

const config: GeminiLlmConfig = {
  apiKey: 'gemini-secret',
  maxRetries: 2,
  model: 'gemini-test-model',
  timeoutMs: 1_000,
};

function fakeClient(generateContent: ReturnType<typeof vi.fn>) {
  return { models: { generateContent } } as unknown as GeminiGroundedSearchClient;
}

describe('GeminiDiscussionSearchProvider', () => {
  it('uses Google Search grounding and returns bounded structured results', async () => {
    const generateContent = vi.fn(async () => ({
      text: JSON.stringify({
        results: [
          {
            description: 'A technical screen and system-design discussion.',
            title: 'Interview experience',
            url: 'https://www.reddit.com/r/interviews/example',
          },
          {
            description: 'This extra result is removed by the requested limit.',
            title: 'Extra result',
            url: 'https://www.reddit.com/r/jobs/extra',
          },
        ],
      }),
    }));
    const provider = new GeminiDiscussionSearchProvider(config, fakeClient(generateContent));

    await expect(provider.search('site:reddit.com Example interview', 1)).resolves.toEqual([
      {
        description: 'A technical screen and system-design discussion.',
        title: 'Interview experience',
        url: 'https://www.reddit.com/r/interviews/example',
      },
    ]);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-test-model',
        config: expect.objectContaining({
          responseMimeType: 'application/json',
          tools: [{ googleSearch: {} }],
        }),
      }),
    );
  });

  it('reports unavailable grounding quota without retrying', async () => {
    const generateContent = vi.fn(async () =>
      Promise.reject(
        Object.assign(new Error('RESOURCE_EXHAUSTED: quota and billing required'), {
          status: 429,
        }),
      ),
    );
    const sleep = vi.fn(async () => undefined);
    const provider = new GeminiDiscussionSearchProvider(config, fakeClient(generateContent), sleep);

    await expect(provider.search('query', 10)).rejects.toMatchObject<
      Partial<DiscussionSearchError>
    >({
      code: 'SEARCH_QUOTA_EXHAUSTED',
      retryable: false,
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries malformed model output once', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: '{"results":[' })
      .mockResolvedValueOnce({ text: JSON.stringify({ results: [] }) });
    const sleep = vi.fn(async () => undefined);
    const provider = new GeminiDiscussionSearchProvider(config, fakeClient(generateContent), sleep);

    await expect(provider.search('query', 10)).resolves.toEqual([]);
    expect(sleep).toHaveBeenCalledWith(250);
  });
});
