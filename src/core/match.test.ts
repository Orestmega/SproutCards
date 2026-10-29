import {
  elapsedMs,
  isMatchFinished,
  matchProgress,
  matchToLogs,
  pickTile,
  startMatch,
} from './match';
import type { MatchState } from './match';
import { seededRng } from './random';
import { makeCard, sampleCards } from './testUtils';

const T0 = 1_000_000;
const rng = () => seededRng(2);
const tile = (s: MatchState, cardId: string, side: 'term' | 'translation') =>
  s.tiles.find((t) => t.cardId === cardId && t.side === side)!.id;

function manyCards(n: number) {
  return Array.from({ length: n }, (_, i) => makeCard(`w${i}`, `с${i}`, { id: `c${i}` }));
}

describe('startMatch', () => {
  it('makes a shuffled board with a word tile and a translation tile per card', () => {
    const s = startMatch(sampleCards(), 'forward', rng());
    expect(s.tiles).toHaveLength(10);
    expect(s.tiles.filter((t) => t.side === 'term')).toHaveLength(5);
    expect(
      s.tiles
        .filter((t) => t.side === 'translation')
        .map((t) => t.text)
        .sort(),
    ).toEqual(['вода', 'будинок', 'книга', 'кіт', 'яблуко'].sort());
    expect(isMatchFinished(s)).toBe(false);
    expect(s.startedAt).toBeNull();
  });

  it('uses at most 6 cards of a big deck, a different set each time', () => {
    const a = startMatch(manyCards(30), 'forward', seededRng(1));
    const b = startMatch(manyCards(30), 'forward', seededRng(2));
    expect(a.tiles).toHaveLength(12);
    expect(new Set(a.tiles.map((t) => t.cardId))).not.toEqual(
      new Set(b.tiles.map((t) => t.cardId)),
    );
  });

  it('skips cards whose word or translation repeats on the board', () => {
    const cards = [
      makeCard('bank', 'банк', { id: 'a' }),
      makeCard('bank', 'берег', { id: 'b' }),
      makeCard('shore', 'берег', { id: 'c' }),
      makeCard('tree', 'дерево', { id: 'd' }),
    ];
    const s = startMatch(cards, 'forward', rng());
    const terms = s.tiles.filter((t) => t.side === 'term').map((t) => t.text);
    const answers = s.tiles.filter((t) => t.side === 'translation').map((t) => t.text);
    expect(new Set(terms).size).toBe(terms.length);
    expect(new Set(answers).size).toBe(answers.length);
  });

  it('an empty deck is a finished game', () => {
    const s = startMatch([], 'forward', rng());
    expect(isMatchFinished(s)).toBe(true);
    expect(matchProgress(s)).toBe(1);
  });
});

describe('playing', () => {
  const board = () => startMatch(sampleCards(), 'forward', rng());

  it('the clock starts at the first tap, not before', () => {
    let s = board();
    expect(elapsedMs(s, T0 + 5000)).toBe(0);
    s = pickTile(s, tile(s, 'apple', 'term'), T0);
    expect(s.startedAt).toBe(T0);
    expect(elapsedMs(s, T0 + 2500)).toBe(2500);
  });

  it('a right pair is matched and stays matched; a wrong pair is a mistake', () => {
    let s = board();
    s = pickTile(s, tile(s, 'apple', 'term'), T0);
    s = pickTile(s, tile(s, 'apple', 'translation'), T0 + 100);
    expect(s.matched).toEqual(['apple']);
    expect(s.selected).toBeNull();
    expect(matchProgress(s)).toBeCloseTo(0.2);

    s = pickTile(s, tile(s, 'house', 'term'), T0 + 200);
    s = pickTile(s, tile(s, 'water', 'translation'), T0 + 300);
    expect(s.mistakes).toBe(1);
    expect(s.matched).toEqual(['apple']);
    expect(s.lastWrong).toEqual([tile(s, 'house', 'term'), tile(s, 'water', 'translation')]);
    expect(s.mistakesByCard).toEqual({ house: 1, water: 1 });
  });

  it('tapping the picked tile again lets go; two words in a row just change the pick', () => {
    let s = board();
    const a = tile(s, 'apple', 'term');
    s = pickTile(s, a, T0);
    s = pickTile(s, a, T0 + 1);
    expect(s.selected).toBeNull();
    s = pickTile(s, a, T0 + 2);
    s = pickTile(s, tile(s, 'house', 'term'), T0 + 3);
    expect(s.selected).toBe(tile(s, 'house', 'term'));
    expect(s.mistakes).toBe(0);
  });

  it('ignores taps on paired tiles and unknown tiles', () => {
    let s = board();
    s = pickTile(s, tile(s, 'apple', 'term'), T0);
    s = pickTile(s, tile(s, 'apple', 'translation'), T0);
    const again = pickTile(s, tile(s, 'apple', 'term'), T0 + 5);
    expect(again).toBe(s);
    expect(pickTile(s, 'nope', T0)).toBe(s);
  });

  it('finishes with the last pair; the clock stops and later taps do nothing', () => {
    let s = board();
    let now = T0;
    for (const id of ['apple', 'house', 'water', 'book', 'cat']) {
      s = pickTile(s, tile(s, id, 'term'), (now += 100));
      s = pickTile(s, tile(s, id, 'translation'), (now += 100));
    }
    expect(isMatchFinished(s)).toBe(true);
    expect(s.finishedAt).toBe(now);
    expect(elapsedMs(s, now + 99_999)).toBe(now - (T0 + 100)); // from the first tap
    expect(pickTile(s, s.tiles[0]!.id, now + 1)).toBe(s);
  });

  it('writes a log row per card: correct without wrong tries, wrong with any', () => {
    let s = startMatch(sampleCards().slice(0, 2), 'forward', rng());
    s = pickTile(s, tile(s, 'apple', 'term'), T0);
    s = pickTile(s, tile(s, 'house', 'translation'), T0 + 1); // a wrong try touches both cards
    s = pickTile(s, tile(s, 'apple', 'term'), T0 + 2);
    s = pickTile(s, tile(s, 'apple', 'translation'), T0 + 3);
    s = pickTile(s, tile(s, 'house', 'term'), T0 + 4);
    s = pickTile(s, tile(s, 'house', 'translation'), T0 + 5);
    const logs = matchToLogs(s, sampleCards(), 99);
    expect(logs.map((l) => [l.cardId, l.result, l.mode])).toEqual([
      ['apple', 'wrong', 'match'],
      ['house', 'wrong', 'match'],
    ]);
    const clean = startMatch(sampleCards().slice(0, 1), 'forward', rng());
    const done = pickTile(
      pickTile(clean, tile(clean, 'apple', 'term'), T0),
      tile(clean, 'apple', 'translation'),
      T0 + 1,
    );
    expect(matchToLogs(done, sampleCards(), 99)[0]).toMatchObject({
      result: 'correct',
      deckId: 'd1',
    });
  });
});
