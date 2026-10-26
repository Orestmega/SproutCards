import { createQuiz, DEFAULT_QUIZ_CONFIG, gradeFor, gradeQuiz, quizToLogs } from './quiz';
import { seededRng } from './random';
import { makeCard, sampleCards } from './testUtils';
import type { Card } from './types';

const rng = () => seededRng(3);

function answerAll(quiz: ReturnType<typeof createQuiz>, make: (i: number) => string | null) {
  return quiz.questions.map((_, i) => make(i));
}

describe('createQuiz', () => {
  it('asks about each card once, up to the question limit', () => {
    const quiz = createQuiz(sampleCards(), 'forward', DEFAULT_QUIZ_CONFIG, rng());
    expect(quiz.questions).toHaveLength(5);
    expect(new Set(quiz.questions.map((q) => q.cardId)).size).toBe(5);
    const capped = createQuiz(
      sampleCards(),
      'forward',
      { ...DEFAULT_QUIZ_CONFIG, questionCount: 3 },
      rng(),
    );
    expect(capped.questions).toHaveLength(3);
  });

  it('mixes choice and typing: every third question is typed', () => {
    const quiz = createQuiz(sampleCards(), 'forward', DEFAULT_QUIZ_CONFIG, rng());
    expect(quiz.questions.map((q) => q.kind)).toEqual([
      'choice',
      'choice',
      'typing',
      'choice',
      'choice',
    ]);
  });

  it('can be all multiple choice', () => {
    const quiz = createQuiz(
      sampleCards(),
      'forward',
      { ...DEFAULT_QUIZ_CONFIG, typingEvery: 0 },
      rng(),
    );
    expect(quiz.questions.every((q) => q.kind === 'choice')).toBe(true);
  });

  it('uses the other cards of the deck as distractors even when only some are asked', () => {
    const quiz = createQuiz(
      sampleCards(),
      'forward',
      { ...DEFAULT_QUIZ_CONFIG, questionCount: 1 },
      rng(),
    );
    expect(quiz.questions[0]?.options).toHaveLength(4);
  });

  it('a deck of one card still works (typing instead of a one-option choice)', () => {
    const quiz = createQuiz([makeCard('a', 'б')], 'forward', DEFAULT_QUIZ_CONFIG, rng());
    expect(quiz.questions).toHaveLength(1);
    expect(quiz.questions[0]?.kind).toBe('typing');
  });

  it('an empty deck gives an empty quiz that grades to 0', () => {
    const quiz = createQuiz([], 'forward', DEFAULT_QUIZ_CONFIG, rng());
    expect(quiz.questions).toEqual([]);
    expect(gradeQuiz(quiz, [])).toMatchObject({ total: 0, percent: 0, grade: 'keepGoing' });
  });

  it('backward quizzes prompt with the translation', () => {
    const quiz = createQuiz(sampleCards(), 'backward', DEFAULT_QUIZ_CONFIG, rng());
    expect(quiz.questions.every((q) => q.promptSide === 'translation')).toBe(true);
  });
});

describe('gradeQuiz', () => {
  const quiz = () => createQuiz(sampleCards(), 'forward', DEFAULT_QUIZ_CONFIG, rng());

  it('gives 100% for all right answers', () => {
    const q = quiz();
    const r = gradeQuiz(
      q,
      answerAll(q, (i) => q.questions[i]!.acceptable[0]!),
    );
    expect(r).toMatchObject({ total: 5, correct: 5, wrong: 0, percent: 100, grade: 'excellent' });
  });

  it('gives 0% for skipped or missing answers', () => {
    const q = quiz();
    expect(gradeQuiz(q, []).percent).toBe(0);
    expect(
      gradeQuiz(
        q,
        answerAll(q, () => null),
      ),
    ).toMatchObject({ wrong: 5, percent: 0 });
  });

  it('counts a typo as half a point', () => {
    const cards: Card[] = [makeCard('apple', 'яблуко', { id: 'a' })];
    const q = createQuiz(cards, 'forward', DEFAULT_QUIZ_CONFIG, rng());
    const r = gradeQuiz(q, ['яблукоx']);
    expect(r).toMatchObject({ almost: 1, points: 0.5, percent: 50, grade: 'fair' });
  });

  it('a wrong choice is wrong even if close', () => {
    const q = quiz();
    const choice = q.questions[0]!;
    const wrong = choice.options.find((o) => o !== choice.acceptable[0])!;
    expect(gradeQuiz(q, [wrong]).items[0]?.result).toBe('wrong');
  });

  it('answers belong to questions by position', () => {
    const q = quiz();
    const answers = answerAll(q, (i) => (i === 1 ? q.questions[1]!.acceptable[0]! : null));
    const r = gradeQuiz(q, answers);
    expect(r.items.map((i) => i.result)).toEqual(['wrong', 'correct', 'wrong', 'wrong', 'wrong']);
    expect(r.percent).toBe(20);
  });

  it('writes one log row per question', () => {
    const q = quiz();
    const r = gradeQuiz(q, []);
    const byId = Object.fromEntries(sampleCards().map((c) => [c.id, c]));
    const logs = quizToLogs(q, r, byId, 99);
    expect(logs).toHaveLength(5);
    expect(logs[0]).toMatchObject({ mode: 'test', at: 99, result: 'wrong', deckId: 'd1' });
  });
});

describe('gradeFor', () => {
  it('has clear thresholds', () => {
    expect([100, 90, 89, 70, 69, 50, 49, 0].map(gradeFor)).toEqual([
      'excellent',
      'excellent',
      'good',
      'good',
      'fair',
      'fair',
      'keepGoing',
      'keepGoing',
    ]);
  });
});
