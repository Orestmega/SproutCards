import { computeStreak } from './stats';

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
