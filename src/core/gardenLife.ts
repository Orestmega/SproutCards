/**
 * What makes the garden alive: which flower a learned word becomes, whether the garden is fresh or
 * thirsty, which decorations the user has earned and whether today's watering is ready. Everything is
 * worked out from stored progress and reviews (nothing extra is saved), so it can never be lost.
 */
import type { AchievementId, AchievementState } from './achievements';

export type Rarity = 'common' | 'rare' | 'golden' | 'weekly';

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
  { id: 'marigold', rarity: 'common' },
  { id: 'violet', rarity: 'common' },
  { id: 'daffodil', rarity: 'common' },
  { id: 'forgetmenot', rarity: 'common' },
  { id: 'peony', rarity: 'common' },
  { id: 'iris', rarity: 'common' },
  { id: 'hyacinth', rarity: 'common' },
  { id: 'crocus', rarity: 'common' },
  { id: 'carnation', rarity: 'common' },
  { id: 'cosmos', rarity: 'common' },
  { id: 'sunflower', rarity: 'rare' },
  { id: 'rose', rarity: 'rare' },
  { id: 'orchid', rarity: 'rare' },
  { id: 'lily', rarity: 'rare' },
  { id: 'lotus', rarity: 'rare' },
  { id: 'sakura', rarity: 'rare' },
  { id: 'golden', rarity: 'golden' },
  // flowers of the week: only the weekly chest gives them (all three of a week finished)
  { id: 'edelweiss', rarity: 'weekly' },
  { id: 'gerbera', rarity: 'weekly' },
  { id: 'magnolia', rarity: 'weekly' },
  { id: 'snowdrop', rarity: 'weekly' },
] as const satisfies readonly Variety[];

export type VarietyId = (typeof VARIETIES)[number]['id'];

/** Correct reviews in a row after which a word counts as known for long ("golden"). */
export const GOLDEN_REPS = 5;

export interface RewardFacts {
  /**
   * Learned words: answered cleanly in a session at least once (a leaf or a flower on the beds). Counted
   * from the first success, so studying shows at once, not only after the next day's review.
   */
  blooms: number;
  bestStreak: number;
  /** Words with at least `GOLDEN_REPS` right answers in a row. */
  goldenWords: number;
  /** Weekly goals and challenges finished, over all weeks (see `weekly.ts`). */
  challenges: number;
  /** Weeks with all three finished: each one opens the week's chest. */
  fullWeeks: number;
}

export type GoalKind = 'blooms' | 'streak' | 'golden' | 'challenges' | 'weeks';

export interface Reward {
  /** Stable id, e.g. `blooms-20`: a plot remembers which reward grows on it. */
  id: string;
  variety: VarietyId;
  goal: { kind: GoalKind; at: number };
}

/** Learned words, days in a row, long-known words: each step of these earns one flower. */
const STEPS: Record<GoalKind, number[]> = {
  blooms: [
    1, 3, 5, 8, 12, 16, 20, 25, 30, 40, 50, 60, 75, 90, 110, 130, 150, 175, 200, 250, 300, 400, 500,
  ],
  streak: [3, 7, 14, 21, 30, 45, 60, 100],
  golden: [1, 5, 10, 25, 50],
  // every one finished is a flower (as the week card promises)
  challenges: Array.from({ length: 52 }, (_, i) => i + 1),
  weeks: Array.from({ length: 52 }, (_, i) => i + 1),
};

const COMMON = VARIETIES.filter((v) => v.rarity === 'common').map((v) => v.id);
const RARE = VARIETIES.filter((v) => v.rarity === 'rare').map((v) => v.id);
const WEEKLY = VARIETIES.filter((v) => v.rarity === 'weekly').map((v) => v.id);

/**
 * Every flower that can be earned: one per step of a goal. Learned words give the common kinds in turn,
 * days in a row the rare ones, long-known words golden flowers. Each reward is one flower: it can grow on
 * one plot.
 */
export const REWARDS: readonly Reward[] = (Object.keys(STEPS) as GoalKind[]).flatMap((kind) =>
  STEPS[kind].map((at, i): Reward => {
    // learned words give the common kinds in turn, days in a row and weekly challenges the rare ones
    // (from opposite ends, so both bring something new), long-known words golden flowers
    const pool =
      kind === 'blooms'
        ? COMMON
        : kind === 'streak'
          ? RARE
          : kind === 'challenges'
            ? [...RARE].reverse()
            : kind === 'weeks'
              ? WEEKLY
              : ['golden' as const];
    return { id: `${kind}-${at}`, variety: pool[i % pool.length] as VarietyId, goal: { kind, at } };
  }),
);

