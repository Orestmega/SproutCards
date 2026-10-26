// Step 1 of building the starter decks: lists the most frequent English words in Tatoeba sentences
// that have a Ukrainian translation. Output: scripts/data/candidates.en.json
// Run (after fetch-tatoeba.ts): node scripts/candidates.ts
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { buildPairs, countWords, parseSentences } from './tatoeba.ts';

const CACHE = new URL('../data-cache/', import.meta.url);
const LIMIT = 500;

const read = (name: string) => readFileSync(new URL(name, CACHE), 'utf8');
const english = parseSentences(read('eng_sentences_detailed.tsv'));
const ukrainian = parseSentences(read('ukr_sentences_detailed.tsv'));
const pairs = buildPairs(read('eng-ukr_links.tsv'), english, ukrainian);
console.log(`${pairs.length} English-Ukrainian sentence pairs`);

const counts = countWords(pairs.map((p) => p.en.text)).slice(0, LIMIT);
mkdirSync(new URL('./data/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('./data/candidates.en.json', import.meta.url),
  JSON.stringify({ pairCount: pairs.length, words: counts }, null, 1),
);
console.log(counts.map((c, i) => `${i + 1}:${c.word}`).join(' '));
