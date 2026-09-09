import { describe, expect, it, vi } from 'vitest';

import type { ResearchConfig } from './config.js';
import { crawlCompanySite } from './company-crawler.js';
import type { CompanyResearchError } from './company-crawler.js';
import { ResearchFetchError, type SafeTextResponse } from './safe-fetch.js';

const config: ResearchConfig = {
  allowPrivateNetworks: false,
  cacheFailureTtlMs: 300_000,
  cacheSuccessTtlMs: 86_400_000,
  maxPages: 3,
  maxRedirects: 2,
  maxResponseBytes: 10_000,
  maxTextCharsPerPage: 1_000,
  requestTimeoutMs: 1_000,
  userAgent: 'TestResearchBot/1.0',
};

function textResponse(finalUrl: string, text: string, contentType = 'text/html'): SafeTextResponse {
  return { contentType, finalUrl, status: 200, text };
}

describe('crawlCompanySite', () => {
  it('selects useful same-origin pages in deterministic priority order', async () => {
    const fetchText = vi.fn(async (url: string) => {
      const responses: Record<string, SafeTextResponse> = {
        'https://example.com/robots.txt': textResponse(
          'https://example.com/robots.txt',
          'User-agent: *\nAllow: /',
          'text/plain',
        ),
        'https://example.com/': textResponse(
          'https://example.com/',
          `<html><head><title>Example</title></head><body>
             <h1>Developer tools</h1>
             <a href="/privacy">Privacy</a>
             <a href="/about">About</a>
             <a href="/careers">Engineering careers and jobs</a>
             <a href="https://outside.example/jobs">Outside</a>
             <a href="/annual-report.pdf">PDF</a>
           </body></html>`,
        ),
        'https://example.com/careers': textResponse(
          'https://example.com/careers',
          '<html><head><title>Careers</title></head><body>Join our engineering team</body></html>',
        ),
        'https://example.com/about': textResponse(
          'https://example.com/about',
          '<html><head><title>About</title></head><body>Our mission is reliability</body></html>',
        ),
      };
      const response = responses[url];

      if (!response) {
        throw new Error(`Unexpected URL: ${url}`);
      }

      return response;
    });

    const result = await crawlCompanySite('https://example.com', config, { fetchText });

    expect(result.pages.map((page) => page.url)).toEqual([
      'https://example.com/',
      'https://example.com/careers',
      'https://example.com/about',
    ]);
    expect(result.pages.map((page) => page.title)).toEqual(['Example', 'Careers', 'About']);
    expect(result.warnings).toEqual([]);
    expect(fetchText.mock.calls.map(([url]) => url)).not.toContain('https://outside.example/jobs');
    expect(fetchText.mock.calls.map(([url]) => url)).not.toContain(
      'https://example.com/annual-report.pdf',
    );
  });

  it('honors robots.txt and records recoverable child-page failures', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url === 'https://example.com/robots.txt') {
        return textResponse(url, 'User-agent: *\nDisallow: /private\nAllow: /', 'text/plain');
      }

      if (url === 'https://example.com/') {
        return textResponse(
          url,
          '<html><body><a href="/private">Company values</a><a href="/careers">Careers</a><a href="/about">About</a></body></html>',
        );
      }

      if (url === 'https://example.com/careers') {
        throw new ResearchFetchError('REQUEST_TIMEOUT', 'Research request timed out.', url, true);
      }

      if (url === 'https://example.com/about') {
        return textResponse(url, '<html><body>About the company</body></html>');
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await crawlCompanySite('https://example.com', config, { fetchText });

    expect(result.pages.map((page) => page.url)).toEqual([
      'https://example.com/',
      'https://example.com/about',
    ]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'ROBOTS_DISALLOWED', url: 'https://example.com/private' }),
        expect.objectContaining({
          code: 'REQUEST_TIMEOUT',
          url: 'https://example.com/careers',
        }),
      ]),
    );
    expect(fetchText).not.toHaveBeenCalledWith('https://example.com/private');
  });

  it('fails the research task when the requested root page cannot be loaded', async () => {
    const fetchText = vi.fn(async (url: string) => {
      if (url.endsWith('/robots.txt')) {
        throw new ResearchFetchError('HTTP_STATUS_ERROR', 'HTTP 404', url, false);
      }

      throw new ResearchFetchError('REQUEST_TIMEOUT', 'Research request timed out.', url, true);
    });

    await expect(
      crawlCompanySite('https://example.com', config, { fetchText }),
    ).rejects.toMatchObject<Partial<CompanyResearchError>>({
      code: 'REQUEST_TIMEOUT',
      url: 'https://example.com/',
    });
  });
});
