import { createFixedIntervalScheduler, DEFAULT_INTERVALS, startOfDayPlus } from './scheduler';
import type { ScheduleState } from './types';

const NOW = new Date(2026, 5, 10, 15, 30).getTime(); // 10 June 2026, afternoon, local time

function daysBetween(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

describe('fixed interval scheduler', () => {
  const scheduler = createFixedIntervalScheduler();

  it('schedules a first success one day ahead, at the start of that day', () => {
    const s = scheduler.review(undefined, 'correct', NOW);
    expect(s).toMatchObject({ reps: 1, intervalDays: 1, lapses: 0 });
    expect(daysBetween(NOW, s.dueAt)).toBe(1);
    expect(new Date(s.dueAt).getHours()).toBe(0);
  });

  it('walks through 1, 3, 7, 14, 30 and then stays at 30', () => {
    let state: ScheduleState | undefined;
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      state = scheduler.review(state, 'correct', NOW);
      seen.push(state.intervalDays);
    }
    expect(seen).toEqual([1, 3, 7, 14, 30, 30, 30]);
  });

  it('resets to the first interval after a mistake and counts the lapse', () => {
    let state = scheduler.review(undefined, 'correct', NOW);
    state = scheduler.review(state, 'correct', NOW);
    state = scheduler.review(state, 'wrong', NOW);
    expect(state).toMatchObject({ reps: 0, intervalDays: 1, lapses: 1 });
    expect(daysBetween(NOW, state.dueAt)).toBe(1);
    const next = scheduler.review(state, 'correct', NOW);
    expect(next).toMatchObject({ reps: 1, intervalDays: 1, lapses: 1 });
  });

  it('a card that is new and answered wrong is also scheduled for the first interval', () => {
    expect(scheduler.review(undefined, 'wrong', NOW)).toMatchObject({ reps: 0, lapses: 1 });
  });

  it('does not change the input state', () => {
    const before = scheduler.review(undefined, 'correct', NOW);
    const copy = { ...before };
    scheduler.review(before, 'correct', NOW);
    expect(before).toEqual(copy);
  });

  it('accepts custom intervals', () => {
    const custom = createFixedIntervalScheduler({ intervalsDays: [2, 5] });
    const a = custom.review(undefined, 'correct', NOW);
    const b = custom.review(a, 'correct', NOW);
    const c = custom.review(b, 'correct', NOW);
    expect([a.intervalDays, b.intervalDays, c.intervalDays]).toEqual([2, 5, 5]);
  });

  it('rejects an invalid configuration', () => {
    expect(() => createFixedIntervalScheduler({ intervalsDays: [] })).toThrow();
    expect(() => createFixedIntervalScheduler({ intervalsDays: [1, 0] })).toThrow();
    expect(DEFAULT_INTERVALS.intervalsDays).toEqual([1, 3, 7, 14, 30]);
  });
});

describe('startOfDayPlus', () => {
  it('moves by calendar days across a month end', () => {
    const end = new Date(2026, 0, 31, 23, 59).getTime();
    const d = new Date(startOfDayPlus(end, 1));
    expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([1, 1, 0]);
  });
});
