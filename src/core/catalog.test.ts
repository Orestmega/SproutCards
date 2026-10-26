import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSafeCatalogPath, localize, parseCatalogIndex, prepareCatalogBundle } from './catalog';
import type { CatalogEntry } from './catalog';
import { parseExchange } from './exchange';
import { makeCard } from './testUtils';

const entry = (over: Record<string, unknown> = {}) => ({
  id: 'freq-1',
  kind: 'frequent',
  title: { en: 'Words', uk: 'Слова' },
  description: { en: 'Common words', uk: 'Поширені слова' },
  learningLang: 'en',
  translationLang: 'uk',
  cardCount: 2,
  exampleCount: 1,
  file: 'decks/freq-1.json',
  attribution: 'attribution/freq-1.tsv',
  reviewed: false,
  ...over,
});
const index = (decks: unknown[] = [entry()]) => ({ version: 1, tatoebaExport: 'Sat', decks });

describe('parseCatalogIndex', () => {
  it('accepts a valid index', () => {
    const parsed = parseCatalogIndex(index());
    expect(parsed?.decks).toHaveLength(1);
    expect(parsed?.decks[0]?.title.uk).toBe('Слова');
  });

  it('rejects anything malformed instead of showing half a list', () => {
    expect(parseCatalogIndex(null)).toBeNull();
    expect(parseCatalogIndex([])).toBeNull();
    expect(parseCatalogIndex({ ...index(), version: 2 })).toBeNull();
    expect(parseCatalogIndex({ ...index(), decks: 'x' })).toBeNull();
    expect(
      parseCatalogIndex(index([entry(), entry({ title: { en: 'only english' } })])),
    ).toBeNull();
    expect(parseCatalogIndex(index([entry({ cardCount: -1 })]))).toBeNull();
    expect(parseCatalogIndex(index([entry({ reviewed: 'no' })]))).toBeNull();
    expect(parseCatalogIndex(index([entry({ kind: 'other' })]))).toBeNull();
  });

  it('rejects duplicate ids', () => {
    expect(parseCatalogIndex(index([entry(), entry()]))).toBeNull();
  });

  it('rejects file paths that could leave the catalog folder', () => {
    for (const file of [
      '../secret.json',
      '/etc/passwd',
      'https://evil.example/x.json',
      'a//b.json',
      '',
    ]) {
      expect(parseCatalogIndex(index([entry({ file })])), file).toBeNull();
    }
    expect(isSafeCatalogPath('decks/ok-1.json')).toBe(true);
    expect(isSafeCatalogPath('decks\\bad.json')).toBe(false);
  });
});

describe('prepareCatalogBundle', () => {
  const parsedEntry = parseCatalogIndex(index())?.decks[0] as CatalogEntry;
  const bundle = {
    deck: { id: 'd', name: 'Words', learningLang: 'en', translationLang: 'uk', createdAt: 0 },
    cards: [makeCard('a', 'б', { id: 'c1', deckId: 'd', createdAt: 0, reviewed: false })],
    progress: [],
  };

  it('names the deck in the interface language, stamps the time and links it to the catalog', () => {
    const out = prepareCatalogBundle(bundle, parsedEntry, 'uk', 12345);
    expect(out.deck).toMatchObject({
      name: 'Слова',
      description: 'Поширені слова',
      catalogId: 'freq-1',
      createdAt: 12345,
    });
    expect(out.cards[0]).toMatchObject({ createdAt: 12345, reviewed: false });
    expect(prepareCatalogBundle(bundle, parsedEntry, 'en', 1).deck.name).toBe('Words');
  });

  it('does not modify its input and never carries progress', () => {
    const copy = JSON.stringify(bundle);
    prepareCatalogBundle(bundle, parsedEntry, 'en', 1);
    expect(JSON.stringify(bundle)).toBe(copy);
    expect(localize({ en: 'a', uk: 'б' }, 'uk')).toBe('б');
  });
});

describe('the generated catalog in public/catalog', () => {
  const root = join(process.cwd(), 'public', 'catalog');
  const raw = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
  const catalog = parseCatalogIndex(raw);

  it('has a valid index with the starter decks', () => {
    expect(catalog).not.toBeNull();
    const ids = catalog?.decks.map((d) => d.id);
    expect(ids).toEqual(['freq-en-uk-1', 'freq-en-uk-2', 'freq-en-uk-3', 'topic-travel-en-uk']);
  });

  for (const deck of catalog?.decks ?? []) {
    describe(deck.id, () => {
      const text = readFileSync(join(root, deck.file), 'utf8');
      const parsed = parseExchange(text);

      it('passes the same validation as an imported file', () => {
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.warnings).toEqual([]);
        expect(parsed.value).toHaveLength(1);
      });

      it('matches its catalog entry and is marked as unchecked', () => {
        if (!parsed.ok) throw new Error('invalid');
        const bundle = parsed.value[0]!;
        expect(bundle.cards).toHaveLength(deck.cardCount);
        expect(bundle.deck).toMatchObject({
          learningLang: deck.learningLang,
          translationLang: deck.translationLang,
          catalogId: deck.id,
        });
        expect(bundle.cards.every((c) => c.reviewed === false)).toBe(true);
        expect(deck.reviewed).toBe(false);
        expect(bundle.cards.filter((c) => c.examples.length > 0)).toHaveLength(deck.exampleCount);
      });

      it('has unique terms and no empty translations', () => {
        if (!parsed.ok) throw new Error('invalid');
        const terms = parsed.value[0]!.cards.map((c) => c.term);
        expect(new Set(terms).size).toBe(terms.length);
        for (const c of parsed.value[0]!.cards) {
          expect(c.translations.length).toBeGreaterThan(0);
          expect(c.translations.every((t) => t.trim() !== '')).toBe(true);
        }
      });

      it('credits the author of every example sentence', () => {
        expect(existsSync(join(root, deck.attribution))).toBe(true);
        const lines = readFileSync(join(root, deck.attribution), 'utf8').trim().split('\n');
        expect(lines[0]).toContain('english_author');
        expect(lines).toHaveLength(deck.exampleCount + 1);
        for (const line of lines.slice(1)) {
          const [enUrl, enAuthor, ukUrl, ukAuthor, license] = line.split('\t');
          expect(enUrl).toMatch(/^https:\/\/tatoeba\.org\/en\/sentences\/show\/\d+$/);
          expect(ukUrl).toMatch(/^https:\/\/tatoeba\.org\/en\/sentences\/show\/\d+$/);
          expect(enAuthor).toBeTruthy();
          expect(ukAuthor).toBeTruthy();
          expect(license).toBe('CC BY 2.0 FR');
        }
      });
    });
  }

  it('never gives the same example sentence to two cards', () => {
    const seen = new Set<string>();
    for (const deck of catalog?.decks ?? []) {
      const parsed = parseExchange(readFileSync(join(root, deck.file), 'utf8'));
      if (!parsed.ok) throw new Error('invalid');
      for (const card of parsed.value[0]!.cards) {
        for (const ex of card.examples) {
          expect(seen.has(ex.text), ex.text).toBe(false);
          seen.add(ex.text);
        }
      }
    }
  });
});
