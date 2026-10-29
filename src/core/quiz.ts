// Quiz (test) mode: a set of questions answered without feedback, graded at the end.
// A quiz does not change the review schedule; it only shows how well the words are known.
//
// Four kinds of questions, chosen by the user: multiple choice, typing, true/false and matching.
// Cards are dealt to the enabled kinds in turn; matching questions group several cards on one screen.
// Every card gives one graded item, so a matching question with 4 pairs counts as 4 items.

import { normalizeAnswer } from './answer';
import { buildExercise, judgeAnswer, sideTexts } from './learn';
import type { Question } from './learn';
import { shuffle } from './random';
import type { Rng } from './random';
import type { Card, CardSide, Direction, ReviewLog, ReviewResult } from './types';

export type QuizQuestionType = 'choice' | 'typing' | 'trueFalse' | 'matching';

/** In this order in the settings and when cards are dealt to the kinds. */
export const QUIZ_QUESTION_TYPES: readonly QuizQuestionType[] = [
  'choice',
  'typing',
  'trueFalse',
  'matching',
];

/** The number of pairs on one matching screen (more would not fit a phone). */
export const MATCHING_MAX_PAIRS = 5;
const MATCHING_MIN_PAIRS = 2;

export interface QuizConfig {
  /** How many words are tested; `'all'` = every word of the deck. */
  questionCount: number | 'all';
  /** The kinds of questions to use; empty means multiple choice only. */
  types: readonly QuizQuestionType[];
  choiceCount: number;
  ignoreDiacritics: boolean;
  /**
   * Test only these cards (a retake of the missed words). The other cards still serve as wrong
   * options, so a retake of two words has real choices.
   */
  restrictTo?: readonly string[];
}

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  questionCount: 20,
  types: QUIZ_QUESTION_TYPES,
  choiceCount: 4,
  ignoreDiacritics: true,
};

export interface ChoiceUnit {
  kind: 'choice';
  question: Question;
}

export interface TypingUnit {
  kind: 'typing';
  question: Question;
}

export type TextUnit = ChoiceUnit | TypingUnit;

/** "Is `prompt` = `shown`?" The statement is true when `shown` is the card's own answer. */
export interface TrueFalseUnit {
  kind: 'trueFalse';
  cardId: string;
  promptSide: CardSide;
  answerSide: CardSide;
  prompt: string;
  shown: string;
  isTrue: boolean;
  /** The card's own answer, shown after the quiz when the statement was false. */
  correct: string;
}

export interface MatchingPair {
  cardId: string;
  left: string;
  right: string;
}

/** Several cards at once: connect each left item with its right item. */
export interface MatchingUnit {
  kind: 'matching';
  promptSide: CardSide;
  answerSide: CardSide;
  pairs: MatchingPair[];
  /** The right-hand items in a shuffled order. */
  options: string[];
}

export type QuizUnit = ChoiceUnit | TypingUnit | TrueFalseUnit | MatchingUnit;

export interface Quiz {
  direction: Direction;
  config: QuizConfig;
  units: QuizUnit[];
}

/**
 * What the user answered to one unit: the text (choice, typing), true/false, or for matching the
 * chosen right-hand item per card id. `null` = skipped.
 */
export type QuizAnswer = string | boolean | null | Readonly<Record<string, string | null>>;

/** Points per answer: a typo ("almost") is worth half. */
export const POINTS: Record<ReviewResult, number> = { correct: 1, almost: 0.5, wrong: 0 };

function studyable(card: Card): boolean {
  return card.term.trim() !== '' && card.translations.some((t) => t.trim() !== '');
}

/** Enabled kinds in a fixed order, without duplicates; a quiz always has at least one kind. */
export function normalizeTypes(types: readonly QuizQuestionType[]): QuizQuestionType[] {
  const wanted = QUIZ_QUESTION_TYPES.filter((t) => types.includes(t));
  return wanted.length > 0 ? wanted : ['choice'];
}

