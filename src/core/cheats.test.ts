import { ALL_CHEATS, cheatsOf, hasCheats, NO_CHEATS } from './cheats';
import { earnedRewards, REWARDS } from './gardenLife';

describe('cheats', () => {
  it('only keeps whole numbers above zero', () => {
    expect(cheatsOf({ learned: 3.7, streak: -2, golden: Number.NaN })).toEqual({
      ...NO_CHEATS,
      learned: 3,
    });
    expect(cheatsOf(null)).toEqual(NO_CHEATS);
    expect(hasCheats(NO_CHEATS)).toBe(false);
    expect(hasCheats({ reviews: 1 })).toBe(true);
  });

  it('"everything" earns every flower', () => {
    const facts = {
      blooms: ALL_CHEATS.learned,
      bestStreak: ALL_CHEATS.streak,
      goldenWords: ALL_CHEATS.golden,
      challenges: ALL_CHEATS.challenges,
      fullWeeks: ALL_CHEATS.weeks,
    };
    expect(earnedRewards(facts)).toHaveLength(REWARDS.length);
  });
});
