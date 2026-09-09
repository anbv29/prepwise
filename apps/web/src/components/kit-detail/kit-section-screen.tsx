'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  MessageSquareText,
  TriangleAlert,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { KitDetailRouteSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Kit } from '@/types/kit';

import { BriefBuilder, RoleBuilder } from './brief-role-builder';
import { FlashcardBuilder } from './flashcard-builder';
import { KitEditorProvider, useKitEditor } from './kit-editor-context';

const QuestionBuilder = dynamic(() => import('./question-builder'), {
  loading: () => (
    <div className="mt-8 space-y-5" aria-label="Loading question editor">
      <div className="skeleton h-14 w-full" />
      <div className="skeleton h-56 w-full" />
      <div className="skeleton h-56 w-full" />
    </div>
  ),
});

export type KitSection =
  'overview' | 'brief' | 'role' | 'questions' | 'flashcards' | 'schedule' | 'coverage';

export const kitSections: Array<{
  id: KitSection;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: 'Overview', description: 'Kit summary and next steps' },
  { id: 'brief', label: 'Company brief', description: 'Research and verified sources' },
  { id: 'role', label: 'Role analysis', description: 'Responsibilities and requirements' },
  { id: 'questions', label: 'Questions', description: 'Role-specific interview practice' },
  { id: 'flashcards', label: 'Flashcards', description: 'Active-recall study prompts' },
  { id: 'schedule', label: 'Schedule', description: 'A daily preparation sequence' },
  { id: 'coverage', label: 'Coverage', description: 'Requirement-level gap check' },
];

function coveragePercent(kit: Kit) {
  const total = kit.role.requirements.length;
  if (total === 0) return 100;
  return Math.round(((total - kit.coverage.uncovered_requirement_ids.length) / total) * 100);
}

function sectionHref(kitId: string, section: KitSection) {
  return section === 'overview' ? `/kits/${kitId}` : `/kits/${kitId}/${section}`;
}

function sourceName(source: string) {
  try {
    return new URL(source).hostname.replace(/^www\./, '');
  } catch {
    return 'View source';
  }
}

