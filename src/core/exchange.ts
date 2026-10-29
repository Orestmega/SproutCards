// Export / import of decks as JSON (backup format). Pure: parsing and validation never touch storage,
// so a bad file cannot damage existing data. Any problem fails the whole import with a list of issues.

import type { IdFactory } from './id';
import type { Card, Deck, Direction, Example, Progress } from './types';
import { progressId } from './types';
import { stripBom } from './text';

export const DECK_FORMAT = 'sproutcards-deck';
export const BACKUP_FORMAT = 'sproutcards-backup';
/** Bump when the file layout changes, and add an upgrade step in `parseExchange`. */
export const EXCHANGE_VERSION = 1;

export const LIMITS = {
  maxCards: 50_000,
  maxTextLength: 2_000,
  maxTranslations: 50,
  maxExamples: 50,
  maxDecksInBackup: 500,
  maxIssues: 50,
} as const;

export interface DeckBundle {
  deck: Deck;
  cards: Card[];
  /** Progress is optional: a shared deck has none, a personal backup has it. */
  progress: Progress[];
}

export type IssueCode =
  | 'not_json'
  | 'not_object'
  | 'wrong_format'
  | 'unsupported_version'
  | 'missing_field'
  | 'invalid_value'
  | 'duplicate_id'
  | 'too_many'
  | 'unknown_card';

/** Machine-readable problem; the UI turns `code` + `path` into a translated message. */
export interface ImportIssue {
  code: IssueCode;
  /** Where in the file, e.g. `cards[3].translations`. */
  path: string;
  /** English text for logs and tests only. */
  detail: string;
}

export type ParseResult<T> =
  { ok: true; value: T; warnings: ImportIssue[] } | { ok: false; errors: ImportIssue[] };

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

class Collector {
  errors: ImportIssue[] = [];
  warnings: ImportIssue[] = [];
  /** Prepended to every path, e.g.  while a deck inside a backup is parsed. */
  prefix = '';
  private full(path: string): string {
    return (this.prefix + path).replace(/\.$/, '');
  }
  error(code: IssueCode, path: string, detail: string): void {
    if (this.errors.length < LIMITS.maxIssues) {
      this.errors.push({ code, path: this.full(path), detail });
    }
  }
  warn(code: IssueCode, path: string, detail: string): void {
    if (this.warnings.length < LIMITS.maxIssues) {
      this.warnings.push({ code, path: this.full(path), detail });
    }
  }
}

function readString(
  obj: Json,
  key: string,
  path: string,
  c: Collector,
  opts: { required: boolean },
): string | undefined {
  const v = obj[key];
  if (v === undefined || v === null) {
    if (opts.required) c.error('missing_field', `${path}.${key}`, 'required string is missing');
    return undefined;
  }
  if (typeof v !== 'string') {
    c.error('invalid_value', `${path}.${key}`, 'must be a string');
    return undefined;
  }
  if (v.length > LIMITS.maxTextLength) {
    c.error('invalid_value', `${path}.${key}`, 'text is too long');
    return undefined;
  }
  if (opts.required && v.trim() === '') {
    c.error('invalid_value', `${path}.${key}`, 'must not be empty');
    return undefined;
  }
  return v;
}

function readTimestamp(
  obj: Json,
  key: string,
  path: string,
  c: Collector,
  fallback: number,
): number {
  const v = obj[key];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    c.error('invalid_value', `${path}.${key}`, 'must be a non-negative number');
    return fallback;
  }
  return v;
}

function parseDeck(raw: unknown, path: string, c: Collector, now: number): Deck | null {
  if (!isObject(raw)) {
    c.error('missing_field', path, 'deck object is missing');
    return null;
  }
  const before = c.errors.length;
  const id = readString(raw, 'id', path, c, { required: true });
  const name = readString(raw, 'name', path, c, { required: true });
  const learningLang = readString(raw, 'learningLang', path, c, { required: true });
  const translationLang = readString(raw, 'translationLang', path, c, { required: true });
  for (const [key, value] of [
    ['learningLang', learningLang],
    ['translationLang', translationLang],
  ] as const) {
    if (value !== undefined && !LANG_RE.test(value)) {
      c.error('invalid_value', `${path}.${key}`, 'must be a language code such as "en" or "uk"');
    }
  }
  const description = readString(raw, 'description', path, c, { required: false });
  const source = readString(raw, 'source', path, c, { required: false });
  const catalogId = readString(raw, 'catalogId', path, c, { required: false });
  const createdAt = readTimestamp(raw, 'createdAt', path, c, now);
  if (c.errors.length > before || !id || !name || !learningLang || !translationLang) return null;
  const deck: Deck = { id, name, learningLang, translationLang, createdAt };
  if (description !== undefined) deck.description = description;
  if (source !== undefined) deck.source = source;
  if (catalogId !== undefined) deck.catalogId = catalogId;
  return deck;
}

