import { serializeBackup, parseExchange } from '../core/exchange';
import { createFixedIntervalScheduler } from '../core/scheduler';
import { DEFAULT_SETTINGS } from '../core/types';
import type { Progress } from '../core/types';
import { AppDatabase } from './db';
import { createRepo } from './repo';

let dbCount = 0;
let db: AppDatabase;
let n: number;
let clock: number;
const repo = () =>
  createRepo(
    db,
    () => `id-${++n}`,
    () => ++clock,
  );

beforeEach(() => {
  db = new AppDatabase(`test-${++dbCount}`);
  n = 0;
  clock = 1000;
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(db.name);
});

const deckInput = { name: 'Travel', learningLang: 'en', translationLang: 'uk' };

function progressFor(
  cardId: string,
  deckId: string,
  direction: 'forward' | 'backward' = 'forward',
): Progress {
  return {
    ...createFixedIntervalScheduler().review(undefined, 'correct', 5000),
    id: `${cardId}:${direction}`,
    cardId,
    deckId,
    direction,
    lastReviewedAt: 5000,
  };
}

describe('decks and cards', () => {
  it('creates a deck and finds it again', async () => {
    const r = repo();
    const deck = await r.createDeck({ ...deckInput, name: '  Travel  ' });
    expect(deck.name).toBe('Travel');
    expect(await r.getDeck(deck.id)).toEqual(deck);
    expect(await r.listDecks()).toEqual([deck]);
  });

  it('refuses an empty deck name, on create and on update', async () => {
    const r = repo();
    await expect(r.createDeck({ ...deckInput, name: '  ' })).rejects.toThrow();
    const deck = await r.createDeck(deckInput);
    await expect(r.updateDeck(deck.id, { name: '' })).rejects.toThrow();
    await expect(r.updateDeck('missing', { name: 'x' })).rejects.toThrow(/not found/);
    expect((await r.getDeck(deck.id))?.name).toBe('Travel');
  });

  it('adds, edits and lists cards in creation order', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    const a = await r.addCard(deck.id, { term: ' ticket ', translations: ['квиток', ' ', ''] });
    const b = await r.addCard(deck.id, { term: 'train', translations: ['потяг'], notes: ' note ' });
    expect(a).toMatchObject({ term: 'ticket', translations: ['квиток'], reviewed: true });
    expect(b.notes).toBe('note');
    await r.updateCard(a.id, { term: 'ticket', translations: ['квиток', 'білет'] });
    const cards = await r.listCards(deck.id);
    expect(cards.map((c) => c.term)).toEqual(['ticket', 'train']);
    expect(cards[0]?.translations).toEqual(['квиток', 'білет']);
  });

  it('refuses cards that cannot be studied and cards for a missing deck', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    await expect(r.addCard(deck.id, { term: '', translations: ['x'] })).rejects.toThrow();
    await expect(r.addCard(deck.id, { term: 'x', translations: [' '] })).rejects.toThrow();
    await expect(r.addCard('missing', { term: 'x', translations: ['y'] })).rejects.toThrow(
      /not found/,
    );
    await expect(r.updateCard('missing', { term: 'x', translations: ['y'] })).rejects.toThrow();
    expect(await r.listCards(deck.id)).toEqual([]);
  });

  it('deleting a deck removes its cards, progress and logs, but not other decks', async () => {
    const r = repo();
    const keep = await r.createDeck({ ...deckInput, name: 'Keep' });
    const gone = await r.createDeck({ ...deckInput, name: 'Gone' });
    const keepCard = await r.addCard(keep.id, { term: 'a', translations: ['б'] });
    const goneCard = await r.addCard(gone.id, { term: 'c', translations: ['д'] });
    await r.saveSession(
      [progressFor(keepCard.id, keep.id), progressFor(goneCard.id, gone.id)],
      [
        {
          at: 1,
          cardId: keepCard.id,
          deckId: keep.id,
          direction: 'forward',
          mode: 'learn',
          result: 'correct',
        },
        {
          at: 2,
          cardId: goneCard.id,
          deckId: gone.id,
          direction: 'forward',
          mode: 'learn',
          result: 'wrong',
        },
      ],
    );
    await r.deleteDeck(gone.id);
    expect((await r.listDecks()).map((d) => d.name)).toEqual(['Keep']);
    expect(await db.cards.count()).toBe(1);
    expect(await db.progress.count()).toBe(1);
    expect(await db.reviewLogs.count()).toBe(1);
  });

  it('deleting a card removes its progress', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    const card = await r.addCard(deck.id, { term: 'a', translations: ['б'] });
    await r.saveSession(
      [progressFor(card.id, deck.id), progressFor(card.id, deck.id, 'backward')],
      [],
    );
    await r.deleteCard(card.id);
    expect(await db.cards.count()).toBe(0);
    expect(await db.progress.count()).toBe(0);
  });
});

