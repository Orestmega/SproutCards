import type { Card, Direction, Progress } from './types';
import { progressId } from './types';

export interface SessionSelection {
  /** Cards whose repetition is due, most overdue first. */
  due: Card[];
  /** Cards never studied in this direction, in deck order, capped by `newLimit`. */
  fresh: Card[];
}

/**
 * Picks the cards for a study session in one direction.
 * @param progress progress records of the deck (any direction; others are ignored)
 * @param newLimit how many never-seen cards may be introduced
 */
export function selectSessionCards(
  cards: readonly Card[],
  progress: readonly Progress[],
  direction: Direction,
  now: number,
  newLimit: number,
): SessionSelection {
  const byId = new Map(progress.map((p) => [p.id, p]));
  const due: { card: Card; dueAt: number }[] = [];
  const fresh: Card[] = [];
  for (const card of cards) {
    const p = byId.get(progressId(card.id, direction));
    if (!p) fresh.push(card);
    else if (p.dueAt <= now) due.push({ card, dueAt: p.dueAt });
  }
  due.sort((a, b) => a.dueAt - b.dueAt);
  return {
    due: due.map((d) => d.card),
    fresh: fresh.slice(0, Math.max(0, newLimit)),
  };
}

/** How many cards are due for review right now (for the home screen counter). */
export function countDue(progress: readonly Progress[], now: number): number {
  return progress.reduce((n, p) => (p.dueAt <= now ? n + 1 : n), 0);
}

/**
 * How many cards were studied for the first time at or after `since` (start of today). Used to keep
 * to the "new cards per day" setting across sessions, decks and directions.
 */
export function countNewSince(progress: readonly Progress[], since: number): number {
  return progress.reduce(
    (n, p) => (p.firstSeenAt !== undefined && p.firstSeenAt >= since ? n + 1 : n),
    0,
  );
}

/** Most cards in one session: long due lists are worked off over several sessions. */
export const SESSION_SIZE = 20;

/** The cards of one session: due first (most overdue first), then new ones, capped at `SESSION_SIZE`. */
export function sessionCards(selection: SessionSelection, size: number = SESSION_SIZE): Card[] {
  return [...selection.due, ...selection.fresh].slice(0, size);
}
