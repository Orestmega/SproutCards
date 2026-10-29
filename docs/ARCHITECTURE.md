# Architecture

## Layers

- `src/core/` — pure logic. No React, no browser APIs, no hidden clock or randomness (time and the
  random generator are passed in). Fully unit-tested.
- `src/db/` — Dexie (IndexedDB) schema and the repository. The only place that talks to storage.
- `src/i18n/` — translation files (`en.ts` defines the keys, `uk.ts` must have all of them) and the `useI18n()` hook.
- `src/ui/` — React components (`components/`), screens (`screens/`), providers and routes.
- `src/dev/` — demo data for development only (`/?seed`), not part of the production bundle.
- `scripts/` — reproducible data preparation scripts, run with `node scripts/<name>.ts`.

Dependencies point one way: `ui` → `db` → `core`. `core` imports nothing from the other layers.

## Data model (`src/core/types.ts`)

| Type | Meaning |
|---|---|
| `Deck` | name, `learningLang` and `translationLang` (BCP 47 codes — no language is hard-coded), optional description and source |
| `Card` | `term` (learning language), `translations[]` (first is primary), `examples[]`, `notes`, `reviewed` |
| `Progress` | schedule of one card **in one direction**: `reps`, `intervalDays`, `dueAt`, `lapses`, `lastReviewedAt`. Id is `cardId:direction` |
| `ReviewLog` | one row per answer (time, card, mode, level, result) for statistics |
| `Settings` | UI language, speech on/off, new cards per day, ignore accents |

`Direction` is `forward` (term → translation) or `backward` (translation → term). Forward and backward
progress of the same card are independent. A card with no `Progress` row has never been studied.

`reviewed: false` marks content of unknown quality (machine translations, CSV imports). Cards typed by
the user are `reviewed: true`.

## Answer checking (`answer.ts`)

`normalizeAnswer` makes two strings comparable: Unicode NFC, lower case, typographic quotes/dashes →
plain, edge punctuation and extra spaces removed, optionally accents removed (setting). On Cyrillic
letters `й`, `ї`, `ё` keep their marks; the stress mark is removed.

`checkAnswer` returns `correct`, `almost` or `wrong`. **Rule for `almost`:** the answer is within a small
edit distance of an accepted answer (swapping two neighbouring letters counts as one edit). Allowed
distance depends on the length of the accepted answer: ≤3 letters → 0, 4–7 → 1, ≥8 → 2. `almost` is
**not** fully correct: the right answer is shown, the level does not rise, and it is not a mistake for
scheduling.

## Scheduler (`scheduler.ts`)

`Scheduler.review(previous, 'correct' | 'wrong', now) → ScheduleState` is the only contract. The default
`createFixedIntervalScheduler` uses 1, 3, 7, 14, 30 days (the last repeats); a mistake resets to the first
interval and counts a lapse. Due dates are the **start of a local calendar day**, so a card is available
from the morning of its day. Replace the implementation (SM-2, FSRS) by providing another `Scheduler`;
`ScheduleState.extra` can hold algorithm-specific numbers.

## Learn engine (`learn.ts`)

A pure state machine: `startSession` → repeated `submitAnswer` → `summarize` / `applySessionToProgress`.

- Levels are data (`LearnConfig.levels`): choice(term→translation), typing(term→translation),
  typing(translation→term). The session `Direction` swaps the sides.
- Correct: level + 1, card goes to the back of the queue. Passing = a correct answer on the last level.
- Wrong or "I don't know": level − 1 (not below 0), mistake counted, card returns after 3–5 cards.
- `almost`: level unchanged, no mistake, card returns after 3–5 cards.
- If a choice question cannot get distractors (one-card deck), it is asked as typing.
- Cards sharing a prompt (duplicates such as two cards for "bank") accept each other's answers.
- Choice options never contain another valid answer.
- Scheduling happens once per card when it **passes**: a card with ≥1 mistake in the session is scheduled
  as `wrong` (back to the first interval), otherwise as `correct`. Cards that did not pass (interrupted
  session) are not scheduled.
- `selection.ts` picks due and new cards for a session.

## Other study modes (`flip.ts`, `quiz.ts`, `match.ts`, `voice.ts`)