describe('progress', () => {
  it('lists by deck and direction, and finds what is due', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    const card = await r.addCard(deck.id, { term: 'a', translations: ['б'] });
    const fwd = { ...progressFor(card.id, deck.id), dueAt: 100 };
    const back = { ...progressFor(card.id, deck.id, 'backward'), dueAt: 900 };
    await r.saveSession([fwd, back], []);
    expect(await r.listProgress(deck.id)).toHaveLength(2);
    expect(await r.listProgress(deck.id, 'backward')).toEqual([back]);
    expect(await r.listDueProgress(500)).toEqual([fwd]);
    expect(await r.listDueProgress(900)).toHaveLength(2);
  });

  it('saving the same card again replaces its record instead of duplicating it', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    const card = await r.addCard(deck.id, { term: 'a', translations: ['б'] });
    await r.saveSession([progressFor(card.id, deck.id)], []);
    await r.saveSession([{ ...progressFor(card.id, deck.id), reps: 9 }], []);
    const all = await r.listProgress(deck.id);
    expect(all).toHaveLength(1);
    expect(all[0]?.reps).toBe(9);
  });

  it('saveSession is atomic: a bad log row leaves the progress unsaved', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    const card = await r.addCard(deck.id, { term: 'a', translations: ['б'] });
    const badLog = {
      id: 1,
      at: 1,
      cardId: card.id,
      deckId: deck.id,
      direction: 'forward',
      mode: 'learn',
      result: 'correct',
    } as const;
    await r.saveSession([], [badLog]);
    await expect(r.saveSession([progressFor(card.id, deck.id)], [badLog])).rejects.toThrow();
    expect(await db.progress.count()).toBe(0);
  });

  it('lists review logs since a moment', async () => {
    const r = repo();
    const log = (at: number) => ({
      at,
      cardId: 'c',
      deckId: 'd',
      direction: 'forward' as const,
      mode: 'learn' as const,
      result: 'correct' as const,
    });
    await r.saveSession([], [log(10), log(20), log(30)]);
    expect((await r.listLogs(20)).map((l) => l.at)).toEqual([20, 30]);
  });

  it('statsSnapshot gathers decks, card ids, progress and the log in one go', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    const other = await r.createDeck({ ...deckInput, name: 'Other' });
    const card = await r.addCard(deck.id, { term: 'cat', translations: ['кіт'] });
    await r.saveSession(
      [progressFor(card.id, deck.id)],
      [
        {
          at: 10,
          cardId: card.id,
          deckId: deck.id,
          direction: 'forward',
          mode: 'learn',
          result: 'correct',
        },
        {
          at: 30,
          cardId: card.id,
          deckId: deck.id,
          direction: 'forward',
          mode: 'learn',
          result: 'wrong',
        },
      ],
    );
    const snapshot = await r.statsSnapshot(20);
    expect(snapshot.decks.map((d) => d.id)).toEqual([deck.id, other.id]);
    expect(snapshot.cardIdsByDeck).toEqual({ [deck.id]: [card.id], [other.id]: [] });
    expect(snapshot.progress).toHaveLength(1);
    expect(snapshot.logs.map((l) => l.at)).toEqual([30]);
    expect(snapshot.totalReviews).toBe(2);
  });
});

describe('settings', () => {
  it('returns defaults when nothing is saved, and saved values afterwards', async () => {
    const r = repo();
    expect(await r.getSettings()).toEqual(DEFAULT_SETTINGS);
    await r.saveSettings({ ...DEFAULT_SETTINGS, uiLanguage: 'en', newCardsPerDay: 25 });
    expect(await r.getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      uiLanguage: 'en',
      newCardsPerDay: 25,
    });
  });

  it('fills settings added in later versions with defaults', async () => {
    await db.settings.put({ id: 'app', uiLanguage: 'en' } as never);
    expect(await repo().getSettings()).toEqual({ ...DEFAULT_SETTINGS, uiLanguage: 'en' });
  });
});

