// Downloads the Tatoeba exports used for the starter decks into `data-cache/` (git-ignored).
// Only official addresses are used (see docs/DATA_SOURCES.md). Run: node scripts/fetch-tatoeba.ts [--force]
//
// Needs the `bzip2` program (it ships with Git for Windows) to unpack the files. Nothing downloaded is
// ever executed; the files are plain tab-separated text.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://downloads.tatoeba.org/exports/per_language';
const FILES = [
  { name: 'eng_sentences_detailed.tsv', url: `${BASE}/eng/eng_sentences_detailed.tsv.bz2` },
  { name: 'ukr_sentences_detailed.tsv', url: `${BASE}/ukr/ukr_sentences_detailed.tsv.bz2` },
  { name: 'eng-ukr_links.tsv', url: `${BASE}/eng/eng-ukr_links.tsv.bz2` },
];
const CACHE = new URL('../data-cache/', import.meta.url);
const force = process.argv.includes('--force');

mkdirSync(CACHE, { recursive: true });
const manifest: Record<string, unknown>[] = [];

for (const file of FILES) {
  const target = new URL(file.name, CACHE);
  const archive = new URL(`${file.name}.bz2`, CACHE);
  if (existsSync(target) && !force) {
    console.log(`skip ${file.name} (already unpacked; use --force to download again)`);
    continue;
  }
  console.log(`download ${file.url}`);
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`${file.url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(archive, bytes);
  const unpack = spawnSync('bzip2', ['-dkf', archive.pathname.replace(/^\/([A-Za-z]:)/, '$1')], {
    stdio: 'inherit',
  });
  if (unpack.status !== 0) {
    throw new Error('bzip2 failed. Install bzip2 (it comes with Git for Windows) and run again.');
  }
  manifest.push({
    file: file.name,
    url: file.url,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    lastModified: response.headers.get('last-modified'),
    downloadedAt: new Date().toISOString(),
  });
}

if (manifest.length > 0) {
  writeFileSync(new URL('manifest.json', CACHE), JSON.stringify(manifest, null, 2));
  console.log('manifest written to data-cache/manifest.json');
}
