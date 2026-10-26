import { countDue, countNewSince, selectSessionCards, sessionCards } from './selection';
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

  it('returns due cards, most overdue first, and caps the new ones', () => {
    const progress = [prog('a', NOW - 10), prog('b', NOW - 500), prog('c', NOW + 999)];
    const r = selectSessionCards(
      [a, b, c, d, makeCard('e', 'д', { id: 'e' })],
      progress,
      'forward',
      NOW,
      1,
    );
    expect(r.due.map((x) => x.id)).toEqual(['b', 'a']);
    expect(r.fresh.map((x) => x.id)).toEqual(['d']);
  });

  it('treats directions independently', () => {
    const progress = [prog('a', NOW - 1, 'forward')];
    expect(selectSessionCards([a], progress, 'backward', NOW, 5).fresh).toHaveLength(1);
    expect(selectSessionCards([a], progress, 'forward', NOW, 5).due).toHaveLength(1);
  });

  it('handles an empty deck and a zero or negative new limit', () => {
    expect(selectSessionCards([], [], 'forward', NOW, 5)).toEqual({ due: [], fresh: [] });
    expect(selectSessionCards([a], [], 'forward', NOW, 0).fresh).toEqual([]);
    expect(selectSessionCards([a], [], 'forward', NOW, -3).fresh).toEqual([]);
  });

  it('counts cards due exactly now as due', () => {
    expect(selectSessionCards([a], [prog('a', NOW)], 'forward', NOW, 0).due).toHaveLength(1);
  });
});

describe('countDue', () => {
  it('counts only records that are due', () => {
    expect(countDue([prog('a', NOW - 1), prog('b', NOW), prog('c', NOW + 1)], NOW)).toBe(2);
  });
});

describe('countNewSince / sessionCards', () => {
  it('counts only cards first seen since the given time', () => {
    const p = (id: string, firstSeenAt?: number) => ({ ...prog(id, 0), firstSeenAt });
    expect(countNewSince([p('a', 100), p('b', 50), p('c', undefined), p('d', 100)], 100)).toBe(2);
  });

  it('puts due cards first and caps the session size', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => makeCard(id, id, { id }));
    const selection = { due: cards.slice(0, 2), fresh: cards.slice(2) };
    expect(sessionCards(selection).map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(sessionCards(selection, 3).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
