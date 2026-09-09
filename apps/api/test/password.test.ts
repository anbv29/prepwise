import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/auth/password.js';

describe('password hashing', () => {
  it('stores a salted scrypt hash and verifies only the correct password', async () => {
    const firstHash = await hashPassword('a-secure-password');
    const secondHash = await hashPassword('a-secure-password');

    expect(firstHash).toMatch(/^scrypt\$v1\$/u);
    expect(firstHash).not.toContain('a-secure-password');
    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPassword('a-secure-password', firstHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', firstHash)).resolves.toBe(false);
  });

  it('rejects malformed and unsupported hashes without throwing', async () => {
    await expect(verifyPassword('anything', 'not-a-password-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'scrypt$v2$16384$8$1$invalid$invalid')).resolves.toBe(
      false,
    );
  });
});
