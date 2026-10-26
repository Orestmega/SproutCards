// Flashcard mode: look at the front, flip, say whether you knew it. One pass, each card once.
// "Knew it" counts as a correct review, "didn't know" as a wrong one, and both are scheduled at once.

import type { Scheduler } from './scheduler';
import type { Card, Direction, Progress, ReviewLog } from './types';
import { progressId } from './types';

export interface FlipResult {
  cardId: string;
  known: boolean;
  at: number;
}

export interface FlipState {
  direction: Direction;
  /** Studyable cards in the order they are shown. */
  cards: readonly Card[];
  results: readonly FlipResult[];
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
  return { direction, cards: studyable, results: [] };
}

export function currentFlipCard(state: FlipState): Card | null {
  return state.cards[state.results.length] ?? null;
}

export function isFlipFinished(state: FlipState): boolean {
  return state.results.length >= state.cards.length;
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
  if (!card) throw new Error('No active card: the session is finished');
  return { ...state, results: [...state.results, { cardId: card.id, known, at: now }] };
}

/** 0..1 for the progress bar. */
export function flipProgress(state: FlipState): number {
  return state.cards.length === 0 ? 1 : state.results.length / state.cards.length;
}

export interface FlipSummary {
  total: number;
  answered: number;
  known: number;
  unknown: number;
  unknownCardIds: string[];
}

export function summarizeFlip(state: FlipState): FlipSummary {
  const unknown = state.results.filter((r) => !r.known);
  return {
    total: state.cards.length,
    answered: state.results.length,
    known: state.results.length - unknown.length,
    unknown: unknown.length,
    unknownCardIds: unknown.map((r) => r.cardId),
  };
}

/** Progress records for every card answered so far (an interrupted session keeps what was done). */
export function flipToProgress(
  state: FlipState,
  existing: readonly Progress[],
  scheduler: Scheduler,
): Progress[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const cards = new Map(state.cards.map((c) => [c.id, c]));
  return state.results.map((r) => {
    const id = progressId(r.cardId, state.direction);
    const previous = byId.get(id);
    return {
      ...scheduler.review(previous, r.known ? 'correct' : 'wrong', r.at),
      id,
      cardId: r.cardId,
      deckId: (cards.get(r.cardId) as Card).deckId,
      direction: state.direction,
      lastReviewedAt: r.at,
      firstSeenAt: previous?.firstSeenAt ?? r.at,
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