function parseExamples(raw: unknown, path: string, c: Collector): Example[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > LIMITS.maxExamples) {
    c.error('invalid_value', path, 'examples must be a list (at most 50)');
    return [];
  }
  const out: Example[] = [];
  raw.forEach((item, i) => {
    if (!isObject(item)) {
      c.error('invalid_value', `${path}[${i}]`, 'example must be an object');
      return;
    }
    const text = readString(item, 'text', `${path}[${i}]`, c, { required: true });
    const translation = readString(item, 'translation', `${path}[${i}]`, c, { required: false });
    if (text === undefined) return;
    out.push(translation === undefined ? { text } : { text, translation });
  });
  return out;
}

function parseCards(raw: unknown, deckId: string, c: Collector, now: number): Card[] {
  if (!Array.isArray(raw)) {
    c.error('missing_field', 'cards', 'cards must be a list');
    return [];
  }
  if (raw.length > LIMITS.maxCards) {
    c.error('too_many', 'cards', `a deck can have at most ${LIMITS.maxCards} cards`);
    return [];
  }
  const ids = new Set<string>();
  const out: Card[] = [];
  raw.forEach((item, i) => {
    const path = `cards[${i}]`;
    if (!isObject(item)) {
      c.error('invalid_value', path, 'card must be an object');
      return;
    }
    const before = c.errors.length;
    const id = readString(item, 'id', path, c, { required: true });
    const term = readString(item, 'term', path, c, { required: true });
    const notes = readString(item, 'notes', path, c, { required: false });
    const translationsRaw = item.translations;
    const translations: string[] = [];
    if (!Array.isArray(translationsRaw) || translationsRaw.length > LIMITS.maxTranslations) {
      c.error('invalid_value', `${path}.translations`, 'must be a list of 1–50 strings');
    } else {
      translationsRaw.forEach((t, j) => {
        if (typeof t !== 'string' || t.trim() === '' || t.length > LIMITS.maxTextLength) {
          c.error('invalid_value', `${path}.translations[${j}]`, 'must be a non-empty string');
        } else translations.push(t);
      });
      if (translationsRaw.length === 0) {
        c.error('invalid_value', `${path}.translations`, 'at least one translation is required');
      }
    }
    const examples = parseExamples(item.examples, `${path}.examples`, c);
    if (item.reviewed !== undefined && typeof item.reviewed !== 'boolean') {
      c.error('invalid_value', `${path}.reviewed`, 'must be true or false');
    }
    if (item.starred !== undefined && typeof item.starred !== 'boolean') {
      c.error('invalid_value', `${path}.starred`, 'must be true or false');
    }
    const createdAt = readTimestamp(item, 'createdAt', path, c, now);
    if (id !== undefined) {
      if (ids.has(id)) c.error('duplicate_id', `${path}.id`, `duplicate card id "${id}"`);
      ids.add(id);
    }
    if (c.errors.length > before || !id || !term) return;
    const card: Card = {
      id,
      deckId,
      term,
      translations,
      examples,
      reviewed: item.reviewed === true, // unknown provenance counts as unverified
      createdAt,
    };
    if (notes !== undefined && notes !== '') card.notes = notes;
    if (item.starred === true) card.starred = true;
    out.push(card);
  });
  return out;
}

function parseProgress(
  raw: unknown,
  cardIds: ReadonlySet<string>,
  deckId: string,
  c: Collector,
): Progress[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    c.error('invalid_value', 'progress', 'progress must be a list');
    return [];
  }
  const out: Progress[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const path = `progress[${i}]`;
    if (!isObject(item)) {
      c.error('invalid_value', path, 'progress entry must be an object');
      return;
    }
    const cardId = item.cardId;
    const direction = item.direction;
    if (typeof cardId !== 'string' || (direction !== 'forward' && direction !== 'backward')) {
      c.error('invalid_value', path, 'needs cardId and direction ("forward" or "backward")');
      return;
    }
    if (!cardIds.has(cardId)) {
      c.warn('unknown_card', path, 'progress for a card that is not in the deck was dropped');
      return;
    }
    const nums = ['reps', 'intervalDays', 'dueAt', 'lapses', 'lastReviewedAt'] as const;
    for (const key of nums) {
      const v = item[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        c.error('invalid_value', `${path}.${key}`, 'must be a non-negative number');
        return;
      }
    }
    const id = progressId(cardId, direction);
    if (seen.has(id)) {
      c.error('duplicate_id', path, 'duplicate progress for the same card and direction');
      return;
    }
    seen.add(id);
    out.push({
      id,
      cardId,
      deckId,
      direction,
      reps: item.reps as number,
      intervalDays: item.intervalDays as number,
      dueAt: item.dueAt as number,
      lapses: item.lapses as number,
      lastReviewedAt: item.lastReviewedAt as number,
    });
  });
  return out;
}