export function createQuiz(
  cards: readonly Card[],
  direction: Direction,
  config: QuizConfig = DEFAULT_QUIZ_CONFIG,
  rng: Rng = Math.random,
): Quiz {
  const pool: Record<string, Card> = {};
  for (const card of cards) {
    if (studyable(card) && !pool[card.id]) pool[card.id] = card;
  }
  const limit = config.questionCount === 'all' ? Infinity : Math.max(0, config.questionCount);
  const only = config.restrictTo ? new Set(config.restrictTo) : null;
  const candidates = Object.keys(pool).filter((id) => only === null || only.has(id));
  const chosen = shuffle(candidates, rng).slice(0, limit);

  const types = normalizeTypes(config.types);
  const dealt: Record<QuizQuestionType, string[]> = {
    choice: [],
    typing: [],
    trueFalse: [],
    matching: [],
  };
  // Matching takes a block of cards (at least a pair), so it gets its fair share first; the other kinds
  // are dealt the remaining cards in turn.
  const others = types.filter((t) => t !== 'matching');
  let matchingShare = 0;
  if (types.includes('matching')) {
    matchingShare = others.length === 0 ? chosen.length : Math.round(chosen.length / types.length);
    if (matchingShare === 1 && chosen.length >= 2) matchingShare = 2;
  }
  dealt.matching = chosen.slice(0, matchingShare);
  chosen.slice(matchingShare).forEach((id, i) => {
    dealt[others[i % others.length] as QuizQuestionType].push(id);
  });

  // Matching needs groups of 2+ cards whose prompts and answers are all different; the rest of the
  // cards are asked in another enabled kind instead.
  const promptSide: CardSide = direction === 'forward' ? 'term' : 'translation';
  const answerSide: CardSide = promptSide === 'term' ? 'translation' : 'term';
  const { groups, leftover } = groupForMatching(
    dealt.matching,
    pool,
    promptSide,
    answerSide,
    config,
  );
  const fallback = types.find((t) => t !== 'matching') ?? 'choice';
  dealt[fallback].push(...leftover);

  const units: QuizUnit[] = [];
  for (const kind of ['choice', 'typing'] as const) {
    for (const id of dealt[kind]) {
      units.push({
        kind,
        question: buildExercise(pool, id, 0, { kind, prompt: 'term' }, direction, config, rng),
      });
    }
  }
  for (const id of dealt.trueFalse) {
    units.push(buildTrueFalse(pool, id, promptSide, answerSide, rng));
  }
  for (const group of groups) {
    const pairs = group.map((id) => {
      const card = pool[id] as Card;
      return {
        cardId: id,
        left: sideTexts(card, promptSide)[0] as string,
        right: sideTexts(card, answerSide)[0] as string,
      };
    });
    units.push({
      kind: 'matching',
      promptSide,
      answerSide,
      pairs,
      options: shuffle(
        pairs.map((p) => p.right),
        rng,
      ),
    });
  }
  return { direction, config, units: shuffle(units, rng) };
}

/** Splits cards into matching groups of at most MATCHING_MAX_PAIRS with no clashing texts. */
function groupForMatching(
  ids: readonly string[],
  pool: Readonly<Record<string, Card>>,
  promptSide: CardSide,
  answerSide: CardSide,
  config: Pick<QuizConfig, 'ignoreDiacritics'>,
): { groups: string[][]; leftover: string[] } {
  const opts = { ignoreDiacritics: config.ignoreDiacritics };
  const key = (id: string, side: CardSide) =>
    normalizeAnswer(sideTexts(pool[id] as Card, side)[0] as string, opts);
  const groups: string[][] = [];
  const leftover: string[] = [];
  // groups being filled; one that stays smaller than MATCHING_MIN_PAIRS is dissolved at the end
  const open: { ids: string[]; left: Set<string>; right: Set<string> }[] = [];
  for (const id of ids) {
    const l = key(id, promptSide);
    const r = key(id, answerSide);
    const group = open.find(
      (g) => g.ids.length < MATCHING_MAX_PAIRS && !g.left.has(l) && !g.right.has(r),
    );
    if (group) {
      group.ids.push(id);
      group.left.add(l);
      group.right.add(r);
    } else {
      open.push({ ids: [id], left: new Set([l]), right: new Set([r]) });
    }
  }
  for (const g of open) {
    if (g.ids.length >= MATCHING_MIN_PAIRS) groups.push(g.ids);
    else leftover.push(...g.ids);
  }
  return { groups, leftover };
}

