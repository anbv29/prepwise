'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Check, LoaderCircle, RotateCcw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { toast } from 'sonner';

import { StepperSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { GenerationJob, PipelineStep, PipelineStepId, StepStatus } from '@/types/kit';

const definitions: Array<{ id: PipelineStepId; label: string }> = [
  { id: 'extract_requirements', label: 'Extracting role requirements' },
  { id: 'crawl_company', label: 'Crawling the company site' },
  { id: 'search_discussions', label: 'Searching interview discussions' },
  { id: 'generate_questions', label: 'Generating questions and study material' },
  { id: 'check_coverage', label: 'Checking requirement coverage' },
  { id: 'build_schedule', label: 'Building your study schedule' },
];

const stageToStep: Record<string, number> = {
  queued: 0,
  extracting_requirements: 0,
  researching_company: 1,
  searching_discussions: 2,
  generating_company_brief: 3,
  generating_questions: 3,
  checking_coverage: 4,
  generating_flashcards: 4,
  building_schedule: 5,
  validating: 5,
  complete: 6,
};

const doneDetail: Record<PipelineStepId, string> = {
  extract_requirements: 'Role, seniority, location, and priorities identified.',
  crawl_company: 'Company pages checked with source links retained.',
  search_discussions: 'Public signals reviewed and kept separate from verified facts.',
  generate_questions: 'Questions, answer outlines, and flashcards drafted.',
  check_coverage: 'Coverage checked; targeted second pass applied where needed.',
  build_schedule: 'Harder must-have material placed earlier in the plan.',
};

function stepsForJob(job: GenerationJob): PipelineStep[] {
  const activeIndex =
    job.stage === 'failed'
      ? Math.min(Math.floor(job.progressPercent / 17), definitions.length - 1)
      : (stageToStep[job.stage] ?? 0);

  return definitions.map((definition, index) => {
    let status: StepStatus = 'pending';

    if (job.status === 'completed' || index < activeIndex) status = 'done';
    else if (job.status === 'failed' && index === activeIndex) status = 'failed';
    else if (index === activeIndex) status = 'running';

    const detail =
      status === 'done'
        ? doneDetail[definition.id]
        : status === 'running'
          ? 'Working now. This page updates automatically.'
          : status === 'failed'
            ? job.error?.message
            : undefined;

    return {
      ...definition,
      status,
      ...(detail ? { detail } : {}),
    };
  });
}

function StepIcon({ index, status }: { index: number; status: StepStatus }) {
  const base =
    'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border font-semibold tabular-nums';

  if (status === 'done') {
    return (
      <span className={`${base} border-[var(--success)] bg-[var(--success)] text-white`}>
        <Check size={18} strokeWidth={2.5} />
      </span>
    );
  }

  if (status === 'running') {
    return (
      <span
        className={`${base} border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]`}
      >
        <LoaderCircle className="animate-spin" size={18} />
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <span
        className={`${base} border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]`}
      >
        <AlertCircle size={18} />
      </span>
    );
  }

  return (
    <span className={`${base} border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]`}>
      {index + 1}
    </span>
  );
}

export function GenerationStepper({ jobId, kitId }: { jobId?: string; kitId: string }) {
  const reducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const jobQuery = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      query.state.data?.status === 'completed' || query.state.data?.status === 'failed'
        ? false
        : 900,
  });
  const kitQuery = useQuery({
    queryKey: ['kit', kitId],
    queryFn: () => api.getKit(kitId),
    enabled: !jobId,
    refetchInterval: (query) =>
      query.state.data?.status === 'ready' || query.state.data?.status === 'failed' ? false : 900,
  });
  const retry = useMutation({
    mutationFn: () => api.retryJob(jobId!),
    onSuccess: (job) => {
      queryClient.setQueryData(['job', jobId], job);
      toast.success('Generation resumed from the saved work.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeQuery = jobId ? jobQuery : kitQuery;

  if (activeQuery.isLoading) return <StepperSkeleton />;

  if (activeQuery.isError || !activeQuery.data) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-6 text-center">
        <h1 className="text-xl font-semibold text-[var(--danger)]">Progress could not be loaded</h1>
        <button
          className="mt-4 font-semibold text-[var(--danger)] underline"
          onClick={() => void activeQuery.refetch()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  const job: GenerationJob = jobId
    ? jobQuery.data!
    : {
        id: `kit-progress-${kitId}`,
        kitId,
        status:
          kitQuery.data!.status === 'ready'
            ? 'completed'
            : kitQuery.data!.status === 'failed'
              ? 'failed'
              : kitQuery.data!.status === 'queued'
                ? 'queued'
                : 'running',
        stage: kitQuery.data!.status === 'ready' ? 'complete' : kitQuery.data!.progress.stage,
        progressPercent: kitQuery.data!.status === 'ready' ? 100 : kitQuery.data!.progress.percent,
        attempts: 1,
        error:
          kitQuery.data!.status === 'failed'
            ? {
                code: 'GENERATION_FAILED',
                message: kitQuery.data!.progress.message,
                retryable: false,
              }
            : null,
        createdAt: kitQuery.data!.createdAt,
        updatedAt: kitQuery.data!.updatedAt,
        startedAt: kitQuery.data!.createdAt,
        completedAt: kitQuery.data!.status === 'ready' ? kitQuery.data!.updatedAt : null,
      };
  const steps = stepsForJob(job);
  const complete = job.status === 'completed';
  const failed = job.status === 'failed';

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-10 text-center">
        <p
          className={`text-sm font-semibold ${failed ? 'text-[var(--danger)]' : complete ? 'text-[var(--success)]' : 'text-[var(--accent)]'}`}
        >
          {failed ? 'Needs attention' : complete ? 'Ready to prepare' : 'Building your kit'}
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
          {failed
            ? 'One step could not finish.'
            : complete
              ? 'Your interview kit is ready.'
              : 'Turning the role into a focused plan.'}
        </h1>
        <p aria-live="polite" className="mt-4 text-[var(--muted)] tabular-nums">
          {complete ? 'Every section passed final validation.' : `${job.progressPercent}% complete`}
        </p>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
          <motion.div
            animate={{ width: `${job.progressPercent}%` }}
            className={`h-full rounded-full ${failed ? 'bg-[var(--danger)]' : complete ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'}`}
            initial={false}
            transition={
              reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }
            }
          />
        </div>
      </div>

      <ol>
        {steps.map((step, index) => (
          <motion.li
            aria-current={step.status === 'running' ? 'step' : undefined}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex min-h-24 gap-4"
            initial={false}
            key={step.id}
            layout={!reducedMotion}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          >
            {index < steps.length - 1 ? (
              <span
                className={`absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-px ${step.status === 'done' ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`}
              />
            ) : null}
            <StepIcon index={index} status={step.status} />
            <div className="pt-1">
              <p
                className={`font-semibold ${step.status === 'pending' ? 'text-[var(--muted)]' : ''}`}
              >
                {step.label}
              </p>
              {step.detail ? (
                <p
                  className={`mt-1 text-sm ${step.status === 'failed' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}
                >
                  {step.detail}
                </p>
              ) : null}
            </div>
          </motion.li>
        ))}
      </ol>

      <div className="mt-5 flex justify-center">
        {complete ? (
          <Link
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--accent)] px-6 font-semibold text-white"
            href={`/kits/${kitId}`}
          >
            Open your kit <ArrowRight size={18} />
          </Link>
        ) : null}
        {failed && jobId && job.error?.retryable ? (
          <button
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--danger)] px-6 font-semibold text-white disabled:opacity-60"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
            type="button"
          >
            <RotateCcw size={18} /> Retry this step
          </button>
        ) : null}
        {failed && (!jobId || !job.error?.retryable) ? (
          <Link
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-6 font-semibold"
            href="/dashboard"
          >
            Return to your kits
          </Link>
        ) : null}
      </div>
    </div>
  );
}
