import { mockApi } from './mock';
import { realApi } from './real';

const explicitlyConfiguredMode = process.env.NEXT_PUBLIC_USE_MOCK_API;
const useMockApi =
  explicitlyConfiguredMode === 'true' ||
  (explicitlyConfiguredMode === undefined && process.env.NODE_ENV !== 'production');

export const api = useMockApi ? mockApi : realApi;
export * from './types';
