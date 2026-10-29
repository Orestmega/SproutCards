// Match game: a board of word tiles and translation tiles; tap two tiles to pair them. Played against
// the clock. It never changes the review schedule (a game is for fun and warm-up); results only go to
// the review log, like a quiz.

import { normalizeAnswer } from './answer';
import { sideTexts } from './learn';
import { shuffle } from './random';
import type { Rng } from './random';
import type { Card, CardSide, Direction, ReviewLog } from './types';

/** Pairs on one board (12 tiles fit a phone screen). */
export const MATCH_PAIRS = 6;

export interface MatchTile {
  id: string;
  cardId: string;
  side: CardSide;
  text: string;
}

export interface MatchState {
  direction: Direction;
  tiles: readonly MatchTile[];
  /** Card ids already paired. */
  matched: readonly string[];
  /** The tile waiting for its partner, if any. */
  selected: string | null;
  mistakes: number;
  /** Wrong tries per card id (both tiles of a wrong pair are counted). */
  mistakesByCard: Readonly<Record<string, number>>;
  /** The two tiles of the latest wrong try, for a short "not a pair" marking. */
  lastWrong: readonly [string, string] | null;
  /** Time of the first tap; the clock starts there, not when the board appears. */
  startedAt: number | null;
  finishedAt: number | null;
}

/**
 * A fresh board from up to `pairCount` random cards. Cards whose word or translation equals another
 * chosen card's are skipped: the board could not tell which tile belongs where.
 */
export function startMatch(
  cards: readonly Card[],
  direction: Direction,
  rng: Rng = Math.random,
  pairCount: number = MATCH_PAIRS,
  ignoreDiacritics = true,
): MatchState {
  const opts = { ignoreDiacritics };
  const usedTerms = new Set<string>();
  const usedAnswers = new Set<string>();
  const chosen: Card[] = [];
  for (const card of shuffle(cards, rng)) {
    if (chosen.length >= pairCount) break;
    const term = sideTexts(card, 'term')[0];
    const answer = sideTexts(card, 'translation')[0];
    if (term === undefined || answer === undefined) continue;
    const termKey = normalizeAnswer(term, opts);
    const answerKey = normalizeAnswer(answer, opts);
    if (usedTerms.has(termKey) || usedAnswers.has(answerKey)) continue;
    if (chosen.some((c) => c.id === card.id)) continue;
    usedTerms.add(termKey);
    usedAnswers.add(answerKey);
    chosen.push(card);
  }
  const tiles: MatchTile[] = chosen.flatMap((card) => [
    {
      id: `${card.id}:term`,
      cardId: card.id,
      side: 'term' as const,
      text: sideTexts(card, 'term')[0] as string,
    },
    {
      id: `${card.id}:translation`,
      cardId: card.id,
      side: 'translation' as const,
      text: sideTexts(card, 'translation')[0] as string,
    },
  ]);
  return {
    direction,
    tiles: shuffle(tiles, rng),
    matched: [],
    selected: null,
    mistakes: 0,
    mistakesByCard: {},
    lastWrong: null,
    startedAt: null,
    finishedAt: chosen.length === 0 ? 0 : null,
  };
}

export function isMatchFinished(state: MatchState): boolean {
  return state.finishedAt !== null;
}

export function isTileMatched(state: MatchState, tile: MatchTile): boolean {
  return state.matched.includes(tile.cardId);
}

/** Taps a tile. Returns the same state for taps that mean nothing (finished game, paired tile). */
export function pickTile(state: MatchState, tileId: string, now: number): MatchState {
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile || isMatchFinished(state) || isTileMatched(state, tile)) return state;
  const startedAt = state.startedAt ?? now;
  const base: MatchState = { ...state, startedAt, lastWrong: null };

  if (state.selected === null) return { ...base, selected: tile.id };
  if (state.selected === tile.id) return { ...base, selected: null }; // tapped again: let go
  const first = state.tiles.find((t) => t.id === state.selected) as MatchTile;
  if (first.side === tile.side) return { ...base, selected: tile.id }; // two words: just change the pick

  if (first.cardId === tile.cardId) {
    const matched = [...state.matched, tile.cardId];
    const done = matched.length === state.tiles.length / 2;
    return { ...base, matched, selected: null, finishedAt: done ? now : null };
  }
  const bump = (counts: Record<string, number>, cardId: string) => ({
    ...counts,
    [cardId]: (counts[cardId] ?? 0) + 1,
  });
  return {
    ...base,
    mistakes: state.mistakes + 1,
    mistakesByCard: bump(bump({ ...state.mistakesByCard }, first.cardId), tile.cardId),
    lastWrong: [first.id, tile.id],
    selected: null,
  };
}

/** Milliseconds on the clock: 0 before the first tap, frozen after the last pair. */
export function elapsedMs(state: MatchState, now: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, (state.finishedAt ?? now) - state.startedAt);
}

/** 0..1 for the progress bar. */
export function matchProgress(state: MatchState): number {
  const pairs = state.tiles.length / 2;
  return pairs === 0 ? 1 : state.matched.length / pairs;
}

/** One log row per paired card: correct if it never took part in a wrong try, otherwise wrong. */
export function matchToLogs(state: MatchState, cards: readonly Card[], now: number): ReviewLog[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return state.matched.map((cardId) => ({
    at: now,
    cardId,
    deckId: (byId.get(cardId) as Card).deckId,
    direction: state.direction,
    mode: 'match',
    result: (state.mistakesByCard[cardId] ?? 0) === 0 ? 'correct' : 'wrong',
  }));
}
