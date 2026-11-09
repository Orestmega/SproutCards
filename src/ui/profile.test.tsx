import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  localStorage.clear();
  name = `profile-test-${++n}`;
  db = new AppDatabase(name);
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(name);
});

function open(path: string) {
  window.location.hash = `#${path}`;
  return render(<App db={db} />);
}

/** A deck with one learned word (a flower) and one new word. */
async function seed() {
  const repo = createRepo(db);
  await repo.saveSettings({ ...(await repo.getSettings()), uiLanguage: 'en' });
  const deck = await repo.createDeck({ name: 'Fruit', learningLang: 'en', translationLang: 'uk' });
  const apple = await repo.addCard(deck.id, { term: 'apple', translations: ['яблуко'] });
  await repo.addCard(deck.id, { term: 'pear', translations: ['груша'] });
  const now = Date.now();
  await repo.saveSession(
    [
      {
        id: `${apple.id}:forward`,
        cardId: apple.id,
        deckId: deck.id,
        direction: 'forward',
        reps: 2,
        intervalDays: 3,
        dueAt: now + 86_400_000,
        lapses: 0,
        lastReviewedAt: now,
      },
    ],
    [
      {
        at: now,
        cardId: apple.id,
        deckId: deck.id,
        direction: 'forward',
        mode: 'learn',
        result: 'correct',
      },
    ],
  );
  return { repo, apple };
}

describe('profile', () => {
  it('is reached from the home screen and shows the rank and the numbers', async () => {
    const user = userEvent.setup();
    await seed();
    open('/');
    await user.click(await screen.findByRole('link', { name: 'Your profile' }));
    expect(await screen.findByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gardener' })).toBeInTheDocument(); // no name yet
    expect(screen.getByText('Seedling')).toBeInTheDocument();
    expect(screen.getByText('4 more learned words to “Young gardener”')).toBeInTheDocument();
    const numbers = screen.getByRole('group', { name: 'Your numbers' });
    expect(within(numbers).getByText('Words learned').previousSibling).toHaveTextContent('1');
    expect(screen.getByText('English', { selector: 'li' })).toBeInTheDocument();
  });

  it('saves a cleaned name and a picture chosen from the kinds of flower opened', async () => {
    const user = userEvent.setup();
    const { repo } = await seed();
    open('/profile');
    const field = await screen.findByRole('textbox', { name: 'Name' });
    await user.type(field, '   Olena    K  ');
    await user.tab();
    await waitFor(async () => expect((await repo.getSettings()).profileName).toBe('Olena K'));
    expect(await screen.findByRole('heading', { name: 'Olena K' })).toBeInTheDocument();

    const pictures = screen.getByRole('radiogroup', { name: 'Picture' });
    // Sprout and the daisy (open from the start; the tulip needs 2 learned words)
    expect(within(pictures).getAllByRole('radio')).toHaveLength(2);
    const flower = 'daisy';
    const [, flowerChoice] = within(pictures).getAllByRole('radio') as [HTMLElement, HTMLElement];
    await user.click(flowerChoice);
    await waitFor(async () => expect((await repo.getSettings()).avatar).toBe(flower));
    // the screen draws again after saving: look the choice up anew
    await waitFor(() =>
      expect(
        within(screen.getByRole('radiogroup', { name: 'Picture' })).getAllByRole('radio')[1],
      ).toHaveAttribute('aria-checked', 'true'),
    );
  });

  it('the settings screen leads to the profile too', async () => {
    await seed();
    open('/settings');
    expect(await screen.findByRole('link', { name: /Name, picture and rank/ })).toHaveAttribute(
      'href',
      '#/profile',
    );
  });
});
