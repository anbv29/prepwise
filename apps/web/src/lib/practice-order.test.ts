import { describe, expect, it } from 'vitest';

import type { Flashcard, PracticeProgress } from '../types/kit';

import { orderFlashcardsForPractice } from './practice-order';

const cards: Flashcard[] = [
  { id: 'easy', front: 'Easy', back: 'A', requirement_ids: [] },
  { id: 'unseen', front: 'Unseen', back: 'B', requirement_ids: [] },
  { id: 'hard', front: 'Hard', back: 'C', requirement_ids: [] },
];

describe('orderFlashcardsForPractice', () => {
  it('places unseen and lower-confidence cards first without mutating the source', () => {
    const progress: PracticeProgress = {
      kitId: 'kit-1',
      updatedAt: '2026-09-09T10:00:00.000Z',
      cards: [
        {
          flashcardId: 'easy',
          confidence: 4,
          attempts: 2,
          lastPracticedAt: '2026-09-09T10:00:00.000Z',
        },
        {
          flashcardId: 'hard',
          confidence: 1,
          attempts: 1,
          lastPracticedAt: '2026-09-09T09:00:00.000Z',
        },
      ],
    };

    expect(orderFlashcardsForPractice(cards, progress).map((card) => card.id)).toEqual([
      'unseen',
      'hard',
      'easy',
    ]);
    expect(cards.map((card) => card.id)).toEqual(['easy', 'unseen', 'hard']);
  });
});
