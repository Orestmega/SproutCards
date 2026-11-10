/**
 * The cheat panel (for testing): bonuses added on top of the real numbers, so rewards, achievements and
 * decorations can be tried out. The real progress (schedules, review log) is never changed.
 */

export interface Cheats {
  learned: number;
  streak: number;
  golden: number;
  reviews: number;
  challenges: number;
  decks: number;
  modes: number;
}

export const NO_CHEATS: Cheats = {
  learned: 0,
  streak: 0,
  golden: 0,
  reviews: 0,
  challenges: 0,
  decks: 0,
  modes: 0,
};

/** Enough of everything to open every flower, achievement and decoration. */
export const ALL_CHEATS: Cheats = {
  learned: 500,
  streak: 100,
  golden: 50,
  reviews: 2000,
  challenges: 52,
  decks: 3,
  modes: 4,
};

export function cheatsOf(value: Partial<Cheats> | null | undefined): Cheats {
  const clean = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return {
    learned: clean(value?.learned),
    streak: clean(value?.streak),
    golden: clean(value?.golden),
    reviews: clean(value?.reviews),
    challenges: clean(value?.challenges),
    decks: clean(value?.decks),
    modes: clean(value?.modes),
  };
}

export function hasCheats(value: Partial<Cheats> | null | undefined): boolean {
  return Object.values(cheatsOf(value)).some((n) => n > 0);
}
