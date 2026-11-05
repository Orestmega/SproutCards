/** A hint for a typed answer: the first letters are shown, the rest are dots (spaces stay visible). */

/** How many letters a hint may show: never the whole word. */
export function maxHintLetters(answer: string): number {
  const letters = Array.from(answer).filter((c) => /[\p{L}\p{N}]/u.test(c)).length;
  return Math.max(1, Math.ceil(letters / 2));
}

export function revealHint(answer: string, letters: number): string {
  let left = letters;
  return Array.from(answer)
    .map((char) => {
      if (!/[\p{L}\p{N}]/u.test(char)) return char;
      if (left > 0) {
        left--;
        return char;
      }
      return '•';
    })
    .join('');
}