- **Flashcards** (`flip.ts`): **rounds until everything is known.** Each card is shown once per round; at the end
  of a round the cards marked "don't know" become the next round (new order), and so on until none is left
  (state `phase`: `card` / `roundEnd` / `done`; `continueFlip` starts the next round). The progress bar is the share of
  cards whose latest answer is "know". Scheduling is **once per card** at the end (or on leaving): a card that was
  ever marked "don't know" counts as `wrong`, otherwise `correct` (same rule as Learn). Every answer of every
  round goes to the review log. Round end screen: "You know 12 of 20. Still learning: 8".
- **Quiz / test** (`quiz.ts`, screens `QuizSetup`, `QuizScreen`, `quizParts.tsx`): a settings screen first (number of
  questions 5 / 10 / 20 / all; kinds of questions on or off, at least one; remembered in `localStorage`). Four
  kinds: **multiple choice** and **typing** (`buildExercise`, as in Learn), **true/false** ("is this a correct
  pair?"; the false pairing takes the answer of another card) and **matching** (up to 5 pairs on one screen;
  tap an item on the left, then its pair; linked pairs show the same number on both tiles). Cards are dealt to
  the enabled kinds in turn; matching takes a block of cards first (at least a pair; texts that clash are asked
  another way). Every card is one graded item (a matching screen with 4 pairs = 4 items). No feedback until the
  end. Points: correct 1, `almost` 0.5, wrong 0; grades at 90 / 70 / 50 %. **Retake the mistakes:** `missedCardIds`
  (every card not fully right) feeds a new quiz of only those words (`QuizConfig.restrictTo`; wrong options still
  come from the whole deck), repeatable until 100 %. A quiz never changes review dates; it only writes the log.
- **Match** (`match.ts`, `MatchScreen`): a timed game on a board of up to 6 pairs (word tile + translation tile,
  clashing texts skipped). Tap two tiles; a wrong pair is a mistake and is marked ✗ for a moment; the clock starts
  at the first tap and stops at the last pair. Result: time, mistakes, best time (per deck and direction, in
  `localStorage`). Only the review log is written (a card with no wrong try = `correct`); the schedule is not
  changed.
- **Stars** (`Card.starred`, `repo.setStarred`, `StarButton`): mark hard words on the deck list or while studying
  flashcards. "Only starred cards" in the study panel adds `?starred=1`; `StudyGate` then filters the loaded
  cards, so Learn, flashcards, test and Match all work on the starred ones only. The field is optional (no
  migration) and part of the export/import format (`starred`, only when true).
- **Session cards** (`selection.ts`): due cards (most overdue first) then new cards, at most
  `SESSION_SIZE` = 20 per session. New cards are limited by the `newCardsPerDay` setting minus the number of
  cards first studied today (`Progress.firstSeenAt`, counted across decks and directions).
- **Practice** (`?all=1`): any card can be practised ahead of schedule; progress is not changed, only the
  review log is written.
- **Speech** (`src/ui/speech.ts` + `core/voice.ts`): Web Speech API. `pickVoice` chooses an exact language
  match, then the same base language, preferring on-device voices. If there is no voice or no support,
  the button shows a message instead of staying silent. Speech buttons are hidden by the setting.

Study screens live in their own layout (`StudyLayout`: progress bar on top, close button, no bottom
navigation). Each screen loads a **snapshot** of the deck once (`StudyGate`), so live updates cannot change
a running session. Results are saved when the session ends, or when the user leaves (finished cards only).
Keyboard: choice options 1–4, Enter submits/continues, Space/Enter turns a flashcard, ← / → answer it.

## Deck catalog (`core/catalog.ts`, `ui/catalog.ts`, `scripts/`, `public/catalog/`)

- Ready-made decks are **static files**: `public/catalog/index.json` plus one deck file per deck in the normal
  export format (`decks/<id>.json`) and an author list (`attribution/<id>.tsv`). Decks are split into parts
  of 100 words and fetched one at a time, only when the user adds them; they are not part of the app
  bundle or the precache (the service worker caches them on first use, stale-while-revalidate).
- `parseCatalogIndex` validates the index and refuses it as a whole if anything is wrong; file paths may
  only be plain relative paths inside the catalog folder (no `..`, scheme or leading slash).
- Adding a deck downloads the file, validates it with the **same** `parseExchange` as a user import, then
  `prepareCatalogBundle` names it in the interface language, stamps the time and sets `Deck.catalogId`
  (so the catalog shows "already added" and cannot add it twice); `importBundles` writes it in one
  transaction. A network, validation or storage failure adds nothing. After adding, the deck lives in
  IndexedDB and needs no network.
