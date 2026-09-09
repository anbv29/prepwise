import { describe, expect, it, vi } from 'vitest';

import {
  BraveDiscussionSearchProvider,
  buildDiscussionQueries,
  DiscussionSearchConfigError,
  DiscussionSearchError,
  readBraveSearchConfig,
  researchInterviewDiscussions,
  type DiscussionSearchProvider,
} from './discussion-search.js';

describe('discussion search', () => {
  it('builds bounded site-specific queries from untrusted names', () => {
    expect(buildDiscussionQueries('Example "ignore"\nCompany', 'Backend `Engineer`')).toEqual([
      'site:reddit.com Example ignore Company Backend Engineer interview experience questions',
      'site:glassdoor.com Example ignore Company Backend Engineer interview questions',
    ]);
  });

  it('requires server-side Brave Search configuration', () => {
    expect(() => readBraveSearchConfig({})).toThrow(DiscussionSearchConfigError);
    expect(readBraveSearchConfig({ BRAVE_SEARCH_API_KEY: 'secret-key' })).toEqual({
      apiKey: 'secret-key',
      endpoint: 'https://api.search.brave.com/res/v1/web/search',
      timeoutMs: 10_000,
    });
  });

  it('calls Brave Search without exposing the key in the URL and validates results', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(input.toString());
      expect(url.origin + url.pathname).toBe('https://api.search.brave.com/res/v1/web/search');
      expect(url.searchParams.get('safesearch')).toBe('moderate');
      expect(url.toString()).not.toContain('secret-key');
      expect(new Headers(init?.headers).get('X-Subscription-Token')).toBe('secret-key');

      return Response.json({
        web: {
          results: [
            {
              title: '<strong>Interview</strong> experience',
              url: 'https://www.reddit.com/r/jobs/example',
              description: 'Asked about <b>system design</b>.',
            },
          ],
        },
      });
    });
    const provider = new BraveDiscussionSearchProvider(
      {
        apiKey: 'secret-key',
        endpoint: 'https://api.search.brave.com/res/v1/web/search',
        timeoutMs: 1_000,
      },
      fetchMock,
    );

    await expect(provider.search('example query', 10)).resolves.toEqual([
      {
        title: 'Interview experience',
        url: 'https://www.reddit.com/r/jobs/example',
        description: 'Asked about system design.',
      },
    ]);
  });

  it('classifies throttling as retryable', async () => {
    const provider = new BraveDiscussionSearchProvider(
      {
        apiKey: 'secret-key',
        endpoint: 'https://api.search.brave.com/res/v1/web/search',
        timeoutMs: 1_000,
      },
      vi.fn<typeof fetch>(async () => new Response('Limited', { status: 429 })),
    );

    await expect(provider.search('query', 10)).rejects.toEqual(
      expect.objectContaining<Partial<DiscussionSearchError>>({
        code: 'SEARCH_HTTP_ERROR',
        retryable: true,
      }),
    );
  });

  it('keeps only attributable Reddit and Glassdoor HTTPS results', async () => {
    const provider: DiscussionSearchProvider = {
      search: vi.fn(async (query) => {
        return query.includes('reddit.com')
          ? [
              {
                title: 'Reddit result',
                description: 'Interview loop notes',
                url: 'https://www.reddit.com/r/interviews/post#comments',
              },
              {
                title: 'Impersonator',
                description: 'Unsafe result',
                url: 'https://reddit.com.attacker.example/post',
              },
              {
                title: 'Not HTTPS',
                description: 'Unsafe transport',
                url: 'http://reddit.com/post',
              },
            ]
          : [
              {
                title: 'Glassdoor result',
                description: 'Technical screen notes',
                url: 'https://www.glassdoor.com/Interview/example?filter=recent',
              },
            ];
      }),
    };

    const result = await researchInterviewDiscussions('Example', 'Engineer', provider);

    expect(result.signals).toHaveLength(2);
    expect(result.signals.map((signal) => signal.source)).toEqual(['reddit', 'glassdoor']);
    expect(result.signals[0]?.url).toBe('https://www.reddit.com/r/interviews/post');
    expect(result.warnings).toEqual([]);
  });

  it('keeps partial results and reports failed searches', async () => {
    const provider: DiscussionSearchProvider = {
      search: vi.fn(async (query) => {
        if (query.includes('reddit.com')) {
          throw new DiscussionSearchError('SEARCH_TIMEOUT', 'Search timed out.', true);
        }

        return [];
      }),
    };

    const result = await researchInterviewDiscussions('Example', 'Engineer', provider);

    expect(result.signals).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'SEARCH_TIMEOUT',
      'NO_DISCUSSION_SIGNALS',
    ]);
  });
});
