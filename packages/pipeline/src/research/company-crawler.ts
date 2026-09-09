import robotsParserModule from 'robots-parser';

import type { ResearchConfig } from './config.js';
import { extractPageContent, type ExtractedLink } from './content.js';
import {
  ResearchFetchError,
  safeFetchText,
  type SafeFetchDependencies,
  type SafeTextResponse,
} from './safe-fetch.js';

export interface CompanyResearchPage {
  contentType: string;
  text: string;
  title: string;
  truncated: boolean;
  url: string;
}

export interface CompanyResearchWarning {
  code: string;
  message: string;
  url: string;
}

export interface CompanyResearchResult {
  pages: CompanyResearchPage[];
  requestedUrl: string;
  warnings: CompanyResearchWarning[];
}

export interface CompanyCrawlerDependencies extends SafeFetchDependencies {
  fetchText?: (url: string) => Promise<SafeTextResponse>;
}

export class CompanyResearchError extends Error {
  readonly code: string;
  readonly url: string;

  constructor(code: string, message: string, url: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CompanyResearchError';
    this.code = code;
    this.url = url;
  }
}

interface RobotsPolicy {
  isAllowed: (url: string, userAgent?: string) => boolean | undefined;
}

const parseRobots = robotsParserModule as unknown as (
  robotsUrl: string,
  contents: string,
) => RobotsPolicy;

const blockedFileExtension =
  /\.(?:avif|bmp|css|csv|docx?|gif|ico|jpe?g|js|json|mp3|mp4|pdf|png|pptx?|rss|svg|webp|xlsx?|xml|zip)$/iu;
const highValueTerms = [
  'about',
  'career',
  'company',
  'culture',
  'engineering',
  'job',
  'mission',
  'product',
  'team',
  'value',
  'work',
];

function normalizeCandidate(link: ExtractedLink, baseUrl: string, allowedOrigin: string) {
  let candidate: URL;

  try {
    candidate = new URL(link.href, baseUrl);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(candidate.protocol) || candidate.origin !== allowedOrigin) {
    return null;
  }

  if (blockedFileExtension.test(candidate.pathname)) {
    return null;
  }

  candidate.hash = '';
  candidate.search = '';
  const searchable = `${candidate.pathname} ${link.text}`.toLowerCase();
  const score = highValueTerms.reduce(
    (total, term) => total + (searchable.includes(term) ? 1 : 0),
    0,
  );

  return { score, url: candidate.toString() };
}

function rankedCandidates(links: readonly ExtractedLink[], baseUrl: string, allowedOrigin: string) {
  return links
    .map((link) => normalizeCandidate(link, baseUrl, allowedOrigin))
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url));
}

function warningFromError(error: unknown, url: string): CompanyResearchWarning {
  if (error instanceof ResearchFetchError) {
    return { code: error.code, message: error.message, url: error.url };
  }

  return {
    code: 'PAGE_FETCH_FAILED',
    message: error instanceof Error ? error.message : 'Company page could not be fetched.',
    url,
  };
}

export async function crawlCompanySite(
  requestedUrl: string,
  config: ResearchConfig,
  dependencies: CompanyCrawlerDependencies = {},
): Promise<CompanyResearchResult> {
  let initialUrl: URL;

  try {
    initialUrl = new URL(requestedUrl);
  } catch (error) {
    throw new CompanyResearchError('INVALID_COMPANY_URL', 'Company URL is invalid.', requestedUrl, {
      cause: error,
    });
  }

  const fetchText =
    dependencies.fetchText ??
    ((url: string) =>
      safeFetchText(url, config, {
        ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
        ...(dependencies.resolveHost ? { resolveHost: dependencies.resolveHost } : {}),
      }));
  const warnings: CompanyResearchWarning[] = [];

  async function loadRobots(origin: string) {
    const robotsUrl = new URL('/robots.txt', origin).toString();

    try {
      const response = await fetchText(robotsUrl);
      return parseRobots(robotsUrl, response.text);
    } catch (error) {
      warnings.push({
        ...warningFromError(error, robotsUrl),
        code: 'ROBOTS_UNAVAILABLE',
        message: 'robots.txt could not be loaded; crawling remains narrowly bounded.',
      });
      return null;
    }
  }

  let robots = await loadRobots(initialUrl.origin);
  let rootResponse: SafeTextResponse;

  try {
    rootResponse = await fetchText(initialUrl.toString());
  } catch (error) {
    const warning = warningFromError(error, initialUrl.toString());
    throw new CompanyResearchError(warning.code, warning.message, warning.url, { cause: error });
  }

  const rootUrl = new URL(rootResponse.finalUrl);

  if (rootUrl.origin !== initialUrl.origin) {
    robots = await loadRobots(rootUrl.origin);
  }

  if (robots?.isAllowed(rootResponse.finalUrl, config.userAgent) === false) {
    throw new CompanyResearchError(
      'ROBOTS_DISALLOWED',
      'The company website does not allow this page to be crawled.',
      rootResponse.finalUrl,
    );
  }

  const rootContent = extractPageContent(
    rootResponse.text,
    rootResponse.contentType,
    config.maxTextCharsPerPage,
  );
  const pages: CompanyResearchPage[] = [
    {
      contentType: rootResponse.contentType,
      text: rootContent.text,
      title: rootContent.title,
      truncated: rootContent.truncated,
      url: rootResponse.finalUrl,
    },
  ];
  const visited = new Set([rootResponse.finalUrl]);
  const queued = new Set<string>();
  const queue = rankedCandidates(rootContent.links, rootResponse.finalUrl, rootUrl.origin);

  queue.forEach(({ url }) => queued.add(url));

  while (queue.length > 0 && pages.length < config.maxPages) {
    const candidate = queue.shift();

    if (!candidate || visited.has(candidate.url)) {
      continue;
    }

    queued.delete(candidate.url);
    visited.add(candidate.url);

    if (robots?.isAllowed(candidate.url, config.userAgent) === false) {
      warnings.push({
        code: 'ROBOTS_DISALLOWED',
        message: 'robots.txt disallows this company page.',
        url: candidate.url,
      });
      continue;
    }

    try {
      const response = await fetchText(candidate.url);

      if (new URL(response.finalUrl).origin !== rootUrl.origin) {
        warnings.push({
          code: 'CROSS_ORIGIN_REDIRECT_SKIPPED',
          message: 'A company page redirected outside the company origin.',
          url: response.finalUrl,
        });
        continue;
      }

      const content = extractPageContent(
        response.text,
        response.contentType,
        config.maxTextCharsPerPage,
      );
      pages.push({
        contentType: response.contentType,
        text: content.text,
        title: content.title,
        truncated: content.truncated,
        url: response.finalUrl,
      });

      for (const discovered of rankedCandidates(content.links, response.finalUrl, rootUrl.origin)) {
        if (!visited.has(discovered.url) && !queued.has(discovered.url)) {
          queue.push(discovered);
          queued.add(discovered.url);
        }
      }

      queue.sort((left, right) => right.score - left.score || left.url.localeCompare(right.url));
    } catch (error) {
      warnings.push(warningFromError(error, candidate.url));
    }
  }

  return { pages, requestedUrl, warnings };
}
