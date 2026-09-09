import { createHash, randomBytes } from 'node:crypto';

export interface SessionToken {
  raw: string;
  hash: string;
}

export function hashSessionToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function createSessionToken(): SessionToken {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashSessionToken(raw) };
}
