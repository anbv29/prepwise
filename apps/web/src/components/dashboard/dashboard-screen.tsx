'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  FileText,
  Files,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

import { DashboardSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { KitRecord, KitStatus } from '@/types/kit';

const statusStyle: Record<KitStatus, { bar: string; badge: string; label: string }> = {
  draft: {
    bar: 'bg-[var(--border-strong)]',
    badge: 'bg-[var(--surface-subtle)] text-[var(--muted)]',
    label: 'Draft',
  },
  queued: {
    bar: 'bg-[var(--accent)]',
    badge: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    label: 'Queued',
  },
  generating: {
    bar: 'bg-[var(--accent)]',
    badge: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    label: 'Generating',
  },
  ready: {
    bar: 'bg-[var(--success)]',
    badge: 'bg-[var(--success-soft)] text-[var(--success)]',
    label: 'Ready',
  },
  failed: {
    bar: 'bg-[var(--danger)]',
    badge: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    label: 'Needs attention',
  },
};

function daysUntil(record: KitRecord) {
  if (!record.interviewDate) return `${record.input.daysAvailable}-day plan`;
  const difference = Math.ceil(
    (new Date(record.interviewDate).getTime() - Date.now()) / (24 * 60 * 60 * 1_000),
  );
  if (difference <= 0) return 'Interview day';
  return `${difference} day${difference === 1 ? '' : 's'} left`;
}

function KitRow({ record }: { record: KitRecord }) {
  const visual = statusStyle[record.status];
  let company = record.kit?.source.company;
  if (!company) {
    try {
      company = new URL(record.input.companyUrl).hostname.replace(/^www\./, '');
    } catch {
      company = 'Company details pending';
    }
  }
  const role = record.kit?.source.role ?? 'Preparing role details';
  const href =
    record.status === 'queued' || record.status === 'generating'
      ? `/kits/${record.id}/progress`
      : `/kits/${record.id}`;

  return (
    <article className="group grid min-h-28 grid-cols-[5px_1fr] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--border-strong)]">
      <div className={visual.bar} />
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="truncate text-lg font-semibold tracking-[-0.015em]">{company}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${visual.badge}`}>
              {visual.label}
            </span>
            {record.warnings.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--warning)]">
                <TriangleAlert size={14} /> {record.warnings.length}{' '}
                {record.warnings.length === 1 ? 'note' : 'notes'}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[var(--muted)]">{role}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarDays size={15} /> {daysUntil(record)}
            </span>
            <span>
              Updated{' '}
              {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                new Date(record.updatedAt),
              )}
            </span>
          </div>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 justify-self-start rounded-lg border border-[var(--border)] px-4 text-sm font-semibold transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] sm:justify-self-end sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          href={href}
          onMouseEnter={() => {
            if (record.status === 'queued' || record.status === 'generating') {
              void import('@/components/generation/generation-stepper');
            } else {
              void import('@/components/kit-detail/kit-section-screen');
            }
          }}
        >
          {record.status === 'failed' ? 'Review issue' : 'Open kit'} <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

export function DashboardScreen() {
  const reducedMotion = useReducedMotion();
  const kits = useQuery({ queryKey: ['kits'], queryFn: api.listKits });
  const readyKits = kits.data?.filter((kit) => kit.status === 'ready') ?? [];
  const averageCoverage =
    readyKits.length === 0
      ? 0
      : Math.round(
          readyKits.reduce((total, record) => {
            const requirements = record.kit?.role.requirements.length ?? 0;
            const uncovered = record.kit?.coverage.uncovered_requirement_ids.length ?? 0;
            return (
              total + (requirements === 0 ? 100 : ((requirements - uncovered) / requirements) * 100)
            );
          }, 0) / readyKits.length,
        );
  const latestReadyKit = readyKits[0];

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-6 border-b border-[var(--border)] pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Preparation workspace
          </h1>
          <p className="mt-3 max-w-2xl text-[var(--muted)]">
            Create role-specific kits, review research, practise questions, and keep every job
            requirement covered.
          </p>
        </div>
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-[var(--accent)] px-5 font-semibold text-white transition-opacity hover:opacity-90"
          href="/kits/new"
        >
          <Plus size={18} /> New kit
        </Link>
      </div>

      <section aria-labelledby="tools-heading" className="pt-8">
        <div className="flex items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Your tools</p>
            <h2 className="mt-1 text-xl font-semibold" id="tools-heading">
              Choose how you want to prepare
            </h2>
          </div>
          {kits.data ? (
            <div className="hidden gap-6 text-right sm:flex">
              <div>
                <p className="text-lg font-semibold tabular-nums">{readyKits.length}</p>
                <p className="text-xs text-[var(--muted)]">Ready kits</p>
              </div>
              <div>
                <p className="text-lg font-semibold tabular-nums">{averageCoverage}%</p>
                <p className="text-xs text-[var(--muted)]">Average coverage</p>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-5 grid gap-px border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
          <Link
            className="group bg-[var(--surface)] p-5 hover:bg-[var(--surface-subtle)]"
            href="/kits/new"
          >
            <FileText className="text-[var(--accent)]" size={20} />
            <h3 className="mt-6 font-semibold">Prepare one role</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Paste one job description and build a complete, focused interview kit.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              Start a kit{' '}
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} />
            </span>
          </Link>
          <Link
            className="group bg-[var(--surface)] p-5 hover:bg-[var(--surface-subtle)]"
            href="/kits/new?mode=batch"
          >
            <Files className="text-[var(--accent)]" size={20} />
            <h3 className="mt-6 font-semibold">Upload several roles</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add a CSV or JSON file and validate every role before generation begins.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              Open batch upload{' '}
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} />
            </span>
          </Link>
          {latestReadyKit ? (
            <Link
              className="group bg-[var(--surface)] p-5 hover:bg-[var(--surface-subtle)]"
              href={`/kits/${latestReadyKit.id}`}
            >
              <BookOpenCheck className="text-[var(--accent)]" size={20} />
              <h3 className="mt-6 font-semibold">Continue your latest kit</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Review its sections, see coverage, and continue your preparation plan.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                Open overview{' '}
                <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} />
              </span>
            </Link>
          ) : (
            <div className="bg-[var(--surface)] p-5">
              <BookOpenCheck className="text-[var(--muted)]" size={20} />
              <h3 className="mt-6 font-semibold">Review generated results</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Company research, questions, cards, schedule, and coverage each get a dedicated
                page.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="pt-12" aria-labelledby="kit-list-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold" id="kit-list-heading">
            Your preparation
          </h2>
          {kits.data ? (
            <span className="text-sm text-[var(--muted)] tabular-nums">
              {kits.data.length} kit{kits.data.length === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
        {kits.isLoading ? <DashboardSkeleton /> : null}
        {kits.isError ? (
          <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-6">
            <h2 className="font-semibold text-[var(--danger)]">Your kits could not be loaded.</h2>
            <button
              className="mt-3 font-semibold text-[var(--danger)] underline underline-offset-4"
              onClick={() => void kits.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : null}
        {kits.data?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">No interview kits yet</h2>
            <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
              Add the role you are preparing for and your first focused plan will appear here.
            </p>
            <Link className="mt-6 inline-block font-semibold text-[var(--accent)]" href="/kits/new">
              Create your first kit
            </Link>
          </div>
        ) : null}
        {kits.data ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="space-y-3"
            initial={reducedMotion ? false : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {kits.data.map((record) => (
              <KitRow key={record.id} record={record} />
            ))}
          </motion.div>
        ) : null}
      </section>
    </main>
  );
}
