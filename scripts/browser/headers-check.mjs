// Checks that the real hosting headers (dist/_headers, including the Content-Security-Policy) do not
// break the app: serves dist/ with exactly those headers, walks through the main screens and an
// actual catalog download in Chrome, and prints every console error or CSP violation.
// Run: npm run build, then node scripts/browser/headers-check.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchChrome, serveDir, sleep } from './lib.mjs';

/** Headers of the `/*` block of a Netlify/Cloudflare style `_headers` file. */
function wildcardHeaders(file) {
  const headers = {};
  let inBlock = false;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    if (!line.startsWith(' ')) {
      inBlock = line.trim() === '/*';
      continue;
    }
    if (inBlock) {
      const colon = line.indexOf(':');
      headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
  }
  return headers;
}

const dist = resolve('dist');
const headers = wildcardHeaders(resolve(dist, '_headers'));
if (!headers['Content-Security-Policy'])
  throw new Error('No Content-Security-Policy in dist/_headers');

const server = await serveDir(dist, 4797, headers);
const browser = await launchChrome();
const text = () => browser.evalJs('document.body.innerText');
const result = {};

await browser.goto(server.origin, 2500);
await browser.reload(2500);
result.homeRenders = (await text()).length > 50;
await browser.goto(`${server.origin}#/catalog`, 2000);
// a real download of a deck file, validation and save into IndexedDB
await browser.evalJs(
  "[...document.querySelectorAll('button')].find((b) => /part 1|частина 1/.test(b.getAttribute('aria-label') ?? ''))?.click()",
);
await sleep(2500);
result.catalogDeckAdded = /Already added|Уже додано|Додано|was added|було додано/.test(
  await text(),
);
for (const route of ['stats', 'settings', 'sources', 'backup', 'decks']) {
  await browser.goto(`${server.origin}#/${route}`, 1000);
}
result.stylesApplied = await browser.evalJs(
  "getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(document.querySelector('.app') ?? document.body).display === 'flex'",
);
result.consoleOrCspProblems = browser.problems.slice();

console.log(JSON.stringify({ headersUsed: Object.keys(headers), ...result }, null, 2));
browser.close();
server.stop();
const failed = !result.homeRenders || !result.catalogDeckAdded || browser.problems.length > 0;
process.exitCode = failed ? 1 : 0;
setTimeout(() => process.exit(), 200);
