import {
  applySessionToProgress,
  DEFAULT_LEARN_CONFIG,
  isFinished,
  progressFraction,
  sessionToLogs,
  startSession,
  submitAnswer,
  summarize,
} from './learn';
import type { LearnConfig, LearnState } from './learn';
import { seededRng } from './random';
import { createFixedIntervalScheduler } from './scheduler';
import { makeCard, sampleCards } from './testUtils';
import type { Progress } from './types';
import { progressId } from './types';

const NOW = new Date(2026, 5, 10, 12).getTime();
const scheduler = createFixedIntervalScheduler();

function q(state: LearnState) {
  if (!state.current) throw new Error('session finished');
  return state.current;
}

/** Answers the current question correctly with the card's own answer. */
function correct(state: LearnState, rng = seededRng(1)): LearnState {
  return submitAnswer(state, q(state).acceptable[0] as string, NOW, rng).state;
}

function wrong(state: LearnState, rng = seededRng(1)): LearnState {
  return submitAnswer(state, 'zzzz-not-an-answer', NOW, rng).state;
}

/** Plays the session to the end, always answering correctly. Returns the final state and answer count. */
function playPerfectly(state: LearnState): { state: LearnState; answers: number } {
  let answers = 0;
  while (!isFinished(state)) {
    state = correct(state);
    answers++;
    if (answers > 1000) throw new Error('session does not end');
  }
  return { state, answers };
}

describe('starting a session', () => {
  it('handles an empty deck: nothing to ask, already finished', () => {
    const s = startSession([], 'forward');
    expect(s.current).toBeNull();
    expect(isFinished(s)).toBe(true);
    expect(summarize(s)).toMatchObject({ totalCards: 0, answers: 0, accuracy: 0 });
    expect(progressFraction(s)).toBe(1);
  });

  it('skips cards that cannot be studied and ignores duplicate ids', () => {
    const ok = makeCard('apple', 'яблуко', { id: 'a' });
    const noTranslation = makeCard('x', [' ', ''], { id: 'b' });
    const noTerm = makeCard('  ', 'щось', { id: 'c' });
    const s = startSession([ok, noTranslation, noTerm, ok], 'forward', undefined, seededRng(1));
    expect(s.skipped).toEqual(['b', 'c']);
    expect(s.queue).toEqual(['a']);
  });

  it('rejects a config without levels', () => {
    expect(() =>
      startSession(sampleCards(), 'forward', { ...DEFAULT_LEARN_CONFIG, levels: [] }),
    ).toThrow();
  });

  it('starts with a choice question: the term is shown, options include the right translation', () => {
    const s = startSession(sampleCards(), 'forward', undefined, seededRng(7));
    const question = q(s);
    expect(question).toMatchObject({
      kind: 'choice',
      promptSide: 'term',
      answerSide: 'translation',
      level: 0,
    });
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options).size).toBe(4);
    expect(question.options).toContain(question.acceptable[0]);
  });

  it('a one-card deck falls back to typing (no distractors possible)', () => {
    const s = startSession([makeCard('apple', 'яблуко')], 'forward', undefined, seededRng(1));
    expect(q(s)).toMatchObject({ kind: 'typing', options: [] });
  });

  it('a two-card deck offers a two-option choice', () => {
    const s = startSession(
      [makeCard('apple', 'яблуко'), makeCard('water', 'вода')],
      'forward',
      undefined,
      seededRng(1),
    );
    expect(q(s).options).toHaveLength(2);
  });

  it('never uses a duplicate or equivalent answer as a distractor', () => {
    const cards = [
      makeCard('bank', 'банк', { id: '1' }),
      makeCard('bank', 'Банк ', { id: '2' }), // same answer as card 1 after normalisation
      makeCard('river', 'річка', { id: '3' }),
    ];
    const s = startSession(cards, 'forward', undefined, seededRng(3));
    expect(q(s).options.sort()).toEqual(['річка', 'банк'].sort());
  });
});

