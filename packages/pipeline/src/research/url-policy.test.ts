import { describe, expect, it, vi } from 'vitest';

import { validateResearchUrl } from './url-policy.js';

describe('validateResearchUrl', () => {
  it('accepts a public HTTP or HTTPS hostname after DNS validation', async () => {
    const resolveHost = vi.fn(async () => [{ address: '93.184.216.34', family: 4 as const }]);

    await expect(
      validateResearchUrl('https://example.com/about#team', { resolveHost }),
    ).resolves.toEqual(new URL('https://example.com/about'));
    expect(resolveHost).toHaveBeenCalledWith('example.com');
  });

  it.each([
    'http://127.0.0.1/admin',
    'http://10.0.0.4/internal',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/admin',
    'http://[fc00::1]/internal',
  ])('blocks private or reserved literal address %s', async (url) => {
    await expect(validateResearchUrl(url)).rejects.toMatchObject({
      code: 'PRIVATE_NETWORK_ADDRESS',
    });
  });

  it('blocks a public-looking hostname if any DNS answer is private', async () => {
    const resolveHost = vi.fn(async () => [
      { address: '93.184.216.34', family: 4 as const },
      { address: '127.0.0.1', family: 4 as const },
    ]);

    await expect(validateResearchUrl('https://example.com', { resolveHost })).rejects.toMatchObject(
      { code: 'PRIVATE_NETWORK_ADDRESS' },
    );
  });

  it.each([
    ['file:///etc/passwd', 'UNSUPPORTED_PROTOCOL'],
    ['https://user:password@example.com', 'URL_CREDENTIALS_NOT_ALLOWED'],
    ['https://example.com:8443', 'NON_STANDARD_PORT'],
    ['http://localhost/admin', 'LOCAL_HOSTNAME'],
  ])('rejects unsafe URL %s', async (url, code) => {
    await expect(validateResearchUrl(url)).rejects.toMatchObject({ code });
  });

  it('allows private addresses only when explicitly enabled for local fixtures', async () => {
    await expect(
      validateResearchUrl('http://127.0.0.1:3001/test', { allowPrivateNetworks: true }),
    ).resolves.toEqual(new URL('http://127.0.0.1:3001/test'));
  });
});
