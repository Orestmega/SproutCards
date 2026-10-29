// Flashcard mode: look at the front, flip, say whether you knew it.
//
// Rounds: every card is shown once per round. At the end of a round the cards marked "don't know" form
// the next round, and so on until no card is left. Each card is scheduled once, with the result of the
// whole session: a card that was ever marked "don't know" counts as a mistake (wrong), otherwise correct.

import { shuffle } from './random';
import type { Rng } from './random';
import type { Scheduler } from './scheduler';
import type { Card, Direction, Progress, ReviewLog } from './types';
import { progressId } from './types';

export interface FlipResult {
  cardId: string;
  known: boolean;
  at: number;
  /** 1 for the first pass over the cards, 2 for the repeat of the missed ones, and so on. */
  round: number;
}

/** `card`: a card is waiting; `roundEnd`: a round is over and missed cards remain; `done`: nothing left. */
export type FlipPhase = 'card' | 'roundEnd' | 'done';

export interface FlipState {
  direction: Direction;
  /** Studyable cards of the whole session. */
  cards: readonly Card[];
  /** Every answer given so far, in order, across all rounds. */
  results: readonly FlipResult[];
  round: number;
  /** The cards of the current round, in the order they are shown. */
  order: readonly string[];
  /** Index of the current card in `order`. */
  position: number;
  /** Cards marked "don't know" in the current round; they make up the next round. */
  missed: readonly string[];
  phase: FlipPhase;
}

export interface FlipFace {
  front: string;
  /** Everything shown after flipping: all translations (or the term), then examples are up to the UI. */
  back: string[];
}

function isStudyable(card: Card): boolean {
  return card.term.trim() !== '' && card.translations.some((t) => t.trim() !== '');
}

export function startFlip(cards: readonly Card[], direction: Direction): FlipState {
  const seen = new Set<string>();
  const studyable = cards.filter((c) => {
    if (seen.has(c.id) || !isStudyable(c)) return false;
    seen.add(c.id);
    return true;
  });
  return {
    direction,
    cards: studyable,
    results: [],
    round: 1,
    order: studyable.map((c) => c.id),
    position: 0,
    missed: [],
    phase: studyable.length === 0 ? 'done' : 'card',
  };
}

export function currentFlipCard(state: FlipState): Card | null {
  if (state.phase !== 'card') return null;
  const id = state.order[state.position];
  return state.cards.find((c) => c.id === id) ?? null;
}

export function isFlipFinished(state: FlipState): boolean {
  return state.phase === 'done';
}

/** What the front and back of a card show in a direction. */
export function flipFace(card: Card, direction: Direction): FlipFace {
  const translations = card.translations.map((t) => t.trim()).filter((t) => t !== '');
  return direction === 'forward'
    ? { front: card.term, back: translations }
    : { front: translations[0] as string, back: [card.term] };
}

export function answerFlip(state: FlipState, known: boolean, now: number): FlipState {
  const card = currentFlipCard(state);
  if (!card) throw new Error('No active card: the round is over or the session is finished');
  const missed = known ? state.missed : [...state.missed, card.id];
  const position = state.position + 1;
  const roundOver = position >= state.order.length;
  return {
    ...state,
    results: [...state.results, { cardId: card.id, known, at: now, round: state.round }],
    missed,
    position,
    phase: !roundOver ? 'card' : missed.length > 0 ? 'roundEnd' : 'done',
  };
}

/** Starts the next round with the cards that were marked "don't know", in a new order. */
export function continueFlip(state: FlipState, rng: Rng = Math.random): FlipState {
  if (state.phase !== 'roundEnd') return state;
  return {
    ...state,
    round: state.round + 1,
    order: shuffle(state.missed, rng),
    position: 0,
    missed: [],
    phase: 'card',
  };
}

/** Cards whose latest answer is "know it". */
function knownIds(state: FlipState): Set<string> {
  const latest = new Map<string, boolean>();
  for (const r of state.results) latest.set(r.cardId, r.known);
  return new Set([...latest].filter(([, known]) => known).map(([id]) => id));
}

/** 0..1 for the progress bar: the share of cards that are known right now. */
export function flipProgress(state: FlipState): number {
  if (state.cards.length === 0) return 1;
  return knownIds(state).size / state.cards.length;
}

export interface FlipSummary {
  total: number;
  /** Cards whose latest answer is "know it". */
  known: number;
  /** Cards not known yet: marked "don't know" last, or not reached. */
  stillLearning: number;
  rounds: number;
  /** Cards that were marked "don't know" at least once, in the order of the deck. */
  struggledCardIds: string[];
}

export function summarizeFlip(state: FlipState): FlipSummary {
  const known = knownIds(state).size;
  const struggled = new Set(state.results.filter((r) => !r.known).map((r) => r.cardId));
  return {
    total: state.cards.length,
    known,
    stillLearning: state.cards.length - known,
    rounds: state.round,
    struggledCardIds: state.cards.filter((c) => struggled.has(c.id)).map((c) => c.id),
  };
}

/**
 * One progress record per card answered so far (an interrupted session keeps what was done).
 * A card ever marked "don't know" counts as a mistake, like in Learn; otherwise as correct.
 */
export function flipToProgress(
  state: FlipState,
  existing: readonly Progress[],
  scheduler: Scheduler,
): Progress[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const cards = new Map(state.cards.map((c) => [c.id, c]));
  const perCard = new Map<string, { mistake: boolean; at: number }>();
  for (const r of state.results) {
    const entry = perCard.get(r.cardId) ?? { mistake: false, at: r.at };
    perCard.set(r.cardId, { mistake: entry.mistake || !r.known, at: r.at });
  }
  return [...perCard].map(([cardId, { mistake, at }]) => {
    const id = progressId(cardId, state.direction);
    const previous = byId.get(id);
    return {
      ...scheduler.review(previous, mistake ? 'wrong' : 'correct', at),
      id,
      cardId,
      deckId: (cards.get(cardId) as Card).deckId,
      direction: state.direction,
      lastReviewedAt: at,
      firstSeenAt: previous?.firstSeenAt ?? at,
    };
  });
}

export function flipToLogs(state: FlipState): ReviewLog[] {
  const cards = new Map(state.cards.map((c) => [c.id, c]));
  return state.results.map((r) => ({
    at: r.at,
    cardId: r.cardId,
    deckId: (cards.get(r.cardId) as Card).deckId,
    direction: state.direction,
    mode: 'flip',
    result: r.known ? 'correct' : 'wrong',
  }));
}
