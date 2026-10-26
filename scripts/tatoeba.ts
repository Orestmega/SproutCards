// Pure helpers for turning Tatoeba exports into study material. No file or network access here,
// so everything can be unit-tested (scripts/tatoeba.test.ts).

export interface Sentence {
  id: string;
  text: string;
  /** Tatoeba user name of the author (needed for the CC BY attribution). */
  author: string;
}

export interface SentencePair {
  en: Sentence;
  uk: Sentence;
}

/** Parses `*_sentences_detailed.tsv`: id, lang, text, username, date added, date modified. */
export function parseSentences(tsv: string): Map<string, Sentence> {
  const out = new Map<string, Sentence>();
  for (const line of tsv.split('\n')) {
    const [id, , text, author] = line.split('\t');
    if (!id || !text) continue;
    out.set(id, {
      id,
      text: text.trim(),
      author: !author || author === '\\N' ? 'unknown' : author,
    });
  }
  return out;
}

/** Parses the links file (`id1<TAB>id2`) into pairs of English and Ukrainian sentences. */
export function buildPairs(
  linksTsv: string,
  english: ReadonlyMap<string, Sentence>,
  ukrainian: ReadonlyMap<string, Sentence>,
): SentencePair[] {
  const pairs: SentencePair[] = [];
  const seen = new Set<string>();
  for (const line of linksTsv.split('\n')) {
    const [a, b] = line.split('\t').map((s) => s.trim());
    if (!a || !b) continue;
    const en = english.get(a) ?? english.get(b);
    const uk = ukrainian.get(b) ?? ukrainian.get(a);
    if (!en || !uk) continue;
    const key = `${en.id}:${uk.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ en, uk });
  }
  return pairs;
}

const TOKEN = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

export function tokenize(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

export interface WordCount {
  word: string;
  count: number;
}

/**
 * Counts words in English sentences, leaving out proper names.
 * A word counts as a name when it is capitalised in the middle of sentences more often than not
 * ("Tom", "Boston"); "I" is the one exception. Sentence-initial capitals are folded into the
 * lower-case word (so "The" counts as "the").
 */
export function countWords(sentences: Iterable<string>): WordCount[] {
  const lower = new Map<string, number>();
  const initial = new Map<string, number>();
  const capitalMid = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const sentence of sentences) {
    tokenize(sentence).forEach((token, index) => {
      const word = token.toLowerCase();
      if (token === word) bump(lower, word);
      else if (token === 'I' || /^I'[a-z]+$/.test(token)) bump(lower, word);
      else if (index === 0) bump(initial, word);
      else bump(capitalMid, word);
    });
  }

  const words = new Set([...lower.keys(), ...initial.keys()]);
  const result: WordCount[] = [];
  for (const word of words) {
    const lowerCount = lower.get(word) ?? 0;
    const capital = capitalMid.get(word) ?? 0;
    if (capital > lowerCount) continue; // mostly capitalised in mid-sentence: a name
    if (word.length < 2 && word !== 'i' && word !== 'a') continue;
    result.push({ word, count: lowerCount + (initial.get(word) ?? 0) });
  }
  return result.sort((x, y) => y.count - x.count || x.word.localeCompare(y.word));
}

// A light filter so the starter decks do not contain vulgar or disturbing example sentences.
const BLOCKED = new Set([
  'fuck',
  'fucking',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'rape',
  'raped',
  'porn',
  'sex',
  'sexy',
  'naked',
  'nazi',
  'suicide',
  'kill',
  'killed',
  'murder',
  'murdered',
  'damn',
  'hell',
  'drunk',
  'stupid',
  'idiot',
  'die',
  'dead',
  'death',
  'died',
  'dying',
  'cancer',
  'stole',
  'stolen',
  'mugged',
  'pig',
  'fart',
  'pee',
  'poop',
  'gun',
  'bomb',
  'war',
  'prison',
  'jail',
  'blood',
  'cry',
  'cried',
  'fat',
  'ugly',
  'loser',
  'battle',
]);
const BLOCKED_PHRASES = ['broke wind'];
// Fine on their own, unpleasant together ("I hate my parents").
const FAMILY = new Set([
  'parents',
  'mother',
  'father',
  'brother',
  'sister',
  'wife',
  'mom',
  'dad',
  'son',
  'daughter',
]);
const NEGATIVE = new Set(['hate', 'hates', 'hated']);

export interface ExampleOptions {
  minLength: number;
  maxLength: number;
}

export const DEFAULT_EXAMPLE_OPTIONS: ExampleOptions = { minLength: 18, maxLength: 60 };

/** Is this pair suitable as a short, clean example sentence for learners? */
export function isGoodExample(
  pair: SentencePair,
  options: ExampleOptions = DEFAULT_EXAMPLE_OPTIONS,
): boolean {
  const { en, uk } = pair;
  if (en.text.length < options.minLength || en.text.length > options.maxLength) return false;
  if (uk.text.length > options.maxLength + 25) return false;
  const ratio = uk.text.length / en.text.length;
  if (ratio < 0.6 || ratio > 1.8) return false; // lengths too different: probably not a close translation
  if (/\d/.test(en.text + uk.text)) return false;
  if (/[A-Za-z]/.test(uk.text)) return false; // Latin letters in the Ukrainian side: untranslated names, mixed text
  if (!/[.!?]$/.test(en.text) || !/[.!?]$/.test(uk.text)) return false;
  const tokens = tokenize(en.text);
  // proper names in the middle of the sentence
  if (tokens.some((t, i) => i > 0 && /^[A-Z]/.test(t) && t !== 'I' && !/^I'/.test(t))) return false;
  if (tokens.some((t) => /^(tom|mary)/i.test(t))) return false;
  const lowered = tokens.map((x) => x.toLowerCase());
  if (lowered.some((x) => BLOCKED.has(x))) return false;
  if (BLOCKED_PHRASES.some((p) => en.text.toLowerCase().includes(p))) return false;
  if (lowered.some((x) => NEGATIVE.has(x)) && lowered.some((x) => FAMILY.has(x))) return false;
  return true;
}

/**
 * Picks one example sentence for a word: the shortest good pair that contains the word.
 * Deterministic (ties broken by sentence id) so the build is reproducible.
 */
export function pickExample(
  word: string,
  pairs: readonly SentencePair[],
  options: ExampleOptions = DEFAULT_EXAMPLE_OPTIONS,
): SentencePair | null {
  let best: SentencePair | null = null;
  for (const pair of pairs) {
    if (!isGoodExample(pair, options)) continue;
    if (!tokenize(pair.en.text).some((t) => t.toLowerCase() === word)) continue;
    if (
      !best ||
      pair.en.text.length < best.en.text.length ||
      (pair.en.text.length === best.en.text.length && Number(pair.en.id) < Number(best.en.id))
    ) {
      best = pair;
    }
  }
  return best;
}

/**
 * Same choice as `pickExample`, but for all words at once: one pass over the pairs.
 * Returns word -> best pair (the shortest good one containing the word, ties broken by sentence id).
 */
export function buildExampleIndex(
  pairs: readonly SentencePair[],
  options: ExampleOptions = DEFAULT_EXAMPLE_OPTIONS,
): Map<string, SentencePair> {
  const best = new Map<string, SentencePair>();
  const better = (a: SentencePair, b: SentencePair) =>
    a.en.text.length < b.en.text.length ||
    (a.en.text.length === b.en.text.length && Number(a.en.id) < Number(b.en.id));
  for (const pair of pairs) {
    if (!isGoodExample(pair, options)) continue;
    for (const word of new Set(tokenize(pair.en.text).map((t) => t.toLowerCase()))) {
      const current = best.get(word);
      if (!current || better(pair, current)) best.set(word, pair);
    }
  }
  return best;
}

/**
 * Every good example per word, best first (shortest, then lowest id). The build uses this to avoid
 * giving the same sentence to many cards: it takes the best one that no other card has used yet.
 */
export function buildExampleCandidates(
  pairs: readonly SentencePair[],
  options: ExampleOptions = DEFAULT_EXAMPLE_OPTIONS,
): Map<string, SentencePair[]> {
  const byWord = new Map<string, SentencePair[]>();
  for (const pair of pairs) {
    if (!isGoodExample(pair, options)) continue;
    for (const word of new Set(tokenize(pair.en.text).map((x) => x.toLowerCase()))) {
      const list = byWord.get(word);
      if (list) list.push(pair);
      else byWord.set(word, [pair]);
    }
  }
  for (const list of byWord.values()) {
    list.sort((a, b) => a.en.text.length - b.en.text.length || Number(a.en.id) - Number(b.en.id));
  }
  return byWord;
}

/** First candidate not in `used`; if all are used, the best one anyway (an example is better than none). */
export function chooseUnused(
  candidates: readonly SentencePair[] | undefined,
  used: ReadonlySet<string>,
): SentencePair | null {
  if (!candidates || candidates.length === 0) return null;
  return candidates.find((p) => !used.has(p.en.id)) ?? (candidates[0] as SentencePair);
}
