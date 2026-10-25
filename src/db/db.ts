import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Card, Deck, Progress, ReviewLog, Settings } from '../core/types';

/** The settings table holds exactly one row. */
export type SettingsRow = Settings & { id: 'app' };

export const DB_NAME = 'sproutcards';

/**
 * IndexedDB schema.
 *
 * HOW TO CHANGE IT WITHOUT LOSING USER DATA: never edit an existing `version(n)` block. Add
 * `this.version(n + 1).stores({ ...only the tables/indexes that changed }).upgrade(tx => ...)`
 * that converts old rows, and add a test that opens a database created at version n.
 * Dexie keeps the old data and runs the upgrade on the user's device when the app updates.
 */
export class AppDatabase extends Dexie {
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  progress!: Table<Progress, string>;
  reviewLogs!: Table<ReviewLog, number>;
  settings!: Table<SettingsRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      decks: 'id, createdAt',
      cards: 'id, deckId',
      // `dueAt` for "what is due today"; the compound index for one deck in one direction.
      progress: 'id, cardId, deckId, dueAt, [deckId+direction]',
      reviewLogs: '++id, at, cardId, deckId',
      settings: 'id',
    });
  }
}

let shared: AppDatabase | undefined;

/** The app-wide database (created on first use). Tests create their own with `new AppDatabase(name)`. */
export function getDb(): AppDatabase {
  shared ??= new AppDatabase();
  return shared;
}
