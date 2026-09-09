'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Kit, Question } from '@/types/kit';

const sections = [
  ['brief', 'Brief'],
  ['role', 'Role'],
  ['questions', 'Questions'],
  ['flashcards', 'Flashcards'],
  ['schedule', 'Schedule'],
  ['coverage', 'Coverage'],
] as const;

const categoryLabel: Record<Question['category'], string> = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  'system-design': 'System design',
  'company-fit': 'Company fit',
};

function coveragePercent(kit: Kit) {
  const total = kit.role.requirements.length;
  if (total === 0) return 100;
  return Math.round(((total - kit.coverage.uncovered_requirement_ids.length) / total) * 100);
}

function KitDetailSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)]">
      <div className="hidden space-y-3 lg:block">
        {sections.map(([id]) => (
          <Skeleton className="h-10 w-full" key={id} />
        ))}
      </div>
      <div className="space-y-8">
        <Skeleton className="h-12 w-96 max-w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

export function KitDetailScreen({ kitId }: { kitId: string }) {
  const kitQuery = useQuery({ queryKey: ['kit', kitId], queryFn: () => api.getKit(kitId) });

  if (kitQuery.isLoading) return <KitDetailSkeleton />;

  if (kitQuery.isError || !kitQuery.data) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-7 text-center">
        <h1 className="text-xl font-semibold text-[var(--danger)]">
          This kit is not available yet.
        </h1>
        <Link className="mt-4 inline-block font-semibold text-[var(--danger)]" href="/dashboard">
          Return to your kits
        </Link>
      </div>
    );
  }

  const record = kitQuery.data;

  if (!record.kit) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] p-7 text-center">
        <h1 className="text-xl font-semibold">This kit is still being prepared.</h1>
        <Link className="mt-4 inline-block font-semibold text-[var(--accent)]" href="/dashboard">
          Return to your kits
        </Link>
      </div>
    );
  }

  const kit = record.kit;
  const percent = coveragePercent(kit);

  return (
    <div>
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        href="/dashboard"
      >
        <ArrowLeft size={16} /> All kits
      </Link>
      <header className="mt-8 border-b border-[var(--border)] pb-8">
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
          <span>{kit.source.company}</span>
          <span aria-hidden="true">/</span>
          <span>{kit.source.location || 'Location not specified'}</span>
        </div>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
          {kit.role.title}
        </h1>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)] tabular-nums">
          <span>{kit.questions.length} questions</span>
          <span>{kit.flashcards.length} flashcards</span>
          <span>{kit.schedule.days_available}-day plan</span>
        </div>
      </header>

      {record.warnings.length > 0 ? (
        <div className="mt-6 flex gap-3 rounded-xl border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm">
          <TriangleAlert className="mt-0.5 shrink-0 text-[var(--warning)]" size={18} />
          <div>
            <p className="font-semibold text-[var(--warning)]">
              Useful with limited source material
            </p>
            <ul className="mt-1 space-y-1 text-[var(--muted)]">
              {record.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.sourceUrl ?? warning.message}`}>
                  {warning.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="sticky top-0 z-20 -mx-5 mt-6 overflow-x-auto border-y border-[var(--border)] bg-[var(--paper)] px-5 lg:hidden">
        <nav aria-label="Kit sections" className="flex min-w-max gap-1 py-2">
          {sections.map(([id, label]) => (
            <a
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
              href={`#${id}`}
              key={id}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="mt-10 grid items-start gap-12 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="sticky top-8 hidden lg:block">
          <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">Coverage</span>
              <span className="font-semibold text-[var(--success)] tabular-nums">{percent}%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]">
              <div
                className="h-full rounded-full bg-[var(--success)]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <nav aria-label="Kit sections" className="space-y-1">
            {sections.map(([id, label]) => (
              <a
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]"
                href={`#${id}`}
                key={id}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-16">
          <section className="scroll-mt-24" id="brief">
            <p className="text-sm font-semibold text-[var(--accent)]">Company brief</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
              What to understand before the conversation
            </h2>
            <div className="mt-6 max-w-[720px] space-y-6 text-[var(--muted)]">
              <p>{kit.company_brief.summary}</p>
              <div>
                <h3 className="font-semibold text-[var(--ink)]">What they do</h3>
                <p className="mt-2">{kit.company_brief.what_they_do}</p>
              </div>
              {kit.company_brief.sources.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {kit.company_brief.sources.map((source) => (
                    <a
                      className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"
                      href={source}
                      key={source}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {new URL(source).hostname.replace(/^www\./, '')} <ArrowUpRight size={14} />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="scroll-mt-24" id="role">
            <p className="text-sm font-semibold text-[var(--accent)]">Role breakdown</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
              {kit.role.seniority}
            </h2>
            <ul className="mt-5 max-w-[720px] space-y-3 text-[var(--muted)]">
              {kit.role.responsibilities.map((responsibility) => (
                <li className="flex gap-3" key={responsibility}>
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />{' '}
                  {responsibility}
                </li>
              ))}
            </ul>
            <div className="mt-7 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead className="bg-[var(--surface-subtle)] text-sm text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Requirement</th>
                    <th className="px-5 py-3 font-semibold">Kind</th>
                    <th className="px-5 py-3 font-semibold">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {kit.role.requirements.map((requirement) => (
                    <tr className="border-t border-[var(--border)]" key={requirement.id}>
                      <td className="px-5 py-4 font-medium">{requirement.text}</td>
                      <td className="px-5 py-4 text-sm capitalize text-[var(--muted)]">
                        {requirement.kind}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${requirement.priority === 'must' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]'}`}
                        >
                          {requirement.priority === 'must' ? 'Required' : 'Preferred'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="scroll-mt-24" id="questions">
            <p className="text-sm font-semibold text-[var(--accent)]">Question bank</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
              Practice the decisions, not a script
            </h2>
            <div className="mt-7 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {kit.questions.map((question, index) => (
                <article
                  className="grid gap-4 py-6 sm:grid-cols-[44px_minmax(0,1fr)]"
                  key={question.id}
                >
                  <span className="text-sm font-semibold text-[var(--muted)] tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                      <span className="text-[var(--accent)]">
                        {categoryLabel[question.category]}
                      </span>
                      <span className="text-[var(--muted)]">
                        Difficulty {question.difficulty}/3
                      </span>
                      {question.edited ? (
                        <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5">
                          Edited
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{question.prompt}</h3>
                    <p className="mt-3 max-w-[720px] text-[var(--muted)]">
                      {question.answer_outline}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="scroll-mt-24" id="flashcards">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--accent)]">Flashcards</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
                  Recall the essentials
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                <BookOpen size={16} /> {kit.flashcards.length} recall prompts
              </span>
            </div>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {kit.flashcards.map((card) => (
                <article
                  className="min-h-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
                  key={card.id}
                >
                  <h3 className="font-semibold">{card.front}</h3>
                  <p className="mt-4 text-sm text-[var(--muted)]">{card.back}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="scroll-mt-24" id="schedule">
            <p className="text-sm font-semibold text-[var(--accent)]">Schedule</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
              A plan for the time available
            </h2>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {kit.schedule.days.map((day) => (
                <article
                  className="border-l-2 border-[var(--accent)] bg-[var(--surface)] px-5 py-4"
                  key={day.day}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">Day {day.day}</span>
                    <span className="text-[var(--muted)] tabular-nums">{day.minutes} min</span>
                  </div>
                  <p className="mt-3 font-medium">{day.focus}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="scroll-mt-24 border-t border-[var(--border)] pt-10" id="coverage">
            <p className="text-sm font-semibold text-[var(--accent)]">Coverage</p>
            {kit.coverage.uncovered_requirement_ids.length === 0 ? (
              <div className="mt-4 flex gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--success)]" size={20} />
                <div>
                  <h2 className="font-semibold">All role requirements are covered</h2>
                  <p className="mt-1 text-[var(--muted)] tabular-nums">
                    Validated in {kit.coverage.passes} pass{kit.coverage.passes === 1 ? '' : 'es'}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <h2 className="font-semibold">Keep these gaps in view</h2>
                <p className="mt-1 text-[var(--muted)]">
                  The source material was thin, so these preferred requirements remain uncovered:{' '}
                  {kit.coverage.uncovered_requirement_ids
                    .map(
                      (requirementId) =>
                        kit.role.requirements.find((item) => item.id === requirementId)?.text ??
                        requirementId,
                    )
                    .join(', ')}
                  .
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
