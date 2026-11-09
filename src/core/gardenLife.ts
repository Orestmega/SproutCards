/**
 * What makes the garden alive: which flower a learned word becomes, whether the garden is fresh or
 * thirsty, which decorations the user has earned and whether today's watering is ready. Everything is
 * worked out from stored progress and reviews (nothing extra is saved), so it can never be lost.
 */
import type { AchievementId, AchievementState } from './achievements';

export type Rarity = 'common' | 'rare' | 'golden';

/** What opens a kind of flower: learned words (flowers), days in a row, or a word known for long. */
export interface Unlock {
  blooms?: number;
  streak?: number;
  /** A word answered right `GOLDEN_REPS` times in a row. */
  golden?: true;
}

export interface Variety {
  id: string;
  rarity: Rarity;
  unlock: Unlock;
}

/**
 * Ids are translation keys (`flower.<id>`); the drawing is in `ui/components/Plant.tsx`. The order is
 * the order in which they open: there is always a clear next goal.
 */
export const VARIETIES = [
  { id: 'daisy', rarity: 'common', unlock: {} },
  { id: 'tulip', rarity: 'common', unlock: { blooms: 2 } },
  { id: 'bellflower', rarity: 'common', unlock: { blooms: 4 } },
  { id: 'poppy', rarity: 'common', unlock: { blooms: 6 } },
  { id: 'lavender', rarity: 'common', unlock: { blooms: 9 } },
  { id: 'cornflower', rarity: 'common', unlock: { blooms: 12 } },
  { id: 'marigold', rarity: 'common', unlock: { blooms: 16 } },
  { id: 'violet', rarity: 'common', unlock: { blooms: 20 } },
  { id: 'daffodil', rarity: 'common', unlock: { blooms: 25 } },
  { id: 'forgetmenot', rarity: 'common', unlock: { blooms: 30 } },
  { id: 'sunflower', rarity: 'rare', unlock: { streak: 3 } },
  { id: 'rose', rarity: 'rare', unlock: { streak: 7 } },
  { id: 'orchid', rarity: 'rare', unlock: { blooms: 50 } },
  { id: 'lily', rarity: 'rare', unlock: { streak: 30 } },
  { id: 'golden', rarity: 'golden', unlock: { golden: true } },
] as const satisfies readonly Variety[];

export type VarietyId = (typeof VARIETIES)[number]['id'];

/** Correct reviews in a row after which a word can be a golden flower: remembered for months. */
export const GOLDEN_REPS = 5;

export interface UnlockFacts {
  blooms: number;
  bestStreak: number;
  /** Words with at least `GOLDEN_REPS` right answers in a row. */
  goldenWords: number;
}

export function isUnlocked(unlock: Unlock, facts: UnlockFacts): boolean {
  if (unlock.blooms !== undefined && facts.blooms < unlock.blooms) return false;
  if (unlock.streak !== undefined && facts.bestStreak < unlock.streak) return false;
  if (unlock.golden && facts.goldenWords === 0) return false;
  return true;
}

/** The kinds of flower the user can grow now, in the order of `VARIETIES`. */
export function unlockedVarieties(facts: UnlockFacts): VarietyId[] {
  return VARIETIES.filter((v) => isUnlocked(v.unlock, facts)).map((v) => v.id);
}

/** The closest kind still closed (the next goal), or null when all are open. */
export function nextVariety(facts: UnlockFacts): (typeof VARIETIES)[number] | null {
  return VARIETIES.find((v) => !isUnlocked(v.unlock, facts)) ?? null;
}

/** A small stable hash: the same word gets the same flower on every device. */
function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Only a word known for long can be golden. */
export function canGrowAs(variety: VarietyId, reps: number): boolean {
  return variety !== 'golden' || reps >= GOLDEN_REPS;
}

/**
 * How a learned word looks on its bed: a golden flower for a word known for long (once golden flowers
 * are open), else one of the open kinds, picked by a stable hash. The kinds themselves are rewards.
 */
export function flowerVariety(
  cardId: string,
  reps: number,
  unlocked: readonly VarietyId[],
): VarietyId {
  if (reps >= GOLDEN_REPS && unlocked.includes('golden')) return 'golden';
  const pool = unlocked.filter((id) => id !== 'golden');
  if (pool.length === 0) return 'daisy';
  return pool[hash(cardId) % pool.length] ?? 'daisy';
}

export function rarityOf(id: VarietyId): Rarity {
  return VARIETIES.find((v) => v.id === id)?.rarity ?? 'common';
}

/** How many plots the garden picture has. */
export const PLOT_COUNT = 15;

/**
 * What grows on each plot: a kind of flower the user has earned, or nothing. Flowers are rewards for
 * goals (see `VARIETIES`), not words: the same kind may grow on many plots. Until the user plants
 * anything (`saved` is null), each earned kind stands once. A kind that is not open (any more) leaves
 * its plot empty.
 */
export function gardenPlotsOf(
  saved: readonly (VarietyId | null)[] | null,
  unlocked: readonly VarietyId[],
): (VarietyId | null)[] {
  return Array.from({ length: PLOT_COUNT }, (_, i) => {
    const kind = saved ? (saved[i] ?? null) : (unlocked[i] ?? null);
    return kind && unlocked.includes(kind) ? kind : null;
  });
}

/**
 * How the garden feels: `fresh` when studied today, `thirsty` when the last study was yesterday,
 * `wilted` after two or more days without study, `new` when nothing was ever studied.
 * Wilting is only a picture: no word loses its progress.
 */
export type GardenHealth = 'new' | 'fresh' | 'thirsty' | 'wilted';

function dayNumber(time: number): number {
  const d = new Date(time);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export function gardenHealth(reviewTimes: readonly number[], now: number): GardenHealth {
  if (reviewTimes.length === 0) return 'new';
  let last = -Infinity;
  for (const t of reviewTimes) last = Math.max(last, t);
  const daysAgo = dayNumber(now) - dayNumber(last);
  if (daysAgo <= 0) return 'fresh';
  return daysAgo === 1 ? 'thirsty' : 'wilted';
}

/** The local calendar day as a stable key, for remembering that today's watering was done. */
export function wateringDay(now: number): number {
  return dayNumber(now);
}

export type WateringState = 'done' | 'ready' | 'notYet';

/** The garden can be watered once a day, when today's goal is reached. */
export function wateringState(
  answersToday: number,
  goal: number,
  lastWateredDay: number | null,
  now: number,
): WateringState {
  if (lastWateredDay === wateringDay(now)) return 'done';
  return answersToday >= goal ? 'ready' : 'notYet';
}

/** Decorations of the garden, each earned with an achievement. Ids are translation keys (`decor.<id>`). */
export const DECORATIONS = [
  { id: 'butterflies', achievement: 'streak3' },
  { id: 'birdhouse', achievement: 'streak7' },
  { id: 'fence', achievement: 'bloom25' },
  { id: 'pond', achievement: 'reviews500' },
  { id: 'tree', achievement: 'streak30' },
  { id: 'beehive', achievement: 'bloom100' },
  { id: 'rainbow', achievement: 'streak100' },
] as const satisfies readonly { id: string; achievement: AchievementId }[];

export type DecorationId = (typeof DECORATIONS)[number]['id'];

export interface DecorationState {
  id: DecorationId;
  achievement: AchievementId;
  earned: boolean;
}

export function decorations(achievements: readonly AchievementState[]): DecorationState[] {
  const done = new Set(achievements.filter((a) => a.done).map((a) => a.id));
  return DECORATIONS.map((d) => ({ ...d, earned: done.has(d.achievement) }));
}
