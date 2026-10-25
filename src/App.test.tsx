import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { AppDatabase } from './db/db';
import { createRepo } from './db/repo';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  name = `ui-test-${++n}`;
  db = new AppDatabase(name);
  window.location.hash = '#/';
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(name);
});

/** Closes the database and opens it again, as if the user quit and reopened the app. */
function restart() {
  db.close();
  db = new AppDatabase(name);
}

describe('first run', () => {
  it('welcomes the user and offers to create a deck', async () => {
    render(<App db={db} />);
    expect(await screen.findByText(/I'm Sprout/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New deck' })).toBeInTheDocument();
  });

  it('shows a clear message when storage is unavailable', async () => {
    const broken = new AppDatabase('broken');
    broken.open = (() => Promise.reject(new Error('blocked'))) as unknown as typeof broken.open;
    render(<App db={broken} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is not available');
  });
});

describe('create a deck and cards, restart, find them again', () => {
  it('works end to end', async () => {
    const user = userEvent.setup();
    const first = render(<App db={db} />);

    await user.click(await screen.findByRole('link', { name: 'New deck' }));
    await user.type(await screen.findByLabelText('Deck name'), 'Travel');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // deck screen
    expect(await screen.findByRole('heading', { name: 'Travel' })).toBeInTheDocument();
    expect(screen.getByText('No cards yet')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Add card' }));
    await user.type(await screen.findByLabelText(/^Word or phrase/), 'ticket');
    await user.type(screen.getByLabelText(/^Translations/), 'квиток');
    await user.click(screen.getByRole('button', { name: 'Save and add another' }));

    // form is cleared for the next card and says what happened
    expect(await screen.findByText(/Cards added so far: 1/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Word or phrase/)).toHaveValue('');
    await user.type(screen.getByLabelText(/^Word or phrase/), 'train');
    await user.type(screen.getByLabelText(/^Translations/), 'потяг{Enter}поїзд');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('ticket')).toBeInTheDocument();
    expect(screen.getByText('train')).toBeInTheDocument();
    expect(screen.getByText('потяг; поїзд')).toBeInTheDocument();

    // "restart" the app
    first.unmount();
    restart();
    window.location.hash = '#/decks';
    render(<App db={db} />);
    expect(await screen.findByText('Travel')).toBeInTheDocument();
    expect(screen.getByText(/2 cards/)).toBeInTheDocument();
  });
});

describe('validation', () => {
  it('does not save a deck without a name and shows the error', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/decks/new';
    render(<App db={db} />);
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a name for the deck.')).toBeInTheDocument();
    expect(await createRepo(db).listDecks()).toEqual([]);
  });

  it('rejects the same language twice', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/decks/new';
    render(<App db={db} />);
    await user.type(await screen.findByLabelText('Deck name'), 'Same');
    await user.selectOptions(screen.getByLabelText('Language you are learning'), 'uk');
    await user.selectOptions(screen.getByLabelText('Language of translations'), 'uk');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('The two languages must be different.')).toBeInTheDocument();
  });

  it('does not save a card without a word or translation', async () => {
    const user = userEvent.setup();
    const deck = await createRepo(db).createDeck({
      name: 'D',
      learningLang: 'en',
      translationLang: 'uk',
    });
    window.location.hash = `#/decks/${deck.id}/cards/new`;
    render(<App db={db} />);
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter the word or phrase.')).toBeInTheDocument();
    expect(screen.getByText('Enter at least one translation.')).toBeInTheDocument();
    expect(await createRepo(db).listCards(deck.id)).toEqual([]);
  });
});

