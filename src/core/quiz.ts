// Quiz (test) mode: a fixed set of questions answered without feedback, graded at the end.
// A quiz does not change the review schedule; it only shows how well the deck is known.

import { buildExercise, judgeAnswer } from './learn';
import type { Question } from './learn';
import { shuffle } from './random';
import type { Rng } from './random';
import type { Card, Direction, ReviewLog, ReviewResult } from './types';

export interface QuizConfig {
  /** Most questions in one quiz. */
  questionCount: number;
  choiceCount: number;
  ignoreDiacritics: boolean;
  /**
   * Every n-th question must be typed instead of chosen (with 3: questions 3, 6, 9...).
   * Mixing the two keeps the quiz from being only recognition.
   */
  typingEvery: number;
}

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  questionCount: 20,
  choiceCount: 4,
  ignoreDiacritics: true,
  typingEvery: 3,
};

export interface Quiz {
  direction: Direction;
  config: QuizConfig;
  questions: Question[];
}

/** Points per answer: a typo ("almost") is worth half. */
export const POINTS: Record<ReviewResult, number> = { correct: 1, almost: 0.5, wrong: 0 };

export function createQuiz(
  cards: readonly Card[],
  direction: Direction,
  config: QuizConfig = DEFAULT_QUIZ_CONFIG,
  rng: Rng = Math.random,
): Quiz {
  const pool: Record<string, Card> = {};
  for (const card of cards) {
    const studyable = card.term.trim() !== '' && card.translations.some((t) => t.trim() !== '');
    if (studyable && !pool[card.id]) pool[card.id] = card;
  }
  const chosen = shuffle(Object.keys(pool), rng).slice(0, Math.max(0, config.questionCount));
  const typingEvery = Math.max(0, config.typingEvery);
  const questions = chosen.map((cardId, i) => {
    const typing = typingEvery > 0 && (i + 1) % typingEvery === 0;
    return buildExercise(
      pool,
      cardId,
      0,
      { kind: typing ? 'typing' : 'choice', prompt: 'term' },
      direction,
      config,
      rng,
    );
  });
  return { direction, config, questions };
}

export interface QuizItem {
  question: Question;
  /** What the user answered; null = skipped / "I don't know". */
  answer: string | null;
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

/** Grades all answers. `answers[i]` belongs to `quiz.questions[i]`; missing answers count as wrong. */
export function gradeQuiz(quiz: Quiz, answers: readonly (string | null | undefined)[]): QuizResult {
  const opts = { ignoreDiacritics: quiz.config.ignoreDiacritics };
  const items = quiz.questions.map((question, i) => {
    const answer = answers[i] ?? null;
    return { question, answer, result: judgeAnswer(question, answer, opts) };
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

export function quizToLogs(
  quiz: Quiz,
  result: QuizResult,
  cards: Readonly<Record<string, Card>>,
  now: number,
): ReviewLog[] {
  return result.items.map((item) => ({
    at: now,
    cardId: item.question.cardId,
    deckId: (cards[item.question.cardId] as Card).deckId,
    direction: quiz.direction,
    mode: 'test',
    result: item.result,
  }));
}
