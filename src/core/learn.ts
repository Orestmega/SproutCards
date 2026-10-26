// Learn engine: a pure state machine. No React, no browser, no clock, no hidden randomness.
//
// How a session works (see PLAN.md, "Алгоритм навчання"):
//  - every card has a level; each level is an exercise: 0 = choose the translation, 1 = type the
//    translation, 2 = type the word from its translation (configurable in `LearnConfig.levels`);
//  - a correct answer raises the level, a wrong one lowers it (not below 0) and brings the card back
//    a few positions later; the card passes the session after a correct answer on the last level;
//  - `almost` (a small typo) keeps the level and brings the card back, but is not a mistake;
//  - the `Direction` of the session swaps the sides: with `backward` the translation is always the
//    prompt where `forward` would show the term, and vice versa.

import { checkAnswer, normalizeAnswer } from './answer';
import type { AnswerOptions } from './answer';
import { randomInt, shuffle } from './random';
import type { Rng } from './random';
import type { Scheduler } from './scheduler';
import type { Card, CardSide, Direction, Progress, ReviewLog, ReviewResult } from './types';
import { progressId } from './types';

export type ExerciseKind = 'choice' | 'typing';

export interface LevelSpec {
  kind: ExerciseKind;
  /** Which side is shown as the prompt when the session direction is `forward`. */
  prompt: CardSide;
}

export interface LearnConfig {
  levels: readonly LevelSpec[];
  /** Total number of options in a choice question (the correct one plus distractors). */
  choiceCount: number;
  /** A card answered wrongly comes back after a random number of cards in this range. */
  requeueGap: { min: number; max: number };
  /** Accents are ignored when checking typed answers. */
  ignoreDiacritics: boolean;
}

export const DEFAULT_LEARN_CONFIG: LearnConfig = {
  levels: [
    { kind: 'choice', prompt: 'term' },
    { kind: 'typing', prompt: 'term' },
    { kind: 'typing', prompt: 'translation' },
  ],
  choiceCount: 4,
  requeueGap: { min: 3, max: 5 },
  ignoreDiacritics: true,
};

export interface Question {
  cardId: string;
  level: number;
  /** `typing` also when a choice level cannot be built (not enough other cards for distractors). */
  kind: ExerciseKind;
  promptSide: CardSide;
  answerSide: CardSide;
  prompt: string;
  /** Shuffled options for `choice`, empty for `typing`. */
  options: string[];
  /** Every answer that counts as correct. The first one is the card's own and is shown on a miss. */
  acceptable: string[];
}

interface ItemState {
  level: number;
  /** Wrong answers in this session (typos marked `almost` do not count). */
  mistakes: number;
  passed: boolean;
}

export interface LearnEvent {
  cardId: string;
  level: number;
  kind: ExerciseKind;
  result: ReviewResult;
  at: number;
}

export interface LearnState {
  direction: Direction;
  config: LearnConfig;
  cards: Readonly<Record<string, Card>>;
  items: Readonly<Record<string, ItemState>>;
  /** Card ids still to be asked; the first one is the current question. */
  queue: readonly string[];
  current: Question | null;
  events: readonly LearnEvent[];
  /** Cards that cannot be studied (empty term or no translation). */
  skipped: readonly string[];
}

export interface Feedback {
  cardId: string;
  result: ReviewResult;
  /** The card's own answer, to show after `almost` and `wrong`. */
  expected: string;
  acceptable: readonly string[];
  /** The card passed the session with this answer. */
  passed: boolean;
}

function isStudyable(card: Card): boolean {
  return card.term.trim() !== '' && card.translations.some((t) => t.trim() !== '');
}

function sideTexts(card: Card, side: CardSide): string[] {
  const texts = side === 'term' ? [card.term] : card.translations;
  return texts.map((t) => t.trim()).filter((t) => t !== '');
}

function flip(side: CardSide): CardSide {
  return side === 'term' ? 'translation' : 'term';
}

function lastLevel(config: LearnConfig): number {
  return config.levels.length - 1;
}

function answerOptions(config: Pick<LearnConfig, 'ignoreDiacritics'>): AnswerOptions {
  return { ignoreDiacritics: config.ignoreDiacritics };
}

/** The part of the configuration that decides how a single question is built. */
export type ExerciseConfig = Pick<LearnConfig, 'choiceCount' | 'ignoreDiacritics'>;

/**
 * Builds one question for a card. Shared by Learn (one question per level) and the quiz.
 * @param cards every card that may serve as a distractor or as a duplicate with the same prompt
 */
