import { almostTolerance, checkAnswer, editDistance, normalizeAnswer } from './answer';

const loose = { ignoreDiacritics: true };
const strict = { ignoreDiacritics: false };

describe('normalizeAnswer', () => {
  it('ignores case, surrounding spaces and edge punctuation', () => {
    expect(normalizeAnswer('  Hello,  World! ', loose)).toBe('hello, world');
    expect(normalizeAnswer('"Hello"', loose)).toBe('hello');
  });

  it('collapses inner whitespace', () => {
    expect(normalizeAnswer('a   b\t c', loose)).toBe('a b c');
  });

  it('treats typographic apostrophes and dashes as plain ones', () => {
    expect(normalizeAnswer('п’ять', loose)).toBe(normalizeAnswer("п'ять", loose));
    expect(normalizeAnswer('well—known', loose)).toBe('well-known');
  });

  it('strips accents only when asked', () => {
    expect(normalizeAnswer('Café', loose)).toBe('cafe');
    expect(normalizeAnswer('Café', strict)).toBe('café');
  });

  it('treats composed and decomposed accents as equal even in strict mode', () => {
    expect(normalizeAnswer('é', strict)).toBe(normalizeAnswer('é', strict));
  });

  it('keeps й and ї when accents are ignored, but drops the stress mark', () => {
    expect(normalizeAnswer('йому', loose)).toBe('йому');
    expect(normalizeAnswer('їжа', loose)).toBe('їжа');
    expect(normalizeAnswer('сло́во', loose)).toBe('слово');
  });
});

describe('editDistance', () => {
  it('counts insertions, deletions and substitutions', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });

  it('counts a swap of neighbours as one edit', () => {
    expect(editDistance('teh', 'the')).toBe(1);
  });

  it('works with Cyrillic', () => {
    expect(editDistance('книга', 'кніга')).toBe(1);
  });
});

describe('almostTolerance', () => {
  it('grows with the length of the expected answer', () => {
    expect([1, 3, 4, 7, 8, 20].map(almostTolerance)).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('checkAnswer', () => {
  it('accepts an exact answer', () => {
    expect(checkAnswer('apple', ['apple'], loose)).toMatchObject({
      verdict: 'correct',
      matchedIndex: 0,
    });
  });

  it('accepts any of several answers and reports which one', () => {
    expect(checkAnswer('дім', ['будинок', 'дім'], loose)).toMatchObject({
      verdict: 'correct',
      matchedIndex: 1,
    });
  });

  it('marks a one-letter typo in a longer word as almost', () => {
    expect(checkAnswer('aple', ['apple'], loose).verdict).toBe('almost');
    expect(checkAnswer('кніга', ['книга'], loose).verdict).toBe('almost');
  });

  it('does not forgive typos in very short words', () => {
    expect(checkAnswer('car', ['cat'], loose).verdict).toBe('wrong');
  });

  it('allows two typos only in long words', () => {
    expect(checkAnswer('advnturr', ['adventure'], loose)).toMatchObject({
      verdict: 'almost',
      distance: 2,
    });
    expect(checkAnswer('advntrr', ['adventure'], loose).verdict).toBe('wrong');
    // 7 letters: only one typo is tolerated
    expect(checkAnswer('banana', ['bananas'], loose).verdict).toBe('almost');
    expect(checkAnswer('banan', ['bananas'], loose).verdict).toBe('wrong');
  });

  it('is wrong for an unrelated or empty answer', () => {
    expect(checkAnswer('dog', ['apple'], loose).verdict).toBe('wrong');
    expect(checkAnswer('   ', ['apple'], loose).verdict).toBe('wrong');
    expect(checkAnswer('', ['apple'], loose).matchedIndex).toBeNull();
  });

  it('prefers an exact match over a near one', () => {
    expect(checkAnswer('plane', ['plan', 'plane'], loose)).toMatchObject({
      verdict: 'correct',
      matchedIndex: 1,
    });
  });

  it('with accents significant, a missing accent is only "almost"', () => {
    expect(checkAnswer('cafe', ['café'], strict).verdict).toBe('almost');
    expect(checkAnswer('cafe', ['café'], loose).verdict).toBe('correct');
  });

  it('ignores empty entries in the acceptable list', () => {
    expect(checkAnswer('x', ['', '  '], loose).verdict).toBe('wrong');
  });
});
