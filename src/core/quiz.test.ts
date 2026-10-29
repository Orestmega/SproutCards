import {
  createQuiz,
  DEFAULT_QUIZ_CONFIG,
  gradeFor,
  gradeQuiz,
  MATCHING_MAX_PAIRS,
  missedCardIds,
  normalizeTypes,
  quizToLogs,
} from './quiz';
import type { Quiz, QuizAnswer, QuizConfig, QuizQuestionType } from './quiz';
import { seededRng } from './random';
import { makeCard, sampleCards } from './testUtils';
import type { Card } from './types';

const rng = () => seededRng(3);
const only = (...types: QuizQuestionType[]): QuizConfig => ({ ...DEFAULT_QUIZ_CONFIG, types });
const manyCards = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => makeCard(`word${i}`, `слово${i}`, { id: `c${i}` }));

/** The right answer for a unit of any kind. */
function rightAnswer(quiz: Quiz, i: number): QuizAnswer {
  const unit = quiz.units[i]!;
  if (unit.kind === 'choice' || unit.kind === 'typing') return unit.question.acceptable[0]!;
  if (unit.kind === 'trueFalse') return unit.isTrue;
  return Object.fromEntries(unit.pairs.map((p) => [p.cardId, p.right]));
}
const allRight = (quiz: Quiz) => quiz.units.map((_, i) => rightAnswer(quiz, i));

describe('createQuiz', () => {
  it('asks about each card once, up to the question limit', () => {
    const quiz = createQuiz(sampleCards(), 'forward', only('choice'), rng());
    expect(quiz.units).toHaveLength(5);
    const capped = createQuiz(
      sampleCards(),
      'forward',
      { ...only('choice'), questionCount: 3 },
      rng(),
    );
    expect(capped.units).toHaveLength(3);
  });

  it('"all" tests every card of a big deck', () => {
    const quiz = createQuiz(
      manyCards(30),
      'forward',
      { ...only('choice'), questionCount: 'all' },
      rng(),
    );
    expect(quiz.units).toHaveLength(30);
    expect(gradeQuiz(quiz, []).total).toBe(30);
  });

  it('uses only the enabled kinds of questions', () => {
    for (const kind of ['choice', 'typing', 'trueFalse'] as const) {
      const quiz = createQuiz(sampleCards(), 'forward', only(kind), rng());
      expect(quiz.units.every((u) => u.kind === kind)).toBe(true);
    }
    const matching = createQuiz(sampleCards(), 'forward', only('matching'), rng());
    expect(matching.units.every((u) => u.kind === 'matching')).toBe(true);
  });

  it('deals the cards to several kinds in turn', () => {
    const quiz = createQuiz(manyCards(12), 'forward', only('choice', 'typing'), rng());
    const kinds = quiz.units.map((u) => u.kind);
    expect(kinds.filter((k) => k === 'choice')).toHaveLength(6);
    expect(kinds.filter((k) => k === 'typing')).toHaveLength(6);
  });

  it('with all kinds on, matching gets a block of cards even in a small deck', () => {
    const quiz = createQuiz(
      manyCards(6),
      'forward',
      { ...DEFAULT_QUIZ_CONFIG, questionCount: 'all' },
      rng(),
    );
    const kinds = quiz.units.map((u) => u.kind);
    expect(kinds).toContain('matching');
    expect(kinds).toContain('choice');
    expect(gradeQuiz(quiz, []).total).toBe(6);
  });

  it('with no kind chosen it falls back to multiple choice', () => {
    expect(normalizeTypes([])).toEqual(['choice']);
    const quiz = createQuiz(sampleCards(), 'forward', only(), rng());
    expect(quiz.units.every((u) => u.kind === 'choice')).toBe(true);
  });

  it('uses the other cards of the deck as distractors even when only some are asked', () => {
    const quiz = createQuiz(
      sampleCards(),
      'forward',
      { ...only('choice'), questionCount: 1 },
      rng(),
    );
    const unit = quiz.units[0]!;
    expect(unit.kind === 'choice' && unit.question.options).toHaveLength(4);
  });

  it('a deck of one card still works (typing instead of a one-option choice)', () => {
    const quiz = createQuiz([makeCard('a', 'б')], 'forward', only('choice'), rng());
    expect(quiz.units).toHaveLength(1);
    expect(quiz.units[0]?.kind).toBe('choice');
    const unit = quiz.units[0]!;
    expect(unit.kind === 'choice' && unit.question.kind).toBe('typing');
  });

  it('an empty deck gives an empty quiz that grades to 0', () => {
    const quiz = createQuiz([], 'forward', DEFAULT_QUIZ_CONFIG, rng());
    expect(quiz.units).toEqual([]);
    expect(gradeQuiz(quiz, [])).toMatchObject({ total: 0, percent: 0, grade: 'keepGoing' });
  });

  it('backward quizzes prompt with the translation', () => {
    const quiz = createQuiz(
      sampleCards(),
      'backward',
      only('choice', 'trueFalse', 'matching'),
      rng(),
    );
    for (const unit of quiz.units) {
      if (unit.kind === 'choice' || unit.kind === 'typing') {
        expect(unit.question.promptSide).toBe('translation');
      } else expect(unit.promptSide).toBe('translation');
    }
  });
});

