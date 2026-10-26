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

## Other study modes (`flip.ts`, `quiz.ts`, `voice.ts`)

- **Flashcards** (`flip.ts`): one pass, each card once. "Know" is scheduled as `correct`, "don't know" as
  `wrong`, immediately and per card (an interrupted session keeps what was answered).
- **Quiz** (`quiz.ts`): up to 20 questions built with the same `buildExercise` as Learn, every third one
  typed, the rest multiple choice. No feedback until the end. Points: correct 1, `almost` 0.5, wrong 0;
  grade thresholds 90 / 70 / 50 %. A quiz never changes review dates; it only writes the review log.
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
- Lighthouse is run by hand against `npm run preview` (see README).
