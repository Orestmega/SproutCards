import type { ScheduleState } from './types';

/**
 * Decides when a card is due next. The rest of the app only knows this interface, so the fixed
 * intervals below can later be replaced by SM-2 or FSRS without touching anything else.
 */
export interface Scheduler {
  /**
   * @param previous state before this review (undefined for a card never reviewed in this direction)
   * @param result `correct` advances the card, `wrong` resets it
   * @param now timestamp of the review, ms
   */
  review(
    previous: ScheduleState | undefined,
    result: 'correct' | 'wrong',
    now: number,
  ): ScheduleState;
}

export interface FixedIntervalConfig {
  /** Days until the next review after the 1st, 2nd, 3rd... success in a row. The last value repeats. */
  intervalsDays: readonly number[];
}

export const DEFAULT_INTERVALS: FixedIntervalConfig = { intervalsDays: [1, 3, 7, 14, 30] };

/** Start of the local day `days` days after the day containing `now`. */
export function startOfDayPlus(now: number, days: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function createFixedIntervalScheduler(
  config: FixedIntervalConfig = DEFAULT_INTERVALS,
): Scheduler {
  const intervals = config.intervalsDays;
  if (intervals.length === 0 || intervals.some((n) => !(n > 0))) {
    throw new Error('intervalsDays must be a non-empty list of positive numbers');
  }
  const first = intervals[0] as number;
  const last = intervals[intervals.length - 1] as number;

  return {
    review(previous, result, now) {
      const lapses = previous?.lapses ?? 0;
      if (result === 'wrong') {
        // A mistake sends the card back to the first interval.
        return {
          reps: 0,
          intervalDays: first,
          dueAt: startOfDayPlus(now, first),
          lapses: lapses + 1,
        };
      }
      const reps = (previous?.reps ?? 0) + 1;
      const intervalDays = intervals[reps - 1] ?? last;
      return { reps, intervalDays, dueAt: startOfDayPlus(now, intervalDays), lapses };
    },
  };
}
