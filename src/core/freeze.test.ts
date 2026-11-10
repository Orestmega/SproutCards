import { MAX_FREEZES, streakState } from './freeze';

/** 10:00 on day `n` of March 2026, local time. */
const day = (n: number, hour = 10) => new Date(2026, 2, n, hour).getTime();

describe('streakState', () => {
  it('without freezes a missed day breaks the run', () => {
    const state = streakState([day(1), day(2), day(4), day(5)], [], day(5, 20));
    expect(state).toMatchObject({ current: 2, best: 2, freezes: 0, frozenDays: [] });
  });

  it('a freeze earned before the missed day saves it; the frozen day does not add to the run', () => {
    // the weekly goal was reached on day 2, day 3 is missed
    const state = streakState([day(1), day(2), day(4), day(5)], [day(2, 18)], day(5, 20));
    expect(state.current).toBe(4);
    expect(state.best).toBe(4);
    expect(state.freezes).toBe(0);
    expect(state.frozenDays).toEqual([new Date(2026, 2, 3).getTime()]);
  });

  it('today without answers yet loses nothing', () => {
    expect(streakState([day(1), day(2)], [], day(3, 9)).current).toBe(2);
  });

  it('keeps at most two freezes and counts the ones earned today', () => {
    const earned = [day(1, 11), day(1, 12), day(1, 13)];
    expect(streakState([day(1)], earned, day(1, 20)).freezes).toBe(MAX_FREEZES);
    expect(streakState([], [day(1, 11)], day(1, 20)).freezes).toBe(1);
  });

  it('two missed days need two freezes', () => {
    const one = streakState([day(1), day(4)], [day(1, 18)], day(4, 20));
    expect(one.current).toBe(1); // only one freeze: the second missed day breaks it
    const two = streakState([day(1), day(4)], [day(1, 18), day(1, 19)], day(4, 20));
    expect(two.current).toBe(2);
    expect(two.frozenDays).toHaveLength(2);
  });
});
