import { accuracy, computeStreak, dailyCounts, LEARNED_REPS, stageCounts } from './stats';

const at = (month: number, day: number, hour = 12) => new Date(2026, month, day, hour).getTime();

describe('computeStreak', () => {
  it('is 0 without any reviews', () => {
    expect(computeStreak([], at(5, 10))).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak([at(5, 8), at(5, 9), at(5, 10, 9), at(5, 10, 20)], at(5, 10))).toBe(3);
  });

  it('keeps the streak alive if today has no review yet but yesterday had', () => {
    expect(computeStreak([at(5, 8), at(5, 9)], at(5, 10, 8))).toBe(2);
  });

  it('is 0 after a missed day', () => {
    expect(computeStreak([at(5, 7), at(5, 8)], at(5, 10))).toBe(0);
  });

  it('stops at a gap', () => {
    expect(computeStreak([at(5, 5), at(5, 8), at(5, 9), at(5, 10)], at(5, 10))).toBe(3);
  });

  it('works across month and year boundaries', () => {
    const now = new Date(2026, 0, 1, 10).getTime();
    expect(computeStreak([new Date(2025, 11, 31, 23).getTime(), now], now)).toBe(2);
  });
});

describe('dailyCounts', () => {
  it('returns every day of the window, oldest first, with zeros', () => {
    const now = at(5, 10, 20);
    const result = dailyCounts([at(5, 10, 8), at(5, 10, 9), at(5, 8)], now, 4);
    expect(result.map((d) => d.count)).toEqual([0, 1, 0, 2]);
    expect(new Date(result[3]!.dayStart).getDate()).toBe(10);
    expect(new Date(result[0]!.dayStart).getDate()).toBe(7);
    expect(new Date(result[0]!.dayStart).getHours()).toBe(0);
  });

  it('ignores reviews outside the window', () => {
    expect(dailyCounts([at(4, 1)], at(5, 10), 7).every((d) => d.count === 0)).toBe(true);
  });

  it('crosses month boundaries', () => {
    const result = dailyCounts([at(4, 31)], at(5, 2), 3);
    expect(result.map((d) => d.count)).toEqual([1, 0, 0]);
  });
});

describe('accuracy', () => {
  it('is null without answers', () => {
    expect(accuracy([])).toBeNull();
  });

  it('counts only fully correct answers', () => {
    expect(accuracy(['correct', 'correct', 'almost', 'wrong'])).toBe(0.5);
  });
});

describe('stageCounts', () => {
  const progress = [
    { cardId: 'a', reps: 5 },
    { cardId: 'b', reps: 1 },
    { cardId: 'b', reps: 0 },
    { cardId: 'c', reps: 0 },
    { cardId: 'c', reps: LEARNED_REPS },
  ];

  it('splits cards into learned, learning and new', () => {
    expect(stageCounts(['a', 'b', 'c', 'd', 'e'], progress)).toEqual({
      learned: 2,
      learning: 1,
      fresh: 2,
    });
  });

  it('only looks at the cards given', () => {
    expect(stageCounts(['d'], progress)).toEqual({ learned: 0, learning: 0, fresh: 1 });
  });
});
