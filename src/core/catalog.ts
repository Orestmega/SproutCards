// The deck catalog: ready-made decks served as static files from `public/catalog/` (see scripts/).
// `index.json` lists them; each deck file is in the normal export format, so adding a deck from the
// catalog is the same code path as importing a file.

import type { DeckBundle } from './exchange';
import type { UiLanguage } from './types';

export interface Localized {
  en: string;
  uk: string;
}

export interface CatalogEntry {
  id: string;
  kind: 'frequent' | 'topic';
  title: Localized;
  description: Localized;
  learningLang: string;
  translationLang: string;
  cardCount: number;
  exampleCount: number;
  /** Path of the deck file, relative to the catalog folder. */
  file: string;
  /** Path of the file crediting the authors of the example sentences. */
  attribution: string;
  /** `false`: translations were not checked by a human. */
  reviewed: boolean;
}

export interface CatalogIndex {
  version: 1;
  /** Which Tatoeba export the examples come from (its `Last-Modified` date). */
  tatoebaExport: string;
  decks: CatalogEntry[];
}

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Only plain relative paths inside the catalog folder: no `..`, no scheme, no leading slash. */
export function isSafeCatalogPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    /^[A-Za-z0-9._/-]+$/.test(path) &&
    !path.includes('..') &&
    !path.startsWith('/') &&
    !path.includes('//')
  );
}

function localized(v: unknown): Localized | null {
  return isObject(v) && isString(v.en) && isString(v.uk) ? { en: v.en, uk: v.uk } : null;
}

function parseEntry(raw: unknown): CatalogEntry | null {
  if (!isObject(raw)) return null;
  const title = localized(raw.title);
  const description = localized(raw.description);
  if (
    !isString(raw.id) ||
    (raw.kind !== 'frequent' && raw.kind !== 'topic') ||
    !title ||
    !description ||
    !isString(raw.learningLang) ||
    !isString(raw.translationLang) ||
    !isCount(raw.cardCount) ||
    !isCount(raw.exampleCount) ||
    !isSafeCatalogPath(raw.file) ||
    !isSafeCatalogPath(raw.attribution) ||
    typeof raw.reviewed !== 'boolean'
  ) {
    return null;
  }
  return {
    id: raw.id,
    kind: raw.kind,
    title,
    description,
    learningLang: raw.learningLang,
    translationLang: raw.translationLang,
    cardCount: raw.cardCount,
    exampleCount: raw.exampleCount,
    file: raw.file,
    attribution: raw.attribution,
    reviewed: raw.reviewed,
  };
}

/**
 * Validates the parsed `index.json`. Returns null if anything is wrong, so a damaged or tampered
 * file shows an error instead of half a list. Entries are not partially accepted.
 */
export function parseCatalogIndex(data: unknown): CatalogIndex | null {
  if (!isObject(data) || data.version !== 1 || !isString(data.tatoebaExport)) return null;
  if (!Array.isArray(data.decks)) return null;
  const decks: CatalogEntry[] = [];
  const ids = new Set<string>();
  for (const raw of data.decks) {
    const entry = parseEntry(raw);
    if (!entry || ids.has(entry.id)) return null;
    ids.add(entry.id);
    decks.push(entry);
  }
  return { version: 1, tatoebaExport: data.tatoebaExport, decks };
}

export function localize(text: Localized, language: UiLanguage): string {
  return text[language];
}

/**
 * Prepares a downloaded catalog deck for adding: named in the interface language, stamped with the
 * time of adding (so it sorts as new, not as "1970"), and tied to its catalog entry.
 */
export function prepareCatalogBundle(
  bundle: DeckBundle,
  entry: CatalogEntry,
  language: UiLanguage,
  now: number,
): DeckBundle {
  return {
    deck: {
      ...bundle.deck,
      name: localize(entry.title, language),
      description: localize(entry.description, language),
      catalogId: entry.id,
      createdAt: now,
    },
    cards: bundle.cards.map((card) => ({ ...card, createdAt: now })),
    progress: [],
  };
}
