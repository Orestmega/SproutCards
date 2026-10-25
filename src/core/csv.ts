// CSV import/export of cards. CSV is a convenience format for spreadsheets: it carries only the
// card content (first example only). JSON is the full-fidelity backup.
//
// Columns: term, translations, example, exampleTranslation, notes.
// Several translations in one cell are separated by `|`.

import type { IdFactory } from './id';
import type { ImportIssue, ParseResult } from './exchange';
import type { Card, Example } from './types';
import { stripBom } from './text';

const TRANSLATION_SEPARATOR = '|';
const HEADER = ['term', 'translations', 'example', 'exampleTranslation', 'notes'];

/** RFC 4180 style parser: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = stripBom(text);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Spreadsheets in some locales save CSV with `;` or tabs; pick the most frequent in the first line. */
export function detectDelimiter(text: string): string {
  const firstLine = stripBom(text).split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', ';', '\t'];
  let best = ',';
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

function quote(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function cardsToCsv(cards: readonly Card[]): string {
  const lines = [HEADER.join(',')];
  for (const card of cards) {
    const example = card.examples[0];
    lines.push(
      [
        card.term,
        card.translations.join(TRANSLATION_SEPARATOR),
        example?.text ?? '',
        example?.translation ?? '',
        card.notes ?? '',
      ]
        .map(quote)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Reads cards from CSV text. A header row is optional. Empty lines are ignored; a row without a term
 * or translation is an error (the whole import is refused, nothing is half-imported).
 * Cards come out as unverified (`reviewed: false`) because their origin is unknown.
 */
export function parseCsvCards(
  text: string,
  deckId: string,
  makeId: IdFactory,
  now: number,
): ParseResult<Card[]> {
  const rows = parseCsv(text, detectDelimiter(text)).filter((r) =>
    r.some((cell) => cell.trim() !== ''),
  );
  const errors: ImportIssue[] = [];
  const cards: Card[] = [];
  const first = rows[0]?.[0]?.trim().toLowerCase();
  const start = first === 'term' || first === 'word' || first === 'слово' ? 1 : 0;
  for (let i = start; i < rows.length; i++) {
    const [term = '', translationsCell = '', example = '', exampleTranslation = '', notes = ''] = (
      rows[i] as string[]
    ).map((c) => c.trim());
    const translations = translationsCell
      .split(TRANSLATION_SEPARATOR)
      .map((t) => t.trim())
      .filter((t) => t !== '');
    if (term === '' || translations.length === 0) {
      if (errors.length < 50) {
        errors.push({
          code: 'invalid_value',
          path: `row ${i + 1}`,
          detail: 'a term and at least one translation are required',
        });
      }
      continue;
    }
    const examples: Example[] =
      example === ''
        ? []
        : [
            exampleTranslation === ''
              ? { text: example }
              : { text: example, translation: exampleTranslation },
          ];
    const card: Card = {
      id: makeId(),
      deckId,
      term,
      translations,
      examples,
      reviewed: false,
      createdAt: now,
    };
    if (notes !== '') card.notes = notes;
    cards.push(card);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: cards, warnings: [] };
}
