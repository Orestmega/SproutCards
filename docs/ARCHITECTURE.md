# Architecture

(Skeleton — filled in as the stages are built.)

- `src/core/` — pure logic, no React or browser APIs (scheduler, Learn engine, answer checking, import/export).
- `src/db/` — Dexie schema and repositories.
- `src/i18n/` — translation files (`uk`, `en`).
- `src/ui/` — React components and screens.
- `scripts/` — reproducible data preparation scripts.