export function buildExercise(
  cards: Readonly<Record<string, Card>>,
  cardId: string,
  level: number,
  spec: LevelSpec,
  direction: Direction,
  config: ExerciseConfig,
  rng: Rng,
): Question {
  const card = cards[cardId] as Card;
  const promptSide = direction === 'forward' ? spec.prompt : flip(spec.prompt);
  const answerSide = flip(promptSide);
  const prompt = sideTexts(card, promptSide)[0] as string;
  const opts = answerOptions(config);
  const promptKey = normalizeAnswer(prompt, opts);

  // The card's own answers first, then the answers of other cards with an identical prompt
  // (duplicates such as two cards for "bank"): otherwise a right answer could be marked wrong.
  const acceptable: string[] = [...sideTexts(card, answerSide)];
  for (const other of Object.values(cards)) {
    if (other.id === cardId) continue;
    const samePrompt = sideTexts(other, promptSide).some(
      (t) => normalizeAnswer(t, opts) === promptKey,
    );
    if (samePrompt) acceptable.push(...sideTexts(other, answerSide));
  }
  const acceptableKeys = new Set(acceptable.map((a) => normalizeAnswer(a, opts)));

  let kind: ExerciseKind = spec.kind;
  let options: string[] = [];
  if (kind === 'choice') {
    const seen = new Set<string>();
    const pool: string[] = [];
    for (const other of Object.values(cards)) {
      if (other.id === cardId) continue;
      const text = sideTexts(other, answerSide)[0];
      if (text === undefined) continue;
      const key = normalizeAnswer(text, opts);
      if (acceptableKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      pool.push(text);
    }
    const distractors = shuffle(pool, rng).slice(0, Math.max(1, config.choiceCount - 1));
    if (distractors.length === 0) {
      kind = 'typing'; // a one-option "choice" would be meaningless
    } else {
      options = shuffle([acceptable[0] as string, ...distractors], rng);
    }
  }

  return { cardId, level, kind, promptSide, answerSide, prompt, options, acceptable };
}

function buildQuestion(
  cards: Readonly<Record<string, Card>>,
  cardId: string,
  level: number,
  direction: Direction,
  config: LearnConfig,
  rng: Rng,
): Question {
  const spec = config.levels[Math.min(level, lastLevel(config))] as LevelSpec;
  return buildExercise(cards, cardId, level, spec, direction, config, rng);
}

/**
 * Starts a session. Cards that cannot be studied are skipped; duplicates by id are ignored.
 * The order of `cards` is the order of the first questions (shuffle beforehand if wanted).
 */
export function startSession(
  cards: readonly Card[],
  direction: Direction,
  config: LearnConfig = DEFAULT_LEARN_CONFIG,
  rng: Rng = Math.random,
): LearnState {
  if (config.levels.length === 0) throw new Error('LearnConfig.levels must not be empty');
  const byId: Record<string, Card> = {};
  const items: Record<string, ItemState> = {};
  const queue: string[] = [];
  const skipped: string[] = [];
  for (const card of cards) {
    if (byId[card.id]) continue;
    if (!isStudyable(card)) {
      skipped.push(card.id);
      continue;
    }
    byId[card.id] = card;
    items[card.id] = { level: 0, mistakes: 0, passed: false };
    queue.push(card.id);
  }
  const first = queue[0];
  return {
    direction,
    config,
    cards: byId,
    items,
    queue,
    current: first === undefined ? null : buildQuestion(byId, first, 0, direction, config, rng),
    events: [],
    skipped,
  };
}

export function isFinished(state: LearnState): boolean {
  return state.current === null;
}

/**
 * Decides whether an answer is correct. `null` or blank means "I don't know" and is wrong.
 * A choice must be exactly right (no typo tolerance); typed answers can be `almost`.
 */
export function judgeAnswer(
  question: Question,
  input: string | null,
  options: AnswerOptions,
): ReviewResult {
  if (input === null || input.trim() === '') return 'wrong';
  if (question.kind === 'choice') {
    const key = normalizeAnswer(input, options);
    return question.acceptable.some((a) => normalizeAnswer(a, options) === key)
      ? 'correct'
      : 'wrong';
  }
  return checkAnswer(input, question.acceptable, options).verdict;
}

/**
 * Submits an answer to the current question.
 * @param input the typed text or the chosen option; `null` means "I don't know" (counts as wrong)
 */
export function submitAnswer(
  state: LearnState,
  input: string | null,
  now: number,
  rng: Rng = Math.random,
): { state: LearnState; feedback: Feedback } {
  const question = state.current;
  if (!question) throw new Error('No active question: the session is finished');
  const { config } = state;
  const opts = answerOptions(config);

  const result = judgeAnswer(question, input, opts);

  const item = state.items[question.cardId] as ItemState;
  const last = lastLevel(config);
  let nextItem: ItemState = item;
  let passed = false;
  if (result === 'correct') {
    passed = question.level >= last;
    nextItem = { ...item, level: passed ? last + 1 : question.level + 1, passed };
  } else if (result === 'wrong') {
    nextItem = { ...item, level: Math.max(0, question.level - 1), mistakes: item.mistakes + 1 };
  } // 'almost': level and mistakes stay as they are

  const rest = state.queue.slice(1);
  let queue: string[];
  if (passed) {
    queue = rest;
  } else {
    // Correct answers go to the back (the whole round is seen first); misses come back soon.
    const at =
      result === 'correct'
        ? rest.length
        : Math.min(randomInt(config.requeueGap.min, config.requeueGap.max, rng), rest.length);
    queue = [...rest.slice(0, at), question.cardId, ...rest.slice(at)];
  }

  const items = { ...state.items, [question.cardId]: nextItem };
  const nextId = queue[0];
  const current =
    nextId === undefined
      ? null
      : buildQuestion(
          state.cards,
          nextId,
          (items[nextId] as ItemState).level,
          state.direction,
          config,
          rng,
        );

  return {
    state: {
      ...state,
      items,
      queue,
      current,
      events: [
        ...state.events,
        { cardId: question.cardId, level: question.level, kind: question.kind, result, at: now },
      ],
    },
    feedback: {
      cardId: question.cardId,
      result,
      expected: question.acceptable[0] as string,
      acceptable: question.acceptable,
      passed,
    },
  };
}

/** Share of the work done, 0..1, for the progress bar (a passed card counts as all its levels). */
export function progressFraction(state: LearnState): number {
  const ids = Object.keys(state.items);
  if (ids.length === 0) return 1;
  const levels = state.config.levels.length;
  const done = ids.reduce(
    (sum, id) => sum + Math.min((state.items[id] as ItemState).level, levels),
    0,
  );
  return done / (ids.length * levels);
}

export interface CardOutcome {
  cardId: string;
  mistakes: number;
  passed: boolean;
}

export interface SessionSummary {
  totalCards: number;
  passedCards: number;
  answers: number;
  correct: number;
  almost: number;
  wrong: number;
  /** correct / answers, 0 when nothing was answered. */
  accuracy: number;
  outcomes: CardOutcome[];
}

export function summarize(state: LearnState): SessionSummary {
  const count = (r: ReviewResult) => state.events.filter((e) => e.result === r).length;
  const outcomes = Object.entries(state.items).map(([cardId, item]) => ({
    cardId,
    mistakes: item.mistakes,
    passed: item.passed,
  }));
  const answers = state.events.length;
  const correct = count('correct');
  return {
    totalCards: outcomes.length,
    passedCards: outcomes.filter((o) => o.passed).length,
    answers,
    correct,
    almost: count('almost'),
    wrong: count('wrong'),
    accuracy: answers === 0 ? 0 : correct / answers,
    outcomes,
  };
}

/**
 * Turns a finished (or interrupted) session into updated progress records.
 * Only cards that passed the session are scheduled. A card with at least one mistake in the session
 * is scheduled as `wrong` (interval resets to the first one), otherwise as `correct`.
 * @param existing current progress records (any direction; only the session's direction is used)
 */
export function applySessionToProgress(
  state: LearnState,
  existing: readonly Progress[],
  scheduler: Scheduler,
  now: number,
): Progress[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const updated: Progress[] = [];
  for (const [cardId, item] of Object.entries(state.items)) {
    if (!item.passed) continue;
    const id = progressId(cardId, state.direction);
    const previous = byId.get(id);
    const schedule = scheduler.review(previous, item.mistakes > 0 ? 'wrong' : 'correct', now);
    const card = state.cards[cardId] as Card;
    updated.push({
      ...schedule,
      id,
      cardId,
      deckId: card.deckId,
      direction: state.direction,
      lastReviewedAt: now,
      firstSeenAt: previous?.firstSeenAt ?? now,
    });
  }
  return updated;
}

/** Review-log rows for every answer given in the session (stored for statistics). */
export function sessionToLogs(state: LearnState): ReviewLog[] {
  return state.events.map((e) => ({
    at: e.at,
    cardId: e.cardId,
    deckId: (state.cards[e.cardId] as Card).deckId,
    direction: state.direction,
    mode: 'learn',
    level: e.level,
    result: e.result,
  }));
}
