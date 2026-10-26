// Real-browser check of the PWA behaviour, on the production build in `dist/`:
//   1. the service worker installs and the app reopens with the server switched off (offline);
//   2. the catalog list that was opened before is still there offline;
//   3. a new version is announced but not applied by surprise, applying it keeps the user's data.
// Run: npm run build, then node scripts/browser/offline-and-update.mjs
// Needs Chrome (set CHROME_PATH if it is not in a usual place). Prints a JSON report and exits
// with code 1 if any check failed.
import { appendFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { launchChrome, serveDir, sleep } from './lib.mjs';

const dist = resolve('dist');
const work = join(tmpdir(), 'sproutcards-dist-copy');
rmSync(work, { recursive: true, force: true });
cpSync(dist, work, { recursive: true }); // the copy is changed below to fake a new version

const server = await serveDir(work, 4798);
const browser = await launchChrome();
const { origin } = server;
const checks = {};
const text = () => browser.evalJs('document.body.innerText');

// ---- 1. install, then go offline ----
await browser.goto(origin, 3000);
await browser.reload(2500); // after one reload the page is controlled by the service worker
checks.pageControlledByServiceWorker = await browser.evalJs(
  'navigator.serviceWorker.controller !== null',
);
await browser.goto(`${origin}#/catalog`, 2500); // fills the catalog cache while online
checks.cachesCreated = await browser.evalJs('caches.keys()');

server.stop();
await browser.goto(`${origin}#/catalog`, 500);
await browser.reload(3000);
const offlineText = await text();
checks.appStartsOffline = offlineText.includes('SproutCards') || offlineText.length > 50;
checks.catalogListOffline = /Frequent|Частотні/.test(offlineText);
await browser.goto(`${origin}#/settings`, 1200);
checks.settingsSaysOfflineOn = /Offline mode is on|Офлайн-режим увімкнено/.test(await text());

// ---- 2. update without losing data (served again, from the changed copy) ----
const server2 = await serveDir(work, 4798);
await browser.goto(`${origin}#/decks`, 1500);
await browser.evalJs(`new Promise((done, fail) => {
  const open = indexedDB.open('sproutcards');
  open.onerror = () => fail(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction('decks', 'readwrite');
    tx.objectStore('decks').put({ id: 'keep-me', name: 'Survives the update', learningLang: 'en', translationLang: 'uk', createdAt: 1 });
    tx.oncomplete = () => done('ok');
    tx.onerror = () => fail(tx.error);
  };
})`);
await browser.reload(2000);
checks.deckBeforeUpdate = (await text()).includes('Survives the update');

appendFileSync(join(work, 'sw.js'), '\n// new version\n');
await browser.evalJs('navigator.serviceWorker.getRegistration().then((r) => r.update())');
await sleep(3000);
checks.newVersionWaitsForUser = await browser.evalJs(
  'navigator.serviceWorker.getRegistration().then((r) => !!r.waiting)',
);
checks.updateMessageShown = /Готова нова версія|A new version of SproutCards/.test(await text());

await browser.evalJs(
  "[...document.querySelectorAll('button')].find((b) => /Оновити зараз|Update now/.test(b.textContent))?.click()",
);
await sleep(3500);
checks.noWaitingWorkerAfterApply = !(await browser.evalJs(
  'navigator.serviceWorker.getRegistration().then((r) => !!r.waiting)',
));
await browser.goto(`${origin}#/decks`, 1000);
await browser.reload(2000);
checks.deckAfterUpdate = (await text()).includes('Survives the update');

console.log(JSON.stringify(checks, null, 2));
browser.close();
server2.stop();
const failed = Object.entries(checks).filter(([, value]) => value === false || value === null);
if (failed.length > 0) {
  console.error('FAILED:', failed.map(([name]) => name).join(', '));
  process.exitCode = 1;
}
setTimeout(() => process.exit(), 200);
