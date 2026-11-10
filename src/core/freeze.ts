/**
 * Streak freezes: each weekly goal reached earns one (at most `MAX_FREEZES` kept). A day without answers
 * then uses one up instead of breaking the run of days in a row. A frozen day keeps the streak alive but
 * does not add to it. Everything is worked out from the answer times, so it is the same on every visit.
 */

export const MAX_FREEZES = 2;

const DAY = 86_400_000;

function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The start of the next local day (safe around daylight saving changes). */
function nextDay(dayStart: number): number {
  return startOfDay(dayStart + DAY + 3 * 3_600_000);
}

export interface StreakState {
  /** Days in a row up to today (or yesterday, if today has no answers yet). */
  current: number;
  /** The longest run ever. */
  best: number;
  /** Freezes left to use. */
  freezes: number;
  /** Starts of the days that a freeze saved. */
  frozenDays: number[];
}

export function streakState(
  answerTimes: readonly number[],
  freezeEarnedAt: readonly number[],
  now: number,
): StreakState {
  if (answerTimes.length === 0) {
    const freezes = Math.min(MAX_FREEZES, freezeEarnedAt.filter((t) => t <= now).length);
    return { current: 0, best: 0, freezes, frozenDays: [] };
  }
  const days = new Set(answerTimes.map(startOfDay));
  const earned = [...freezeEarnedAt].sort((a, b) => a - b);
  const today = startOfDay(now);
  let first = Infinity;
  for (const t of answerTimes) first = Math.min(first, t);
  let next = 0; // the next freeze in `earned` not yet added
  let freezes = 0;
  let run = 0;
  let best = 0;
  const frozenDays: number[] = [];
  for (let day = startOfDay(first); day <= today; day = nextDay(day)) {
    // freezes earned before this day can save it
    while (next < earned.length && (earned[next] as number) < day) {
      freezes = Math.min(MAX_FREEZES, freezes + 1);
      next++;
    }
    if (days.has(day)) {
      run++;
      best = Math.max(best, run);
    } else if (day === today) {
      // today is not over yet: nothing is lost
    } else if (freezes > 0) {
      freezes--;
      frozenDays.push(day);
    } else {
      run = 0;
    }
  }
  // freezes earned today count as well
  while (next < earned.length && (earned[next] as number) <= now) {
    freezes = Math.min(MAX_FREEZES, freezes + 1);
    next++;
  }
  return { current: run, best, freezes, frozenDays };
}
