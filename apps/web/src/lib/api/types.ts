import type {
  ApiUser,
  GenerationJob,
  Kit,
  KitRecord,
  PracticeConfidence,
  PracticeProgress,
  Question,
} from '@/types/kit';

export interface Credentials {
  email: string;
  password: string;
}

export interface RegistrationCredentials extends Credentials {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
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

export type RegenerationTarget =
  { type: 'company_brief' } | { type: 'question_category'; category: Question['category'] };

export interface RegenerationPreview {
  title: string;
  summary: string;
  changes: string[];
  preservedEditedItems: number;
}

export interface ApiClient {
  createBatch: (items: readonly BatchKitInput[]) => Promise<CreateKitResult[]>;
  createKit: (input: CreateKitInput) => Promise<CreateKitResult>;
  getCurrentUser: () => Promise<ApiUser | null>;
  getJob: (jobId: string) => Promise<GenerationJob>;
  getKit: (kitId: string) => Promise<KitRecord>;
  getPracticeProgress: (kitId: string) => Promise<PracticeProgress>;
  listKits: () => Promise<KitRecord[]>;
  login: (credentials: Credentials) => Promise<ApiUser>;
  logout: () => Promise<void>;
  previewRegeneration: (kitId: string, target: RegenerationTarget) => Promise<RegenerationPreview>;
  regenerateKitSection: (kitId: string, target: RegenerationTarget) => Promise<KitRecord>;
  register: (credentials: RegistrationCredentials) => Promise<ApiUser>;
  retryJob: (jobId: string) => Promise<GenerationJob>;
  saveFlashcardConfidence: (
    kitId: string,
    flashcardId: string,
    confidence: PracticeConfidence,
  ) => Promise<PracticeProgress>;
  updateKit: (kitId: string, kit: Kit) => Promise<KitRecord>;
}

export class ApiClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
  }
}
