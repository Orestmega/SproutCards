import { parseBulkCards } from './bulk';

describe('parseBulkCards', () => {
  it.each([
    ['apple - яблуко'],
    ['apple – яблуко'],
    ['apple — яблуко'],
    ['apple\tяблуко'],
    ['apple = яблуко'],
    ['apple: яблуко'],
    ['apple;яблуко'],
    ['apple,яблуко'],
  ])('reads "%s"', (line) => {
    expect(parseBulkCards(line).cards).toEqual([{ term: 'apple', translations: ['яблуко'] }]);
  });

  it('several translations are separated by commas or semicolons', () => {
    expect(parseBulkCards('bank - банк, берег; узбережжя').cards[0]?.translations).toEqual([
      'банк',
      'берег',
      'узбережжя',
    ]);
  });

  it('a dash inside a word is not a separator', () => {
    expect(parseBulkCards('well-known - відомий').cards[0]).toEqual({
      term: 'well-known',
      translations: ['відомий'],
    });
  });

  it('skips empty lines and reports lines without a pair by their number', () => {
    const result = parseBulkCards('apple - яблуко\n\nnothing here\nwater - вода\r\n- одне');
    expect(result.cards.map((c) => c.term)).toEqual(['apple', 'water']);
    expect(result.badLines).toEqual([3, 5]);
  });

  it('leaves out words already in the deck or repeated in the list', () => {
    const result = parseBulkCards('Apple - яблуко\nbook - книга\nBOOK - книжка', ['apple']);
    expect(result.cards.map((c) => c.term)).toEqual(['book']);
    expect(result.duplicates).toEqual(['Apple', 'BOOK']);
  });

  it('an empty text gives nothing', () => {
    expect(parseBulkCards('   \n ')).toEqual({ cards: [], badLines: [], duplicates: [] });
  });
});