describe('directions and levels', () => {
  const rng = () => seededRng(5);

  it('forward: choose translation -> type translation -> type the term', () => {
    let s = startSession(sampleCards(), 'forward', undefined, rng());
    const first = q(s);
    expect(first).toMatchObject({ kind: 'choice', prompt: 'apple', promptSide: 'term' });
    // answer only this card until it reaches the next levels
    s = correct(s);
    while (q(s).cardId !== first.cardId) s = correct(s);
    expect(q(s)).toMatchObject({ level: 1, kind: 'typing', promptSide: 'term' });
    s = correct(s);
    while (q(s).cardId !== first.cardId) s = correct(s);
    expect(q(s)).toMatchObject({
      level: 2,
      kind: 'typing',
      promptSide: 'translation',
      prompt: 'яблуко',
    });
  });

  it('backward: the sides are swapped on every level', () => {
    const s = startSession(sampleCards(), 'backward', undefined, rng());
    expect(q(s)).toMatchObject({ kind: 'choice', promptSide: 'translation', answerSide: 'term' });
    const typed = startSession(sampleCards(), 'backward', undefined, rng());
    let t = typed;
    const id = q(t).cardId;
    t = correct(t);
    while (q(t).cardId !== id) t = correct(t);
    expect(q(t)).toMatchObject({ level: 1, promptSide: 'translation', answerSide: 'term' });
    t = correct(t);
    while (q(t).cardId !== id) t = correct(t);
    expect(q(t)).toMatchObject({ level: 2, promptSide: 'term', answerSide: 'translation' });
  });

  it('a typed answer may be any of the translations', () => {
    const house = makeCard('house', ['будинок', 'дім'], { id: 'h' });
    let s = startSession([house], 'forward', undefined, seededRng(1)); // typing straight away
    s = submitAnswer(s, 'дім', NOW).state;
    expect(s.events[0]?.result).toBe('correct');
  });

  it('accepts the term of another card that shares the same translation (duplicates)', () => {
    const cards = [
      makeCard('big', 'великий', { id: 'a' }),
      makeCard('large', 'великий', { id: 'b' }),
    ];
    const alone = startSession(cards.slice(0, 1), 'backward', undefined, seededRng(1));
    expect(q(alone).acceptable).toEqual(['big']); // a single card accepts only its own term
    const s = startSession(cards, 'backward', undefined, seededRng(1));
    expect(q(s).acceptable).toEqual(expect.arrayContaining(['big', 'large']));
    expect(q(s).acceptable[0]).toBe(s.cards[q(s).cardId]?.term);
  });
});

