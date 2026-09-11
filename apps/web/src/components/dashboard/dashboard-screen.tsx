'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  FileText,
  Files,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

import { DashboardSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { visibleWarnings } from '@/lib/visible-warnings';
import type { KitRecord, KitStatus } from '@/types/kit';

const statusStyle: Record<KitStatus, { marker: string; badge: string; label: string }> = {
  draft: { marker: 'bg-[var(--border-strong)]', badge: 'text-[var(--muted)]', label: 'Draft' },
  queued: { marker: 'bg-[var(--ochre)]', badge: 'text-[var(--warning)]', label: 'Queued' },
  generating: { marker: 'bg-[var(--accent)]', badge: 'text-[var(--accent)]', label: 'Generating' },
  ready: { marker: 'bg-[var(--success)]', badge: 'text-[var(--success-strong)]', label: 'Ready' },
  failed: { marker: 'bg-[var(--danger)]', badge: 'text-[var(--danger)]', label: 'Needs attention' },
};

function daysUntil(record: KitRecord) {
  if (!record.interviewDate) return `${record.input.daysAvailable}-day plan`;
  const difference = Math.ceil((new Date(record.interviewDate).getTime() - Date.now()) / 86_400_000);
  if (difference <= 0) return 'Interview day';
  return `${difference} day${difference === 1 ? '' : 's'} left`;
}

function getCompany(record: KitRecord) {
  if (record.kit?.source.company) return record.kit.source.company;
  try {
    return new URL(record.input.companyUrl).hostname.replace(/^www\./, '');
  } catch {
    return 'Company details pending';
  }
}

function KitRow({ record }: { record: KitRecord }) {
  const visual = statusStyle[record.status];
  const displayedWarnings = visibleWarnings(record.warnings);
  const role = record.kit?.source.role ?? 'Preparing role details';
  const href = record.status === 'queued' || record.status === 'generating' ? `/kits/${record.id}/progress` : `/kits/${record.id}`;

  return (
    <article className="group border-t border-[var(--divider)] first:border-t-0">
      <div className="grid gap-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`size-2.5 rounded-full ${visual.marker}`} />
            <h3 className="font-display truncate text-xl font-semibold">{getCompany(record)}</h3>
            <span className={`text-xs font-semibold ${visual.badge}`}>{visual.label}</span>
            {displayedWarnings.length > 0 ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--warning)]"><TriangleAlert size={14} /> {displayedWarnings.length} {displayedWarnings.length === 1 ? 'note' : 'notes'}</span> : null}
          </div>
          <p className="mt-1 truncate text-sm text-[var(--ink-secondary)]">{role}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5 tabular-nums"><CalendarDays size={14} /> {daysUntil(record)}</span>
            <span>Updated {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(record.updatedAt))}</span>
          </div>
        </div>
        <Link className="secondary-action min-h-10 justify-self-start px-4 py-2 sm:justify-self-end" href={href} onMouseEnter={() => { if (record.status === 'queued' || record.status === 'generating') void import('@/components/generation/generation-stepper'); else void import('@/components/kit-detail/kit-section-screen'); }}>
          {record.status === 'failed' ? 'Review issue' : 'Open kit'} <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function ActiveFolio({ record }: { record: KitRecord }) {
  const kit = record.kit!;
  const today = kit.schedule.days[0];
  const firstCard = kit.flashcards[0];
  const covered = kit.role.requirements.length - kit.coverage.uncovered_requirement_ids.length;
  const coverage = kit.role.requirements.length === 0 ? 100 : Math.round((covered / kit.role.requirements.length) * 100);

  return (
    <section aria-label="Current preparation folio" className="mt-10 grid overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] xl:grid-cols-[0.9fr_1.15fr_0.85fr]">
      <div className="border-b border-[var(--divider)] p-6 sm:p-7 xl:border-b-0 xl:border-r">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--accent)]">Your plan for today</p><h2 className="font-display mt-2 text-2xl font-semibold">{today?.focus ?? 'Continue preparing'}</h2></div><span className="text-xs text-[var(--muted)] tabular-nums">{today?.minutes ?? 0} min</span></div>
        <div className="mt-7 space-y-0">
          {(today?.question_ids.slice(0, 4) ?? []).map((questionId, index) => {
            const question = kit.questions.find((item) => item.id === questionId);
            if (!question) return null;
            return <div className="relative grid grid-cols-[24px_1fr] gap-3 pb-6 last:pb-0" key={questionId}>{index < Math.min(today?.question_ids.length ?? 0, 4) - 1 ? <span className="absolute left-[9px] top-5 h-[calc(100%-8px)] w-px bg-[var(--border)]" /> : null}<span className={`relative z-10 mt-0.5 grid size-5 place-items-center rounded-full border ${index === 0 ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--muted)]'}`}>{index === 0 ? <span className="size-1.5 rounded-full bg-[var(--accent)]" /> : null}</span><div><p className="text-sm font-semibold leading-6">{question.prompt}</p><p className="mt-1 text-xs capitalize text-[var(--muted)]">{question.category.replace('-', ' ')}</p></div></div>;
          })}
        </div>
        <Link className="primary-action mt-8 w-full" href={`/kits/${record.id}/schedule`}>Open today’s plan <ArrowRight size={16} /></Link>
      </div>

      <div className="border-b border-[var(--divider)] bg-[var(--surface-elevated)] p-6 sm:p-7 xl:border-b-0 xl:border-r">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold">Next study card</p><span className="text-xs text-[var(--muted)] tabular-nums">{kit.flashcards.length} cards</span></div>
        {firstCard ? <div className="relative mt-7 pb-4"><div className="absolute inset-x-4 bottom-0 top-4 rotate-1 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]" /><article className="relative min-h-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgb(66_42_30/0.08)]"><p className="text-xs font-semibold text-[var(--muted)]">Think before you reveal</p><h3 className="font-display mt-7 text-2xl font-semibold leading-snug">{firstCard.front}</h3></article></div> : <p className="mt-7 text-sm text-[var(--muted)]">This kit has no flashcards yet.</p>}
        <Link className="secondary-action mt-6 w-full" href={`/kits/${record.id}/practice`}>Start practice <BookOpenCheck size={17} /></Link>
      </div>

      <div className="p-6 sm:p-7">
        <p className="text-sm font-semibold">Readiness notes</p>
        <div className="mt-7"><div className="flex items-end justify-between gap-4"><span className="font-display text-4xl font-semibold tabular-nums">{coverage}%</span><span className="pb-1 text-xs text-[var(--muted)]">requirements covered</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--success-soft)]"><div className="h-full rounded-full bg-[var(--success)]" style={{ width: `${coverage}%` }} /></div></div>
        <div className="mt-8 border-t border-[var(--divider)] pt-6"><p className="font-display text-xl font-semibold">{kit.source.company}</p><p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--muted)]">{kit.company_brief.summary}</p><div className="mt-4 flex items-center gap-2 text-xs text-[var(--success-strong)]"><Check size={15} /><span>{kit.company_brief.sources.length} verified source{kit.company_brief.sources.length === 1 ? '' : 's'}</span></div></div>
        <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]" href={`/kits/${record.id}/brief`}>Read company brief <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}