describe('destructive actions ask first', () => {
  it('deleting a deck needs confirmation, and cancel keeps it', async () => {
    const user = userEvent.setup();
    const repo = createRepo(db);
    const deck = await repo.createDeck({
      name: 'Doomed',
      learningLang: 'en',
      translationLang: 'uk',
    });
    await repo.addCard(deck.id, { term: 'a', translations: ['б'] });
    window.location.hash = `#/decks/${deck.id}`;
    render(<App db={db} />);

    await user.click(await screen.findByRole('button', { name: 'Delete deck' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await repo.listDecks()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Delete deck' }));
    dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No decks yet')).toBeInTheDocument();
    expect(await repo.listDecks()).toEqual([]);
    expect(await db.cards.count()).toBe(0);
  });

  it('deleting a card needs confirmation', async () => {
    const user = userEvent.setup();
    const repo = createRepo(db);
    const deck = await repo.createDeck({ name: 'D', learningLang: 'en', translationLang: 'uk' });
    const card = await repo.addCard(deck.id, { term: 'word', translations: ['слово'] });
    window.location.hash = `#/decks/${deck.id}/cards/${card.id}`;
    render(<App db={db} />);
    await user.click(await screen.findByRole('button', { name: 'Delete card' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }),
    );
    await waitFor(async () => expect(await repo.listCards(deck.id)).toEqual([]));
  });
});

describe('editing keeps data', () => {
  it('keeps all examples of a card when it is edited', async () => {
    const user = userEvent.setup();
    const repo = createRepo(db);
    const deck = await repo.createDeck({ name: 'D', learningLang: 'en', translationLang: 'uk' });
    const card = await repo.addCard(deck.id, {
      term: 'run',
      translations: ['бігти'],
      examples: [{ text: 'I run.' }, { text: 'She runs.', translation: 'Вона бігає.' }],
    });
    window.location.hash = `#/decks/${deck.id}/cards/${card.id}`;
    render(<App db={db} />);
    const term = await screen.findByLabelText(/^Word or phrase/);
    await user.clear(term);
    await user.type(term, 'run!');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await repo.listCards(deck.id))[0]?.term).toBe('run!'));
    expect((await repo.listCards(deck.id))[0]?.examples).toEqual([
      { text: 'I run.' },
      { text: 'She runs.', translation: 'Вона бігає.' },
    ]);
  });

  it('an unknown deck shows the not-found screen', async () => {
    window.location.hash = '#/decks/does-not-exist';
    render(<App db={db} />);
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});

describe('import', () => {
  it('refuses a broken file, lists the problems and changes nothing', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/backup';
    const { container } = render(<App db={db} />);
    await screen.findByRole('heading', { name: 'Backup and import' });
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(
      input,
      new File(['not json at all'], 'bad.json', { type: 'application/json' }),
    );
    expect(
      await screen.findByText('The file was not imported. Nothing was changed.'),
    ).toBeInTheDocument();
    expect(screen.getByText('The file is not valid JSON.')).toBeInTheDocument();
    expect(await createRepo(db).listDecks()).toEqual([]);
  });

  it('imports a valid deck file as a new deck', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/backup';
    const { container } = render(<App db={db} />);
    await screen.findByRole('heading', { name: 'Backup and import' });
    const file = JSON.stringify({
      format: 'sproutcards-deck',
      version: 1,
      deck: { id: 'x', name: 'Imported', learningLang: 'de', translationLang: 'uk' },
      cards: [{ id: 'c', term: 'Haus', translations: ['будинок'] }],
    });
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, new File([file], 'deck.json', { type: 'application/json' }));
    expect(await screen.findByText(/Imported: 1 deck, 1 card\./)).toBeInTheDocument();
    const decks = await createRepo(db).listDecks();
    expect(decks.map((d) => d.name)).toEqual(['Imported']);
    expect(decks[0]?.id).not.toBe('x'); // always a fresh id
  });
});

describe('settings', () => {
  it('switches the interface language and remembers it after restart', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    const first = render(<App db={db} />);
    await user.click(await screen.findByRole('radio', { name: 'Українська' }));
    expect(await screen.findByRole('heading', { name: 'Налаштування' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uk');

    first.unmount();
    restart();
    render(<App db={db} />);
    expect(await screen.findByRole('heading', { name: 'Налаштування' })).toBeInTheDocument();
  });

  it('rejects an invalid number of new cards without saving it', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/settings';
    render(<App db={db} />);
    const field = await screen.findByLabelText('New cards per day');
    await user.clear(field);
    await user.type(field, '9999');
    expect(await screen.findByText('Enter a whole number from 0 to 200.')).toBeInTheDocument();
    await user.tab(); // leaving the field discards the invalid text
    expect(field).toHaveValue('10');
    expect((await createRepo(db).getSettings()).newCardsPerDay).toBe(10);
    await user.clear(field);
    await user.type(field, '25');
    await user.tab();
    await waitFor(async () => expect((await createRepo(db).getSettings()).newCardsPerDay).toBe(25));
  });
});
