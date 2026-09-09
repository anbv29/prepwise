import type { ApiUser, GenerationJob, KitRecord } from '@/types/kit';

export interface Credentials {
  email: string;
  password: string;
}

export interface CreateKitInput {
  jobDescription: string;
  companyUrl: string;
  daysAvailable: number;
}

export interface CreateKitResult {
  idempotencyKey: string;
  reused: boolean;
  kit: KitRecord;
  job: GenerationJob;
}

export interface BatchKitInput extends CreateKitInput {
  id: string;
}

export interface ApiClient {
  createBatch: (items: readonly BatchKitInput[]) => Promise<CreateKitResult[]>;
  createKit: (input: CreateKitInput) => Promise<CreateKitResult>;
  getCurrentUser: () => Promise<ApiUser | null>;
  getJob: (jobId: string) => Promise<GenerationJob>;
  getKit: (kitId: string) => Promise<KitRecord>;
  listKits: () => Promise<KitRecord[]>;
  login: (credentials: Credentials) => Promise<ApiUser>;
  logout: () => Promise<void>;
  register: (credentials: Credentials) => Promise<ApiUser>;
  retryJob: (jobId: string) => Promise<GenerationJob>;
}

export class ApiClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
  }
}
