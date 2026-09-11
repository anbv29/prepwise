'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PracticeSkeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { orderFlashcardsForPractice } from '@/lib/practice-order';
import type { PracticeConfidence, PracticeProgress } from '@/types/kit';

const confidenceOptions: Array<{
  value: PracticeConfidence;
  label: string;
  hint: string;
  tone: string;
}> = [
  { value: 1, label: 'Again', hint: 'Did not know it', tone: 'text-[var(--danger)]' },
  { value: 2, label: 'Hard', hint: 'Needed effort', tone: 'text-[var(--warning)]' },
  { value: 3, label: 'Good', hint: 'Mostly clear', tone: 'text-[var(--accent)]' },
  { value: 4, label: 'Easy', hint: 'Knew it quickly', tone: 'text-[var(--success)]' },
];

function optimisticProgress(
  previous: PracticeProgress,
  flashcardId: string,
  confidence: PracticeConfidence,
) {
  const now = new Date().toISOString();
  const existing = previous.cards.find((card) => card.flashcardId === flashcardId);
  return {
    cards: existing
      ? previous.cards.map((card) =>
          card.flashcardId === flashcardId
            ? { ...card, attempts: card.attempts + 1, confidence, lastPracticedAt: now }
            : card,
        )
      : [...previous.cards, { attempts: 1, confidence, flashcardId, lastPracticedAt: now }],
    kitId: previous.kitId,
    updatedAt: now,
  } satisfies PracticeProgress;
}

