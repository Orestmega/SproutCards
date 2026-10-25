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
