import { parseCatalogIndex } from '../core/catalog';
import type { CatalogEntry, CatalogIndex } from '../core/catalog';
import { parseExchange } from '../core/exchange';
import type { DeckBundle } from '../core/exchange';

/** URL of a file in the catalog folder, relative to the page (works under any hosting path). */
export function catalogUrl(path: string): string {
  return new URL(`catalog/${path}`, document.baseURI).href;
}

/** `network`: could not download (offline, server error). `invalid`: downloaded but not a valid file. */
export type CatalogFailure = 'network' | 'invalid';
export type CatalogResult<T> = { ok: true; value: T } | { ok: false; reason: CatalogFailure };

async function fetchJsonText(path: string): Promise<CatalogResult<string>> {
  try {
    const response = await fetch(catalogUrl(path));
    if (!response.ok) return { ok: false, reason: 'network' };
    return { ok: true, value: await response.text() };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export async function fetchCatalogIndex(): Promise<CatalogResult<CatalogIndex>> {
  const got = await fetchJsonText('index.json');
  if (!got.ok) return got;
  try {
    const index = parseCatalogIndex(JSON.parse(got.value));
    return index ? { ok: true, value: index } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Downloads one deck file and validates it exactly like a file the user imports. */
export async function fetchCatalogDeck(entry: CatalogEntry): Promise<CatalogResult<DeckBundle>> {
  const got = await fetchJsonText(entry.file);
  if (!got.ok) return got;
  const parsed = parseExchange(got.value);
  if (!parsed.ok || parsed.value.length !== 1) return { ok: false, reason: 'invalid' };
  return { ok: true, value: parsed.value[0] as DeckBundle };
}
