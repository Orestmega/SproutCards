/**
 * Daily habit numbers, all worked out from review times: today's goal, the week strip, the longest
 * streak, the activity heatmap, the forecast of coming reviews. Nothing extra is stored.
 */

/** The choices offered for the daily goal (answers per day). */
export const GOAL_OPTIONS = [10, 20, 40, 80] as const;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Noon of a local day: stepping by whole days from here stays safe around DST changes. */
function noon(time: number): Date {
  const date = new Date(time);
  date.setHours(12, 0, 0, 0);
  return date;
}

function startOfDay(date: Date): number {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function countsByDay(times: readonly number[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of times) {
    const key = dayKey(new Date(t));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Answers given today. */
export function todayCount(times: readonly number[], now: number): number {
  const key = dayKey(new Date(now));
  return times.filter((t) => dayKey(new Date(t)) === key).length;
}

export interface WeekDay {
  dayStart: number;
  count: number;
  today: boolean;
  future: boolean;
}

/** The current week, Monday to Sunday. */
export function weekDays(times: readonly number[], now: number): WeekDay[] {
  const counts = countsByDay(times);
  const cursor = noon(now);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // back to Monday
  const todayStart = startOfDay(new Date(now));
  return Array.from({ length: 7 }, () => {
    const dayStart = startOfDay(cursor);
    const count = counts.get(dayKey(cursor)) ?? 0;
    cursor.setDate(cursor.getDate() + 1);
    return { dayStart, count, today: dayStart === todayStart, future: dayStart > todayStart };
  });
}

/** The longest run of consecutive days with at least one answer, ever. */
export function bestStreak(times: readonly number[]): number {
  if (times.length === 0) return 0;
  const days = new Set(times.map((t) => dayKey(new Date(t))));
  let first = Infinity;
  let latest = -Infinity;
  for (const t of times) {
    first = Math.min(first, t);
    latest = Math.max(latest, t);
  }
  const cursor = noon(first);
  const last = startOfDay(new Date(latest));
  let best = 0;
  let run = 0;
  while (startOfDay(cursor) <= last) {
    run = days.has(dayKey(cursor)) ? run + 1 : 0;
    best = Math.max(best, run);
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
}

export interface HeatDay {
  dayStart: number;
  count: number;
  /** 0 = nothing, 1..4 = how much, relative to the busiest day. */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

/** Whole weeks (Monday first) ending with the current one, oldest first; each week has 7 days. */
export function heatmapWeeks(times: readonly number[], now: number, weeks: number): HeatDay[][] {
  const counts = countsByDay(times);
  const cursor = noon(now);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7) - (weeks - 1) * 7);
  const todayStart = startOfDay(new Date(now));
  const raw: { dayStart: number; count: number }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    raw.push({ dayStart: startOfDay(cursor), count: counts.get(dayKey(cursor)) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const peak = Math.max(1, ...raw.map((d) => d.count));
  const days = raw.map((d): HeatDay => {
    const level = d.count === 0 ? 0 : Math.ceil((d.count / peak) * 4);
    return { ...d, level: level as HeatDay['level'], future: d.dayStart > todayStart };
  });
  return Array.from({ length: weeks }, (_, w) => days.slice(w * 7, (w + 1) * 7));
}

export interface ForecastDay {
  dayStart: number;
  count: number;
}

/** Reviews due on each of the next `days` days, starting today; overdue cards count for today. */
export function reviewForecast(
  dueTimes: readonly number[],
  now: number,
  days: number,
): ForecastDay[] {
  const cursor = noon(now);
  const result: ForecastDay[] = [];
  for (let i = 0; i < days; i++) {
    result.push({ dayStart: startOfDay(cursor), count: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const end = startOfDay(cursor); // the first moment after the last day
  for (const due of dueTimes) {
    if (due >= end) continue;
    const index = result.findLastIndex((day) => day.dayStart <= due);
    const slot = result[Math.max(0, index)];
    if (slot) slot.count++;
  }
  return result;
}

/** The same item for the whole day, a new one tomorrow. */
export function pickOfTheDay<T>(items: readonly T[], now: number): T | undefined {
  if (items.length === 0) return undefined;
  const date = new Date(now);
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return items[dayNumber % items.length];
}
