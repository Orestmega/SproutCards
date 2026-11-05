import { ACHIEVEMENTS, evaluateAchievements } from './achievements';

const none = { totalReviews: 0, bestStreak: 0, blooms: 0, decks: 0, modesUsed: 0 };

describe('evaluateAchievements', () => {
  it('nothing is done at the start', () => {
    const list = evaluateAchievements(none);
    expect(list).toHaveLength(ACHIEVEMENTS.length);
    expect(list.every((a) => !a.done && a.share === 0)).toBe(true);
  });

  it('marks what is reached and shows the way to the rest', () => {
    const list = evaluateAchievements({ ...none, totalReviews: 150, bestStreak: 7 });
    const get = (id: string) => list.find((a) => a.id === id);
    expect(get('firstStep')?.done).toBe(true);
    expect(get('reviews100')?.done).toBe(true);
    expect(get('reviews500')).toMatchObject({ done: false, value: 150, share: 0.3 });
    expect(get('streak7')?.done).toBe(true);
    expect(get('streak30')?.done).toBe(false);
  });

  it('the value never goes over the target', () => {
    const first = evaluateAchievements({ ...none, totalReviews: 5000 })[0];
    expect(first).toMatchObject({ value: 1, share: 1 });
  });

  it('ids are unique', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