describe('true/false questions', () => {
  it('show a true or a false pairing, never a false one that is actually right', () => {
    const quiz = createQuiz(
      manyCards(30),
      'forward',
      { ...only('trueFalse'), questionCount: 'all' },
      seededRng(5),
    );
    const units = quiz.units.flatMap((u) => (u.kind === 'trueFalse' ? [u] : []));
    expect(units.some((u) => u.isTrue)).toBe(true);
    expect(units.some((u) => !u.isTrue)).toBe(true);
    for (const u of units) {
      if (u.isTrue) expect(u.shown).toBe(u.correct);
      else expect(u.shown).not.toBe(u.correct);
    }
  });

  it('are always true when there is no other card to take a wrong answer from', () => {
    const quiz = createQuiz([makeCard('a', 'б')], 'forward', only('trueFalse'), rng());
    const unit = quiz.units[0]!;
    expect(unit.kind === 'trueFalse' && unit.isTrue).toBe(true);
  });

  it('are graded by the answer; skipping is wrong', () => {
    const quiz = createQuiz(
      manyCards(6),
      'forward',
      { ...only('trueFalse'), questionCount: 'all' },
      rng(),
    );
    expect(gradeQuiz(quiz, allRight(quiz))).toMatchObject({ correct: 6, percent: 100 });
    const opposite = quiz.units.map((u) => (u.kind === 'trueFalse' ? !u.isTrue : null));
    expect(gradeQuiz(quiz, opposite).wrong).toBe(6);
    expect(
      gradeQuiz(
        quiz,
        quiz.units.map(() => null),
      ).wrong,
    ).toBe(6);
  });
});

describe('matching questions', () => {
  it('group the cards, at most MATCHING_MAX_PAIRS per screen, each right-hand item exactly once', () => {
    const quiz = createQuiz(
      manyCards(12),
      'forward',
      { ...only('matching'), questionCount: 'all' },
      rng(),
    );
    let pairs = 0;
    for (const unit of quiz.units) {
      if (unit.kind !== 'matching') throw new Error('expected matching');
      expect(unit.pairs.length).toBeLessThanOrEqual(MATCHING_MAX_PAIRS);
      expect(unit.pairs.length).toBeGreaterThanOrEqual(2);
      expect([...unit.options].sort()).toEqual(unit.pairs.map((p) => p.right).sort());
      pairs += unit.pairs.length;
    }
    expect(pairs).toBeLessThanOrEqual(12);
    // nothing is lost: a card that did not fit a group is asked another way
    expect(gradeQuiz(quiz, []).total).toBe(12);
  });

  it('one card is asked as multiple choice instead (a pair needs two)', () => {
    const quiz = createQuiz(manyCards(1), 'forward', only('matching'), rng());
    expect(quiz.units).toHaveLength(1);
    expect(quiz.units[0]?.kind).toBe('choice');
  });

  it('do not put cards with the same word or the same answer on one screen', () => {
    const cards = [
      makeCard('bank', 'банк', { id: 'a' }),
      makeCard('bank', 'берег', { id: 'b' }),
      makeCard('shore', 'берег', { id: 'c' }),
      makeCard('tree', 'дерево', { id: 'd' }),
    ];
    const quiz = createQuiz(cards, 'forward', { ...only('matching'), questionCount: 'all' }, rng());
    for (const unit of quiz.units) {
      if (unit.kind !== 'matching') continue;
      expect(new Set(unit.pairs.map((p) => p.left)).size).toBe(unit.pairs.length);
      expect(new Set(unit.pairs.map((p) => p.right)).size).toBe(unit.pairs.length);
    }
    expect(gradeQuiz(quiz, []).total).toBe(4);
  });

  it('are graded per pair: each wrongly linked pair costs one item', () => {
    const quiz = createQuiz(
      manyCards(4),
      'forward',
      { ...only('matching'), questionCount: 'all' },
      rng(),
    );
    const unit = quiz.units[0]!;
    if (unit.kind !== 'matching') throw new Error('expected matching');
    const [first, second, ...rest] = unit.pairs;
    // swap the first two answers, answer the rest right, leave one empty if there is one
    const picks: Record<string, string | null> = {
      [first!.cardId]: second!.right,
      [second!.cardId]: first!.right,
    };
    rest.forEach((p, i) => (picks[p.cardId] = i === 0 ? null : p.right));
    const result = gradeQuiz(quiz, [picks]);
    expect(result.total).toBe(unit.pairs.length);
    expect(result.items.filter((i) => i.result === 'wrong').length).toBe(
      2 + (rest.length > 0 ? 1 : 0),
    );
  });
});

