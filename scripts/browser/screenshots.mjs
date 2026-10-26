// Takes the README screenshots in a phone-sized Chrome, using the demo data of the dev server.
// Run (dev server must be running): npm run dev, then
//   node scripts/browser/screenshots.mjs http://localhost:5173 docs/screenshots
// The interface language is set in the app's settings (default English; pass `uk` as the third argument).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchChrome } from './lib.mjs';

const [base = 'http://localhost:5173', outDir = 'docs/screenshots', language = 'en'] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await launchChrome({ width: 390, height: 780 });

async function shot(name, route) {
  await browser.goto(`${base}/#/${route}`, 300);
  await browser.reload(1800);
  writeFileSync(join(outDir, `${name}.png`), await browser.screenshot());
  console.log(`saved ${name}.png`);
}

await browser.goto(`${base}/?seed#/`, 3500); // `?seed` adds demo decks (development server only)
// choose the interface language the way the Settings screen does (a row in the settings table)
await browser.evalJs(`new Promise((done, fail) => {
  const open = indexedDB.open('sproutcards');
  open.onerror = () => fail(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ id: 'app', uiLanguage: '${language}' });
    tx.oncomplete = () => done('ok');
    tx.onerror = () => fail(tx.error);
  };
})`);
await browser.reload(1500);

const deckHref = await browser.evalJs(
  "document.querySelector('a[href*=\"/decks/\"]')?.getAttribute('href')",
);
const deck = String(deckHref).replace(/^#?\/?/, '');

await shot('home', '');
await shot('deck', deck);
await shot('learn', `${deck}/learn`);
await shot('flashcards', `${deck}/flip`);
await shot('statistics', 'stats');
await shot('catalog', 'catalog');
await shot('settings', 'settings');

browser.close();
setTimeout(() => process.exit(), 200);
