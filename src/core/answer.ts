// Normalisation and checking of typed answers.

export interface AnswerOptions {
  /** When true, accents are ignored: `cafe` matches `café`. */
  ignoreDiacritics: boolean;
}

export type Verdict = 'correct' | 'almost' | 'wrong';

const CYRILLIC = /[Ѐ-ӿ]/u;
const MARK = /\p{M}/u;
// Leading/trailing punctuation and spaces that never matter for an answer.
const EDGE_JUNK = /^[\s.,;:!?…"'«»„“”()[\]]+|[\s.,;:!?…"'«»„“”()[\]]+$/gu;

/**
 * Removes combining marks (accents). Exception: on Cyrillic letters the breve and the diaeresis are
 * part of the letter (й, ї, ё), so they stay; other marks there (e.g. the stress mark) are removed.
 */
function stripDiacritics(text: string): string {
  let out = '';
  let base = '';
  for (const ch of text.normalize('NFD')) {
    if (MARK.test(ch)) {
      if (CYRILLIC.test(base) && (ch === '̆' || ch === '̈')) out += ch;
      continue;
    }
    out += ch;
    base = ch;
  }
  return out.normalize('NFC');
}

/** Canonical form used to compare answers: case, spacing, quotes, apostrophes, optional accents. */
export function normalizeAnswer(text: string, options: AnswerOptions): string {
  let s = text.normalize('NFC');
  s = s.replace(/[’ʼ`´‘]/g, "'").replace(/[–—‑]/g, '-');
  s = s.toLowerCase();
  if (options.ignoreDiacritics) s = stripDiacritics(s);
  s = s.replace(EDGE_JUNK, '').replace(/\s+/g, ' ');
  return s;
}

/** Edit distance where swapping two neighbouring letters counts as one edit (`teh` -> `the`). */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  const d: number[][] = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1));
  for (let i = 0; i <= x.length; i++) (d[i] as number[])[0] = i;
  for (let j = 0; j <= y.length; j++) (d[0] as number[])[j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      const row = d[i] as number[];
      const prev = d[i - 1] as number[];
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
        const prev2 = d[i - 2] as number[];
        row[j] = Math.min(row[j] as number, (prev2[j - 2] as number) + 1);
      }
    }
  }
  return (d[x.length] as number[])[y.length] as number;
}

/**
 * How many edits still count as "almost" for an expected answer of this length.
 * Short words (up to 3 letters) get no tolerance, because one letter usually makes a different word
 * (`cat`/`car`). 4–7 letters tolerate one typo, longer answers two.
 */
export function almostTolerance(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  return 2;
}

export interface CheckResult {
  verdict: Verdict;
  /** Index in `acceptable` of the best match, or null when the answer is plainly wrong. */
  matchedIndex: number | null;
  distance: number;
}

/**
 * Checks a typed answer against all accepted answers.
 * - `correct`: equal to one of them after normalisation.
 * - `almost`: within the typo tolerance of one of them. NOT counted as fully correct: the caller shows
 *   the right answer and does not raise the card's level.
 * - `wrong`: anything else, including an empty answer.
 */
export function checkAnswer(
  input: string,
  acceptable: readonly string[],
  options: AnswerOptions,
): CheckResult {
  const typed = normalizeAnswer(input, options);
  if (typed === '') return { verdict: 'wrong', matchedIndex: null, distance: Infinity };

  let best: { index: number; distance: number } | null = null;
  for (let i = 0; i < acceptable.length; i++) {
    const candidate = normalizeAnswer(acceptable[i] as string, options);
    if (candidate === '') continue;
    const distance = candidate === typed ? 0 : editDistance(typed, candidate);
    if (distance === 0) return { verdict: 'correct', matchedIndex: i, distance: 0 };
    if (distance <= almostTolerance([...candidate].length) && (!best || distance < best.distance)) {
      best = { index: i, distance };
    }
  }
  if (best) return { verdict: 'almost', matchedIndex: best.index, distance: best.distance };
  return { verdict: 'wrong', matchedIndex: null, distance: Infinity };
}
