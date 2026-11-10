import { evaluateAchievements } from './achievements';
import {
  decorations,
  shownDecorations,
  toggleDecoration,
  earnedRewards,
  firstRewardOf,
  foundKinds,
  gardenHealth,
  gardenPlotsOf,
  nextRewards,
  PLOT_COUNT,
  rarityOf,
  weekFlower,
  REWARDS,
  VARIETIES,
  wateringDay,
  wateringState,
} from './gardenLife';

const NOW = new Date(2026, 2, 11, 15).getTime();
const day = (offset: number, hour = 10) => new Date(2026, 2, 11 + offset, hour).getTime();

describe('flowers as rewards', () => {
  const none = { blooms: 0, bestStreak: 0, goldenWords: 0, challenges: 0, fullWeeks: 0 };

  it('nothing is earned at the start; the first learned word earns the first flower', () => {
    expect(earnedRewards(none)).toEqual([]);
    expect(earnedRewards({ ...none, blooms: 1 }).map((r) => r.variety)).toEqual(['daisy']);
    expect(nextRewards(none)[0]).toMatchObject({ reward: { id: 'blooms-1' }, left: 1 });
  });

  it('every step of a goal is one more flower: words give common kinds, days rare ones', () => {
    const earned = earnedRewards({
      blooms: 20,
      bestStreak: 7,
      goldenWords: 1,
      challenges: 0,
      fullWeeks: 0,
    });
    expect(earned.filter((r) => r.goal.kind === 'blooms')).toHaveLength(7); // 1 3 5 8 12 16 20
    expect(earned.filter((r) => r.goal.kind === 'streak').map((r) => r.variety)).toEqual([
      'sunflower',
      'rose',
    ]);
    expect(earned.filter((r) => r.variety === 'golden')).toHaveLength(1);
    expect(earned.every((r) => r.goal.kind !== 'blooms' || rarityOf(r.variety) === 'common')).toBe(
      true,
    );
  });

  it('reward ids are unique, and every kind can be earned', () => {
    expect(new Set(REWARDS.map((r) => r.id)).size).toBe(REWARDS.length);
    for (const v of VARIETIES) expect(firstRewardOf(v.id), v.id).toBeDefined();
  });

  it('every full week opens a chest with a flower of the week, a new kind in turn', () => {
    const earned = earnedRewards({ ...none, fullWeeks: 2 });
    expect(earned.map((r) => r.id)).toEqual(['weeks-1', 'weeks-2']);
    expect(earned.every((r) => rarityOf(r.variety) === 'weekly')).toBe(true);
    expect(weekFlower(1)).toBe(earned[0]?.variety);
    expect(weekFlower(2)).toBe(earned[1]?.variety);
    expect(weekFlower(5)).toBe(weekFlower(1));
  });

  it('finished weekly challenges earn rare flowers too', () => {
    const earned = earnedRewards({ ...none, challenges: 3 });
    // every one finished is a flower
    expect(earned.map((r) => r.id)).toEqual(['challenges-1', 'challenges-2', 'challenges-3']);
    expect(earned.every((r) => rarityOf(r.variety) === 'rare')).toBe(true);
  });

  it('kinds found are the kinds of the earned flowers', () => {
    expect(foundKinds(earnedRewards({ ...none, blooms: 3 }))).toEqual(['daisy', 'tulip']);
  });
});

describe('gardenPlotsOf', () => {
  const earned = earnedRewards({
    blooms: 5,
    bestStreak: 0,
    goldenWords: 0,
    challenges: 0,
    fullWeeks: 0,
  }); // 3 flowers

  it('until anything is planted, the earned flowers stand in order: no more than earned', () => {
    const plots = gardenPlotsOf(null, earned);
    expect(plots).toHaveLength(PLOT_COUNT);
    expect(plots.filter(Boolean)).toHaveLength(3);
    expect(plots[0]?.id).toBe('blooms-1');
  });

  it('keeps the plots the user chose; one flower grows on one plot only', () => {
    const plots = gardenPlotsOf(['blooms-3', 'blooms-3', null, 'blooms-1', 'blooms-99'], earned);
    expect(plots.slice(0, 5).map((p) => p?.id ?? null)).toEqual([
      'blooms-3',
      null,
      null,
      'blooms-1',
      null,
    ]);
  });

  it('plots the user emptied stay empty', () => {
    expect(gardenPlotsOf(Array(PLOT_COUNT).fill(null), earned).filter(Boolean)).toHaveLength(0);
  });

  it('an old or broken choice falls back to the earned flowers', () => {
    expect(gardenPlotsOf(['daisy', 'tulip'], earned).filter(Boolean)).toHaveLength(3);
  });
});

describe('gardenHealth', () => {
  it('is new before any study, then fresh, thirsty, wilted', () => {
    expect(gardenHealth([], NOW)).toBe('new');
    expect(gardenHealth([day(-5), day(0, 1)], NOW)).toBe('fresh');
    expect(gardenHealth([day(-1, 23)], NOW)).toBe('thirsty');
    expect(gardenHealth([day(-2)], NOW)).toBe('wilted');
  });
});

describe('wateringState', () => {
  it('is ready once the goal is reached, and done after watering today', () => {
    expect(wateringState(5, 20, null, NOW)).toBe('notYet');
    expect(wateringState(20, 20, null, NOW)).toBe('ready');
    expect(wateringState(20, 20, wateringDay(day(-1)), NOW)).toBe('ready');
    expect(wateringState(20, 20, wateringDay(NOW), NOW)).toBe('done');
  });

  it('a watering day is the local calendar day', () => {
    expect(wateringDay(day(0, 0))).toBe(wateringDay(day(0, 23)));
    expect(wateringDay(day(1, 0))).toBe(wateringDay(day(0, 0)) + 1);
  });
});

describe('shownDecorations', () => {
  const list = [
    { id: 'pond' as const, achievement: 'streak7' as const, earned: true },
    { id: 'fence' as const, achievement: 'firstStep' as const, earned: true },
    { id: 'tree' as const, achievement: 'bloom100' as const, earned: false },
  ];

  it('every earned decoration stands in the garden unless it was put away', () => {
    expect(shownDecorations(list, null)).toEqual(['pond', 'fence']);
    expect(shownDecorations(list, ['fence', 'old-id'])).toEqual(['pond']);
  });

  it('putting away and bringing back changes only that decoration', () => {
    expect(toggleDecoration(null, 'fence', false)).toEqual(['fence']);
    expect(toggleDecoration(['fence', 'pond'], 'fence', true)).toEqual(['pond']);
    expect(toggleDecoration(['pond'], 'pond', false)).toEqual(['pond']);
  });
});

describe('decorations', () => {
  it('are earned together with their achievements', () => {
    const none = { totalReviews: 0, bestStreak: 0, blooms: 0, decks: 0, modesUsed: 0 };
    expect(decorations(evaluateAchievements(none)).every((d) => !d.earned)).toBe(true);
    const some = decorations(evaluateAchievements({ ...none, bestStreak: 7 }));
    expect(some.filter((d) => d.earned).map((d) => d.id)).toEqual(['butterflies', 'birdhouse']);
  });
});
