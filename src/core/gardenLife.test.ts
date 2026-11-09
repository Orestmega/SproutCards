import { evaluateAchievements } from './achievements';
import {
  decorations,
  flowerVariety,
  GOLDEN_REPS,
  gardenHealth,
  rarityOf,
  VARIETIES,
  wateringDay,
  wateringState,
} from './gardenLife';

const NOW = new Date(2026, 2, 11, 15).getTime();
const day = (offset: number, hour = 10) => new Date(2026, 2, 11 + offset, hour).getTime();

describe('flowerVariety', () => {
  it('the same word always becomes the same flower', () => {
    expect(flowerVariety('card-1', 3)).toBe(flowerVariety('card-1', 4));
  });

  it('a word remembered for a long time turns golden', () => {
    expect(flowerVariety('card-1', GOLDEN_REPS)).toBe('golden');
    expect(rarityOf('golden')).toBe('golden');
  });

  it('most words get a common flower, about one in seven a rare one, and every kind appears', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => flowerVariety(`id-${i}`, 3));
    const rare = ids.filter((id) => rarityOf(id) === 'rare').length;
    expect(rare).toBeGreaterThan(200);
    expect(rare).toBeLessThan(400);
    for (const variety of VARIETIES.filter((v) => v.rarity !== 'golden')) {
      expect(ids).toContain(variety.id);
    }
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