- Content comes from `scripts/` (run by hand, deterministic): `fetch-tatoeba.ts` (official addresses only,
  records sizes and sha256), `candidates.ts` (word frequencies computed from the Tatoeba corpus, proper
  names removed), `build-catalog.ts` (cards + one example per card, never the same sentence twice, a light
  content filter). Word translations are hand-written by an AI assistant in
  `scripts/data/translations.en-uk.json`; every catalog card has `reviewed: false`. Sources, licences and
  attribution rules: `docs/DATA_SOURCES.md`. A test validates every generated file.

## PWA, offline and updates (`ui/pwa.tsx`, `vite.config.ts`)

- **Build:** `vite-plugin-pwa` generates the manifest (standalone, icons "any" + "maskable") and a Workbox
  service worker (`generateSW`). `base: './'` makes every path relative, so the site works from any folder or
  sub-path of a static host.
- **Cache strategy.** The app shell (HTML, JS, CSS, icons, ~500 KB) is **precached**: after the first visit
  the app opens with no network, and any navigation falls back to the cached `index.html`
  (`navigateFallback`). Old caches are removed on update (`cleanupOutdatedCaches`). Catalog files
  (`/catalog/`) are not precached; they use **stale-while-revalidate** at run time, so a catalog page that
  was opened once is also available offline and refreshes in the background. A deck that was added is
  copied into IndexedDB and never needs the network again.
- **Updates are never applied by surprise** (`registerType: 'prompt'`). A new service worker waits; the
  app shows "A new version is ready" (`PwaBanner`, only on normal screens, never inside a study session)
  and reloads only when the user taps "Update now". User data lives in IndexedDB, which an update does
  not touch; schema changes use Dexie migrations (see Storage).
- `PwaProvider` is the only place that talks to the service worker, the install event
  (`beforeinstallprompt`) and `navigator.storage`. The rest of the UI reads `usePwa()`; tests supply a fake
  state, and `virtual:pwa-register` is replaced by a stub in Vitest.
- **Install:** Chromium offers the install event (shown as a button in Settings); iPhone/iPad Safari has none,
  so Settings shows the "Add to Home Screen" instructions there.
- **Data protection:** the app asks the browser for persistent storage (`navigator.storage.persist()`) and
  tells the user in Settings whether it was granted. Closing the tab in the middle of a Learn session or a
  quiz triggers the browser's confirmation (`beforeunload`); an unexpected rendering error shows a screen
  with a reload button instead of a blank page (`ErrorBoundary`).
- **Reminders (limit of the platform):** a web app cannot show notifications while it is closed without a
  push server, and accounts/servers are out of scope. Instead, where `navigator.setAppBadge` exists (installed
  app on some platforms), the icon shows the number of due reviews as of the last time the app ran. The
  number is not refreshed in the background.

## Native apps (`capacitor.config.ts`, `android/`, `ios/`, `ui/native.ts`)

Capacitor wraps the same `dist/` build in an Android/iOS WebView (`npm run cap:sync` copies it in; the copy is
git-ignored). App id `app.sproutcards.mobile`. Where a WebView differs from a browser, the code checks
`isNativeApp()`:

- **Files** (`ui/files.ts`): a WebView cannot download blobs, so the text is written to the app cache
  (`@capacitor/filesystem`) and the system share sheet opens (`@capacitor/share`). Closing the sheet is not an
  error; other failures reach the screens' normal "could not create the file" message.
- **Speech** (`ui/speech.ts`): the phone's engine through `@capacitor-community/text-to-speech`, with the same
  results ('no_voice', 'error') as the browser path, so the UI messages stay the same.
- **No service worker, install prompt or storage request** (`ui/pwa.tsx`): the files are inside the app. Settings
  shows a short description instead.
- **Safe areas:** `viewport-fit=cover` + `env(safe-area-inset-top)` padding (CSS), status bar icons forced dark
  (`SystemBars.style: 'LIGHT'`), because the app is always light.
- The database is the same Dexie/IndexedDB, but inside the app's own WebView: it is **separate** from the website's.
- Android is built in the cloud (`.github/workflows/android-apk.yml`, Java 21, Gradle) as a debug apk. Debug keys
  change on every run, so a new apk cannot be installed over an old one (back up, uninstall, install, import).
- iOS: project generated, never built (no Mac). Details: `docs/NATIVE_APPS.md`.

## Statistics (`core/stats.ts`, `ui/screens/StatsScreen.tsx`)

