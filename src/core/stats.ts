/** Local calendar day as `YYYY-M-D` (no zero padding; only used as a set key). */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Number of consecutive days with at least one review, counted back from today.
 * If nothing was reviewed today yet, the streak still counts up to yesterday (the day is not over),
 * so it only drops to 0 after a whole day was missed.
 * @param reviewTimes timestamps (ms) of review log entries
 */
export function computeStreak(reviewTimes: readonly number[], now: number): number {
  const days = new Set(reviewTimes.map((t) => dayKey(new Date(t))));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0); // noon: stepping by whole days stays safe around DST changes
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface DayCount {
  /** Start of the local day (ms). */
  dayStart: number;
  count: number;
}

/**
 * Reviews per local day for the last `days` days, oldest first, today last. Days without reviews
 * are included with 0 so a chart has no gaps.
 */
export function dailyCounts(reviewTimes: readonly number[], now: number, days: number): DayCount[] {
  const counts = new Map<string, number>();
  for (const t of reviewTimes) {
    const key = dayKey(new Date(t));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const result: DayCount[] = [];
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    result.push({ dayStart: start.getTime(), count: counts.get(dayKey(cursor)) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

/** Share of answers that were fully correct, 0..1; `null` when there are no answers. */
export function accuracy(results: readonly string[]): number | null {
  if (results.length === 0) return null;
  return results.filter((r) => r === 'correct').length / results.length;
}

/** A card counts as learned after this many correct reviews in a row in some direction (interval >= 7 days). */
export const LEARNED_REPS = 3;

export interface StageCounts {
  learned: number;
  /** Studied at least once, not learned yet. */
  learning: number;
  /** Never studied. */
  fresh: number;
}

/**
 * Where the cards of a deck are in learning. `progress` holds one row per card and direction; the
 * best direction decides, so a card learned only one way still counts as learned.
 */
export function stageCounts(
  cardIds: readonly string[],
  progress: readonly { cardId: string; reps: number }[],
): StageCounts {
  const bestReps = new Map<string, number>();
  for (const p of progress) bestReps.set(p.cardId, Math.max(bestReps.get(p.cardId) ?? 0, p.reps));
  const counts: StageCounts = { learned: 0, learning: 0, fresh: 0 };
  for (const id of cardIds) {
    const reps = bestReps.get(id);
    if (reps === undefined) counts.fresh++;
    else if (reps >= LEARNED_REPS) counts.learned++;
    else counts.learning++;
  }
  return counts;
}