function parseBundle(raw: unknown, prefix: string, c: Collector, now: number): DeckBundle | null {
  c.prefix = prefix;
  try {
    if (!isObject(raw)) {
      c.error('not_object', '', 'deck entry must be an object');
      return null;
    }
    const deck = parseDeck(raw.deck, 'deck', c, now);
    const deckId = deck?.id ?? '';
    const cards = parseCards(raw.cards, deckId, c, now);
    const progress = parseProgress(raw.progress, new Set(cards.map((x) => x.id)), deckId, c);
    return deck ? { deck, cards, progress } : null;
  } finally {
    c.prefix = '';
  }
}

/**
 * Parses and validates the text of an exported file: a single deck or a backup of several decks.
 * Never throws; every problem is reported in the result. Nothing is stored here.
 */
export function parseExchange(text: string, now: number = Date.now()): ParseResult<DeckBundle[]> {
  const c = new Collector();
  let data: unknown;
  try {
    data = JSON.parse(stripBom(text));
  } catch {
    return {
      ok: false,
      errors: [{ code: 'not_json', path: '', detail: 'file is not valid JSON' }],
    };
  }
  if (!isObject(data)) {
    return {
      ok: false,
      errors: [{ code: 'not_object', path: '', detail: 'expected a JSON object' }],
    };
  }
  if (data.format !== DECK_FORMAT && data.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      errors: [{ code: 'wrong_format', path: 'format', detail: 'not a SproutCards export file' }],
    };
  }
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) {
    return {
      ok: false,
      errors: [
        { code: 'invalid_value', path: 'version', detail: 'version must be a positive integer' },
      ],
    };
  }
  if (data.version > EXCHANGE_VERSION) {
    return {
      ok: false,
      errors: [
        {
          code: 'unsupported_version',
          path: 'version',
          detail: `file version ${data.version} is newer than supported ${EXCHANGE_VERSION}`,
        },
      ],
    };
  }
  // Future: upgrade older `data.version` shapes here, one step at a time, before validation.

  const bundles: DeckBundle[] = [];
  if (data.format === DECK_FORMAT) {
    const b = parseBundle(data, '', c, now);
    if (b) bundles.push(b);
  } else {
    const list = data.decks;
    if (!Array.isArray(list)) {
      c.error('missing_field', 'decks', 'backup must contain a list of decks');
    } else if (list.length > LIMITS.maxDecksInBackup) {
      c.error('too_many', 'decks', `a backup can have at most ${LIMITS.maxDecksInBackup} decks`);
    } else {
      list.forEach((item, i) => {
        const b = parseBundle(item, `decks[${i}].`, c, now);
        if (b) bundles.push(b);
      });
    }
  }
  if (c.errors.length > 0) return { ok: false, errors: c.errors };
  return { ok: true, value: bundles, warnings: c.warnings };
}

export function serializeDeck(bundle: DeckBundle, now: number = Date.now()): string {
  return JSON.stringify(
    {
      format: DECK_FORMAT,
      version: EXCHANGE_VERSION,
      exportedAt: new Date(now).toISOString(),
      ...strip(bundle),
    },
    null,
    2,
  );
}

export function serializeBackup(bundles: readonly DeckBundle[], now: number = Date.now()): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: EXCHANGE_VERSION,
      exportedAt: new Date(now).toISOString(),
      decks: bundles.map(strip),
    },
    null,
    2,
  );
}

/** Cards do not repeat `deckId` in the file: it is the deck they sit in. */
function strip(bundle: DeckBundle) {
  return {
    deck: bundle.deck,
    cards: bundle.cards.map(({ deckId: _deckId, ...card }) => card),
    progress: bundle.progress.map(({ id: _id, deckId: _deckId, ...p }) => p),
  };
}

/**
 * Gives an imported bundle brand-new ids so it can never overwrite an existing deck, card or
 * progress record (importing the same file twice makes two copies).
 */
export function remapBundleIds(bundle: DeckBundle, makeId: IdFactory): DeckBundle {
  const deckId = makeId();
  const cardIds = new Map(bundle.cards.map((card) => [card.id, makeId()]));
  const cards = bundle.cards.map((card) => ({
    ...card,
    id: cardIds.get(card.id) as string,
    deckId,
  }));
  const progress = bundle.progress.map((p) => {
    const cardId = cardIds.get(p.cardId) as string;
    return { ...p, id: progressId(cardId, p.direction as Direction), cardId, deckId };
  });
  return { deck: { ...bundle.deck, id: deckId }, cards, progress };
}
