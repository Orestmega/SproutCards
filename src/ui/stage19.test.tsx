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

  it('a catalog deck is named in the interface language; a renamed one keeps its name', async () => {
    const repo = createRepo(db);
    const names = { en: 'Travel (English)', uk: 'Подорожі (англійська)' };
    const travel = await repo.createDeck({
      name: names.uk,
      learningLang: 'en',
      translationLang: 'uk',
    });
    await db.decks.update(travel.id, { catalogId: 'topic-travel-en-uk', names });
    const mine = await repo.createDeck({
      name: 'My words',
      learningLang: 'en',
      translationLang: 'uk',
    });
    await db.decks.update(mine.id, {
      catalogId: 'topic-food-en-uk',
      names: { en: 'Food', uk: 'Їжа' },
    });
    await repo.saveSettings({ ...(await repo.getSettings()), uiLanguage: 'en' });
    open('/decks');
    expect(await screen.findByText('Travel (English)')).toBeInTheDocument();
    expect(screen.queryByText('Подорожі (англійська)')).toBeNull();
    expect(screen.getByText('My words')).toBeInTheDocument();
  });

  it('the list of decks says how many words are learned', async () => {
    await seed(1);
    open('/decks');
    expect(await screen.findByText(/1 of 3 learned/)).toBeInTheDocument();
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
    const card = await screen.findByRole('button', { name: /Whole deck/ });
    expect(await within(card).findByText('Learned 2 of 3')).toBeInTheDocument();
    // it asks how many words at a time, like Learn
    const user = userEvent.setup();
    await user.click(card);
    const dialog = await screen.findByRole('dialog', { name: 'How many words at a time?' });
    await user.click(within(dialog).getByRole('button', { name: 'Start' }));
    expect(window.location.hash).toBe(`#/decks/${deck.id}/learn?dir=forward&whole=1&size=20`);
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
    // what each item gives, the chest for all three, the streak freezes
    expect(within(card).getByText('+ a rare flower and a streak freeze')).toBeInTheDocument();
    expect(within(card).getAllByText('+ a rare flower')).toHaveLength(2);
    expect(within(card).getByText('Chest of the week')).toBeInTheDocument();
    expect(within(card).getByText(/Finish all three and the chest gives/)).toBeInTheDocument();
    expect(within(card).getByText(/Streak freezes: 0 of 2/)).toBeInTheDocument();
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

  it('closing the test setup goes back to the deck', async () => {
    const user = userEvent.setup();
    const { deck } = await seed(0);
    open(`/decks/${deck.id}/test`);
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('heading', { name: 'Fruit', level: 1 })).toBeInTheDocument();
  });

  it('an earned decoration can be put away from the garden and brought back', async () => {
    const user = userEvent.setup();
    const { repo } = await seed(0);
    // the cheat panel's bonus earns every decoration
    await repo.saveSettings({
      ...(await repo.getSettings()),
      cheats: {
        learned: 0,
        streak: 3,
        golden: 0,
        reviews: 0,
        challenges: 0,
        weeks: 0,
        decks: 0,
        modes: 0,
      },
    });
    const { container } = open('/garden');
    const toggle = await screen.findByRole('checkbox', { name: 'In the garden' });
    expect(container.querySelector('.garden__flight')).not.toBeNull(); // the butterflies fly
    await user.click(toggle);
    await waitFor(() => expect(container.querySelector('.garden__flight')).toBeNull());
    await user.click(screen.getByRole('checkbox', { name: 'In the garden' }));
    await waitFor(() => expect(container.querySelector('.garden__flight')).not.toBeNull());
  });
});
