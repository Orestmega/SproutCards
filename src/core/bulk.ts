/**
 * "Paste a list of words": turns lines like `apple - яблуко, яблучко` into cards. It accepts what
 * people usually have in notes and spreadsheets: a tab, a dash, `=`, `:` or `;` between the two sides.
 */

export interface BulkCard {
  term: string;
  translations: string[];
}

export interface BulkResult {
  cards: BulkCard[];
  /** 1-based numbers of lines with no recognisable pair. */
  badLines: number[];
  /** Words left out because they are already in the deck or earlier in the list. */
  duplicates: string[];
}

/** Tried in this order; the first one found in a line splits it (only at its first place). */
const SEPARATORS = ['\t', ' - ', ' – ', ' — ', ' = ', ' : ', ': ', ';', '=', ','];

function splitLine(line: string): BulkCard | null {
  for (const separator of SEPARATORS) {
    const at = line.indexOf(separator);
    if (at < 0) continue;
    const term = line.slice(0, at).trim();
    const rest = line.slice(at + separator.length).trim();
    // a comma already used as the separator cannot also separate translations
    const list = separator === ',' ? [rest] : rest.split(/[;,]/);
    const translations = list.map((t) => t.trim()).filter((t) => t !== '');
    if (term !== '' && translations.length > 0) return { term, translations };
  }
  return null;
}

const comparable = (term: string) => term.trim().toLowerCase();

export function parseBulkCards(text: string, existingTerms: readonly string[] = []): BulkResult {
  const seen = new Set(existingTerms.map(comparable));
  const result: BulkResult = { cards: [], badLines: [], duplicates: [] };
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const card = splitLine(line);
    if (!card) {
      result.badLines.push(index + 1);
      return;
    }
    const key = comparable(card.term);
    if (seen.has(key)) {
      result.duplicates.push(card.term);
      return;
    }
    seen.add(key);
    result.cards.push(card);
  });
  return result;
}
