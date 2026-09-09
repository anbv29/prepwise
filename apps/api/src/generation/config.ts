import { z } from 'zod';

const integerSettingSchema = z.string().regex(/^\d+$/u).transform(Number);

export interface WorkerConfig {
  maxAttempts: number;
  pollIntervalMs: number;
  staleAfterMs: number;
}

export class WorkerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkerConfigError';
  }
}

function readInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  const result = integerSettingSchema
    .pipe(z.number().int().min(minimum).max(maximum))
    .safeParse(value?.trim() || String(fallback));

  if (!result.success) {
    throw new WorkerConfigError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }

  return result.data;
}

export function readWorkerConfig(
  environment: Record<string, string | undefined> = process.env,
): WorkerConfig {
  return {
    maxAttempts: readInteger(environment.WORKER_MAX_ATTEMPTS, 3, 1, 10, 'WORKER_MAX_ATTEMPTS'),
    pollIntervalMs: readInteger(
      environment.WORKER_POLL_INTERVAL_MS,
      1_000,
      100,
      60_000,
      'WORKER_POLL_INTERVAL_MS',
    ),
    staleAfterMs: readInteger(
      environment.WORKER_STALE_AFTER_MS,
      15 * 60 * 1_000,
      60_000,
      24 * 60 * 60 * 1_000,
      'WORKER_STALE_AFTER_MS',
    ),
  };
}