describe('gradeQuiz', () => {
  const quiz = () => createQuiz(sampleCards(), 'forward', only('choice', 'typing'), rng());

  it('gives 100% for all right answers, whatever the kinds', () => {
    const q = createQuiz(
      manyCards(12),
      'forward',
      { ...DEFAULT_QUIZ_CONFIG, questionCount: 'all' },
      rng(),
    );
    const r = gradeQuiz(q, allRight(q));
    expect(r).toMatchObject({ total: 12, correct: 12, wrong: 0, percent: 100, grade: 'excellent' });
  });

  it('gives 0% for skipped or missing answers', () => {
    const q = quiz();
    expect(gradeQuiz(q, []).percent).toBe(0);
    expect(
      gradeQuiz(
        q,
        q.units.map(() => null),
      ),
    ).toMatchObject({ wrong: 5, percent: 0 });
  });

  it('counts a typo as half a point', () => {
    const cards: Card[] = [makeCard('apple', 'яблуко', { id: 'a' })];
    const q = createQuiz(cards, 'forward', only('typing'), rng());
    const r = gradeQuiz(q, ['яблукоx']);
    expect(r).toMatchObject({ almost: 1, points: 0.5, percent: 50, grade: 'fair' });
  });

  it('a wrong choice is wrong even if close', () => {
    const q = createQuiz(sampleCards(), 'forward', only('choice'), rng());
    const unit = q.units[0]!;
    if (unit.kind !== 'choice') throw new Error('expected choice');
    const wrong = unit.question.options.find((o) => o !== unit.question.acceptable[0])!;
    expect(gradeQuiz(q, [wrong]).items[0]?.result).toBe('wrong');
  });

  it('answers belong to questions by position', () => {
    const q = quiz();
    const answers = q.units.map((_, i) => (i === 1 ? rightAnswer(q, 1) : null));
    const r = gradeQuiz(q, answers);
    expect(r.items.map((i) => i.result)).toEqual(['wrong', 'correct', 'wrong', 'wrong', 'wrong']);
    expect(r.percent).toBe(20);
  });

  it('writes one log row per graded word', () => {
    const q = quiz();
    const r = gradeQuiz(q, []);
    const byId = Object.fromEntries(sampleCards().map((c) => [c.id, c]));
    const logs = quizToLogs(q, r, byId, 99);
    expect(logs).toHaveLength(5);
    expect(logs[0]).toMatchObject({ mode: 'test', at: 99, result: 'wrong', deckId: 'd1' });
  });
});

describe('missedCardIds (retake only the mistakes)', () => {
  it('lists every card that was not fully right, once each, in any kind of question', () => {
    const q = createQuiz(
      manyCards(8),
      'forward',
      { ...DEFAULT_QUIZ_CONFIG, questionCount: 'all' },
      rng(),
    );
    const perfect = gradeQuiz(q, allRight(q));
    expect(missedCardIds(perfect)).toEqual([]);

    const none = gradeQuiz(q, []);
    expect(missedCardIds(none).sort()).toEqual(
      manyCards(8)
        .map((c) => c.id)
        .sort(),
    );
  });

  it('includes a typo ("almost"), because it is not fully known', () => {
    const q = createQuiz(
      [makeCard('apple', 'яблуко', { id: 'a' })],
      'forward',
      only('typing'),
      rng(),
    );
    expect(missedCardIds(gradeQuiz(q, ['яблукоx']))).toEqual(['a']);
  });

  it('a retake asks only the restricted cards but still draws wrong options from the whole deck', () => {
    const cards = manyCards(10);
    const retake = createQuiz(
      cards,
      'forward',
      { ...only('choice'), questionCount: 'all', restrictTo: ['c1', 'c2'] },
      rng(),
    );
    expect(retake.units).toHaveLength(2);
    for (const unit of retake.units) {
      if (unit.kind !== 'choice') throw new Error('expected choice');
      expect(['c1', 'c2']).toContain(unit.question.cardId);
      expect(unit.question.options).toHaveLength(4);
    }
  });

  it('a quiz made from the missed cards asks exactly those', () => {
    const cards = manyCards(10);
    const first = createQuiz(cards, 'forward', { ...only('choice'), questionCount: 'all' }, rng());
    const answers: QuizAnswer[] = first.units.map((_, i) => (i < 3 ? rightAnswer(first, i) : null));
    const missed = missedCardIds(gradeQuiz(first, answers));
    expect(missed).toHaveLength(7);
    const retake = createQuiz(
      cards.filter((c) => missed.includes(c.id)),
      'forward',
      { ...only('choice'), questionCount: 'all' },
      rng(),
    );
    expect(retake.units).toHaveLength(7);
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
