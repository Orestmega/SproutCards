import {
  bestStreak,
  heatmapWeeks,
  pickOfTheDay,
  reviewForecast,
  todayCount,
  weekDays,
} from './habit';

/** Local time, so the tests do not depend on the time zone. Wednesday, 2026-03-11. */
const NOW = new Date(2026, 2, 11, 15, 0).getTime();
const day = (offset: number, hour = 10) => new Date(2026, 2, 11 + offset, hour).getTime();

describe('todayCount', () => {
  it('counts only the local calendar day', () => {
    expect(todayCount([day(0), day(0, 1), day(-1, 23)], NOW)).toBe(2);
  });
});

describe('weekDays', () => {
  it('is Monday to Sunday with today and the future marked', () => {
    const week = weekDays([day(-2), day(-2), day(0)], NOW);
    expect(week).toHaveLength(7);
    expect(new Date(week[0]?.dayStart ?? 0).getDay()).toBe(1);
    expect(new Date(week[6]?.dayStart ?? 0).getDay()).toBe(0);
    expect(week.map((d) => d.count)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(week.findIndex((d) => d.today)).toBe(2);
    expect(week.filter((d) => d.future)).toHaveLength(4);
  });

  it('a Sunday is the end of its week, not the start of the next', () => {
    const sunday = new Date(2026, 2, 15, 12).getTime();
    expect(weekDays([], sunday)[6]?.today).toBe(true);
  });
});

describe('bestStreak', () => {
  it('finds the longest run, even when it is over', () => {
    expect(bestStreak([])).toBe(0);
    expect(bestStreak([day(-20)])).toBe(1);
    expect(bestStreak([day(-20), day(-19), day(-18), day(-5), day(-4), day(0)])).toBe(3);
  });

  it('several answers on one day count once', () => {
    expect(bestStreak([day(0), day(0, 12), day(0, 20)])).toBe(1);
  });
});

describe('heatmapWeeks', () => {
  it('gives whole weeks ending with the current one, with levels', () => {
    const times = [day(-7), ...Array.from({ length: 8 }, () => day(0))];
    const weeks = heatmapWeeks(times, NOW, 3);
    expect(weeks).toHaveLength(3);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const current = weeks[2] ?? [];
    expect(current[2]).toMatchObject({ count: 8, level: 4, future: false });
    expect(current[3]).toMatchObject({ count: 0, level: 0, future: true });
    expect(weeks[1]?.[2]).toMatchObject({ count: 1, level: 1 });
  });

  it('works with no answers at all', () => {
    const days = heatmapWeeks([], NOW, 2).flat();
    expect(days.every((d) => d.level === 0)).toBe(true);
  });
});

describe('reviewForecast', () => {
  it('counts overdue cards for today and ignores what is further away', () => {
    const forecast = reviewForecast([day(-3), day(0), day(1), day(1), day(9)], NOW, 3);
    expect(forecast.map((d) => d.count)).toEqual([2, 2, 0]);
  });
});

describe('pickOfTheDay', () => {
  it('stays the same during a day and changes the next day', () => {
    const items = ['a', 'b', 'c'];
    expect(pickOfTheDay(items, day(0, 1))).toBe(pickOfTheDay(items, day(0, 23)));
    expect(pickOfTheDay(items, day(0))).not.toBe(pickOfTheDay(items, day(1)));
    expect(pickOfTheDay([], NOW)).toBeUndefined();
  });
});
