import type { LlmGenerationMetadata } from './provider.js';

export interface GenerationCallMetadata extends LlmGenerationMetadata {
  stage:
    | 'company_brief'
    | 'flashcard_coverage_repair'
    | 'flashcards'
    | 'question_coverage_repair'
    | 'questions';
}

export function normalizeGeneratedText(value: string) {
  return value.replace(/\s+/gu, ' ').trim();
}

export function normalizedKey(value: string) {
  return normalizeGeneratedText(value).toLocaleLowerCase('en-US');
}

export function stableGeneratedId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

export function uniqueKnownIds(
  values: readonly string[],
  knownIds: ReadonlySet<string>,
): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const value = normalizeGeneratedText(rawValue);

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    (knownIds.has(value) ? known : unknown).push(value);
  }

  return { known, unknown };
}

export function withStage(
  stage: GenerationCallMetadata['stage'],
  metadata: LlmGenerationMetadata,
): GenerationCallMetadata {
  return { ...metadata, stage };
}
