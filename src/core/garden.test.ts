import {
  bestRepsByCard,
  gardenShare,
  growthCounts,
  growthGain,
  growthStage,
  learnedCount,
} from './garden';

describe('growthStage', () => {
  it('goes from seed to bloom with correct reviews in a row', () => {
    expect(growthStage(undefined)).toBe('seed');
    expect(growthStage(0)).toBe('sprout'); // studied, but the last answer was a mistake
    expect(growthStage(1)).toBe('leaf');
    expect(growthStage(2)).toBe('bloom');
    expect(growthStage(3)).toBe('bloom');
    expect(growthStage(9)).toBe('bloom');
  });
});

describe('growthCounts', () => {
  it('the stronger direction of a card decides, unstudied cards are seeds', () => {
    const progress = [
      { cardId: 'a', reps: 1 },
      { cardId: 'a', reps: 3 },
      { cardId: 'b', reps: 1 },
    ];
    expect(bestRepsByCard(progress).get('a')).toBe(3);
    expect(growthCounts(['a', 'b', 'c'], progress)).toEqual({
      seed: 1,
      sprout: 0,
      leaf: 1,
      bloom: 1,
    });
  });

  it('ignores progress of cards that are not in the list', () => {
    expect(growthCounts([], [{ cardId: 'x', reps: 3 }]).bloom).toBe(0);
  });
});

describe('growthGain', () => {
  const p = (cardId: string, reps: number, direction = 'forward') => ({
    id: `${cardId}:${direction}`,
    cardId,
    reps,
  });

  it('counts the words that moved up, by their new stage', () => {
    const before = [p('a', 1), p('b', 0)];
    const after = [p('a', 2), p('b', 1), p('c', 1), p('d', 0)];
    expect(growthGain(before, after)).toEqual({ sprout: 1, leaf: 2, bloom: 1 });
  });

  it('a word that stayed or fell back is not growth; the other direction still counts', () => {
    const before = [p('a', 2), p('b', 1), p('c', 2, 'backward')];
    const after = [p('a', 3), p('b', 0), p('c', 1)];
    expect(growthGain(before, after)).toEqual({ sprout: 0, leaf: 0, bloom: 0 });
  });
});

describe('learnedCount', () => {
  it('a word counts once it was answered cleanly in some direction', () => {
    expect(
      learnedCount([
        { cardId: 'a', reps: 0 },
        { cardId: 'a', reps: 1 },
        { cardId: 'b', reps: 0 },
        { cardId: 'c', reps: 4 },
      ]),
    ).toBe(2);
  });
});

describe('gardenShare', () => {
  it('is 0 for seeds or nothing, 1 when all bloom, in between otherwise', () => {
    expect(gardenShare({ seed: 0, sprout: 0, leaf: 0, bloom: 0 })).toBe(0);
    expect(gardenShare({ seed: 4, sprout: 0, leaf: 0, bloom: 0 })).toBe(0);
    expect(gardenShare({ seed: 0, sprout: 0, leaf: 0, bloom: 4 })).toBe(1);
    expect(gardenShare({ seed: 1, sprout: 1, leaf: 1, bloom: 1 })).toBe(0.5);
  });
});
