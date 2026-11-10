/**
 * "Learn the whole deck": go through every word of a deck in order, a portion at a time, with no daily
 * limit for new words. A word counts as learned in a direction once it was answered cleanly there
 * (at least one success in a row), the same rule the garden uses.
 */
import type { Card, Direction } from './types';

/** Words per portion: one Learn session. */
export const WHOLE_CHUNK = 20;

interface DirectionProgress {
  cardId: string;
  direction: Direction;
  reps: number;
}

export interface DeckLearning {
  learned: number;
  total: number;
  /** The words still to learn, in the order they were added to the deck. */
  left: Card[];
}

export function deckLearning(
  cards: readonly Card[],
  progress: readonly DirectionProgress[],
  direction: Direction,
): DeckLearning {
  const learnedIds = new Set(
    progress.filter((p) => p.direction === direction && p.reps >= 1).map((p) => p.cardId),
  );
  const left = cards
    .filter((c) => !learnedIds.has(c.id))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return { learned: cards.length - left.length, total: cards.length, left };
}

/** The next portion of words to learn (empty when the whole deck is learned). */
export function wholeDeckChunk(
  cards: readonly Card[],
  progress: readonly DirectionProgress[],
  direction: Direction,
  size = WHOLE_CHUNK,
): Card[] {
  return deckLearning(cards, progress, direction).left.slice(0, size);
}

/** Progress records merged with newer ones (same card and direction: the newer one wins). */
export function mergeProgress<T extends DirectionProgress>(
  older: readonly T[],
  newer: readonly T[],
): T[] {
  const key = (p: T) => `${p.cardId}:${p.direction}`;
  const map = new Map(older.map((p) => [key(p), p]));
  for (const p of newer) map.set(key(p), p);
  return [...map.values()];
}
