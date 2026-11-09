/**
 * The user's local profile: a gardener rank earned with learned words, and a few facts worked out from
 * what is stored (since when, on how many days, which languages). No account: it all stays on the device.
 */

/** Ids are translation keys (`rank.<id>`); `at` is the number of flowers (learned words) needed. */
export const RANKS = [
  { id: 'seedling', at: 0 },
  { id: 'gardener', at: 5 },
  { id: 'grower', at: 25 },
  { id: 'florist', at: 75 },
  { id: 'master', at: 200 },
  { id: 'botanist', at: 500 },
] as const;

export type RankId = (typeof RANKS)[number]['id'];

export interface RankState {
  id: RankId;
  /** The next rank and the flowers it needs, or null at the top. */
  next: { id: RankId; at: number } | null;
  /** 0..1 of the way from this rank to the next (1 at the top). */
  share: number;
}

export function gardenRank(blooms: number): RankState {
  let index = 0;
  RANKS.forEach((rank, i) => {
    if (blooms >= rank.at) index = i;
  });
  const current = RANKS[index] ?? RANKS[0];
  const next = RANKS[index + 1];
  if (!next) return { id: current.id, next: null, share: 1 };
  return {
    id: current.id,
    next: { id: next.id, at: next.at },
    share: (blooms - current.at) / (next.at - current.at),
  };
}

function dayKey(time: number): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** On how many different days anything was answered. */
export function activeDays(reviewTimes: readonly number[]): number {
  return new Set(reviewTimes.map(dayKey)).size;
}

/** The earliest moment the user did something: made a deck or answered; null when nothing exists. */
export function memberSince(
  reviewTimes: readonly number[],
  deckCreatedTimes: readonly number[],
): number | null {
  let first = Infinity;
  for (const t of reviewTimes) first = Math.min(first, t);
  for (const t of deckCreatedTimes) first = Math.min(first, t);
  return Number.isFinite(first) ? first : null;
}

/** The languages being learned, without repeats, in the order they first appear. */
export function learnedLanguages(decks: readonly { learningLang: string }[]): string[] {
  return [...new Set(decks.map((d) => d.learningLang))];
}

/** Longest name a profile accepts (a name is shown in small places too). */
export const MAX_NAME = 30;

/** Trims the name and cuts it to `MAX_NAME` whole characters. */
export function cleanName(name: string): string {
  return Array.from(name.trim().replace(/\s+/g, ' ')).slice(0, MAX_NAME).join('');
}