function SectionNavigation({ kitId, active }: { kitId: string; active: KitSection }) {
  return (
    <>
      <div className="sticky top-16 z-30 -mx-5 overflow-x-auto border-y border-[var(--border)] bg-[var(--paper)] px-5 lg:hidden">
        <nav aria-label="Kit sections" className="flex min-w-max gap-1 py-2">
          {kitSections.map((item) => (
            <Link
              aria-current={active === item.id ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${active === item.id ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'}`}
              href={sectionHref(kitId, item.id)}
              key={item.id}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <aside className="sticky top-24 hidden lg:block">
        <nav aria-label="Kit sections" className="space-y-1">
          {kitSections.map((item) => (
            <Link
              aria-current={active === item.id ? 'page' : undefined}
              className={`block border-l-2 px-4 py-3 ${active === item.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]'}`}
              href={sectionHref(kitId, item.id)}
              key={item.id}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-xs leading-5 opacity-80">{item.description}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <header className="border-b border-[var(--border)] pb-7">
      <p className="text-sm font-semibold text-[var(--accent)]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{title}</h2>
      <p className="mt-3 max-w-2xl text-[var(--muted)]">{text}</p>
    </header>
  );
}

function OverviewSection({ kit, kitId }: { kit: Kit; kitId: string }) {
  const percent = coveragePercent(kit);
  const totalMinutes = kit.schedule.days.reduce((total, day) => total + day.minutes, 0);
  const cards = [
    {
      id: 'brief' as const,
      label: 'Company brief',
      value: `${kit.company_brief.sources.length} sources`,
      icon: Building2,
    },
    {
      id: 'role' as const,
      label: 'Role analysis',
      value: `${kit.role.requirements.length} requirements`,
      icon: ListChecks,
    },
    {
      id: 'questions' as const,
      label: 'Question bank',
      value: `${kit.questions.length} questions`,
      icon: MessageSquareText,
    },
    {
      id: 'flashcards' as const,
      label: 'Flashcards',
      value: `${kit.flashcards.length} prompts`,
      icon: BookOpen,
    },
    {
      id: 'schedule' as const,
      label: 'Study schedule',
      value: `${totalMinutes} total minutes`,
      icon: CalendarDays,
    },
    {
      id: 'coverage' as const,
      label: 'Coverage check',
      value: `${percent}% covered`,
      icon: BadgeCheck,
    },
  ];

  return (
    <div>
      <SectionHeading
        eyebrow="Kit overview"
        title="Everything prepared for this interview"
        text="Each part of the kit has its own workspace. Start with the company and role context, then use the question bank and schedule for focused practice."
      />
      <div className="mt-8 grid border-l border-t border-[var(--border)] sm:grid-cols-2">
        {cards.map(({ id, label, value, icon: Icon }) => (
          <Link
            className="group border-b border-r border-[var(--border)] bg-[var(--surface)] p-6 hover:bg-[var(--surface-subtle)]"
            href={sectionHref(kitId, id)}
            key={id}
          >
            <div className="flex items-start justify-between gap-4">
              <Icon className="text-[var(--accent)]" size={21} />
              <ArrowRight
                className="text-[var(--muted)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
                size={17}
              />
            </div>
            <h3 className="mt-8 font-semibold">{label}</h3>
            <p className="mt-1 text-sm text-[var(--muted)] tabular-nums">{value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8 border-l-2 border-[var(--accent)] bg-[var(--surface)] p-6">
        <p className="text-sm font-semibold text-[var(--accent)]">Recommended next step</p>
        <h3 className="mt-2 text-xl font-semibold">
          Review the must-have requirements before practising answers.
        </h3>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          This gives every answer a clear connection to what the hiring team is likely evaluating.
        </p>
        <Link
          className="mt-5 inline-flex items-center gap-2 font-semibold text-[var(--accent)]"
          href={`/kits/${kitId}/role`}
        >
          Open role analysis <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function BriefSection({ kit, kitId }: { kit: Kit; kitId: string }) {
  return (
    <div>
      <SectionHeading
        eyebrow="Company brief"
        title="What to understand before the conversation"
        text="A concise, source-grounded view of the company and the context most useful for this interview."
      />
      <BriefBuilder kitId={kitId} />
      <div className="mt-8 max-w-3xl">
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)]">Sources used</h3>
          {kit.company_brief.sources.length > 0 ? (
            <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {kit.company_brief.sources.map((source) => (
                <a
                  className="flex items-center justify-between gap-4 py-4 font-semibold hover:text-[var(--accent)]"
                  href={source}
                  key={source}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{sourceName(source)}</span>
                  <ArrowUpRight size={17} />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[var(--muted)]">
              No verified public sources were available. The remaining kit is based on the job
              description.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleSection() {
  return (
    <div>
      <SectionHeading
        eyebrow="Role analysis"
        title="Shape the role around what you need to demonstrate"
        text="Responsibilities and requirements extracted from the job description, with must-have expectations kept distinct from preferred experience."
      />
      <RoleBuilder />
    </div>
  );
}

function QuestionsSection({ kit, kitId }: { kit: Kit; kitId: string }) {
  return (
    <div>
      <SectionHeading
        eyebrow="Question bank"
        title={`${kit.questions.length} questions built for this role`}
        text="Use the outline to shape your own evidence and decisions. It is a preparation guide, not a script to memorise."
      />
      <QuestionBuilder kitId={kitId} />
    </div>
  );
}

function FlashcardsSection({ kit }: { kit: Kit }) {
  return (
    <div>
      <SectionHeading
        eyebrow="Flashcards"
        title={`${kit.flashcards.length} prompts for active recall`}
        text="Use these for short review sessions. Answer the front aloud before checking the explanation."
      />
      <FlashcardBuilder />
    </div>
  );
}

function ScheduleSection({ kit }: { kit: Kit }) {
  return (
    <div>
      <SectionHeading
        eyebrow="Preparation schedule"
        title={`${kit.schedule.days_available} days, ordered by priority`}
        text="High-difficulty must-have topics appear earlier, leaving time for repetition and mixed review."
      />
      <ol className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {kit.schedule.days.map((day) => (
          <li
            className="grid gap-4 py-6 sm:grid-cols-[80px_minmax(0,1fr)_100px] sm:items-center"
            key={day.day}
          >
            <span className="text-sm font-semibold text-[var(--accent)] tabular-nums">
              DAY {String(day.day).padStart(2, '0')}
            </span>
            <div>
              <h3 className="font-semibold">{day.focus}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {day.question_ids.length} practice question
                {day.question_ids.length === 1 ? '' : 's'}
              </p>
            </div>
            <span className="text-sm font-semibold text-[var(--muted)] tabular-nums sm:text-right">
              {day.minutes} min
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CoverageSection({ kit }: { kit: Kit }) {
  const uncovered = new Set(kit.coverage.uncovered_requirement_ids);
  const percent = coveragePercent(kit);
  return (
    <div>
      <SectionHeading
        eyebrow="Coverage report"
        title={`${percent}% of role requirements covered`}
        text="Coverage links the generated question bank back to the source requirements so preparation gaps remain explicit."
      />
      <div className="mt-8 flex items-end justify-between gap-5 border-b border-[var(--border)] pb-5">
        <div>
          <p className="text-sm text-[var(--muted)]">Validation passes</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{kit.coverage.passes}</p>
        </div>
        <p className="text-5xl font-semibold tracking-[-0.05em] text-[var(--success)] tabular-nums">
          {percent}%
        </p>
      </div>
      <div className="mt-6 divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {kit.role.requirements.map((requirement) => {
          const isCovered = !uncovered.has(requirement.id);
          const questionCount = kit.questions.filter((question) =>
            question.requirement_ids.includes(requirement.id),
          ).length;
          return (
            <div className="flex gap-4 py-5" key={requirement.id}>
              {isCovered ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--success)]" size={20} />
              ) : (
                <TriangleAlert className="mt-0.5 shrink-0 text-[var(--warning)]" size={20} />
              )}
              <div>
                <h3 className="font-semibold">{requirement.text}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {isCovered
                    ? `${questionCount} linked question${questionCount === 1 ? '' : 's'}`
                    : 'No question currently covers this preferred requirement'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionContent({ section, kit, kitId }: { section: KitSection; kit: Kit; kitId: string }) {
  if (section === 'overview') return <OverviewSection kit={kit} kitId={kitId} />;
  if (section === 'brief') return <BriefSection kit={kit} kitId={kitId} />;
  if (section === 'role') return <RoleSection />;
  if (section === 'questions') return <QuestionsSection kit={kit} kitId={kitId} />;
  if (section === 'flashcards') return <FlashcardsSection kit={kit} />;
  if (section === 'schedule') return <ScheduleSection kit={kit} />;
  return <CoverageSection kit={kit} />;
}

function SavingIndicator() {
  const { isSaving } = useKitEditor();
  return (
    <span className="text-sm text-[var(--muted)]" role="status">
      {isSaving ? 'Saving changes…' : 'All changes saved'}
    </span>
  );
}

export function KitSectionScreen({ kitId, section }: { kitId: string; section: KitSection }) {
  const kitQuery = useQuery({ queryKey: ['kit', kitId], queryFn: () => api.getKit(kitId) });

  if (kitQuery.isLoading) return <KitDetailRouteSkeleton />;
  if (kitQuery.isError || !kitQuery.data)
    return (
      <div className="mx-auto max-w-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-7 text-center">
        <h1 className="text-xl font-semibold text-[var(--danger)]">
          This kit could not be loaded.
        </h1>
        <button
          className="mt-4 font-semibold text-[var(--danger)] underline underline-offset-4"
          onClick={() => void kitQuery.refetch()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  const record = kitQuery.data;
  const kit = record.kit;

  if (!kit)
    return (
      <div className="mx-auto max-w-xl border border-[var(--warning)] bg-[var(--warning-soft)] p-7 text-center">
        <h1 className="text-xl font-semibold">This kit is still being prepared.</h1>
        <Link
          className="mt-4 inline-block font-semibold text-[var(--accent)]"
          href={`/kits/${kitId}/progress`}
        >
          View progress
        </Link>
      </div>
    );

  return (
    <KitEditorProvider kit={kit} kitId={kitId}>
      <div>
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          href="/dashboard"
        >
          <ArrowLeft size={16} /> All kits
        </Link>
        <header className="mt-7 pb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                <span>{kit.source.company}</span>
                <span aria-hidden="true">/</span>
                <span>{kit.source.location || 'Location not specified'}</span>
              </div>
              <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {kit.role.title}
              </h1>
            </div>
            <SavingIndicator />
          </div>
        </header>
        {record.warnings.length > 0 ? (
          <div className="mb-7 flex gap-3 border-l-2 border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm">
            <TriangleAlert className="mt-0.5 shrink-0 text-[var(--warning)]" size={18} />
            <div>
              <p className="font-semibold text-[var(--warning)]">Limited source note</p>
              <p className="mt-1 text-[var(--muted)]">{record.warnings[0]?.message}</p>
            </div>
          </div>
        ) : null}
        <div className="lg:hidden">
          <SectionNavigation active={section} kitId={kitId} />
        </div>
        <div className="mt-9 grid items-start gap-12 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <SectionNavigation active={section} kitId={kitId} />
          </div>
          <main className="min-w-0">
            <SectionContent kit={kit} kitId={kitId} section={section} />
          </main>
        </div>
      </div>
    </KitEditorProvider>
  );
}