Pure functions: `computeStreak`, `dailyCounts` (reviews per local day, zeros included), `accuracy` (share of
fully correct answers), `stageCounts` (a card is *learned* after `LEARNED_REPS` = 3 correct reviews in a row
in some direction, *learning* if studied, otherwise *new*). `repo.statsSnapshot()` reads the raw rows; the
screen draws a CSS bar chart (no chart library) with a text list for screen readers.

## Exchange formats (`exchange.ts`, `csv.ts`)

- JSON, `format: "sproutcards-deck"` (one deck) or `"sproutcards-backup"` (several), `version: 1`.
  A file with a newer version is refused with a clear code. To change the layout, bump
  `EXCHANGE_VERSION` and add an upgrade step in `parseExchange`.
- `parseExchange` validates everything first and returns **all** problems (code + path) or the data.
  Any error refuses the whole file; nothing is written. Unknown progress entries only produce a warning.
- Import always creates **new** decks with new ids (`remapBundleIds`), so existing data is never
  overwritten; the write is one transaction.
- CSV (`term, translations, example, exampleTranslation, notes`, `|` between translations, `,` `;` or tab
  as delimiter, optional header) carries cards only; imported cards are `reviewed: false`.

## Storage (`src/db`)

Dexie database `sproutcards`. Tables: `decks`, `cards`, `progress`, `reviewLogs`, `settings` (one row).
Everything that touches several tables (delete deck, save session, import) runs in one transaction.

**Schema changes without losing data:** never edit an existing `version(n)` block; add `version(n + 1)`
with only the changed stores and an `.upgrade()` function. `repo.test.ts` contains a test that opens a
database created at version 1 with a version-2 class and checks the data survived.

## UI (`src/ui`)

- `App` = `AppProviders` (opens the database, loads settings, provides repository and UI language,
  shows a clear screen if storage is blocked) + `HashRouter` + `AppRoutes`. A hash router is used so the
  static site works offline and on any static host without server rewrites.
- Screens read data with `useLiveQuery` (dexie-react-hooks), so lists update by themselves after a write.
- Routes: `/` home, `/stats`, `/catalog`, `/sources`, `/decks`, `/decks/new`, `/decks/:id`, `/decks/:id/edit`, `/decks/:id/cards/new`,
  `/decks/:id/cards/:cardId`, `/backup`, `/settings`.
- i18n: all text goes through `t(key)` / `tp(base, count)` (plural rules from `Intl.PluralRules`; Ukrainian
  needs one/few/many/other). Language names come from `Intl.DisplayNames`. Tests check that `uk` has every
  key, all plural forms and the same placeholders as `en`.
- Destructive actions (delete deck/card) use `ConfirmDialog` (native `<dialog>`). Forms show errors next to
  the field and keep what the user typed; a failed save shows a message and changes nothing.
- Design tokens are CSS custom properties in `src/styles/tokens.css`; see `docs/DESIGN.md`.

## Testing

Vitest + Testing Library; `fake-indexeddb` gives an in-memory IndexedDB (`src/test/setup.ts`). Logic is
tested before UI. Checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

### Real-browser checks (`scripts/browser/`)

Unit and UI tests cannot see a service worker, so three scripts drive a headless Chrome (DevTools Protocol, no
extra dependencies; they use a throw-away profile):

- `npm run check:offline` (after `npm run build`): installs the service worker from `dist/`, stops the
  server, reloads (the app and the visited catalog page still open), then fakes a new version, checks it
  waits for the user, applies it and checks that a deck written to IndexedDB is still there.
- `npm run check:a11y` (with `npm run dev` running): axe-core on 12 screens, with demo data (`/?seed`).
- `npm run check:headers` (after `npm run build`): serves `dist/` with exactly the headers from `dist/_headers`
  (including the strict Content-Security-Policy), adds a catalog deck, visits the main screens and fails on any
  console error or CSP violation.
- Lighthouse is run by hand against `npm run preview` (see README).

## Hosting (prepared, not deployed)

The build in `dist/` is plain static files with relative paths: any static host or sub-path works. Nothing needs a
server, a database or an API key. `public/_headers` (Cloudflare Pages, Netlify) sets security headers
(Content-Security-Policy locked to the app's own origin: no third-party requests exist), long caching for hashed
files and `no-cache` for `index.html`, `sw.js` and the manifest (otherwise users could be stuck on an old version).
GitHub Pages cannot set headers; the app works there without them. `.github/workflows/deploy-pages.yml` can publish
to GitHub Pages but runs only when started by hand. Walkthrough and hosting comparison: `docs/IPHONE_TEST.md`.
