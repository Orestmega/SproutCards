import { cardsToCsv, detectDelimiter, parseCsv, parseCsvCards } from './csv';
import { makeCard } from './testUtils';

let n = 0;
const makeId = () => `id-${++n}`;

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('a,b\nc,d\n', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles quotes, doubled quotes, commas and newlines inside quotes', () => {
    expect(parseCsv('"a,1","say ""hi""","x\ny"\r\nlast,,', ',')).toEqual([
      ['a,1', 'say "hi"', 'x\ny'],
      ['last', '', ''],
    ]);
  });

  it('works without a trailing newline and with CRLF', () => {
    expect(parseCsv('a,b\r\nc,d', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('ignores a byte-order mark', () => {
    expect(parseCsv(String.fromCharCode(0xfeff) + 'a,b', ',')).toEqual([['a', 'b']]);
  });
});

describe('detectDelimiter', () => {
  it('picks the most frequent separator of the first line', () => {
    expect(detectDelimiter('a,b,c')).toBe(',');
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('single')).toBe(',');
  });
});

describe('parseCsvCards', () => {
  it('reads cards with and without a header', () => {
    const withHeader = parseCsvCards('term,translations\napple,яблуко\n', 'd', makeId, 5);
    const without = parseCsvCards('apple,яблуко\n', 'd', makeId, 5);
    for (const r of [withHeader, without]) {
      expect(r.ok && r.value).toHaveLength(1);
      expect(r.ok && r.value[0]).toMatchObject({
        term: 'apple',
        translations: ['яблуко'],
        deckId: 'd',
        reviewed: false,
        createdAt: 5,
      });
    }
  });

  it('splits several translations on | and reads example and notes', () => {
    const r = parseCsvCards(
      'house,будинок | дім,"I live in a house.",Я живу в будинку.,noun',
      'd',
      makeId,
      1,
    );
    expect(r.ok && r.value[0]).toMatchObject({
      translations: ['будинок', 'дім'],
      examples: [{ text: 'I live in a house.', translation: 'Я живу в будинку.' }],
      notes: 'noun',
    });
  });

  it('works with semicolon-separated files (common in Excel exports)', () => {
    const r = parseCsvCards('term;translations\nwater;вода\n', 'd', makeId, 1);
    expect(r.ok && r.value[0]?.translations).toEqual(['вода']);
  });

  it('skips blank lines', () => {
    const r = parseCsvCards('a,б\n\n   \nc,д\n', 'd', makeId, 1);
    expect(r.ok && r.value).toHaveLength(2);
  });

  it('refuses the whole file if any row lacks a term or a translation', () => {
    const r = parseCsvCards('a,б\nlonely\n,only translation\n', 'd', makeId, 1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path)).toEqual(['row 2', 'row 3']);
  });

  it('an empty file gives no cards (not an error)', () => {
    const r = parseCsvCards('', 'd', makeId, 1);
    expect(r.ok && r.value).toEqual([]);
  });
});

describe('cardsToCsv', () => {
  it('round-trips through parseCsvCards, including awkward characters', () => {
    const cards = [
      makeCard('say "hi"', ['привіт', 'вітаю'], {
        examples: [{ text: 'He said, "hi".\nThen left.', translation: 'Він сказав.' }],
        notes: 'a, b',
      }),
      makeCard('plain', 'простий'),
    ];
    const back = parseCsvCards(cardsToCsv(cards), 'd', makeId, 1);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.map((c) => [c.term, c.translations, c.examples, c.notes])).toEqual([
      [
        'say "hi"',
        ['привіт', 'вітаю'],
        [{ text: 'He said, "hi".\nThen left.', translation: 'Він сказав.' }],
        'a, b',
      ],
      ['plain', ['простий'], [], undefined],
    ]);
  });
});
