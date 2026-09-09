import {
  Agent,
  buildConnector,
  fetch as undiciFetch,
  type RequestInit as UndiciRequestInit,
} from 'undici';

import type { HostResolver } from './url-policy.js';
import { resolveResearchHost, UnsafeResearchUrlError, validateResearchUrl } from './url-policy.js';

export interface SafeFetchConfig {
  allowPrivateNetworks: boolean;
  maxRedirects: number;
  maxResponseBytes: number;
  requestTimeoutMs: number;
  userAgent: string;
}

export interface SafeTextResponse {
  contentType: string;
  finalUrl: string;
  status: number;
  text: string;
}

export interface SafeFetchDependencies {
  fetch?: typeof fetch;
  resolveHost?: HostResolver;
}

export class ResearchFetchError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly url: string;

  constructor(code: string, message: string, url: string, retryable: boolean) {
    super(message);
    this.name = 'ResearchFetchError';
    this.code = code;
    this.url = url;
    this.retryable = retryable;
  }
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const allowedContentTypes = new Set(['text/html', 'text/plain', 'application/xhtml+xml']);

async function readBoundedBody(response: Response, maximumBytes: number, url: string) {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let receivedBytes = 0;
  let text = '';

  while (true) {
    const result = await reader.read();

    if (result.done) {
      text += decoder.decode();
      return text;
    }

    receivedBytes += result.value.byteLength;

    if (receivedBytes > maximumBytes) {
      await reader.cancel();
      throw new ResearchFetchError(
        'RESPONSE_TOO_LARGE',
        `Research response exceeded ${maximumBytes} bytes.`,
        url,
        false,
      );
    }

    text += decoder.decode(result.value, { stream: true });
  }
}

async function fetchTextWithImplementation(
  rawUrl: string,
  config: SafeFetchConfig,
  dependencies: SafeFetchDependencies,
  fetchImplementation: typeof fetch,
): Promise<SafeTextResponse> {
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= config.maxRedirects; redirectCount += 1) {
    let validatedUrl: URL;

    try {
      validatedUrl = await validateResearchUrl(currentUrl, {
        allowPrivateNetworks: config.allowPrivateNetworks,
        ...(dependencies.resolveHost ? { resolveHost: dependencies.resolveHost } : {}),
      });
    } catch (error) {
      if (error instanceof UnsafeResearchUrlError) {
        throw new ResearchFetchError(error.code, error.message, currentUrl, false);
      }

      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    let response: Response;

    try {
      response = await fetchImplementation(validatedUrl, {
        headers: {
          Accept: 'text/html,text/plain,application/xhtml+xml;q=0.9',
          'User-Agent': config.userAgent,
        },
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch {
      const timedOut = controller.signal.aborted;
      throw new ResearchFetchError(
        timedOut ? 'REQUEST_TIMEOUT' : 'REQUEST_FAILED',
        timedOut ? 'Research request timed out.' : 'Research request failed.',
        validatedUrl.toString(),
        true,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (redirectStatuses.has(response.status)) {
      const location = response.headers.get('location');

      if (!location) {
        throw new ResearchFetchError(
          'INVALID_REDIRECT',
          'Research response redirected without a Location header.',
          validatedUrl.toString(),
          false,
        );
      }

      if (redirectCount === config.maxRedirects) {
        throw new ResearchFetchError(
          'TOO_MANY_REDIRECTS',
          'Research request exceeded the redirect limit.',
          validatedUrl.toString(),
          false,
        );
      }

      currentUrl = new URL(location, validatedUrl).toString();
      continue;
    }

    if (!response.ok) {
      throw new ResearchFetchError(
        'HTTP_STATUS_ERROR',
        `Research request returned HTTP ${response.status}.`,
        validatedUrl.toString(),
        response.status === 429 || response.status >= 500,
      );
    }

    const declaredLength = Number(response.headers.get('content-length'));

    if (Number.isFinite(declaredLength) && declaredLength > config.maxResponseBytes) {
      throw new ResearchFetchError(
        'RESPONSE_TOO_LARGE',
        `Research response exceeded ${config.maxResponseBytes} bytes.`,
        validatedUrl.toString(),
        false,
      );
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();

    if (!contentType || !allowedContentTypes.has(contentType)) {
      throw new ResearchFetchError(
        'UNSUPPORTED_CONTENT_TYPE',
        `Research response used unsupported content type ${contentType ?? 'unknown'}.`,
        validatedUrl.toString(),
        false,
      );
    }

    return {
      contentType,
      finalUrl: validatedUrl.toString(),
      status: response.status,
      text: await readBoundedBody(response, config.maxResponseBytes, validatedUrl.toString()),
    };
  }

  throw new ResearchFetchError('TOO_MANY_REDIRECTS', 'Redirect limit exceeded.', rawUrl, false);
}

function createPinnedDispatcher(config: SafeFetchConfig, resolveHost?: HostResolver) {
  const connect = buildConnector({});

  return new Agent({
    connect(options, callback) {
      const originalHostname = options.hostname.replace(/^\[|\]$/gu, '');

      void resolveResearchHost(originalHostname, {
        allowPrivateNetworks: config.allowPrivateNetworks,
        ...(resolveHost ? { resolveHost } : {}),
      })
        .then(([address]) => {
          if (!address) {
            callback(new Error('Research hostname did not resolve.'), null);
            return;
          }

          connect(
            {
              ...options,
              host: address.address,
              hostname: address.address,
              servername: originalHostname,
            },
            callback,
          );
        })
        .catch((error: unknown) => {
          callback(
            error instanceof Error ? error : new Error('Research DNS validation failed.'),
            null,
          );
        });
    },
  });
}

export async function safeFetchText(
  rawUrl: string,
  config: SafeFetchConfig,
  dependencies: SafeFetchDependencies = {},
): Promise<SafeTextResponse> {
  if (dependencies.fetch) {
    return fetchTextWithImplementation(rawUrl, config, dependencies, dependencies.fetch);
  }

  const dispatcher = createPinnedDispatcher(config, dependencies.resolveHost);
  const pinnedFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    return undiciFetch(String(input), {
      ...init,
      dispatcher,
    } as unknown as UndiciRequestInit) as unknown as Promise<Response>;
  }) as typeof fetch;

  try {
    return await fetchTextWithImplementation(rawUrl, config, dependencies, pinnedFetch);
  } finally {
    await dispatcher.close();
  }
}
