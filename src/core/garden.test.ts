import {
  bestRepsByCard,
  gardenPlots,
  gardenShare,
  growthCounts,
  growthGain,
  growthStage,
  learnedCount,
  scenePlants,
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

describe('gardenPlots', () => {
  it('is empty without words and never bigger than the words or the plots', () => {
    expect(gardenPlots({ seed: 0, sprout: 0, leaf: 0, bloom: 0 }, 9)).toEqual([]);
    expect(gardenPlots({ seed: 2, sprout: 0, leaf: 0, bloom: 0 }, 9)).toHaveLength(2);
    expect(
      gardenPlots({ seed: 100, sprout: 50, leaf: 20, bloom: 5 }, 9).length,
    ).toBeLessThanOrEqual(9);
  });

  it('puts the most grown first and shows a rare stage too', () => {
    const plots = gardenPlots({ seed: 100, sprout: 0, leaf: 0, bloom: 1 }, 5);
    expect(plots[0]).toBe('bloom');
    expect(plots.filter((p) => p === 'seed')).toHaveLength(4);
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

describe('scenePlants', () => {
  it('draws real plants, the special flowers first', () => {
    const plants = [
      { id: 'a', stage: 'bloom' as const, rank: 0 },
      { id: 'b', stage: 'bloom' as const, rank: 2 },
      { id: 'c', stage: 'seed' as const, rank: 0 },
    ];
    expect(scenePlants(plants, 9).map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(scenePlants(plants, 1)).toHaveLength(1);
    expect(scenePlants([], 9)).toEqual([]);
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
