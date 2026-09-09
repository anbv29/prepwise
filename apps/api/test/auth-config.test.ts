import { describe, expect, it } from 'vitest';

import { AuthConfigError, readAuthConfig } from '../src/auth/config.js';

describe('auth configuration', () => {
  it('uses safe development defaults', () => {
    expect(readAuthConfig({ WEB_ORIGIN: 'http://localhost:3000/path' })).toEqual({
      cookieName: 'prep_session',
      secureCookies: false,
      sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
      webOrigin: 'http://localhost:3000',
    });
  });

  it('requires a valid origin and bounded session duration', () => {
    expect(() => readAuthConfig({})).toThrow(AuthConfigError);
    expect(() =>
      readAuthConfig({ WEB_ORIGIN: 'http://localhost:3000', SESSION_TTL_DAYS: '31' }),
    ).toThrow(AuthConfigError);
  });

  it('marks production cookies as secure', () => {
    expect(
      readAuthConfig({ NODE_ENV: 'production', WEB_ORIGIN: 'https://prep.example.com' })
        .secureCookies,
    ).toBe(true);
  });
});
