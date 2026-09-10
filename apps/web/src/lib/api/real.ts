import type { ApiClient } from './types';
import { ApiClientError } from './types';

// Production requests stay on the web app's origin and are securely proxied to
// the API by Next.js. The public-origin fallback keeps existing local setups
// working without exposing a production API address to browser code.
const API_ORIGIN =
  process.env.NODE_ENV === 'production'
    ? ''
    : (process.env.NEXT_PUBLIC_API_ORIGIN ?? 'http://localhost:4000');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T & {
    error?: { code?: string; message?: string };
  };

  if (!response.ok) {
    throw new ApiClientError(
      payload.error?.code ?? 'REQUEST_FAILED',
      payload.error?.message ?? 'The request could not be completed.',
    );
  }

  return payload;
}

export const realApi: ApiClient = {
  login: async (credentials) =>
    (
      await request<{ user: Awaited<ReturnType<ApiClient['login']>> }>('/api/auth/login', {
        body: JSON.stringify(credentials),
        method: 'POST',
      })
    ).user,
  register: async (credentials) =>
    (
      await request<{ user: Awaited<ReturnType<ApiClient['register']>> }>('/api/auth/register', {
        body: JSON.stringify(credentials),
        method: 'POST',
      })
    ).user,
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getCurrentUser: async () => {
    try {
      return (
        await request<{ user: Awaited<ReturnType<ApiClient['getCurrentUser']>> }>('/api/auth/me')
      ).user;
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'AUTHENTICATION_REQUIRED') return null;
      throw error;
    }
  },
  listKits: async () =>
    (await request<{ kits: Awaited<ReturnType<ApiClient['listKits']>> }>('/api/kits')).kits,
  getKit: async (kitId) =>
    (await request<{ kit: Awaited<ReturnType<ApiClient['getKit']>> }>(`/api/kits/${kitId}`)).kit,
  getPracticeProgress: async (kitId) =>
    (
      await request<{ progress: Awaited<ReturnType<ApiClient['getPracticeProgress']>> }>(
        `/api/kits/${kitId}/practice`,
      )
    ).progress,
  createKit: (input) =>
    request('/api/kits', {
      body: JSON.stringify(input),
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      method: 'POST',
    }),
  createBatch: (items) =>
    request('/api/kits/batch', { body: JSON.stringify({ items }), method: 'POST' }),
  getJob: async (jobId) =>
    (await request<{ job: Awaited<ReturnType<ApiClient['getJob']>> }>(`/api/jobs/${jobId}`)).job,
  retryJob: async (jobId) =>
    (
      await request<{ job: Awaited<ReturnType<ApiClient['retryJob']>> }>(
        `/api/jobs/${jobId}/retry`,
        {
          method: 'POST',
        },
      )
    ).job,
  updateKit: async (kitId, kit) =>
    (
      await request<{ kit: Awaited<ReturnType<ApiClient['updateKit']>> }>(`/api/kits/${kitId}`, {
        body: JSON.stringify({ kit }),
        method: 'PATCH',
      })
    ).kit,
  previewRegeneration: (kitId, target) =>
    request(`/api/kits/${kitId}/regenerate/preview`, {
      body: JSON.stringify(target),
      method: 'POST',
    }),
  regenerateKitSection: async (kitId, target) =>
    (
      await request<{ kit: Awaited<ReturnType<ApiClient['regenerateKitSection']>> }>(
        `/api/kits/${kitId}/regenerate`,
        {
          body: JSON.stringify(target),
          method: 'POST',
        },
      )
    ).kit,
  saveFlashcardConfidence: async (kitId, flashcardId, confidence) =>
    (
      await request<{
        progress: Awaited<ReturnType<ApiClient['saveFlashcardConfidence']>>;
      }>(`/api/kits/${kitId}/practice/${flashcardId}`, {
        body: JSON.stringify({ confidence }),
        method: 'PUT',
      })
    ).progress,
};
