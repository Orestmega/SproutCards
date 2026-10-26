// Runs the axe-core accessibility rules on the main screens in a real Chrome.
// Run (dev server with demo data must be running): npm run dev, then
//   node scripts/browser/axe.mjs http://localhost:5173 [width]
// Prints the violations per screen; exits with code 1 if there is any.
import { readFileSync } from 'node:fs';
import { launchChrome } from './lib.mjs';

const [base = 'http://localhost:5173', width = '390'] = process.argv.slice(2);
const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const browser = await launchChrome({ width: Number(width), height: 844 });

await browser.goto(`${base}/?seed#/`, 3500); // `?seed` adds demo decks (development server only)
const deckHref = await browser.evalJs(
  "document.querySelector('a[href*=\"/decks/\"]')?.getAttribute('href')",
);
const deck = String(deckHref).replace(/^#?\/?/, '');

const routes = [
  '',
  'decks',
  deck,
  'stats',
  'settings',
  'catalog',
  'sources',
  'backup',
  'decks/new',
  `${deck}/learn`,
  `${deck}/flip`,
  `${deck}/test`,
];
let violations = 0;
for (const route of routes) {
  await browser.goto(`${base}/#/${route}`, 300);
  await browser.reload(1800);
  await browser.evalJs(axeSource);
  const found = await browser.evalJs(`axe
    .run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] })
    .then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })))`);
  const list = Array.isArray(found) ? found : [{ id: 'script-error', help: JSON.stringify(found) }];
  violations += list.length;
  console.log(
    `#/${route.replace(deck, ':deck')}:`,
    list.length === 0 ? 'no violations' : JSON.stringify(list),
  );
}
console.log(`Rules violated in total: ${violations}`);
browser.close();
process.exitCode = violations > 0 ? 1 : 0;
setTimeout(() => process.exit(), 200);