export function PracticeScreen({ kitId }: { kitId: string }) {
  const queryClient = useQueryClient();
  const kitQuery = useQuery({ queryFn: () => api.getKit(kitId), queryKey: ['kit', kitId] });
  const progressQuery = useQuery({
    enabled: Boolean(kitQuery.data?.kit),
    queryFn: () => api.getPracticeProgress(kitId),
    queryKey: ['practice-progress', kitId],
  });
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [complete, setComplete] = useState(false);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const pointerStart = useRef<number | null>(null);

  const kit = kitQuery.data?.kit;
  const progress = progressQuery.data;

  useEffect(() => {
    if (kit && progress && sessionIds === null) {
      setSessionIds(orderFlashcardsForPractice(kit.flashcards, progress).map((card) => card.id));
    }
  }, [kit, progress, sessionIds]);

  const sessionCards = useMemo(
    () =>
      (sessionIds ?? [])
        .map((id) => kit?.flashcards.find((card) => card.id === id))
        .filter((card): card is NonNullable<typeof card> => Boolean(card)),
    [kit, sessionIds],
  );
  const currentCard = sessionCards[index];
  const seenPercent = sessionCards.length
    ? Math.round((seenIds.length / sessionCards.length) * 100)
    : 0;

  const rating = useMutation({
    mutationFn: ({
      confidence,
      flashcardId,
    }: {
      confidence: PracticeConfidence;
      flashcardId: string;
    }) => api.saveFlashcardConfidence(kitId, flashcardId, confidence),
    onMutate: async ({ confidence, flashcardId }) => {
      await queryClient.cancelQueries({ queryKey: ['practice-progress', kitId] });
      const previous = queryClient.getQueryData<PracticeProgress>(['practice-progress', kitId]);
      if (previous) {
        queryClient.setQueryData(
          ['practice-progress', kitId],
          optimisticProgress(previous, flashcardId, confidence),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['practice-progress', kitId], context.previous);
      }
      toast.error('Confidence was not saved. Try that card again.');
    },
    onSuccess: (next) => queryClient.setQueryData(['practice-progress', kitId], next),
  });

  const move = useCallback(
    (direction: -1 | 1) => {
      setIndex((current) => Math.min(Math.max(current + direction, 0), sessionCards.length - 1));
      setRevealed(false);
    },
    [sessionCards.length],
  );

  const rateCurrent = useCallback(
    (confidence: PracticeConfidence) => {
      if (!currentCard || rating.isPending) return;
      rating.mutate({ confidence, flashcardId: currentCard.id });
      setSeenIds((current) =>
        current.includes(currentCard.id) ? current : [...current, currentCard.id],
      );
      if (index >= sessionCards.length - 1) {
        setComplete(true);
      } else {
        setIndex((current) => current + 1);
        setRevealed(false);
      }
    },
    [currentCard, index, rating, sessionCards.length],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)) return;

      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setRevealed((value) => !value);
      } else if (event.key === 'ArrowLeft') {
        move(-1);
      } else if (event.key === 'ArrowRight') {
        move(1);
      } else if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        rateCurrent(Number(event.key) as PracticeConfidence);
      } else if (event.key === 'Escape') {
        setRevealed(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move, rateCurrent, revealed]);

  function restart() {
    const latest = queryClient.getQueryData<PracticeProgress>(['practice-progress', kitId]);
    if (!kit || !latest) return;
    setSessionIds(orderFlashcardsForPractice(kit.flashcards, latest).map((card) => card.id));
    setIndex(0);
    setSeenIds([]);
    setRevealed(false);
    setComplete(false);
  }

  if (kitQuery.isLoading || progressQuery.isLoading || sessionIds === null) {
    return <PracticeSkeleton />;
  }

  if (kitQuery.isError || progressQuery.isError || !kit) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper)] px-5 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold">Practice could not be loaded</h1>
          <p className="mt-3 text-[var(--muted)]">
            Your kit is unchanged. Return to the flashcards and try again.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center gap-2 bg-[var(--ink)] px-5 font-semibold text-[var(--paper)]"
            href={`/kits/${kitId}/flashcards`}
          >
            <ArrowLeft size={17} /> Back to flashcards
          </Link>
        </div>
      </main>
    );
  }

  if (sessionCards.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper)] px-5 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold">No flashcards to practise yet</h1>
          <p className="mt-3 text-[var(--muted)]">
            Add a few focused recall prompts, then return here for a practice session.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center gap-2 bg-[var(--accent)] px-5 font-semibold text-white"
            href={`/kits/${kitId}/flashcards`}
          >
            <ArrowLeft size={17} /> Add flashcards
          </Link>
        </div>
      </main>
    );
  }

  if (complete) {
    const latest = queryClient.getQueryData<PracticeProgress>(['practice-progress', kitId]);
    const weakCards = latest?.cards.filter((card) => card.confidence <= 2).length ?? 0;
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--paper)] px-5 py-10 text-center">
        <div className="paper-elevated w-full max-w-xl border border-[var(--border)] p-8 sm:p-12">
          <CheckCircle2 className="mx-auto text-[var(--success)]" size={42} />
          <p className="mt-6 text-sm font-semibold text-[var(--success)]">Session complete</p>
          <h1 className="editorial-title mt-2 text-4xl">
            You reviewed {seenIds.length} card{seenIds.length === 1 ? '' : 's'}
          </h1>
          <p className="mt-4 leading-7 text-[var(--muted)]">
            {weakCards > 0
              ? `${weakCards} low-confidence card${weakCards === 1 ? '' : 's'} will move toward the front of your next session.`
              : 'Your next session will still begin with the least-confident material.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              className="primary-action min-h-11 px-5"
              onClick={restart}
              type="button"
            >
              <RotateCcw size={17} /> Start next session
            </button>
            <Link
              className="secondary-action min-h-11 px-5"
              href={`/kits/${kitId}/flashcards`}
            >
              Return to kit
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-center justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Focused practice</p>
            <h1 className="font-display mt-1 text-xl font-semibold">
              {kit.source.company} · {kit.role.title}
            </h1>
          </div>
          <Link
            aria-label="Close practice mode"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
            href={`/kits/${kitId}/flashcards`}
          >
            <X size={19} />
          </Link>
        </header>

        <div className="mt-7">
          <div className="flex items-center justify-between gap-4 text-sm text-[var(--muted)]">
            <span>
              {seenIds.length} of {sessionCards.length} reviewed
            </span>
            <span className="tabular-nums">
              Card {index + 1} of {sessionCards.length}
            </span>
          </div>
          <div
            aria-label={`${seenPercent}% of this session reviewed`}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-subtle)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={seenPercent}
          >
            <div
              className="h-full rounded-full bg-[var(--success)] transition-[width]"
              style={{ width: `${seenPercent}%` }}
            />
          </div>
        </div>

        <div
          className="mt-7"
          onPointerDown={(event) => void (pointerStart.current = event.clientX)}
          onPointerUp={(event) => {
            if (pointerStart.current === null) return;
            const distance = event.clientX - pointerStart.current;
            pointerStart.current = null;
            if (Math.abs(distance) > 55) move(distance > 0 ? -1 : 1);
          }}
          style={{ perspective: 1200 }}
        >
          <motion.button
            animate={{ rotateY: revealed ? 180 : 0 }}
            aria-label={revealed ? 'Hide flashcard answer' : 'Reveal flashcard answer'}
            className="relative block min-h-[400px] w-full text-left"
            onClick={() => setRevealed((value) => !value)}
            style={{ transformStyle: 'preserve-3d' }}
            transition={{ damping: 26, stiffness: 210, type: 'spring' }}
            type="button"
          >
            <section
              className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-7 shadow-[0_20px_54px_rgb(66_42_30/0.11)] sm:p-12"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div>
                <p className="text-sm font-semibold text-[var(--accent)]">Question</p>
                <p className="font-display mt-10 text-3xl font-semibold leading-tight sm:text-4xl">
                  {currentCard?.front}
                </p>
              </div>
              <p className="text-sm text-[var(--muted)]">Tap, click, or press Space to reveal</p>
            </section>
            <section
              className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-[var(--accent)] bg-[var(--surface)] p-7 shadow-[0_20px_54px_rgb(66_42_30/0.11)] sm:p-12"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <div>
                <p className="text-sm font-semibold text-[var(--accent)]">Answer</p>
                <p className="font-display mt-10 text-2xl leading-9 sm:text-3xl">{currentCard?.back}</p>
              </div>
              <p className="text-sm text-[var(--muted)]">Choose how confidently you recalled it</p>
            </section>
          </motion.button>
        </div>

        <div className="mt-6 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3">
          <button
            aria-label="Previous flashcard"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] disabled:opacity-30"
            disabled={index === 0}
            onClick={() => move(-1)}
            type="button"
          >
            <ChevronLeft size={19} />
          </button>
          {revealed ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {confidenceOptions.map((option) => (
                <button
                  className="min-h-14 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-center hover:border-[var(--accent)] disabled:opacity-50"
                  disabled={rating.isPending}
                  key={option.value}
                  onClick={() => rateCurrent(option.value)}
                  type="button"
                >
                  <span className={`block font-semibold ${option.tone}`}>{option.label}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {option.value} · {option.hint}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-[var(--muted)]">
              Reveal the answer to record confidence
            </p>
          )}
          <button
            aria-label="Next flashcard"
            className="inline-flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] disabled:opacity-30"
            disabled={index === sessionCards.length - 1}
            onClick={() => move(1)}
            type="button"
          >
            <ChevronRight size={19} />
          </button>
        </div>

        <footer className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
          <span>Space reveal</span>
          <span>
            <ArrowLeft className="inline" size={13} /> <ArrowRight className="inline" size={13} />{' '}
            navigate
          </span>
          <span>1–4 confidence</span>
        </footer>
      </div>
    </main>
  );
}
