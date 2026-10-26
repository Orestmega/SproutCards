import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { AppDatabase } from '../../db/db';
import { createRepo } from '../../db/repo';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  name = `catalog-test-${++n}`;
  db = new AppDatabase(name);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  db.close();
  await AppDatabase.delete(name);
});

const ROOT = join(process.cwd(), 'public', 'catalog');

interface FetchOptions {
  /** Paths (relative to the catalog folder) that should fail with a network error. */
  offline?: boolean;
  /** Paths answered with this status instead of the file. */
  status?: Record<string, number>;
  /** Paths answered with this text instead of the file. */
  override?: Record<string, string>;
}

/** Serves the real generated catalog files, with optional failures. */
function stubCatalog(options: FetchOptions = {}) {
  const requested: string[] = [];
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const path = new URL(String(input)).pathname.split('/catalog/')[1] as string;
    requested.push(path);
    if (options.offline) throw new TypeError('Failed to fetch');
    const status = options.status?.[path];
    if (status) return new Response('error', { status });
    const body = options.override?.[path] ?? readFileSync(join(ROOT, path), 'utf8');
    return new Response(body, { status: 200 });
  });
  return requested;
}

function open(path: string) {
  window.location.hash = `#${path}`;
  return render(<App db={db} />);
}

describe('catalog list', () => {
  it('shows the ready-made decks with their size and an honest "not checked" label', async () => {
    stubCatalog();
    open('/catalog');
    expect(await screen.findByText('Frequent English words, part 1')).toBeInTheDocument();
    expect(screen.getByText('Travel (English)')).toBeInTheDocument();
    expect(screen.getAllByText('Translations not checked')).toHaveLength(4);
    expect(screen.getAllByText(/100 cards/).length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByRole('link', { name: 'Authors of the sentences' })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('/catalog/attribution/freq-en-uk-1.tsv'),
    );
  });

  it('explains a network failure and recovers on retry', async () => {
    const user = userEvent.setup();
    stubCatalog({ offline: true });
    open('/catalog');
    expect(await screen.findByText(/Could not load the catalog/)).toBeInTheDocument();
    stubCatalog();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Frequent English words, part 1')).toBeInTheDocument();
  });

  it('refuses a damaged index', async () => {
    stubCatalog({ override: { 'index.json': '{"version":1,"decks":"nope"}' } });
    open('/catalog');
    expect(
      await screen.findByText('The catalog file is damaged. Please try again later.'),
    ).toBeInTheDocument();
  });

  it('is reachable from the decks screen', async () => {
    stubCatalog();
    const user = userEvent.setup();
    open('/decks');
    await user.click(await screen.findByRole('link', { name: 'Deck catalog' }));
    expect(await screen.findByRole('heading', { name: 'Deck catalog' })).toBeInTheDocument();
  });
});

