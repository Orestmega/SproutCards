/** Achievements: worked out from what is already stored, so they can never be lost or out of date. */

export interface AchievementFacts {
  totalReviews: number;
  bestStreak: number;
  /** Words at the bloom stage. */
  blooms: number;
  decks: number;
  /** How many different study modes were used. */
  modesUsed: number;
}

export interface AchievementRule {
  id: string;
  metric: keyof AchievementFacts;
  target: number;
}

/** Ids are translation keys (`achievement.<id>`). Order: the order on the screen. */
export const ACHIEVEMENTS = [
  { id: 'firstStep', metric: 'totalReviews', target: 1 },
  { id: 'reviews100', metric: 'totalReviews', target: 100 },
  { id: 'reviews500', metric: 'totalReviews', target: 500 },
  { id: 'reviews2000', metric: 'totalReviews', target: 2000 },
  { id: 'streak3', metric: 'bestStreak', target: 3 },
  { id: 'streak7', metric: 'bestStreak', target: 7 },
  { id: 'streak30', metric: 'bestStreak', target: 30 },
  { id: 'streak100', metric: 'bestStreak', target: 100 },
  { id: 'bloom1', metric: 'blooms', target: 1 },
  { id: 'bloom25', metric: 'blooms', target: 25 },
  { id: 'bloom100', metric: 'blooms', target: 100 },
  { id: 'bloom500', metric: 'blooms', target: 500 },
  { id: 'decks3', metric: 'decks', target: 3 },
  { id: 'explorer', metric: 'modesUsed', target: 4 },
] as const satisfies readonly AchievementRule[];

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];

export interface AchievementState {
  id: AchievementId;
  metric: keyof AchievementFacts;
  value: number;
  target: number;
  done: boolean;
  /** 0..1 */
  share: number;
}

export function evaluateAchievements(facts: AchievementFacts): AchievementState[] {
  return ACHIEVEMENTS.map(({ id, metric, target }) => {
    const value = Math.min(facts[metric], target);
    return { id, metric, value, target, done: value >= target, share: value / target };
  });
}
