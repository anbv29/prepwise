import { ObjectId } from 'mongodb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResearchCacheDocument, ResearchCacheRepository } from '@prep-kit/database';
import { ResearchFetchError, type SafeTextResponse } from '@prep-kit/pipeline';

import { CachedResearchFetcher } from '../src/generation/research-cache.js';

const NOW = new Date('2026-09-09T10:00:00.000Z');
const SUCCESS_TTL = 86_400_000;
const FAILURE_TTL = 300_000;

describe('CachedResearchFetcher', () => {
  let findFreshByUrlHash: ReturnType<typeof vi.fn<ResearchCacheRepository['findFreshByUrlHash']>>;
  let save: ReturnType<typeof vi.fn<ResearchCacheRepository['save']>>;
  let fetchText: ReturnType<typeof vi.fn<(url: string) => Promise<SafeTextResponse>>>;
  let fetcher: CachedResearchFetcher;

  beforeEach(() => {
    findFreshByUrlHash = vi.fn(async () => null);
    save = vi.fn(async () => undefined);
    fetchText = vi.fn(async (url) => ({
      contentType: 'text/html',
      finalUrl: url,
      status: 200,
      text: '<html>Company</html>',
    }));
    fetcher = new CachedResearchFetcher(
      { findFreshByUrlHash, save },
      fetchText,
      { cacheFailureTtlMs: FAILURE_TTL, cacheSuccessTtlMs: SUCCESS_TTL },
      () => NOW,
    );
  });

  it('returns a fresh successful entry without making a network request', async () => {
    const cached: ResearchCacheDocument = {
      _id: new ObjectId(),
      urlHash: 'a'.repeat(64),
      url: 'https://example.com/about',
      status: 'ok',
      content: 'Cached company information',
      contentType: 'text/plain',
      failure: null,
      fetchedAt: NOW,
      expiresAt: new Date(NOW.getTime() + SUCCESS_TTL),
    };
    findFreshByUrlHash.mockResolvedValue(cached);

    await expect(fetcher.fetch('https://example.com/about')).resolves.toEqual({
      contentType: 'text/plain',
      finalUrl: 'https://example.com/about',
      status: 200,
      text: 'Cached company information',
    });
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('stores a successful bounded response with a long expiry', async () => {
    const response = await fetcher.fetch('https://example.com/about');

    expect(response.text).toContain('Company');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        urlHash: expect.stringMatching(/^[a-f\d]{64}$/u),
        url: 'https://example.com/about',
        status: 'ok',
        fetchedAt: NOW,
        expiresAt: new Date(NOW.getTime() + SUCCESS_TTL),
      }),
    );
  });

  it('replays cached structured failures without repeating a bad request', async () => {
    const cached: ResearchCacheDocument = {
      _id: new ObjectId(),
      urlHash: 'a'.repeat(64),
      url: 'https://example.com/private',
      status: 'failed',
      content: null,
      contentType: null,
      failure: {
        code: 'PRIVATE_NETWORK_ADDRESS',
        message: 'Private address blocked.',
        retryable: false,
      },
      fetchedAt: NOW,
      expiresAt: new Date(NOW.getTime() + FAILURE_TTL),
    };
    findFreshByUrlHash.mockResolvedValue(cached);

    await expect(fetcher.fetch(cached.url)).rejects.toMatchObject({
      code: 'PRIVATE_NETWORK_ADDRESS',
      retryable: false,
    });
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('caches live failures briefly and preserves retryability', async () => {
    fetchText.mockRejectedValue(
      new ResearchFetchError(
        'REQUEST_TIMEOUT',
        'Research request timed out.',
        'https://example.com',
        true,
      ),
    );

    await expect(fetcher.fetch('https://example.com')).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        failure: {
          code: 'REQUEST_TIMEOUT',
          message: 'Research request timed out.',
          retryable: true,
        },
        expiresAt: new Date(NOW.getTime() + FAILURE_TTL),
      }),
    );
  });
});
