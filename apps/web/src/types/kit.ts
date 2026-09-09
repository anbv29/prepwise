export interface Kit {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
}

export interface Requirement {
  id: string;
  text: string;
  kind: 'technical' | 'behavioural' | 'domain';
  priority: 'must' | 'nice';
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: 'technical' | 'behavioural' | 'system-design' | 'company-fit';
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  edited?: boolean;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  edited?: boolean;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export type KitStatus = 'draft' | 'queued' | 'generating' | 'ready' | 'failed';

export type PipelineStepId =
  | 'extract_requirements'
  | 'crawl_company'
  | 'search_discussions'
  | 'generate_questions'
  | 'check_coverage'
  | 'build_schedule';

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface ApiUser {
  id: string;
  email: string;
}

export interface KitRecord {
  id: string;
  input: {
    jobDescription: string;
    companyUrl: string;
    daysAvailable: number;
  };
  status: KitStatus;
  progress: {
    stage: string;
    percent: number;
    message: string;
  };
  kit: Kit | null;
  warnings: Array<{ code: string; message: string; sourceUrl?: string }>;
  version: number;
  createdAt: string;
  updatedAt: string;
  interviewDate?: string;
}

export interface GenerationJob {
  id: string;
  kitId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: string;
  progressPercent: number;
  attempts: number;
  error: { code: string; message: string; retryable: boolean } | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
