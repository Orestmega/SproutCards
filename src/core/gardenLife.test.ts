import { evaluateAchievements } from './achievements';
import {
  canGrowAs,
  decorations,
  flowerVariety,
  GOLDEN_REPS,
  gardenHealth,
  gardenPlotsOf,
  nextVariety,
  rarityOf,
  PLOT_COUNT,
  unlockedVarieties,
  VARIETIES,
  wateringDay,
  wateringState,
} from './gardenLife';

const NOW = new Date(2026, 2, 11, 15).getTime();
const day = (offset: number, hour = 10) => new Date(2026, 2, 11 + offset, hour).getTime();

describe('unlocking flowers', () => {
  const none = { blooms: 0, bestStreak: 0, goldenWords: 0 };

  it('a daisy is open from the start; the next kind is a clear goal', () => {
    expect(unlockedVarieties(none)).toEqual(['daisy']);
    expect(nextVariety(none)?.id).toBe('tulip');
  });

  it('learned words, days in a row and a word known for long open more kinds', () => {
    expect(unlockedVarieties({ ...none, blooms: 4 })).toEqual(['daisy', 'tulip', 'bellflower']);
    expect(unlockedVarieties({ ...none, bestStreak: 7 })).toEqual(['daisy', 'sunflower', 'rose']);
    expect(unlockedVarieties({ ...none, goldenWords: 1 })).toContain('golden');
    expect(nextVariety({ blooms: 999, bestStreak: 999, goldenWords: 1 })).toBeNull();
  });
});

describe('flowerVariety', () => {
  const open = ['daisy', 'tulip', 'bellflower', 'golden'] as const;

  it('the same word always gets the same open kind', () => {
    const a = flowerVariety('card-1', 2, [...open]);
    expect(a).toBe(flowerVariety('card-1', 3, [...open]));
    expect(['daisy', 'tulip', 'bellflower']).toContain(a);
  });

  it('a word known for long is golden once golden flowers are open', () => {
    expect(flowerVariety('card-1', GOLDEN_REPS, [...open])).toBe('golden');
    expect(flowerVariety('card-1', GOLDEN_REPS, ['daisy'])).toBe('daisy');
    expect(rarityOf('golden')).toBe('golden');
    expect(canGrowAs('golden', 1)).toBe(false);
    expect(canGrowAs('tulip', 1)).toBe(true);
  });

  it('every kind can be grown once it is open', () => {
    const all = VARIETIES.map((v) => v.id).filter((id) => id !== 'golden');
    const kinds = new Set(Array.from({ length: 2000 }, (_, i) => flowerVariety(`id-${i}`, 2, all)));
    expect(kinds.size).toBe(all.length);
  });
});

describe('gardenPlotsOf', () => {
  it('until anything is planted, each earned kind stands once', () => {
    const plots = gardenPlotsOf(null, ['daisy', 'tulip']);
    expect(plots).toHaveLength(PLOT_COUNT);
    expect(plots.slice(0, 3)).toEqual(['daisy', 'tulip', null]);
  });

  it('keeps what the user planted, the same kind on many plots too; a closed kind leaves a gap', () => {
    const saved = ['tulip', 'tulip', null, 'rose'] as const;
    expect(gardenPlotsOf([...saved], ['daisy', 'tulip']).slice(0, 5)).toEqual([
      'tulip',
      'tulip',
      null,
      null,
      null,
    ]);
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

describe('decorations', () => {
  it('are earned together with their achievements', () => {
    const none = { totalReviews: 0, bestStreak: 0, blooms: 0, decks: 0, modesUsed: 0 };
    expect(decorations(evaluateAchievements(none)).every((d) => !d.earned)).toBe(true);
    const some = decorations(evaluateAchievements({ ...none, bestStreak: 7 }));
    expect(some.filter((d) => d.earned).map((d) => d.id)).toEqual(['butterflies', 'birdhouse']);
  });
});