describe('adding a catalog deck', () => {
  it('copies the whole deck to the device, unchecked, with examples, and then works without network', async () => {
    const user = userEvent.setup();
    const requested = stubCatalog();
    open('/catalog');
    await user.click(await screen.findByRole('button', { name: /^Add .*part 1/ }));

    expect(
      await screen.findByText(/“Frequent English words, part 1” was added\./),
    ).toBeInTheDocument();
    const repo = createRepo(db);
    const [deck] = await repo.listDecks();
    expect(deck).toMatchObject({
      name: 'Frequent English words, part 1',
      catalogId: 'freq-en-uk-1',
      learningLang: 'en',
      translationLang: 'uk',
    });
    expect(Math.abs((deck?.createdAt ?? 0) - Date.now())).toBeLessThan(60_000); // stamped now, not 1970
    const cards = await repo.listCards(deck!.id);
    expect(cards).toHaveLength(100);
    expect(cards.every((c) => !c.reviewed)).toBe(true);
    expect(cards.filter((c) => c.examples.length > 0).length).toBeGreaterThan(90);
    expect(requested).toEqual(['index.json', 'decks/freq-en-uk-1.json']); // only this part was downloaded

    // the button becomes a link to the deck: no duplicates
    expect(await screen.findByRole('link', { name: 'Already added: open' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add .*part 1/ })).not.toBeInTheDocument();

    // from now on the network is not needed
    stubCatalog({ offline: true });
    await user.click(screen.getByRole('link', { name: 'Open the deck' }));
    expect(
      await screen.findByRole('heading', { name: 'Frequent English words, part 1' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Unchecked').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('link', { name: 'Learn' }));
    expect(await screen.findByText('Choose the translation')).toBeInTheDocument();
  });

  it('names the deck in the Ukrainian interface language', async () => {
    const user = userEvent.setup();
    stubCatalog();
    await createRepo(db).saveSettings({
      uiLanguage: 'uk',
      speechEnabled: true,
      newCardsPerDay: 10,
      ignoreDiacritics: true,
    });
    open('/catalog');
    await user.click(await screen.findByRole('button', { name: /^Додати .*частина 3/ }));
    await waitFor(async () =>
      expect((await createRepo(db).listDecks()).map((d) => d.name)).toEqual([
        'Частотні англійські слова, частина 3',
      ]),
    );
  });

  it('adds nothing when the download fails, and says so', async () => {
    const user = userEvent.setup();
    stubCatalog({ status: { 'decks/freq-en-uk-1.json': 503 } });
    open('/catalog');
    await user.click(await screen.findByRole('button', { name: /^Add .*part 1/ }));
    expect(
      await screen.findByText(/Could not download “Frequent English words, part 1”/),
    ).toBeInTheDocument();
    expect(await createRepo(db).listDecks()).toEqual([]);
    // the button is back, so the user can try again
    expect(screen.getByRole('button', { name: /^Add .*part 1/ })).toBeEnabled();
  });

  it('adds nothing when the deck file is damaged', async () => {
    const user = userEvent.setup();
    stubCatalog({
      override: {
        'decks/freq-en-uk-2.json': '{"format":"sproutcards-deck","version":1,"cards":[]}',
      },
    });
    open('/catalog');
    await user.click(await screen.findByRole('button', { name: /^Add .*part 2/ }));
    expect(
      await screen.findByText(/The file for “Frequent English words, part 2” is damaged/),
    ).toBeInTheDocument();
    expect(await createRepo(db).listDecks()).toEqual([]);
  });

  it('adds nothing when the device storage fails (all or nothing)', async () => {
    const user = userEvent.setup();
    stubCatalog();
    open('/catalog');
    const button = await screen.findByRole('button', { name: /^Add .*Travel/ });
    db.cards.bulkAdd = (() =>
      Promise.reject(new Error('quota'))) as unknown as typeof db.cards.bulkAdd;
    await user.click(button);
    expect(
      await screen.findByText(/Could not save “Travel \(English\)” on this device/),
    ).toBeInTheDocument();
    expect(await createRepo(db).listDecks()).toEqual([]);
  });

  it('survives export and import with the catalog link intact', async () => {
    const user = userEvent.setup();
    stubCatalog();
    open('/catalog');
    await user.click(await screen.findByRole('button', { name: /^Add .*Travel/ }));
    await screen.findByRole('link', { name: 'Already added: open' });
    const repo = createRepo(db);
    const bundles = await repo.exportAll();
    expect(bundles[0]?.deck.catalogId).toBe('topic-travel-en-uk');
    await repo.importBundles(bundles);
    expect((await repo.listDecks()).map((d) => d.catalogId)).toEqual([
      'topic-travel-en-uk',
      'topic-travel-en-uk',
    ]);
  });
});

describe('sources and licenses', () => {
  it('names Tatoeba and its licence, lists the author files, and admits the AI translations', async () => {
    stubCatalog();
    open('/sources');
    expect(
      await screen.findByRole('heading', { name: 'Sources and licenses' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Example sentences: Tatoeba')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'License CC BY 2.0 FR' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/2.0/fr/',
    );
    expect(await screen.findByText(/Tatoeba export used: /)).toBeInTheDocument();
    expect(
      await screen.findAllByRole('link', { name: /List of sentences and authors/ }),
    ).toHaveLength(4);
    expect(screen.getByText(/written by an AI assistant/)).toBeInTheDocument();
    expect(screen.getByText('This is a non-commercial personal project.')).toBeInTheDocument();
  });

  it('still shows the licence text when offline', async () => {
    stubCatalog({ offline: true });
    open('/sources');
    expect(
      await screen.findByText('The author files are available when you are online.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Example sentences: Tatoeba')).toBeInTheDocument();
  });

  it('is linked from the settings', async () => {
    stubCatalog();
    const user = userEvent.setup();
    open('/settings');
    await user.click(await screen.findByRole('link', { name: 'Sources and licenses' }));
    expect(await screen.findByText('Example sentences: Tatoeba')).toBeInTheDocument();
  });
});
