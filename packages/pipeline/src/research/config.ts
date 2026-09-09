import { z } from 'zod';

const integerStringSchema = z.string().regex(/^\d+$/u).transform(Number);

export interface ResearchConfig {
  allowPrivateNetworks: boolean;
  cacheFailureTtlMs: number;
  cacheSuccessTtlMs: number;
  maxPages: number;
  maxRedirects: number;
  maxResponseBytes: number;
  maxTextCharsPerPage: number;
  requestTimeoutMs: number;
  userAgent: string;
}

export class ResearchConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResearchConfigError';
  }
}

function readBoundedInteger(
  environment: Record<string, string | undefined>,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = integerStringSchema
    .pipe(z.number().int().min(minimum).max(maximum))
    .safeParse(environment[name]?.trim() || String(fallback));

  if (!parsed.success) {
    throw new ResearchConfigError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }

  return parsed.data;
}

function readBoolean(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new ResearchConfigError(`${name} must be either true or false.`);
}

export function readResearchConfig(
  environment: Record<string, string | undefined> = process.env,
): ResearchConfig {
  const allowPrivateNetworks = readBoolean(
    environment.ALLOW_PRIVATE_NETWORKS,
    false,
    'ALLOW_PRIVATE_NETWORKS',
  );

  if (environment.NODE_ENV === 'production' && allowPrivateNetworks) {
    throw new ResearchConfigError('ALLOW_PRIVATE_NETWORKS cannot be enabled in production.');
  }

  return {
    allowPrivateNetworks,
    cacheFailureTtlMs: readBoundedInteger(
      environment,
      'RESEARCH_FAILURE_CACHE_TTL_MS',
      5 * 60 * 1_000,
      10_000,
      60 * 60 * 1_000,
    ),
    cacheSuccessTtlMs: readBoundedInteger(
      environment,
      'RESEARCH_CACHE_TTL_MS',
      24 * 60 * 60 * 1_000,
      60_000,
      7 * 24 * 60 * 60 * 1_000,
    ),
    maxPages: readBoundedInteger(environment, 'RESEARCH_MAX_PAGES', 5, 1, 10),
    maxRedirects: readBoundedInteger(environment, 'RESEARCH_MAX_REDIRECTS', 3, 0, 5),
    maxResponseBytes: readBoundedInteger(
      environment,
      'RESEARCH_MAX_RESPONSE_BYTES',
      1_000_000,
      10_000,
      5_000_000,
    ),
    maxTextCharsPerPage: readBoundedInteger(
      environment,
      'RESEARCH_MAX_TEXT_CHARS',
      25_000,
      1_000,
      100_000,
    ),
    requestTimeoutMs: readBoundedInteger(
      environment,
      'RESEARCH_REQUEST_TIMEOUT_MS',
      10_000,
      1_000,
      60_000,
    ),
    userAgent: 'InterviewPrepResearchBot/1.0',
  };
}
