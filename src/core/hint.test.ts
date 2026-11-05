import { maxHintLetters, revealHint } from './hint';

describe('revealHint', () => {
  it('shows the first letters and hides the rest', () => {
    expect(revealHint('яблуко', 2)).toBe('яб••••');
  });

  it('keeps spaces, hyphens and apostrophes visible and does not count them', () => {
    expect(revealHint('ice-cream van', 4)).toBe('ice-c•••• •••');
    expect(revealHint("м'яч", 1)).toBe("м'••");
  });
});

describe('maxHintLetters', () => {
  it('is at most half of the word, at least one letter', () => {
    expect(maxHintLetters('яблуко')).toBe(3);
    expect(maxHintLetters('вода!')).toBe(2);
    expect(maxHintLetters('я')).toBe(1);
  });
});
