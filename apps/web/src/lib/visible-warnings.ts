import type { KitRecord } from '../types/kit';

const hiddenWarningCodes = new Set(['SEARCH_QUOTA_EXHAUSTED']);

export function visibleWarnings(warnings: KitRecord['warnings']) {
  return warnings.filter((warning) => !hiddenWarningCodes.has(warning.code));
}
