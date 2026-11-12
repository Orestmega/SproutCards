import { countDue, selectSessionCards, sessionCards, sessionSizeOf } from './selection';
import { makeCard } from './testUtils';
import type { Progress } from './types';
import { progressId } from './types';

const NOW = 1_000_000;

function prog(
  cardId: string,
  dueAt: number,
  direction: 'forward' | 'backward' = 'forward',
): Progress {
  return {
    id: progressId(cardId, direction),
    cardId,
    deckId: 'd1',
    direction,
    reps: 1,
    intervalDays: 1,
    dueAt,
    lapses: 0,
    lastReviewedAt: 0,
  };
}

describe('selectSessionCards', () => {
  const a = makeCard('a', 'а', { id: 'a' });
  const b = makeCard('b', 'б', { id: 'b' });
  const c = makeCard('c', 'в', { id: 'c' });
  const d = makeCard('d', 'г', { id: 'd' });

  it('returns due cards, most overdue first, and every new one (no daily limit)', () => {
    const progress = [prog('a', NOW - 10), prog('b', NOW - 500), prog('c', NOW + 999)];
    const r = selectSessionCards(
      [a, b, c, d, makeCard('e', 'д', { id: 'e' })],
      progress,
      'forward',
      NOW,
    );
    expect(r.due.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.fresh.map((x) => x.id)).toEqual(['d', 'e']);
  });

  it('treats directions independently', () => {
    const progress = [prog('a', NOW - 1, 'forward')];
    expect(selectSessionCards([a], progress, 'backward', NOW).fresh).toHaveLength(1);
    expect(selectSessionCards([a], progress, 'forward', NOW).due).toHaveLength(1);
  });

  it('handles an empty deck', () => {
    expect(selectSessionCards([], [], 'forward', NOW)).toEqual({ due: [], fresh: [] });
  });

  it('counts cards due exactly now as due', () => {
    expect(selectSessionCards([a], [prog('a', NOW)], 'forward', NOW).due).toHaveLength(1);
  });
});

describe('countDue', () => {
  it('counts only records that are due', () => {
    expect(countDue([prog('a', NOW - 1), prog('b', NOW), prog('c', NOW + 1)], NOW)).toBe(2);
  });
});

describe('sessionSizeOf', () => {
  it('keeps a size one can choose, else the default 20', () => {
    expect(sessionSizeOf(10)).toBe(10);
    expect(sessionSizeOf(50)).toBe(50);
    expect(sessionSizeOf(7)).toBe(20);
    expect(sessionSizeOf(undefined)).toBe(20);
    expect(sessionSizeOf('10')).toBe(20);
  });
});

describe('sessionCards', () => {
  it('puts due cards first and caps the session size', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => makeCard(id, id, { id }));
    const selection = { due: cards.slice(0, 2), fresh: cards.slice(2) };
    expect(sessionCards(selection).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(sessionCards(selection, 3).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
