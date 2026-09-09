import { z } from 'zod';

const positiveIntegerStringSchema = z
  .string()
  .regex(/^\d+$/u)
  .transform(Number)
  .pipe(z.number().int().positive().max(30));

export interface AuthConfig {
  cookieName: string;
  sessionTtlMs: number;
  secureCookies: boolean;
  webOrigin: string;
}

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}

export function readAuthConfig(
  environment: Record<string, string | undefined> = process.env,
): AuthConfig {
  const originResult = z.string().url().safeParse(environment.WEB_ORIGIN?.trim());
  const ttlResult = positiveIntegerStringSchema.safeParse(
    environment.SESSION_TTL_DAYS?.trim() || '7',
  );
  const cookieName = environment.SESSION_COOKIE_NAME?.trim() || 'prep_session';

  if (!originResult.success) {
    throw new AuthConfigError('WEB_ORIGIN must be a valid absolute URL.');
  }

  if (!ttlResult.success) {
    throw new AuthConfigError('SESSION_TTL_DAYS must be an integer from 1 to 30.');
  }

  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(cookieName)) {
    throw new AuthConfigError('SESSION_COOKIE_NAME contains invalid cookie-name characters.');
  }

  return {
    cookieName,
    sessionTtlMs: ttlResult.data * 24 * 60 * 60 * 1000,
    secureCookies: environment.NODE_ENV === 'production',
    webOrigin: new URL(originResult.data).origin,
  };
}
