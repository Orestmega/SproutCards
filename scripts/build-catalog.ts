// Step 2: builds the static deck catalog in public/catalog/ from the candidate list, the
// hand-written translations (scripts/data/translations.en-uk.json) and the Tatoeba example sentences.
// Run (after fetch-tatoeba.ts and candidates.ts): node scripts/build-catalog.ts
//
// The output is deterministic: running it again on the same input gives byte-identical files.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildExampleCandidates,
  buildPairs,
  chooseUnused,
  parseSentences,
  tokenize,
} from './tatoeba.ts';
import type { SentencePair } from './tatoeba.ts';

const CACHE = new URL('../data-cache/', import.meta.url);
const OUT = new URL('../public/catalog/', import.meta.url);
const PART_SIZE = 100;
const PARTS = 3;

interface Translations {
  frequent: Record<string, string[]>;
  travel: { term: string; translations: string[] }[];
}
interface Candidates {
  words: { word: string; count: number }[];
}

const read = (name: string) => readFileSync(new URL(name, CACHE), 'utf8');
const translations: Translations = JSON.parse(
  readFileSync(new URL('./data/translations.en-uk.json', import.meta.url), 'utf8'),
);
const candidates: Candidates = JSON.parse(
  readFileSync(new URL('./data/candidates.en.json', import.meta.url), 'utf8'),
);
const manifest: { file: string; lastModified: string }[] = JSON.parse(read('manifest.json'));
const snapshot = manifest.find((m) => m.file.startsWith('eng_'))?.lastModified ?? 'unknown';

const pairs = buildPairs(
  read('eng-ukr_links.tsv'),
  parseSentences(read('eng_sentences_detailed.tsv')),
  parseSentences(read('ukr_sentences_detailed.tsv')),
);
const candidatesByWord = buildExampleCandidates(pairs);
const usedSentences = new Set<string>(); // English sentence ids already given to some card

interface BuiltCard {
  term: string;
  translations: string[];
  pair: SentencePair | null;
}

/** An example for a card: a good Tatoeba pair containing every word of a single-word term. */
function exampleFor(term: string): SentencePair | null {
  const words = tokenize(term).map((w) => w.toLowerCase());
  if (words.length !== 1) return null;
  const pair = chooseUnused(candidatesByWord.get(words[0] as string), usedSentences);
  if (pair) usedSentences.add(pair.en.id);
  return pair;
}

const frequent: BuiltCard[] = [];
for (const { word } of candidates.words) {
  const tr = translations.frequent[word];
  if (!tr) continue; // deliberately left out (function words, contractions...)
  frequent.push({ term: word, translations: tr, pair: exampleFor(word) });
  if (frequent.length === PART_SIZE * PARTS) break;
}
if (frequent.length < PART_SIZE * PARTS) {
  throw new Error(`only ${frequent.length} frequent words have translations`);
}
const travel: BuiltCard[] = translations.travel.map((t) => ({ ...t, pair: exampleFor(t.term) }));

interface DeckSpec {
  id: string;
  kind: 'frequent' | 'topic';
  title: { en: string; uk: string };
  description: { en: string; uk: string };
  cards: BuiltCard[];
}

const decks: DeckSpec[] = [
  ...Array.from({ length: PARTS }, (_, i): DeckSpec => {
    return {
      id: `freq-en-uk-${i + 1}`,
      kind: 'frequent',
      title: {
        en: `Frequent English words, part ${i + 1}`,
        uk: `Частотні англійські слова, частина ${i + 1}`,
      },
      description: {
        en: 'Common English words in order of how often they occur in Tatoeba sentences, with example sentences.',
        uk: 'Поширені англійські слова в порядку частоти в реченнях Tatoeba, з прикладами речень.',
      },
      cards: frequent.slice(i * PART_SIZE, (i + 1) * PART_SIZE),
    };
  }),
  {
    id: 'topic-travel-en-uk',
    kind: 'topic',
    title: { en: 'Travel (English)', uk: 'Подорожі (англійська)' },
    description: {
      en: 'Words and phrases for trips: transport, hotels, restaurants, emergencies.',
      uk: 'Слова й фрази для подорожей: транспорт, готелі, ресторани, надзвичайні ситуації.',
    },
    cards: travel,
  },
];

mkdirSync(new URL('decks/', OUT), { recursive: true });
mkdirSync(new URL('attribution/', OUT), { recursive: true });

const sentenceUrl = (id: string) => `https://tatoeba.org/en/sentences/show/${id}`;
const index = [];

for (const spec of decks) {
  const cards = spec.cards.map((c, i) => ({
    id: `${spec.id}-${i + 1}`,
    term: c.term,
    translations: c.translations,
    examples: c.pair ? [{ text: c.pair.en.text, translation: c.pair.uk.text }] : [],
    reviewed: false, // translations are AI-written, never human-checked
    createdAt: 0,
  }));
  const deckFile = {
    format: 'sproutcards-deck',
    version: 1,
    deck: {
      id: spec.id,
      name: spec.title.en,
      learningLang: 'en',
      translationLang: 'uk',
      description: spec.description.en,
      source: 'SproutCards catalog',
      catalogId: spec.id,
      createdAt: 0,
    },
    cards,
    progress: [],
  };
  writeFileSync(new URL(`decks/${spec.id}.json`, OUT), JSON.stringify(deckFile, null, 1) + '\n');

  // Attribution for the example sentences (CC BY 2.0 FR requires crediting the authors).
  const rows = spec.cards
    .flatMap((c) => (c.pair ? [c.pair] : []))
    .sort((a, b) => Number(a.en.id) - Number(b.en.id));
  const unique = [...new Map(rows.map((p) => [p.en.id, p])).values()];
  const tsv = [
    'english_sentence_url\tenglish_author\tukrainian_sentence_url\tukrainian_author\tlicense',
    ...unique.map(
      (p) =>
        `${sentenceUrl(p.en.id)}\t${p.en.author}\t${sentenceUrl(p.uk.id)}\t${p.uk.author}\tCC BY 2.0 FR`,
    ),
  ].join('\n');
  writeFileSync(new URL(`attribution/${spec.id}.tsv`, OUT), tsv + '\n');

  index.push({
    id: spec.id,
    kind: spec.kind,
    title: spec.title,
    description: spec.description,
    learningLang: 'en',
    translationLang: 'uk',
    cardCount: cards.length,
    exampleCount: unique.length,
    file: `decks/${spec.id}.json`,
    attribution: `attribution/${spec.id}.tsv`,
    reviewed: false,
  });
  console.log(`${spec.id}: ${cards.length} cards, ${unique.length} example sentences`);
}

writeFileSync(
  new URL('index.json', OUT),
  JSON.stringify({ version: 1, tatoebaExport: snapshot, decks: index }, null, 1) + '\n',
);
console.log('catalog written to public/catalog/');
