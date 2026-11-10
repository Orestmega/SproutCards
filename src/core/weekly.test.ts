import { finishedChallenges, weekChallenges, weekStart, weekState } from './weekly';

/** Wednesday 2026-03-11, 15:00 local time. */
const NOW = new Date(2026, 2, 11, 15).getTime();
const at = (dayOffset: number, hour = 10) => new Date(2026, 2, 11 + dayOffset, hour).getTime();
const log = (time: number, result = 'correct', mode = 'learn') => ({ at: time, result, mode });

describe('weekStart', () => {
  it('is Monday at midnight', () => {
    const start = new Date(weekStart(NOW));
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(9);
    expect(start.getHours()).toBe(0);
    expect(weekStart(new Date(2026, 2, 15, 23).getTime())).toBe(weekStart(NOW)); // Sunday
  });
});

describe('weekChallenges', () => {
  it('two different kinds, the same all week, other ones on other weeks', () => {
    const these = weekChallenges(weekStart(NOW));
    expect(these).toHaveLength(2);
    expect(these[0]?.kind).not.toBe(these[1]?.kind);
    expect(weekChallenges(weekStart(at(4)))).toEqual(these);
    const later = Array.from({ length: 6 }, (_, w) => weekChallenges(weekStart(at(7 * w))));
    expect(new Set(later.map((c) => JSON.stringify(c))).size).toBeGreaterThan(1);
  });
});

describe('weekState', () => {
  it('the weekly goal is five days of the daily goal; progress counts this week only', () => {
    const logs = [log(at(-1)), log(at(0)), log(at(0), 'wrong', 'flip'), log(at(-7))];
    const week = weekState(logs, [at(0)], NOW, 2);
    expect(week.items).toHaveLength(3);
    expect(week.items[0]).toMatchObject({
      goal: true,
      challenge: { kind: 'answers', target: 10 },
      value: 3,
      done: false,
    });
  });

  it('measures every kind of challenge', () => {
    const logs = [log(at(-2)), log(at(-1), 'wrong', 'flip'), log(at(0), 'correct', 'test')];
    const value = (kind: string) => {
      // look for a week whose challenges include this kind (weeks shift everything by 7 days)
      for (let w = 0; w < 60; w++) {
        const shift = (t: number) => t + 7 * w * 86_400_000;
        const week = weekState(
          logs.map((l) => ({ ...l, at: shift(l.at) })),
          [shift(at(0)), shift(at(-1))],
          shift(NOW),
          20,
        );
        const item = week.items.find((i) => !i.goal && i.challenge.kind === kind);
        if (item) return item.value;
      }
      throw new Error(`no week with ${kind}`);
    };
    expect(value('days')).toBe(3);
    expect(value('correct')).toBe(2);
    expect(value('modes')).toBe(3);
    expect(value('newWords')).toBe(2);
  });
});

describe('finishedChallenges', () => {
  it('counts what was finished in every week so far', () => {
    expect(finishedChallenges([], [], NOW, 1)).toBe(0);
    // a daily goal of 1: five answers make the weekly goal, in this week and the one before
    const logs = [
      ...[1, 2, 3, 4, 5].map((h) => log(at(-7, h))),
      ...[1, 2, 3, 4, 5].map((h) => log(at(0, h))),
    ];
    expect(finishedChallenges(logs, [], NOW, 1)).toBeGreaterThanOrEqual(2);
  });
});
