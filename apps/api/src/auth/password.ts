import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_VERSION = 'v1';
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const SALT_BYTES = 16;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt);

  return [
    'scrypt',
    SCRYPT_VERSION,
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELIZATION),
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, version, cost, blockSize, parallelization, encodedSalt, encodedKey] =
    encodedHash.split('$');

  if (
    algorithm !== 'scrypt' ||
    version !== SCRYPT_VERSION ||
    cost !== String(SCRYPT_COST) ||
    blockSize !== String(SCRYPT_BLOCK_SIZE) ||
    parallelization !== String(SCRYPT_PARALLELIZATION) ||
    !encodedSalt ||
    !encodedKey
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, 'base64url');
    const storedKey = Buffer.from(encodedKey, 'base64url');

    if (salt.length !== SALT_BYTES || storedKey.length !== SCRYPT_KEY_LENGTH) {
      return false;
    }

    const candidateKey = await deriveKey(password, salt);
    return timingSafeEqual(candidateKey, storedKey);
  } catch {
    return false;
  }
}