describe('answers', () => {
  it('perfect play takes one answer per card per level and ends with everything passed', () => {
    const { state, answers } = playPerfectly(
      startSession(sampleCards(), 'forward', undefined, seededRng(2)),
    );
    expect(answers).toBe(5 * 3);
    const summary = summarize(state);
    expect(summary).toMatchObject({
      totalCards: 5,
      passedCards: 5,
      wrong: 0,
      almost: 0,
      accuracy: 1,
    });
    expect(summary.outcomes.every((o) => o.mistakes === 0 && o.passed)).toBe(true);
    expect(progressFraction(state)).toBe(1);
  });

  it('a correct answer sends the card to the back of the queue', () => {
    const s = startSession(sampleCards(), 'forward', undefined, seededRng(2));
    const first = q(s).cardId;
    const next = correct(s);
    expect(next.queue.at(-1)).toBe(first);
    expect(next.queue).toHaveLength(5);
  });

  it('a wrong answer shows the right one, lowers the level and brings the card back within 3-5 places', () => {
    let s = startSession(sampleCards(), 'forward', undefined, seededRng(2));
    const id = q(s).cardId;
    s = correct(s); // some other card is now current
    while (q(s).cardId !== id) s = correct(s); // level 1 for `id`
    expect(q(s).level).toBe(1);

    const result = submitAnswer(s, 'definitely wrong', NOW, seededRng(9));
    expect(result.feedback).toMatchObject({ result: 'wrong', passed: false });
    expect(result.feedback.expected).toBe(s.cards[id]?.translations[0]);
    expect(result.state.items[id]).toMatchObject({ level: 0, mistakes: 1 });
    const position = result.state.queue.indexOf(id);
    expect(position).toBeGreaterThanOrEqual(3);
    expect(position).toBeLessThanOrEqual(5);
  });

  it('a wrong answer on level 0 stays on level 0', () => {
    const s = wrong(startSession(sampleCards(), 'forward', undefined, seededRng(2)));
    const id = s.queue.find((c) => s.items[c]?.mistakes === 1) as string;
    expect(s.items[id]?.level).toBe(0);
  });

  it('comes back after fewer cards when the queue is short', () => {
    const cards = [makeCard('a', 'б', { id: '1' }), makeCard('c', 'д', { id: '2' })];
    const s = wrong(startSession(cards, 'forward', undefined, seededRng(1)));
    expect(s.queue).toEqual(['2', '1']);
  });

  it('"I don\'t know" (null) counts as a wrong answer', () => {
    const s = startSession(sampleCards(), 'forward', undefined, seededRng(2));
    const id = q(s).cardId;
    const r = submitAnswer(s, null, NOW, seededRng(1));
    expect(r.feedback.result).toBe('wrong');
    expect(r.state.items[id]?.mistakes).toBe(1);
  });

  it('an empty typed answer counts as wrong', () => {
    const s = startSession([makeCard('apple', 'яблуко')], 'forward', undefined, seededRng(1));
    expect(submitAnswer(s, '   ', NOW).feedback.result).toBe('wrong');
  });

  it('a typo is "almost": same level, not a mistake, card comes back, right answer is given', () => {
    const s = startSession(
      [makeCard('apple', 'яблуко', { id: 'a' })],
      'forward',
      undefined,
      seededRng(1),
    );
    const r = submitAnswer(s, 'яблуко' + 'x', NOW, seededRng(1)); // one extra letter
    expect(r.feedback).toMatchObject({ result: 'almost', expected: 'яблуко', passed: false });
    expect(r.state.items['a']).toMatchObject({ level: 0, mistakes: 0, passed: false });
    expect(r.state.queue).toEqual(['a']);
  });

  it('an almost answer on the last level does not pass the card', () => {
    let s = startSession(
      [makeCard('apple', 'яблуко', { id: 'a' })],
      'forward',
      undefined,
      seededRng(1),
    );
    s = correct(s);
    s = correct(s); // now on level 2: type the term from its translation
    expect(q(s).level).toBe(2);
    const r = submitAnswer(s, 'aple', NOW);
    expect(r.feedback).toMatchObject({ result: 'almost', passed: false });
    expect(isFinished(r.state)).toBe(false);
  });

  it('a choice must be exactly right: no leniency', () => {
    const s = startSession(sampleCards(), 'forward', undefined, seededRng(4));
    const wrongOption = q(s).options.find((o) => o !== q(s).acceptable[0]) as string;
    expect(submitAnswer(s, wrongOption, NOW).feedback.result).toBe('wrong');
  });

  it('passing happens on a correct answer to the last level, and only then', () => {
    let s = startSession(
      [makeCard('apple', 'яблуко', { id: 'a' })],
      'forward',
      undefined,
      seededRng(1),
    );
    s = correct(s);
    s = correct(s);
    const last = submitAnswer(s, q(s).acceptable[0] as string, NOW);
    expect(last.feedback.passed).toBe(true);
    expect(isFinished(last.state)).toBe(true);
    expect(last.state.items['a']?.passed).toBe(true);
  });

  it('a mistake after reaching the last level costs levels again', () => {
    let s = startSession(
      [makeCard('apple', 'яблуко', { id: 'a' })],
      'forward',
      undefined,
      seededRng(1),
    );
    s = correct(s);
    s = correct(s);
    s = wrong(s); // wrong on level 2 -> back to level 1
    expect(q(s).level).toBe(1);
    expect(s.items['a']?.mistakes).toBe(1);
    const { state, answers } = playPerfectly(s);
    expect(answers).toBe(2);
    expect(summarize(state).outcomes[0]).toMatchObject({ passed: true, mistakes: 1 });
  });

  it('throws when answering after the session is over', () => {
    const { state } = playPerfectly(
      startSession(sampleCards(), 'forward', undefined, seededRng(2)),
    );
    expect(() => submitAnswer(state, 'x', NOW)).toThrow(/finished/);
  });

  it('a session with many mistakes still ends once every card is eventually answered right', () => {
    let s = startSession(sampleCards(), 'forward', undefined, seededRng(11));
    for (let i = 0; i < 10; i++) s = wrong(s, seededRng(i));
    const { state } = playPerfectly(s);
    expect(summarize(state).passedCards).toBe(5);
    expect(summarize(state).wrong).toBe(10);
  });

  it('does not mutate the previous state', () => {
    const s = startSession(sampleCards(), 'forward', undefined, seededRng(2));
    const snapshot = JSON.stringify(s);
    submitAnswer(s, q(s).acceptable[0] as string, NOW);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('supports a custom configuration (two levels, strict accents)', () => {
    const config: LearnConfig = {
      ...DEFAULT_LEARN_CONFIG,
      levels: [{ kind: 'typing', prompt: 'term' }],
      ignoreDiacritics: false,
    };
    let s = startSession([makeCard('cafe', 'кафе', { id: 'a' })], 'forward', config, seededRng(1));
    expect(q(s).kind).toBe('typing');
    s = submitAnswer(s, 'кафе', NOW).state;
    expect(isFinished(s)).toBe(true);
  });
});

describe('progress and review log', () => {
  function finish(cards = sampleCards(), withMistakeOn?: string): LearnState {
    let s = startSession(cards, 'forward', undefined, seededRng(2));
    let mistakeDone = false;
    while (!isFinished(s)) {
      if (withMistakeOn && !mistakeDone && q(s).cardId === withMistakeOn) {
        s = wrong(s);
        mistakeDone = true;
      } else s = correct(s);
    }
    return s;
  }

  it('schedules a clean card for the first interval and a card with mistakes also for the first, counting a lapse', () => {
    const s = finish(sampleCards(), 'apple');
    const progress = applySessionToProgress(s, [], scheduler, NOW);
    expect(progress).toHaveLength(5);
    const apple = progress.find((p) => p.cardId === 'apple') as Progress;
    const water = progress.find((p) => p.cardId === 'water') as Progress;
    expect(apple).toMatchObject({
      id: 'apple:forward',
      reps: 0,
      lapses: 1,
      direction: 'forward',
      deckId: 'd1',
    });
    expect(water).toMatchObject({ reps: 1, intervalDays: 1, lapses: 0, lastReviewedAt: NOW });
  });

  it('moves a card along the intervals across sessions', () => {
    const cards = [makeCard('apple', 'яблуко', { id: 'a' })];
    const first = applySessionToProgress(finish(cards), [], scheduler, NOW);
    const second = applySessionToProgress(finish(cards), first, scheduler, NOW);
    const third = applySessionToProgress(finish(cards), second, scheduler, NOW);
    expect([first, second, third].map((p) => p[0]?.intervalDays)).toEqual([1, 3, 7]);
  });

  it('a mistake in a later session resets the interval', () => {
    const cards = [makeCard('apple', 'яблуко', { id: 'a' })];
    const first = applySessionToProgress(finish(cards), [], scheduler, NOW);
    const second = applySessionToProgress(finish(cards), first, scheduler, NOW);
    const reset = applySessionToProgress(finish(cards, 'a'), second, scheduler, NOW);
    expect(reset[0]).toMatchObject({ reps: 0, intervalDays: 1, lapses: 1 });
  });

  it('keeps forward and backward progress separate', () => {
    const cards = [makeCard('apple', 'яблуко', { id: 'a' })];
    const forward = applySessionToProgress(finish(cards), [], scheduler, NOW);
    let back = startSession(cards, 'backward', undefined, seededRng(1));
    back = playPerfectly(back).state;
    const both = applySessionToProgress(back, forward, scheduler, NOW);
    expect(both[0]).toMatchObject({ id: progressId('a', 'backward'), reps: 1 });
  });

  it('an interrupted session schedules only the cards that passed', () => {
    let s = startSession(sampleCards(), 'forward', undefined, seededRng(2));
    for (let i = 0; i < 6; i++) s = correct(s); // only part of the work
    expect(applySessionToProgress(s, [], scheduler, NOW)).toEqual([]);
  });

  it('produces one log row per answer', () => {
    const s = finish(sampleCards(), 'apple');
    const logs = sessionToLogs(s);
    expect(logs).toHaveLength(s.events.length);
    expect(logs[0]).toMatchObject({ mode: 'learn', direction: 'forward', deckId: 'd1', level: 0 });
    expect(logs.filter((l) => l.result === 'wrong')).toHaveLength(1);
  });
});

describe('progress bar', () => {
  it('grows monotonically with correct answers and stays within 0..1', () => {
    let s = startSession(sampleCards(), 'forward', undefined, seededRng(2));
    let prev = progressFraction(s);
    expect(prev).toBe(0);
    while (!isFinished(s)) {
      s = correct(s);
      const now = progressFraction(s);
      expect(now).toBeGreaterThanOrEqual(prev);
      expect(now).toBeLessThanOrEqual(1);
      prev = now;
    }
    expect(prev).toBe(1);
  });
});