function buildTrueFalse(
  pool: Readonly<Record<string, Card>>,
  cardId: string,
  promptSide: CardSide,
  answerSide: CardSide,
  rng: Rng,
): TrueFalseUnit {
  const card = pool[cardId] as Card;
  const prompt = sideTexts(card, promptSide)[0] as string;
  const correct = sideTexts(card, answerSide)[0] as string;
  const own = new Set(sideTexts(card, answerSide).map((t) => t.toLowerCase()));
  const others = shuffle(
    Object.values(pool).filter((c) => c.id !== cardId),
    rng,
  );
  const wrong = others
    .map((c) => sideTexts(c, answerSide)[0] as string)
    .find((text) => !own.has(text.toLowerCase()));
  const isTrue = wrong === undefined || rng() < 0.5;
  return {
    kind: 'trueFalse',
    cardId,
    promptSide,
    answerSide,
    prompt,
    shown: isTrue ? correct : (wrong as string),
    isTrue,
    correct,
  };
}

/** One graded word. A matching question gives one item per pair. */
export interface QuizItem {
  cardId: string;
  kind: QuizUnit['kind'];
  prompt: string;
  /** The right answer, to show after the quiz. */
  expected: string;
  /** True/false questions only: the statement that was shown ("prompt = shown"). */
  shown?: string;
  /** What the user answered; null = skipped / "I don't know". */
  answer: string | boolean | null;
  result: ReviewResult;
}

export type QuizGrade = 'excellent' | 'good' | 'fair' | 'keepGoing';

export interface QuizResult {
  items: QuizItem[];
  total: number;
  correct: number;
  almost: number;
  wrong: number;
  points: number;
  /** 0..100, rounded. */
  percent: number;
  grade: QuizGrade;
}

export function gradeFor(percent: number): QuizGrade {
  if (percent >= 90) return 'excellent';
  if (percent >= 70) return 'good';
  if (percent >= 50) return 'fair';
  return 'keepGoing';
}

/** Grades all answers. `answers[i]` belongs to `quiz.units[i]`; missing answers count as wrong. */
export function gradeQuiz(quiz: Quiz, answers: readonly (QuizAnswer | undefined)[]): QuizResult {
  const opts = { ignoreDiacritics: quiz.config.ignoreDiacritics };
  const items: QuizItem[] = [];
  quiz.units.forEach((unit, i) => {
    const answer = answers[i] ?? null;
    if (unit.kind === 'choice' || unit.kind === 'typing') {
      const text = typeof answer === 'string' ? answer : null;
      items.push({
        cardId: unit.question.cardId,
        kind: unit.kind,
        prompt: unit.question.prompt,
        expected: unit.question.acceptable[0] as string,
        answer: text,
        result: judgeAnswer(unit.question, text, opts),
      });
    } else if (unit.kind === 'trueFalse') {
      const said = typeof answer === 'boolean' ? answer : null;
      items.push({
        cardId: unit.cardId,
        kind: unit.kind,
        prompt: unit.prompt,
        expected: unit.correct,
        shown: unit.shown,
        answer: said,
        result: said !== null && said === unit.isTrue ? 'correct' : 'wrong',
      });
    } else {
      const picks = typeof answer === 'object' && answer !== null ? answer : {};
      for (const pair of unit.pairs) {
        const picked = picks[pair.cardId] ?? null;
        items.push({
          cardId: pair.cardId,
          kind: 'matching',
          prompt: pair.left,
          expected: pair.right,
          answer: picked,
          result: picked !== null && picked === pair.right ? 'correct' : 'wrong',
        });
      }
    }
  });
  const count = (r: ReviewResult) => items.filter((it) => it.result === r).length;
  const points = items.reduce((sum, it) => sum + POINTS[it.result], 0);
  const total = items.length;
  const percent = total === 0 ? 0 : Math.round((points / total) * 100);
  return {
    items,
    total,
    correct: count('correct'),
    almost: count('almost'),
    wrong: count('wrong'),
    points,
    percent,
    grade: gradeFor(percent),
  };
}

/** Cards that were not answered fully right, each once: the words for "retake only the mistakes". */
export function missedCardIds(result: QuizResult): string[] {
  const ids = result.items.filter((it) => it.result !== 'correct').map((it) => it.cardId);
  return [...new Set(ids)];
}

export function quizToLogs(
  quiz: Quiz,
  result: QuizResult,
  cards: Readonly<Record<string, Card>>,
  now: number,
): ReviewLog[] {
  return result.items.map((item) => ({
    at: now,
    cardId: item.cardId,
    deckId: (cards[item.cardId] as Card).deckId,
    direction: quiz.direction,
    mode: 'test',
    result: item.result,
  }));
}