describe('export and import', () => {
  async function seed() {
    const r = repo();
    const deck = await r.createDeck({ ...deckInput, description: 'd' });
    const a = await r.addCard(deck.id, {
      term: 'ticket',
      translations: ['квиток'],
      examples: [{ text: 'A ticket.' }],
    });
    await r.addCard(deck.id, { term: 'train', translations: ['потяг'] });
    await r.saveSession([progressFor(a.id, deck.id)], []);
    return { r, deck };
  }

  it('exports a deck with cards and progress', async () => {
    const { r, deck } = await seed();
    const bundle = await r.exportDeck(deck.id);
    expect(bundle.deck.id).toBe(deck.id);
    expect(bundle.cards).toHaveLength(2);
    expect(bundle.progress).toHaveLength(1);
    await expect(r.exportDeck('missing')).rejects.toThrow(/not found/);
  });

  it('importing a backup into an empty database restores decks, cards and progress', async () => {
    const { r } = await seed();
    const text = serializeBackup(await r.exportAll());

    const fresh = new AppDatabase(`test-fresh-${dbCount}`);
    try {
      const r2 = createRepo(fresh, () => `new-${++n}`);
      const parsed = parseExchange(text);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const decks = await r2.importBundles(parsed.value);
      expect(decks).toHaveLength(1);
      const cards = await r2.listCards(decks[0]!.id);
      expect(cards.map((c) => c.term).sort()).toEqual(['ticket', 'train']);
      const progress = await r2.listProgress(decks[0]!.id);
      expect(progress).toHaveLength(1);
      expect(cards.map((c) => c.id)).toContain(progress[0]!.cardId); // links were remapped consistently
    } finally {
      fresh.close();
      await AppDatabase.delete(fresh.name);
    }
  });

  it('importing the same file twice makes two separate decks and never overwrites', async () => {
    const { r, deck } = await seed();
    const bundles = await r.exportAll();
    await r.importBundles(bundles);
    await r.importBundles(bundles);
    expect(await r.listDecks()).toHaveLength(3);
    expect(await db.cards.count()).toBe(6);
    expect(await r.listCards(deck.id)).toHaveLength(2);
  });

  it('a failing import writes nothing (all or nothing)', async () => {
    const { r } = await seed();
    const [bundle] = await r.exportAll();
    // Two cards with the same id make the second insert fail inside the transaction.
    const broken = { ...bundle!, cards: [bundle!.cards[0]!, bundle!.cards[0]!] };
    const repoWithFixedIds = createRepo(
      db,
      (() => {
        let i = 0;
        return () => (i++ < 1 ? 'deck-x' : 'same-id');
      })(),
    );
    await expect(repoWithFixedIds.importBundles([broken])).rejects.toThrow();
    expect(await r.listDecks()).toHaveLength(1);
    expect(await db.cards.count()).toBe(2);
  });

  it('addCards appends to an existing deck, and refuses a missing one', async () => {
    const { r, deck } = await seed();
    const card = { ...(await r.listCards(deck.id))[0]!, id: 'extra' };
    await r.addCards(deck.id, [card]);
    expect(await r.listCards(deck.id)).toHaveLength(3);
    await expect(r.addCards('missing', [card])).rejects.toThrow(/not found/);
  });
});

describe('persistence across restarts', () => {
  it('data is still there after closing and reopening the database', async () => {
    const r = repo();
    const deck = await r.createDeck(deckInput);
    await r.addCard(deck.id, { term: 'a', translations: ['б'] });
    db.close();

    db = new AppDatabase(db.name);
    const again = repo();
    expect((await again.listDecks()).map((d) => d.name)).toEqual(['Travel']);
    expect(await again.listCards(deck.id)).toHaveLength(1);
  });

  it('keeps existing data when a newer schema version is opened (upgrade path)', async () => {
    // Pretend the app shipped with version 1 and later added version 2 with a new index.
    const r = repo();
    const deck = await r.createDeck(deckInput);
    await r.addCard(deck.id, { term: 'a', translations: ['б'] });
    db.close();

    class V2 extends AppDatabase {
      constructor(name: string) {
        super(name);
        this.version(2)
          .stores({ cards: 'id, deckId, term' })
          .upgrade((tx) => tx.table('cards').toCollection().modify({ notes: 'migrated' }));
      }
    }
    const upgraded = new V2(db.name);
    try {
      const cards = await upgraded.cards.toArray();
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({ term: 'a', notes: 'migrated' });
      expect(await upgraded.decks.count()).toBe(1);
    } finally {
      upgraded.close();
    }
    db = new AppDatabase(db.name); // so afterEach can close/delete it
  });
});
