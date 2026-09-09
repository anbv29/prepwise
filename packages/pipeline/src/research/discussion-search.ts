import { load } from 'cheerio';
import { z } from 'zod';

const braveResponseSchema = z.object({
  web: z
    .object({
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          description: z.string().nullish(),
        }),
      ),
    })
    .optional(),
});

export interface SearchResult {
  description: string;
  title: string;
  url: string;
}

export interface DiscussionSearchProvider {
  search: (query: string, limit: number) => Promise<readonly SearchResult[]>;
}

export interface DiscussionSignal extends SearchResult {
  query: string;
  source: 'glassdoor' | 'reddit';
}

export interface DiscussionResearchWarning {
  code: string;
  message: string;
  query: string;
}

export interface DiscussionResearchResult {
  queries: string[];
  signals: DiscussionSignal[];
  warnings: DiscussionResearchWarning[];
}

export interface BraveSearchConfig {
  apiKey: string;
  endpoint: string;
  timeoutMs: number;
}

export class DiscussionSearchError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = 'DiscussionSearchError';
    this.code = code;
    this.retryable = retryable;
  }
}

export class DiscussionSearchConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscussionSearchConfigError';
  }
}

function plainText(value: string) {
  return load(value).text().replace(/\s+/gu, ' ').trim();
}

function safeQueryTerm(value: string, maximumLength: number) {
  const withoutControls = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('');

  return withoutControls
    .replace(/["'`]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength);
}

export function buildDiscussionQueries(company: string, role: string) {
  const safeCompany = safeQueryTerm(company, 120);
  const safeRole = safeQueryTerm(role, 120);

  if (!safeCompany || !safeRole) {
    throw new RangeError('Company and role are required to research interview discussions.');
  }

  return [
    `site:reddit.com ${safeCompany} ${safeRole} interview experience questions`,
    `site:glassdoor.com ${safeCompany} ${safeRole} interview questions`,
  ];
}

export function readBraveSearchConfig(
  environment: Record<string, string | undefined> = process.env,
): BraveSearchConfig {
  const apiKey = environment.BRAVE_SEARCH_API_KEY?.trim() || environment.SEARCH_API_KEY?.trim();
  const timeout = Number(environment.SEARCH_REQUEST_TIMEOUT_MS?.trim() || '10000');

  if (!apiKey) {
    throw new DiscussionSearchConfigError('BRAVE_SEARCH_API_KEY is required.');
  }

  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 60_000) {
    throw new DiscussionSearchConfigError(
      'SEARCH_REQUEST_TIMEOUT_MS must be an integer from 1000 to 60000.',
    );
  }

  return {
    apiKey,
    endpoint: 'https://api.search.brave.com/res/v1/web/search',
    timeoutMs: timeout,
  };
}

export class BraveDiscussionSearchProvider implements DiscussionSearchProvider {
  constructor(
    private readonly config: BraveSearchConfig,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
  ) {}

  async search(query: string, limit: number): Promise<SearchResult[]> {
    const url = new URL(this.config.endpoint);
    url.searchParams.set('q', query.slice(0, 600));
    url.searchParams.set('count', String(Math.min(Math.max(limit, 1), 20)));
    url.searchParams.set('safesearch', 'moderate');
    url.searchParams.set('search_lang', 'en');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    let response: Response;

    try {
      response = await this.fetchImplementation(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': this.config.apiKey,
        },
        signal: controller.signal,
      });
    } catch {
      throw new DiscussionSearchError(
        controller.signal.aborted ? 'SEARCH_TIMEOUT' : 'SEARCH_REQUEST_FAILED',
        controller.signal.aborted ? 'Discussion search timed out.' : 'Discussion search failed.',
        true,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new DiscussionSearchError(
        'SEARCH_HTTP_ERROR',
        `Discussion search returned HTTP ${response.status}.`,
        response.status === 429 || response.status >= 500,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new DiscussionSearchError(
        'SEARCH_INVALID_RESPONSE',
        'Discussion search returned invalid JSON.',
        false,
      );
    }

    const parsed = braveResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new DiscussionSearchError(
        'SEARCH_INVALID_RESPONSE',
        'Discussion search response did not match the expected structure.',
        false,
      );
    }

    return (parsed.data.web?.results ?? []).map((result) => ({
      description: plainText(result.description ?? '').slice(0, 1_000),
      title: plainText(result.title).slice(0, 300),
      url: result.url,
    }));
  }
}

function classifyDiscussionUrl(rawUrl: string) {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/u, '');
  let source: DiscussionSignal['source'];

  if (hostname === 'reddit.com' || hostname.endsWith('.reddit.com')) {
    source = 'reddit';
  } else if (hostname === 'glassdoor.com' || hostname.endsWith('.glassdoor.com')) {
    source = 'glassdoor';
  } else {
    return null;
  }

  url.hash = '';
  return { source, url: url.toString() };
}

export async function researchInterviewDiscussions(
  company: string,
  role: string,
  provider: DiscussionSearchProvider,
  maximumSignals = 8,
): Promise<DiscussionResearchResult> {
  const queries = buildDiscussionQueries(company, role);
  const signals: DiscussionSignal[] = [];
  const warnings: DiscussionResearchWarning[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    try {
      const results = await provider.search(query, 10);

      for (const result of results) {
        const classified = classifyDiscussionUrl(result.url);

        if (!classified || seenUrls.has(classified.url) || signals.length >= maximumSignals) {
          continue;
        }

        seenUrls.add(classified.url);
        signals.push({
          description: plainText(result.description).slice(0, 1_000),
          query,
          source: classified.source,
          title: plainText(result.title).slice(0, 300),
          url: classified.url,
        });
      }
    } catch (error) {
      warnings.push({
        code: error instanceof DiscussionSearchError ? error.code : 'DISCUSSION_SEARCH_FAILED',
        message:
          error instanceof Error ? error.message : 'Public interview discussion search failed.',
        query,
      });
    }
  }

  if (signals.length === 0) {
    warnings.push({
      code: 'NO_DISCUSSION_SIGNALS',
      message: 'No attributable public interview discussion signals were found.',
      query: queries.join(' | '),
    });
  }

  return { queries, signals, warnings };
}
