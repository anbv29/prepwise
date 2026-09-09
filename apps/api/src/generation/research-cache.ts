import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';

import type { ResearchCacheRepository } from '@prep-kit/database';
import { ResearchFetchError, type ResearchConfig, type SafeTextResponse } from '@prep-kit/pipeline';

type CacheRepository = Pick<ResearchCacheRepository, 'findFreshByUrlHash' | 'save'>;

function urlHash(url: string) {
  return createHash('sha256').update(url.trim(), 'utf8').digest('hex');
}

export class CachedResearchFetcher {
  constructor(
    private readonly cache: CacheRepository,
    private readonly fetchText: (url: string) => Promise<SafeTextResponse>,
    private readonly config: Pick<ResearchConfig, 'cacheFailureTtlMs' | 'cacheSuccessTtlMs'>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async fetch(url: string): Promise<SafeTextResponse> {
    const hash = urlHash(url);
    const cached = await this.cache.findFreshByUrlHash(hash);

    if (cached?.status === 'ok') {
      return {
        contentType: cached.contentType ?? 'text/plain',
        finalUrl: cached.url,
        status: 200,
        text: cached.content ?? '',
      };
    }

    if (cached?.status === 'failed' && cached.failure) {
      throw new ResearchFetchError(
        cached.failure.code,
        cached.failure.message,
        cached.url,
        cached.failure.retryable,
      );
    }

    const fetchedAt = this.clock();

    try {
      const response = await this.fetchText(url);
      await this.cache.save({
        _id: new ObjectId(),
        urlHash: hash,
        url: response.finalUrl,
        status: 'ok',
        content: response.text,
        contentType: response.contentType,
        failure: null,
        fetchedAt,
        expiresAt: new Date(fetchedAt.getTime() + this.config.cacheSuccessTtlMs),
      });
      return response;
    } catch (error) {
      if (error instanceof ResearchFetchError) {
        await this.cache.save({
          _id: new ObjectId(),
          urlHash: hash,
          url,
          status: 'failed',
          content: null,
          contentType: null,
          failure: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          },
          fetchedAt,
          expiresAt: new Date(fetchedAt.getTime() + this.config.cacheFailureTtlMs),
        });
      }

      throw error;
    }
  }
}
