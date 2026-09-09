import { mockApi } from './mock';
import { realApi } from './real';

export const api = process.env.NEXT_PUBLIC_USE_MOCK_API === 'false' ? realApi : mockApi;
export * from './types';
