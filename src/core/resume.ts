/**
 * Continuing a Learn session later. A snapshot of the session is kept while it runs; when the user
 * leaves, the words finished so far are saved as usual and the snapshot remembers what was saved, so
 * finishing the session later never schedules a word or logs an answer twice.
 */
import { progressFraction } from './learn';
import type { LearnState } from './learn';
import type { Card, Direction, Progress, ReviewLog } from './types';

export interface LearnSnapshot {
  version: 1;
  deckId: string;
  direction: Direction;
  state: LearnState;
  /** Cards whose new schedule is already stored (saved when the user left). */
  savedCardIds: string[];
  /** How many answers (from the start of `state.events`) are already in the review log. */
  savedEvents: number;
  savedAt: number;
}

/** A snapshot older than this is not offered any more: the words are due differently by then. */
export const RESUME_MAX_DAYS = 14;

/**
 * How far the session got: words finished out of all words, and the share of the whole session (each
 * word has several steps, so the share moves even before a word is finished; like the progress bar).
 */
export function snapshotProgress(snapshot: LearnSnapshot): {
  done: number;
  total: number;
  percent: number;
} {
  const items = Object.values(snapshot.state.items);
  return {
    done: items.filter((i) => i.passed).length,
    total: items.length,
    percent: Math.round(progressFraction(snapshot.state) * 100),
  };
}

/**
 * Whether the snapshot can be continued: it belongs to the deck and direction, it is not finished,
 * not too old, and every word in it still exists.
 */
export function isResumable(
  snapshot: LearnSnapshot | null,
  deckId: string,
  direction: Direction,
  cards: readonly Card[],
  now: number,
): snapshot is LearnSnapshot {
  if (!snapshot || snapshot.version !== 1) return false;
  if (snapshot.deckId !== deckId || snapshot.direction !== direction) return false;
  if (snapshot.state.current === null) return false;
  if (now - snapshot.savedAt > RESUME_MAX_DAYS * 86_400_000) return false;
  const ids = new Set(cards.map((c) => c.id));
  return Object.keys(snapshot.state.items).every((id) => ids.has(id));
}

/** The session with the cards as they are now (a card may have been edited in between). */
export function withCurrentCards(state: LearnState, cards: readonly Card[]): LearnState {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const fresh: Record<string, Card> = {};
  for (const id of Object.keys(state.cards)) fresh[id] = byId.get(id) ?? (state.cards[id] as Card);
  return { ...state, cards: fresh };
}

/** What still has to be stored: schedules of words not saved before, answers after the saved ones. */
export function unsaved(
  progress: readonly Progress[],
  logs: readonly ReviewLog[],
  savedCardIds: readonly string[],
  savedEvents: number,
): { progress: Progress[]; logs: ReviewLog[] } {
  const saved = new Set(savedCardIds);
  return {
    progress: progress.filter((p) => !saved.has(p.cardId)),
    logs: logs.slice(savedEvents),
  };
}

/** After saving on leaving: everything finished so far counts as saved. */
export function markSaved(snapshot: LearnSnapshot, now: number): LearnSnapshot {
  const passed = Object.entries(snapshot.state.items)
    .filter(([, item]) => item.passed)
    .map(([id]) => id);
  return {
    ...snapshot,
    savedCardIds: [...new Set([...snapshot.savedCardIds, ...passed])],
    savedEvents: snapshot.state.events.length,
    savedAt: now,
  };
}
