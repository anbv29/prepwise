import { describe, expect, it, vi } from 'vitest';

import { safeFetchText, type SafeFetchConfig } from './safe-fetch.js';
import type { ResearchFetchError } from './safe-fetch.js';

const config: SafeFetchConfig = {
  allowPrivateNetworks: false,
  maxRedirects: 2,
  maxResponseBytes: 100,
  requestTimeoutMs: 1_000,
  userAgent: 'TestResearchBot/1.0',
};
const resolvePublicHost = async () => [{ address: '93.184.216.34', family: 4 as const }];

describe('safeFetchText', () => {
  it('returns bounded text with final provenance', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.redirect).toBe('manual');
      expect(new Headers(init?.headers).get('User-Agent')).toBe('TestResearchBot/1.0');
      return new Response('<html><body>Company</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    });

    await expect(
      safeFetchText('https://example.com/about', config, {
        fetch: fetchMock,
        resolveHost: resolvePublicHost,
      }),
    ).resolves.toEqual({
      contentType: 'text/html',
      finalUrl: 'https://example.com/about',
      status: 200,
      text: '<html><body>Company</body></html>',
    });
  });

  it('validates every redirect target before requesting it', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      });
    });

    await expect(
      safeFetchText('https://example.com', config, {
        fetch: fetchMock,
        resolveHost: resolvePublicHost,
      }),
    ).rejects.toMatchObject({ code: 'PRIVATE_NETWORK_ADDRESS', retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects unsupported content before reading the body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
    });

    await expect(
      safeFetchText('https://example.com/report', config, {
        fetch: fetchMock,
        resolveHost: resolvePublicHost,
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT_TYPE' });
  });

  it('enforces declared and streamed response limits', async () => {
    const declaredLarge = vi.fn<typeof fetch>(async () => {
      return new Response('small', {
        headers: { 'content-length': '101', 'content-type': 'text/plain' },
      });
    });
    const streamedLarge = vi.fn<typeof fetch>(async () => {
      return new Response('x'.repeat(101), {
        headers: { 'content-type': 'text/plain' },
      });
    });

    for (const fetchMock of [declaredLarge, streamedLarge]) {
      await expect(
        safeFetchText('https://example.com/large', config, {
          fetch: fetchMock,
          resolveHost: resolvePublicHost,
        }),
      ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    }
  });

  it('marks throttling and server failures as retryable', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response('Unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain' },
      });
    });

    await expect(
      safeFetchText('https://example.com', config, {
        fetch: fetchMock,
        resolveHost: resolvePublicHost,
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ResearchFetchError>>({
        code: 'HTTP_STATUS_ERROR',
        retryable: true,
      }),
    );
  });
});
