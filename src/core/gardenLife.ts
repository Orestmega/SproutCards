/**
 * What makes the garden alive: which flower a learned word becomes, whether the garden is fresh or
 * thirsty, which decorations the user has earned and whether today's watering is ready. Everything is
 * worked out from stored progress and reviews (nothing extra is saved), so it can never be lost.
 */
import type { AchievementId, AchievementState } from './achievements';

export type Rarity = 'common' | 'rare' | 'golden';

export interface Variety {
  id: string;
  rarity: Rarity;
}

/** Ids are translation keys (`flower.<id>`); the drawing is in `ui/components/Plant.tsx`. */
export const VARIETIES = [
  { id: 'daisy', rarity: 'common' },
  { id: 'tulip', rarity: 'common' },
  { id: 'bellflower', rarity: 'common' },
  { id: 'poppy', rarity: 'common' },
  { id: 'lavender', rarity: 'common' },
  { id: 'cornflower', rarity: 'common' },
  { id: 'sunflower', rarity: 'rare' },
  { id: 'rose', rarity: 'rare' },
  { id: 'golden', rarity: 'golden' },
] as const satisfies readonly Variety[];

export type VarietyId = (typeof VARIETIES)[number]['id'];

/** Correct reviews in a row after which a word turns into a golden flower: remembered for months. */
export const GOLDEN_REPS = 6;
/** Out of 100: how many learned words become a rare flower. */
const RARE_CHANCE = 10;

/** A small stable hash: the same word always gets the same flower, on every device. */
function hash(text: string): number {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** The flower of a learned word. */
export function flowerVariety(cardId: string, reps: number): VarietyId {
  if (reps >= GOLDEN_REPS) return 'golden';
  const h = hash(cardId);
  const rare: VarietyId[] = ['sunflower', 'rose'];
  const common: VarietyId[] = ['daisy', 'tulip', 'bellflower', 'poppy', 'lavender', 'cornflower'];
  if (h % 100 < RARE_CHANCE) return rare[(h >>> 11) % rare.length] ?? 'sunflower';
  return common[(h >>> 7) % common.length] ?? 'daisy';
}

export function rarityOf(id: VarietyId): Rarity {
  return VARIETIES.find((v) => v.id === id)?.rarity ?? 'common';
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
