import { makeCard } from './testUtils';
import { deckLearning, mergeProgress, wholeDeckChunk } from './wholeDeck';

const cards = [
  makeCard('c', 'в', { id: 'c', createdAt: 3 }),
  makeCard('a', 'а', { id: 'a', createdAt: 1 }),
  makeCard('b', 'б', { id: 'b', createdAt: 2 }),
];

describe('deckLearning', () => {
  it('counts words answered cleanly in this direction; the rest wait in the order they were added', () => {
    const progress = [
      { cardId: 'a', direction: 'forward' as const, reps: 1 },
      { cardId: 'b', direction: 'forward' as const, reps: 0 },
      { cardId: 'c', direction: 'backward' as const, reps: 3 },
    ];
    const state = deckLearning(cards, progress, 'forward');
    expect(state.learned).toBe(1);
    expect(state.total).toBe(3);
    expect(state.left.map((c) => c.id)).toEqual(['b', 'c']);
    expect(deckLearning(cards, progress, 'backward').learned).toBe(1);
  });
});

describe('wholeDeckChunk', () => {
  it('gives the next portion, with no daily limit, and nothing once all is learned', () => {
    const many = Array.from({ length: 45 }, (_, i) => makeCard(`w${i}`, 'x', { createdAt: i }));
    expect(wholeDeckChunk(many, [], 'forward')).toHaveLength(20);
    const done = cards.map((c) => ({ cardId: c.id, direction: 'forward' as const, reps: 1 }));
    expect(wholeDeckChunk(cards, done, 'forward')).toEqual([]);
  });
});

describe('mergeProgress', () => {
  it('the newer record of the same card and direction wins', () => {
    const merged = mergeProgress(
      [
        { cardId: 'a', direction: 'forward' as const, reps: 0 },
        { cardId: 'b', direction: 'forward' as const, reps: 2 },
      ],
      [{ cardId: 'a', direction: 'forward' as const, reps: 1 }],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.cardId === 'a')?.reps).toBe(1);
  });
});
