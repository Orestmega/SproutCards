import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';
import { playCue } from './cues';
import { applyTheme, rememberedTheme, rememberTheme } from './theme';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  localStorage.clear();
  name = `features-test-${++n}`;
  db = new AppDatabase(name);
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(name);
});

const WORDS: [string, string][] = [
  ['apple', 'яблуко'],
  ['water', 'вода'],
  ['book', 'книга'],
];

async function seed(words: [string, string][] = WORDS) {
  const repo = createRepo(db);
  const deck = await repo.createDeck({
    name: 'Fruit',
    learningLang: 'en',
    translationLang: 'uk',
  });
  const cards = [];
  for (const [term, translation] of words) {
    cards.push(await repo.addCard(deck.id, { term, translations: [translation] }));
  }
  return { repo, deck, cards };
}

function open(path: string) {
  window.location.hash = `#${path}`;
  return render(<App db={db} />);
}

function logAt(at: number, cardId: string, deckId: string) {
  return {
    at,
    cardId,
    deckId,
    direction: 'forward' as const,
    mode: 'learn' as const,
    result: 'correct' as const,
  };
}

describe('home', () => {
  it('shows the garden with the earned flowers, the goal, the week and the word of the day', async () => {
    const { repo, deck, cards } = await seed();
    const first = cards[0];
    if (!first) throw new Error('no card');
    await repo.saveSession([], [logAt(Date.now(), first.id, deck.id)]);
    open('/');

    expect(await screen.findByRole('heading', { name: "Today's goal" })).toBeInTheDocument();
    expect(screen.getByText('1 of 20 answers')).toBeInTheDocument();
    expect(screen.getByText('19 more to reach it')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem'),
    ).toHaveLength(7);
    // the home picture shows the earned flowers: nothing is learned yet, so nothing grows there
    expect(document.querySelectorAll('.garden__plant')).toHaveLength(0);
    expect(document.querySelector('.garden')).toHaveAttribute('data-part');

    const heading = await screen.findByRole('heading', { name: 'Word of the day' });
    const word = heading.closest('section');
    expect(word).toHaveTextContent(/apple|water|book/);
    // nothing is due yet: the main button offers the new words
    expect(screen.getByRole('link', { name: 'Learn new words: Fruit' })).toHaveAttribute(
      'href',
      `#/decks/${deck.id}/learn`,
    );
    expect(screen.getByRole('link', { name: /Day streak: 1/ })).toBeInTheDocument();
  });

  it('an empty app points to the catalog first', async () => {
    open('/');
    expect(await screen.findByRole('link', { name: 'Deck catalog' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Word of the day' })).not.toBeInTheDocument();
  });

  it('the Progress tab is in the main navigation', async () => {
    open('/');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Progress' })).toHaveAttribute('href', '#/stats');
  });
});

describe('deck screen', () => {
  const MANY: [string, string][] = [
    ...WORDS,
    ['tree', 'дерево'],
    ['house', 'будинок'],
    ['bread', 'хліб'],
    ['milk', 'молоко'],
    ['cheese', 'сир'],
  ];

  it('finds cards by word or translation', async () => {
    const user = userEvent.setup();
    const { deck } = await seed(MANY);
    open(`/decks/${deck.id}`);
    const search = await screen.findByRole('searchbox', { name: 'Search cards' });
    await user.type(search, 'ХЛІБ');
    expect(screen.getByText('bread')).toBeInTheDocument();
    expect(screen.queryByText('apple')).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(screen.getByText('Nothing found.')).toBeInTheDocument();
  });

  it('filters starred and hard cards and shows each word as a plant', async () => {
    const user = userEvent.setup();
    const { repo, deck, cards } = await seed();
    const [apple, water] = cards;
    if (!apple || !water) throw new Error('no cards');
    await repo.setStarred(apple.id, true);
    await repo.saveSession(
      [
        {
          id: `${water.id}:forward`,
          cardId: water.id,
          deckId: deck.id,
          direction: 'forward',
          reps: 3,
          intervalDays: 7,
          dueAt: Date.now() + 86_400_000,
          lapses: 2,
          lastReviewedAt: Date.now(),
        },
      ],
      [],
    );
    open(`/decks/${deck.id}`);
    expect(await screen.findByRole('img', { name: 'Bush: you know it well' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Seed: not studied yet' })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Starred' }));
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.queryByText('water')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hard' }));
    expect(screen.getByText('water')).toBeInTheDocument();
    expect(screen.queryByText('apple')).not.toBeInTheDocument();
  });
});

describe('add a list of words', () => {
  it('previews, skips what is known or unclear, then adds the rest at once', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seed();
    open(`/decks/${deck.id}/cards/bulk`);
    const box = await screen.findByRole('textbox', { name: 'Words' });
    fireEvent.change(box, {
      target: { value: 'Apple - яблуко\ntree - дерево, деревце\nnonsense\nhouse\tбудинок' },
    });

    const preview = screen.getByRole('list', { name: 'What will be added' });
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/lines: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Already in the deck, skipped: Apple/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add 2 cards' }));
    await waitFor(async () => expect(await repo.listCards(deck.id)).toHaveLength(5));
    const tree = (await repo.listCards(deck.id)).find((c) => c.term === 'tree');
    expect(tree?.translations).toEqual(['дерево', 'деревце']);
  });

  it('with nothing to add the button is off', async () => {
    const { deck } = await seed();
    open(`/decks/${deck.id}/cards/bulk`);
    expect(await screen.findByRole('button', { name: 'Add' })).toBeDisabled();
  });
});

describe('deck list', () => {
  it('search appears when the list is long', async () => {
    const user = userEvent.setup();
    const repo = createRepo(db);
    for (const deckName of ['One', 'Two', 'Three', 'Four', 'Five']) {
      await repo.createDeck({ name: deckName, learningLang: 'en', translationLang: 'uk' });
    }
    open('/decks');
    await user.type(await screen.findByRole('searchbox', { name: 'Search decks' }), 'thr');
    expect(screen.getByText('Three')).toBeInTheDocument();
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });
});

describe('flashcards: undo and swipe', () => {
  const show = () => screen.findByRole('button', { name: /Show answer/ });

  it('takes the last answer back', async () => {
    const user = userEvent.setup();
    const { deck } = await seed();
    open(`/decks/${deck.id}/flip`);
    await user.click(await show());
    expect(screen.queryByRole('button', { name: 'Undo the last answer' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /I know it/ }));
    await screen.findByText('Card 2 of 3');
    await user.click(screen.getByRole('button', { name: 'Undo the last answer' }));
    expect(await screen.findByText('Card 1 of 3')).toBeInTheDocument();
  });

  it('a long sideways swipe answers, a short one does not, and only after turning', async () => {
    const user = userEvent.setup();
    const { deck } = await seed();
    open(`/decks/${deck.id}/flip`);
    const front = await show();
    const card = front.closest('.fc') as HTMLElement;
    card.setPointerCapture = () => undefined;

    const swipe = async (element: HTMLElement, distance: number) => {
      fireEvent.pointerDown(element, { clientX: 100, clientY: 100, pointerId: 1 });
      fireEvent.pointerMove(element, { clientX: 100 + distance, clientY: 100, pointerId: 1 });
      fireEvent.pointerUp(element, { clientX: 100 + distance, clientY: 100, pointerId: 1 });
    };
    await swipe(card, 200); // not turned yet: nothing happens
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument();

    await user.click(front);
    await swipe(card, 30); // too short
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument();

    await swipe(card, 200);
    expect(await screen.findByText('Card 2 of 3')).toBeInTheDocument();
  });

  it('a vertical move is left to the page scroll', async () => {
    const user = userEvent.setup();
    const { deck } = await seed();
    open(`/decks/${deck.id}/flip`);
    const front = await show();
    const card = front.closest('.fc') as HTMLElement;
    await user.click(front);
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 104, clientY: 240, pointerId: 1 });
    fireEvent.pointerMove(card, { clientX: 300, clientY: 240, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 300, clientY: 240, pointerId: 1 });
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument();
    expect(card.style.transform).toBe('');
  });
});

