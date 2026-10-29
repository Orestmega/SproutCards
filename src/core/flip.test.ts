import {
  answerFlip,
  continueFlip,
  currentFlipCard,
  flipFace,
  flipProgress,
  flipToLogs,
  flipToProgress,
  isFlipFinished,
  startFlip,
  summarizeFlip,
} from './flip';
import type { FlipState } from './flip';
import { seededRng } from './random';
import { createFixedIntervalScheduler } from './scheduler';
import { makeCard, sampleCards } from './testUtils';

const NOW = new Date(2026, 5, 10, 12).getTime();
const scheduler = createFixedIntervalScheduler();
const rng = () => seededRng(1);

/** Answers the current card of every round as `known(cardId, round)` says, until the session ends. */
function play(state: FlipState, known: (id: string, round: number) => boolean): FlipState {
  let s = state;
  for (let guard = 0; guard < 200 && !isFlipFinished(s); guard++) {
    const card = currentFlipCard(s);
    s = card ? answerFlip(s, known(card.id, s.round), NOW) : continueFlip(s, rng());
  }
  return s;
}

describe('flip mode: one round', () => {
  it('shows the cards one by one and finishes after the last if all were known', () => {
    let s = startFlip(sampleCards(), 'forward');
    expect(currentFlipCard(s)?.id).toBe('apple');
    s = answerFlip(s, true, NOW);
    expect(currentFlipCard(s)?.id).toBe('house');
    for (let i = 0; i < 4; i++) s = answerFlip(s, true, NOW);
    expect(isFlipFinished(s)).toBe(true);
    expect(currentFlipCard(s)).toBeNull();
    expect(() => answerFlip(s, true, NOW)).toThrow(/finished/);
  });

  it('handles an empty deck, skips unstudyable cards and duplicates', () => {
    expect(isFlipFinished(startFlip([], 'forward'))).toBe(true);
    expect(flipProgress(startFlip([], 'forward'))).toBe(1);
    const a = makeCard('a', 'б', { id: 'a' });
    const s = startFlip(
      [a, a, makeCard('x', [' '], { id: 'bad' }), makeCard('', 'y', { id: 'bad2' })],
      'forward',
    );
    expect(s.cards.map((c) => c.id)).toEqual(['a']);
  });

  it('shows the term first going forward and the translation first going backward', () => {
    const house = makeCard('house', ['будинок', 'дім']);
    expect(flipFace(house, 'forward')).toEqual({ front: 'house', back: ['будинок', 'дім'] });
    expect(flipFace(house, 'backward')).toEqual({ front: 'будинок', back: ['house'] });
  });
});

