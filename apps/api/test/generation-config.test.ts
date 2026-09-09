import { describe, expect, it } from 'vitest';

import { readWorkerConfig, WorkerConfigError } from '../src/generation/config.js';

describe('generation worker configuration', () => {
  it('provides bounded production-safe defaults', () => {
    expect(readWorkerConfig({})).toEqual({
      maxAttempts: 3,
      pollIntervalMs: 1_000,
      staleAfterMs: 900_000,
    });
  });

  it('rejects invalid polling and retry values', () => {
    expect(() => readWorkerConfig({ WORKER_MAX_ATTEMPTS: '0' })).toThrow(WorkerConfigError);
    expect(() => readWorkerConfig({ WORKER_POLL_INTERVAL_MS: 'fast' })).toThrow(WorkerConfigError);
    expect(() => readWorkerConfig({ WORKER_STALE_AFTER_MS: '1000' })).toThrow(WorkerConfigError);
  });
});
