// Storage operations. Every multi-table change runs in one transaction, so a failure leaves the
// data as it was (no half-deleted decks, no half-imported files).

import type { DeckBundle } from '../core/exchange';
import { remapBundleIds } from '../core/exchange';
import type { IdFactory } from '../core/id';
import { newId } from '../core/id';
import type { Card, Deck, Direction, Example, Progress, ReviewLog, Settings } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import type { AppDatabase } from './db';

export interface NewDeck {
  name: string;
  learningLang: string;
  translationLang: string;
  description?: string;
  source?: string;
}

export interface NewCard {
  term: string;
  translations: string[];
  examples?: Example[];
  notes?: string;
  reviewed?: boolean;
}

/** Trims text and removes empty translations; throws on content that could not be studied. */
function cleanCard(input: NewCard): Omit<Card, 'id' | 'deckId' | 'createdAt'> {
  const term = input.term.trim();
  const translations = input.translations.map((t) => t.trim()).filter((t) => t !== '');
  if (term === '') throw new Error('A card needs a term');
  if (translations.length === 0) throw new Error('A card needs at least one translation');
  const card: Omit<Card, 'id' | 'deckId' | 'createdAt'> = {
    term,
    translations,
    examples: (input.examples ?? []).filter((e) => e.text.trim() !== ''),
    reviewed: input.reviewed ?? true, // cards typed by the user themselves are verified by definition
  };
  const notes = input.notes?.trim();
  if (notes) card.notes = notes;
  return card;
}

export function createRepo(
  db: AppDatabase,
  makeId: IdFactory = newId,
  now: () => number = Date.now,
) {
  return {
    // ---- decks ----
    async createDeck(input: NewDeck): Promise<Deck> {
      const name = input.name.trim();
      if (name === '') throw new Error('A deck needs a name');
      const deck: Deck = { ...input, name, id: makeId(), createdAt: now() };
      await db.decks.add(deck);
      return deck;
    },

    async updateDeck(id: string, changes: Partial<NewDeck>): Promise<void> {
      if (changes.name !== undefined && changes.name.trim() === '') {
        throw new Error('A deck needs a name');
      }
      const updated = await db.decks.update(id, changes);
      if (updated === 0) throw new Error(`Deck ${id} not found`);
    },

    listDecks(): Promise<Deck[]> {
      return db.decks.orderBy('createdAt').toArray();
    },

    getDeck(id: string): Promise<Deck | undefined> {
      return db.decks.get(id);
    },

    /** Deletes a deck with its cards, progress and review history, all or nothing. */
    async deleteDeck(id: string): Promise<void> {
      await db.transaction('rw', [db.decks, db.cards, db.progress, db.reviewLogs], async () => {
        await db.cards.where('deckId').equals(id).delete();
        await db.progress.where('deckId').equals(id).delete();
        await db.reviewLogs.where('deckId').equals(id).delete();
        await db.decks.delete(id);
      });
    },

    // ---- cards ----
    async addCard(deckId: string, input: NewCard): Promise<Card> {
      if (!(await db.decks.get(deckId))) throw new Error(`Deck ${deckId} not found`);
      const card: Card = { ...cleanCard(input), id: makeId(), deckId, createdAt: now() };
      await db.cards.add(card);
      return card;
    },

    async updateCard(id: string, input: NewCard): Promise<void> {
      const updated = await db.cards.update(id, cleanCard(input));
      if (updated === 0) throw new Error(`Card ${id} not found`);
    },

    listCards(deckId: string): Promise<Card[]> {
      return db.cards.where('deckId').equals(deckId).sortBy('createdAt');
    },

    async deleteCard(id: string): Promise<void> {
      await db.transaction('rw', [db.cards, db.progress], async () => {
        await db.progress.where('cardId').equals(id).delete();
        await db.cards.delete(id);
      });
    },

    // ---- progress and history ----
    listProgress(deckId: string, direction?: Direction): Promise<Progress[]> {
      return direction
        ? db.progress.where('[deckId+direction]').equals([deckId, direction]).toArray()
        : db.progress.where('deckId').equals(deckId).toArray();
    },

    /** Progress records that are due now, across all decks. */
    listDueProgress(at: number): Promise<Progress[]> {
      return db.progress.where('dueAt').belowOrEqual(at).toArray();
    },

    /** Saves a finished session: progress and review log together. */
    async saveSession(progress: Progress[], logs: ReviewLog[]): Promise<void> {
      await db.transaction('rw', [db.progress, db.reviewLogs], async () => {
        await db.progress.bulkPut(progress);
        await db.reviewLogs.bulkAdd(logs);
      });
    },

    listLogs(since: number): Promise<ReviewLog[]> {
      return db.reviewLogs.where('at').aboveOrEqual(since).toArray();
    },

    // ---- settings ----
    async getSettings(): Promise<Settings> {
      const row = await db.settings.get('app');
      if (!row) return { ...DEFAULT_SETTINGS };
      const { id: _id, ...saved } = row;
      return { ...DEFAULT_SETTINGS, ...saved }; // new settings added later get their defaults
    },

    async saveSettings(settings: Settings): Promise<void> {
      await db.settings.put({ ...settings, id: 'app' });
    },

    // ---- export / import ----
    async exportDeck(deckId: string): Promise<DeckBundle> {
      const deck = await db.decks.get(deckId);
      if (!deck) throw new Error(`Deck ${deckId} not found`);
      const [cards, progress] = await Promise.all([
        this.listCards(deckId),
        this.listProgress(deckId),
      ]);
      return { deck, cards, progress };
    },

    async exportAll(): Promise<DeckBundle[]> {
      const decks = await this.listDecks();
      return Promise.all(decks.map((d) => this.exportDeck(d.id)));
    },

    /**
     * Adds validated bundles as NEW decks (fresh ids, existing data is never overwritten).
     * All bundles are written in one transaction: either everything is imported or nothing.
     */
    async importBundles(bundles: readonly DeckBundle[]): Promise<Deck[]> {
      const fresh = bundles.map((b) => remapBundleIds(b, makeId));
      await db.transaction('rw', [db.decks, db.cards, db.progress], async () => {
        for (const b of fresh) {
          await db.decks.add(b.deck);
          await db.cards.bulkAdd(b.cards);
          await db.progress.bulkAdd(b.progress);
        }
      });
      return fresh.map((b) => b.deck);
    },

    /** Adds cards (e.g. from CSV) to an existing deck in one transaction. */
    async addCards(deckId: string, cards: readonly Card[]): Promise<void> {
      await db.transaction('rw', [db.decks, db.cards], async () => {
        if (!(await db.decks.get(deckId))) throw new Error(`Deck ${deckId} not found`);
        await db.cards.bulkAdd(cards.map((c) => ({ ...c, deckId })));
      });
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;