describe('flip mode: rounds until everything is known', () => {
  it('stops after the round with a "round end" when some cards were not known', () => {
    let s = startFlip(sampleCards(), 'forward');
    s = answerFlip(s, true, NOW); // apple
    s = answerFlip(s, false, NOW); // house
    s = answerFlip(s, true, NOW); // water
    s = answerFlip(s, false, NOW); // book
    s = answerFlip(s, true, NOW); // cat
    expect(s.phase).toBe('roundEnd');
    expect(isFlipFinished(s)).toBe(false);
    expect(currentFlipCard(s)).toBeNull();
    expect(s.missed).toEqual(['house', 'book']);
    expect(summarizeFlip(s)).toMatchObject({ total: 5, known: 3, stillLearning: 2, rounds: 1 });
  });

  it('the next round contains exactly the cards that were not known, in a new order', () => {
    let s = startFlip(sampleCards(), 'forward');
    s = play(
      { ...s },
      () => true, // everything known: finished at once
    );
    expect(isFlipFinished(s)).toBe(true);

    let t = startFlip(sampleCards(), 'forward');
    for (const known of [true, false, true, false, true]) t = answerFlip(t, known, NOW);
    t = continueFlip(t, rng());
    expect(t.phase).toBe('card');
    expect(t.round).toBe(2);
    expect([...t.order].sort()).toEqual(['book', 'house']);
    expect(t.missed).toEqual([]);
    expect(t.position).toBe(0);
  });

  it('continuing when no round has ended does nothing', () => {
    const s = startFlip(sampleCards(), 'forward');
    expect(continueFlip(s, rng())).toBe(s);
  });

  it('repeats until every card was known, then finishes', () => {
    // "house" is unknown in rounds 1 and 2, known in round 3; "book" is unknown only in round 1
    const s = play(startFlip(sampleCards(), 'forward'), (id, round) => {
      if (id === 'house') return round >= 3;
      if (id === 'book') return round >= 2;
      return true;
    });
    expect(isFlipFinished(s)).toBe(true);
    expect(s.round).toBe(3);
    expect(summarizeFlip(s)).toMatchObject({
      total: 5,
      known: 5,
      stillLearning: 0,
      rounds: 3,
      struggledCardIds: ['house', 'book'],
    });
    expect(s.results.filter((r) => r.round === 1)).toHaveLength(5);
    expect(s.results.filter((r) => r.round === 2)).toHaveLength(2);
    expect(s.results.filter((r) => r.round === 3)).toHaveLength(1);
  });

  it('a single card that is not known keeps coming back', () => {
    let s = startFlip([sampleCards()[0]!], 'forward');
    s = answerFlip(s, false, NOW);
    expect(s.phase).toBe('roundEnd');
    s = continueFlip(s, rng());
    expect(currentFlipCard(s)?.id).toBe('apple');
    s = answerFlip(s, true, NOW);
    expect(isFlipFinished(s)).toBe(true);
  });

  it('the progress bar shows how many cards are known now: it falls back never, rises with each "know"', () => {
    let s = startFlip(sampleCards(), 'forward');
    expect(flipProgress(s)).toBe(0);
    s = answerFlip(s, true, NOW);
    expect(flipProgress(s)).toBeCloseTo(0.2);
    s = answerFlip(s, false, NOW);
    expect(flipProgress(s)).toBeCloseTo(0.2);
    for (const known of [true, true, true]) s = answerFlip(s, known, NOW);
    expect(flipProgress(s)).toBeCloseTo(0.8);
    s = continueFlip(s, rng());
    s = answerFlip(s, true, NOW);
    expect(flipProgress(s)).toBe(1);
  });
});

describe('flip mode: saving', () => {
  it('schedules once per card: known all the time = correct, ever "don\'t know" = mistake', () => {
    const cards = sampleCards().slice(0, 2); // apple, house
    // apple known at once; house not known, then known in round 2
    const s = play(startFlip(cards, 'forward'), (id, round) => id === 'apple' || round > 1);
    const progress = flipToProgress(s, [], scheduler);
    expect(progress).toHaveLength(2);
    expect(progress[0]).toMatchObject({
      id: 'apple:forward',
      reps: 1,
      lapses: 0,
      firstSeenAt: NOW,
    });
    expect(progress[1]).toMatchObject({ id: 'house:forward', reps: 0, lapses: 1 });
  });

  it('keeps the first-seen time and advances an existing schedule', () => {
    const first = flipToProgress(
      answerFlip(startFlip([sampleCards()[0]!], 'forward'), true, NOW),
      [],
      scheduler,
    );
    const later = NOW + 86_400_000;
    const second = flipToProgress(
      answerFlip(startFlip([sampleCards()[0]!], 'forward'), true, later),
      first,
      scheduler,
    );
    expect(second[0]).toMatchObject({
      reps: 2,
      intervalDays: 3,
      firstSeenAt: NOW,
      lastReviewedAt: later,
    });
  });

  it('only schedules the cards answered so far (interrupted session)', () => {
    const s = answerFlip(startFlip(sampleCards(), 'forward'), true, NOW);
    expect(flipToProgress(s, [], scheduler)).toHaveLength(1);
    expect(flipToLogs(s)).toEqual([
      {
        at: NOW,
        cardId: 'apple',
        deckId: 'd1',
        direction: 'forward',
        mode: 'flip',
        result: 'correct',
      },
    ]);
  });

  it('logs every answer of every round', () => {
    const s = play(
      startFlip(sampleCards().slice(0, 2), 'forward'),
      (id, round) => id === 'apple' || round > 1,
    );
    expect(flipToLogs(s).map((l) => [l.cardId, l.result])).toEqual([
      ['apple', 'correct'],
      ['house', 'wrong'],
      ['house', 'correct'],
    ]);
  });

  it('an interrupted session counts the cards still not known as still learning', () => {
    let s = startFlip(sampleCards(), 'forward');
    s = answerFlip(s, true, NOW);
    s = answerFlip(s, false, NOW);
    expect(summarizeFlip(s)).toMatchObject({
      known: 1,
      stillLearning: 4,
      struggledCardIds: ['house'],
    });
  });
});
