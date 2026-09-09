import type { Flashcard, PracticeProgress } from '../types/kit';

export function orderFlashcardsForPractice(cards: Flashcard[], progress: PracticeProgress) {
  const confidence = new Map(
    progress.cards.map((card) => [card.flashcardId, card.confidence] as const),
  );

  return [...cards].sort((left, right) => {
    const leftScore = confidence.get(left.id) ?? 0;
    const rightScore = confidence.get(right.id) ?? 0;
    return leftScore - rightScore;
  });
}
