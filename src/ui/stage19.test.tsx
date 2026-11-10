import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { evaluateAchievements } from '../core/achievements';
import { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  localStorage.clear();
  name = `stage19-test-${++n}`;
  db = new AppDatabase(name);
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(name);
});

/** A deck of three words; `learned` of them were answered right once (forward). */
async function seed(learned: number) {
  const repo = createRepo(db);
  const deck = await repo.createDeck({ name: 'Fruit', learningLang: 'en', translationLang: 'uk' });
  const cards = [];
  for (const [term, tr] of [
    ['apple', 'яблуко'],
    ['pear', 'груша'],
    ['plum', 'слива'],
  ] as const) {
    cards.push(await repo.addCard(deck.id, { term, translations: [tr] }));
  }
  const now = Date.now();
  const progress = cards.slice(0, learned).map((c) => ({
    id: `${c.id}:forward`,
    cardId: c.id,
    deckId: deck.id,
    direction: 'forward' as const,
    reps: 1,
    intervalDays: 1,
    dueAt: now + 86_400_000,
    lapses: 0,
    lastReviewedAt: now,
  }));
  const logs = progress.map((p) => ({
    at: now,
    cardId: p.cardId,
    deckId: deck.id,
    direction: 'forward' as const,
    mode: 'learn' as const,
    result: 'correct' as const,
  }));
  await repo.saveSession(progress, logs);
  await repo.saveSettings({ ...(await repo.getSettings()), uiLanguage: 'en' });
  return { repo, deck };
}

function open(path: string) {
  window.location.hash = `#${path}`;
  return render(<App db={db} />);
}

describe('stage 19', () => {
  it('a word answered right once already counts as learned and earns the first flower', async () => {
    await seed(1);
    open('/garden');
    const heading = await screen.findByRole('heading', { name: 'Flower collection' });
    const collection = heading.closest('section') as HTMLElement;
    expect(within(collection).getByText('Earned: 1')).toBeInTheDocument();
  });

  it('the garden picture has no mascot', async () => {
    await seed(1);
    const { container } = open('/garden');
    await screen.findByRole('heading', { name: 'Garden', level: 1 });
    expect(container.querySelector('.garden .mascot')).toBeNull();
    expect(container.querySelector('.garden__sprout')).toBeNull();
  });

  it('the deck screen offers the whole deck with how much of it is learned', async () => {
    const { deck } = await seed(2);
    open(`/decks/${deck.id}`);
    const link = await screen.findByRole('link', { name: /Whole deck/ });
    expect(link).toHaveAttribute('href', `#/decks/${deck.id}/learn?dir=forward&whole=1`);
    expect(await within(link).findByText('Learned 2 of 3')).toBeInTheDocument();
  });

  it('the whole deck brings only the words still to learn, and says when all are learned', async () => {
    const { deck } = await seed(2);
    open(`/decks/${deck.id}/learn?dir=forward&whole=1`);
    // only "plum" is left: the question asks for it
    expect(await screen.findByText('plum')).toBeInTheDocument();
  });

  it('a fully learned deck says so in the whole-deck mode', async () => {
    const { deck } = await seed(3);
    open(`/decks/${deck.id}/learn?dir=forward&whole=1`);
    expect(
      await screen.findByRole('heading', { name: 'The whole deck is learned!' }),
    ).toBeInTheDocument();
  });

  it('the home screen shows the week: a goal and two challenges', async () => {
    await seed(1);
    open('/');
    const heading = await screen.findByRole('heading', { name: 'This week' });
    const card = heading.closest('section') as HTMLElement;
    expect(within(card).getByText('Weekly goal:')).toBeInTheDocument();
    expect(within(card).getAllByText('Challenge:')).toHaveLength(2);
    expect(within(card).getAllByRole('progressbar')).toHaveLength(3);
  });

  it('the cheat panel grants every achievement; reset takes the bonuses away', async () => {
    const user = userEvent.setup();
    await seed(0);
    open('/settings');
    await user.click(await screen.findByText('Cheat panel'));
    await user.click(screen.getByRole('button', { name: 'Grant everything' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled());

    window.location.hash = '#/stats';
    const total = evaluateAchievements({
      totalReviews: 0,
      bestStreak: 0,
      blooms: 0,
      decks: 0,
      modesUsed: 0,
    }).length;
    const heading = await screen.findByRole('heading', { name: 'Achievements' });
    const section = heading.closest('section') as HTMLElement;
    // done achievements glow and have no visible badge; screen readers still hear "Reached"
    const done = await within(section).findAllByText('Reached');
    expect(done.every((el) => el.classList.contains('visually-hidden'))).toBe(true);
    await waitFor(() => expect(section.querySelectorAll('.ach--done')).toHaveLength(total));

    window.location.hash = '#/settings';
    await user.click(await screen.findByText('Cheat panel'));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled());
  });

  it('a cheat button adds to its bonus', async () => {
    const user = userEvent.setup();
    await seed(0);
    open('/settings');
    await user.click(await screen.findByText('Cheat panel'));
    await user.click(screen.getByRole('button', { name: 'Add 5: Learned words' }));
    await waitFor(() => expect(screen.getByText('Learned words')).toHaveTextContent('+5'));
  });
});
