# Data sources

Every data source used by the app is listed here with its official address, version, download date
and licence (checked before use, see "How the licence was checked"). Nothing else is included.

## Sources in use

| Source | Official address | Version | Downloaded | Licence | Used for |
|---|---|---|---|---|---|
| Tatoeba, English sentences (detailed export) | https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_detailed.tsv.bz2 | export of 2026-10-24 06:41 GMT, 34 953 888 bytes, sha256 `c39d2fab0cc5bc2b798b539134b83abaf5dec723a059ce55496907d08e3e9030` | 2026-10-26 | CC BY 2.0 FR | English example sentences, word frequencies |
| Tatoeba, Ukrainian sentences (detailed export) | https://downloads.tatoeba.org/exports/per_language/ukr/ukr_sentences_detailed.tsv.bz2 | export of 2026-10-24 06:41 GMT, 3 083 939 bytes, sha256 `f31ef3515dc856b078050f93d271d2edb652473fce5c227bc05d624c9ec501b1` | 2026-10-26 | CC BY 2.0 FR | Ukrainian translations of the examples |
| Tatoeba, English–Ukrainian links | https://downloads.tatoeba.org/exports/per_language/eng/eng-ukr_links.tsv.bz2 | export of 2026-10-24 06:55 GMT, 1 259 024 bytes, sha256 `236890a485d1d947c1b0f3ac93616271820c3efac9c3d3789b96d61608c24f42` | 2026-10-26 | CC BY 2.0 FR | which English sentence translates to which Ukrainian one |

The raw files are kept in `data-cache/` (git-ignored, not published). Only the derived decks in
`public/catalog/` are part of the project. `data-cache/manifest.json` is written by
`scripts/fetch-tatoeba.ts` with the sizes and hashes above.

## Content written for this project (not from a third-party source)

- **Word and phrase translations** (`scripts/data/translations.en-uk.json`) were **written by an AI
  assistant**, not copied from any dictionary or other app. They have not been checked by a human, so every
  card built from them has `reviewed: false` and the app labels them "Not checked".
- **Which words** are in the frequent-word decks: computed by `scripts/candidates.ts` from the Tatoeba
  sentences themselves (how often a word occurs in English sentences that have a Ukrainian translation).
  No third-party frequency list is used. Function words (the, a, of...), contractions and some auxiliary
  forms were left out because they have no clean one-word translation.
- **Travel deck** words and phrases were chosen and translated by the same AI assistant (unchecked).

## Licence terms that apply

- **Tatoeba sentences: CC BY 2.0 FR** (https://creativecommons.org/licenses/by/2.0/fr/). Reuse is allowed
  **if the author of each sentence is credited**. The app credits them in two ways: every catalog deck has
  an attribution file (`public/catalog/attribution/<deck>.tsv`: link and author of each English and
  Ukrainian sentence used), and the "Sources and licenses" page lists the files and the licence.
  Sentences are included unchanged (only trimmed of surrounding spaces). Short example sentences were
  selected by a content filter (see `scripts/tatoeba.ts`), not edited.
- Tatoeba says it is "not generally opposed" to commercial use of its content, but this app is a
  **non-commercial personal project**, and the owner's decision about any future commercial use is
  recorded in `JOURNAL.md` ("Черга рішень власника").
- The **application code** is MIT (see `LICENSE`). The data in `public/catalog/` keeps the licences above.

## How the licence was checked

- 2026-10-26, https://tatoeba.org/en/downloads: "The files are released under CC BY 2.0 FR"; part of the
  sentences are also CC0; many English sentences come from the public-domain Tanaka Corpus.
- 2026-10-26, https://tatoeba.org/en/terms_of_use: default licence for sentences is CC BY 2.0 FR; "using,
  reusing, modifying and distributing the sentence is only allowed if the name of the author is cited";
  commercial use depends primarily on contributors.
- Audio files and their licences are **not** used.

## Rebuilding the catalog

```
node scripts/fetch-tatoeba.ts      # download (official addresses only), needs bzip2 (ships with Git for Windows)
node scripts/candidates.ts         # most frequent words -> scripts/data/candidates.en.json
node scripts/build-catalog.ts      # decks, index and attribution -> public/catalog/
```

The build is deterministic for a given Tatoeba export. A newer export changes the examples and the word
order; check the diff and the "How the licence was checked" section again before committing it.