describe('Learn: counting a typed answer as right, and the result', () => {
  it('no hint button; a typed answer marked wrong can be counted as right', async () => {
    const user = userEvent.setup();
    const { deck } = await seed([['house', 'будинок']]); // one card: typing right away
    open(`/decks/${deck.id}/learn`);
    const input = await screen.findByRole('textbox');
    expect(screen.queryByRole('button', { name: 'Show a letter' })).toBeNull();
    await user.type(input, 'дім');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Not quite.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Count it as right' }));
    expect(await screen.findByText('Counted as right.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Count it as right' })).toBeNull();
  });

  it("the result screen shows how far today's goal is", async () => {
    const user = userEvent.setup();
    const { deck } = await seed([['house', 'будинок']]);
    open(`/decks/${deck.id}/flip`);
    await user.click(await screen.findByRole('button', { name: /Show answer/ }));
    await user.click(screen.getByRole('button', { name: /I know it/ }));
    expect(await screen.findByText("Today's goal: 1 of 20")).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('saves the theme, the goal and the feel switches', async () => {
    const user = userEvent.setup();
    const repo = createRepo(db);
    open('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(rememberedTheme()).toBe('dark');

    await user.click(screen.getByRole('radio', { name: '40' }));
    await user.click(screen.getByRole('checkbox', { name: 'Sounds for answers' }));
    await user.click(screen.getByRole('checkbox', { name: 'Read each word aloud automatically' }));
    await waitFor(async () =>
      expect(await repo.getSettings()).toMatchObject({
        theme: 'dark',
        dailyGoal: 40,
        soundEnabled: false,
        autoSpeak: true,
      }),
    );
  });

  it('older saved settings get the new defaults', async () => {
    await db.settings.put({
      id: 'app',
      uiLanguage: 'en',
      speechEnabled: false,
      ignoreDiacritics: false,
    } as never);
    expect(await createRepo(db).getSettings()).toMatchObject({
      theme: 'system',
      dailyGoal: 20,
      soundEnabled: true,
    });
  });
});

describe('theme', () => {
  it('a remembered theme survives; rubbish means "system"', () => {
    rememberTheme('light');
    expect(rememberedTheme()).toBe('light');
    localStorage.setItem('sproutcards.theme', 'pink');
    expect(rememberedTheme()).toBe('system');
  });

  it('"system" follows the device, also when it changes', () => {
    const listeners: (() => void)[] = [];
    const query = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: vi.fn(),
    };
    const original = window.matchMedia;
    window.matchMedia = (() => query) as unknown as typeof window.matchMedia;
    const stop = applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    query.matches = false;
    listeners.forEach((fn) => fn());
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
    expect(query.removeEventListener).toHaveBeenCalled();
    window.matchMedia = original;
  });
});

describe('cues', () => {
  it('vibrates only when allowed and never fails where nothing is available', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    playCue('wrong', true, false);
    expect(vibrate).not.toHaveBeenCalled();
    playCue('wrong', false, true);
    expect(vibrate).toHaveBeenCalledOnce();
    Reflect.deleteProperty(navigator, 'vibrate');
    expect(() => playCue('finish', true, true)).not.toThrow();
  });
});
