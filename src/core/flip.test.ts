import {
  answerFlip,
  currentFlipCard,
  flipFace,
  flipProgress,
  flipToLogs,
  flipToProgress,
  isFlipFinished,
  startFlip,
  summarizeFlip,
} from './flip';
import { createFixedIntervalScheduler } from './scheduler';
import { makeCard, sampleCards } from './testUtils';

const NOW = new Date(2026, 5, 10, 12).getTime();
const scheduler = createFixedIntervalScheduler();

describe('flip mode', () => {
  it('shows the cards one by one and finishes after the last', () => {
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

  it('progress bar grows with answers', () => {
    let s = startFlip(sampleCards(), 'forward');
    expect(flipProgress(s)).toBe(0);
    s = answerFlip(s, false, NOW);
    expect(flipProgress(s)).toBeCloseTo(0.2);
  });

  it('summarises known and unknown cards', () => {
    let s = startFlip(sampleCards(), 'forward');
    s = answerFlip(s, true, NOW);
    s = answerFlip(s, false, NOW);
    s = answerFlip(s, false, NOW);
    expect(summarizeFlip(s)).toEqual({
      total: 5,
      answered: 3,
      known: 1,
      unknown: 2,
      unknownCardIds: ['house', 'water'],
    });
  });

  it('schedules known cards forward and resets the unknown ones', () => {
    let s = startFlip(sampleCards().slice(0, 2), 'forward');
    s = answerFlip(s, true, NOW);
    s = answerFlip(s, false, NOW);
    const progress = flipToProgress(s, [], scheduler);
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
});