export function DashboardScreen() {
  const reducedMotion = useReducedMotion();
  const kits = useQuery({ queryKey: ['kits'], queryFn: api.listKits });
  const user = useQuery({ queryKey: ['current-user'], queryFn: api.getCurrentUser });
  const readyKits = kits.data?.filter((kit) => kit.status === 'ready') ?? [];
  const latestReadyKit = readyKits[0];
  const name = user.data?.firstName?.trim();
  const greeting = name ? `Welcome back, ${name}.` : 'Welcome back.';

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-9 sm:px-8 sm:py-12 xl:px-12">
      <div className="flex flex-col gap-6 border-b border-[var(--divider)] pb-9 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="editorial-title text-4xl sm:text-5xl">{greeting}</h1><p className="mt-3 max-w-2xl text-[var(--ink-secondary)]">Your focused workspace for research, role-specific practice, and the days ahead.</p></div>
        <Link className="primary-action self-start px-5" href="/kits/new"><Plus size={18} /> New preparation kit</Link>
      </div>

      {latestReadyKit?.kit ? <ActiveFolio record={latestReadyKit} /> : null}

      <section aria-labelledby="tools-heading" className="pt-12">
        <div className="flex items-end justify-between gap-5"><h2 className="font-display text-2xl font-semibold" id="tools-heading">Choose how you want to prepare</h2>{kits.data ? <p className="text-sm text-[var(--muted)]"><span className="font-semibold text-[var(--ink)] tabular-nums">{readyKits.length}</span> ready · <span className="font-semibold text-[var(--ink)] tabular-nums">{kits.data.length}</span> total</p> : null}</div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Link className="group paper-panel flex min-h-40 flex-col p-6 hover:border-[var(--accent)]" href="/kits/new"><FileText className="text-[var(--accent)]" size={22} /><h3 className="font-display mt-6 text-xl font-semibold">Prepare one role</h3><p className="mt-2 max-w-md text-sm text-[var(--muted)]">Paste one job description and build a complete, focused interview kit.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">Start a kit <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} /></span></Link>
          <Link className="group paper-panel flex min-h-40 flex-col p-6 hover:border-[var(--accent)]" href="/kits/new?mode=batch"><Files className="text-[var(--accent)]" size={22} /><h3 className="font-display mt-6 text-xl font-semibold">Upload several roles</h3><p className="mt-2 max-w-md text-sm text-[var(--muted)]">Add a CSV or JSON file and validate every role before generation begins.</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">Open batch upload <ArrowRight className="transition-transform group-hover:translate-x-1" size={15} /></span></Link>
        </div>
      </section>

      <section className="pt-14" aria-labelledby="kit-list-heading">
        <div className="flex items-end justify-between border-b border-[var(--border-strong)] pb-4"><h2 className="font-display text-2xl font-semibold" id="kit-list-heading">Your preparation library</h2>{kits.data ? <span className="text-sm text-[var(--muted)] tabular-nums">{kits.data.length} kit{kits.data.length === 1 ? '' : 's'}</span> : null}</div>
        {kits.isLoading ? <DashboardSkeleton /> : null}
        {kits.isError ? <div className="mt-6 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-6"><h2 className="font-semibold text-[var(--danger)]">Your kits could not be loaded.</h2><button className="mt-3 font-semibold text-[var(--danger)] underline" onClick={() => void kits.refetch()} type="button">Try again</button></div> : null}
        {kits.data?.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-elevated)] px-6 py-16 text-center"><h2 className="font-display text-2xl font-semibold">Your preparation folio is empty</h2><p className="mx-auto mt-3 max-w-md text-[var(--muted)]">Add the role you are preparing for and your first focused plan will appear here.</p><Link className="primary-action mt-7" href="/kits/new">Create your first kit</Link></div> : null}
        {kits.data ? <motion.div animate={{ opacity: 1 }} initial={reducedMotion ? false : { opacity: 0 }} transition={{ duration: 0.2 }}>{kits.data.map((record) => <KitRow key={record.id} record={record} />)}</motion.div> : null}
      </section>
    </main>
  );
}