/** The flower of the week that the chest of the `n`-th full week gives (1 = the first full week). */
export function weekFlower(n: number): VarietyId {
  return WEEKLY[(Math.max(1, n) - 1) % WEEKLY.length] as VarietyId;
}

function factOf(kind: GoalKind, facts: RewardFacts): number {
  if (kind === 'blooms') return facts.blooms;
  if (kind === 'streak') return facts.bestStreak;
  if (kind === 'challenges') return facts.challenges;
  if (kind === 'weeks') return facts.fullWeeks;
  return facts.goldenWords;
}

export function isEarned(reward: Reward, facts: RewardFacts): boolean {
  return factOf(reward.goal.kind, facts) >= reward.goal.at;
}

/** The flowers earned so far, in the order of `REWARDS`. */
export function earnedRewards(facts: RewardFacts): Reward[] {
  return REWARDS.filter((r) => isEarned(r, facts));
}

/** The next flower of each goal (what to aim for), the closest first; empty when all are earned. */
export function nextRewards(facts: RewardFacts): { reward: Reward; left: number }[] {
  return (Object.keys(STEPS) as GoalKind[])
    .flatMap((kind) => {
      const reward = REWARDS.find((r) => r.goal.kind === kind && !isEarned(r, facts));
      return reward ? [{ reward, left: reward.goal.at - factOf(kind, facts) }] : [];
    })
    .sort((x, y) => x.left / x.reward.goal.at - y.left / y.reward.goal.at);
}

/** The kinds found so far (at least one flower of the kind earned), in the order of `VARIETIES`. */
export function foundKinds(earned: readonly Reward[]): VarietyId[] {
  const kinds = new Set(earned.map((r) => r.variety));
  return VARIETIES.map((v) => v.id).filter((id) => kinds.has(id));
}

/** The first reward of a kind: how to find a kind not found yet. */
export function firstRewardOf(variety: VarietyId): Reward | undefined {
  return REWARDS.find((r) => r.variety === variety);
}

export function rarityOf(id: VarietyId): Rarity {
  return VARIETIES.find((v) => v.id === id)?.rarity ?? 'common';
}

/** How many plots the garden picture has. */
export const PLOT_COUNT = 15;

/**
 * What grows on each plot: an earned flower (a reward), or nothing. Each earned flower grows on one plot
 * at most, so the garden holds exactly what was earned. Until the user plants anything (`saved` is
 * null, or holds only unknown ids), the earned flowers stand on the plots in order.
 */
export function gardenPlotsOf(
  saved: readonly (string | null)[] | null,
  earned: readonly Reward[],
): (Reward | null)[] {
  const byId = new Map(earned.map((r) => [r.id, r]));
  // an older format (kind names) or ids that no longer exist: start again from the earned flowers;
  // plots the user emptied (all null) stay empty
  const filled = saved?.filter((id) => id !== null) ?? [];
  const usable = saved !== null && (filled.length === 0 || filled.some((id) => byId.has(id)));
  if (!usable) return Array.from({ length: PLOT_COUNT }, (_, i) => earned[i] ?? null);
  const used = new Set<string>();
  return Array.from({ length: PLOT_COUNT }, (_, i) => {
    const id = saved?.[i] ?? null;
    const reward = id ? byId.get(id) : undefined;
    if (!reward || used.has(reward.id)) return null;
    used.add(reward.id);
    return reward;
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

/**
 * How the garden looks, from the last watering (reach the day's goal, then water): watered today it is
 * fresh, yesterday it is thirsty, earlier or never it wilts. Studying alone does not water it. Only a
 * picture: no word ever loses its progress. `studied`: there were answers at all (else a new garden).
 */
export function gardenHealth(
  lastWateredDay: number | null,
  studied: boolean,
  now: number,
): GardenHealth {
  if (lastWateredDay === null) return studied ? 'wilted' : 'new';
  const daysAgo = dayNumber(now) - lastWateredDay;
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

/**
 * The decorations that stand in the garden: every earned one, except those the user put away. Unknown ids
 * in the saved list (from an older version) are ignored.
 */
export function shownDecorations(
  list: readonly DecorationState[],
  hidden: readonly string[] | null | undefined,
): DecorationId[] {
  const away = new Set(hidden ?? []);
  return list.filter((d) => d.earned && !away.has(d.id)).map((d) => d.id);
}

/** The saved list of put-away decorations after showing or hiding one. */
export function toggleDecoration(
  hidden: readonly string[] | null | undefined,
  id: DecorationId,
  show: boolean,
): string[] {
  const rest = (hidden ?? []).filter((x) => x !== id);
  return show ? rest : [...rest, id];
}
