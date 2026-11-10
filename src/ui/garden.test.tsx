import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { wateringDay } from '../core/gardenLife';
import { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  localStorage.clear();
  name = `garden-test-${++n}`;
  db = new AppDatabase(name);
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(name);
});

const DAY = 86_400_000;

/** A deck with a learned word, a word on its way and a new one; `answersAgo` days since the last answer. */
async function seed({ answersToday = 0, daysAgo = 0 } = {}) {
  const repo = createRepo(db);
  const deck = await repo.createDeck({ name: 'Fruit', learningLang: 'en', translationLang: 'uk' });
  const apple = await repo.addCard(deck.id, { term: 'apple', translations: ['яблуко'] });
  const pear = await repo.addCard(deck.id, { term: 'pear', translations: ['груша'] });
  await repo.addCard(deck.id, { term: 'plum', translations: ['слива'] });
  const now = Date.now();
  const record = (cardId: string, reps: number) => ({
    id: `${cardId}:forward`,
    cardId,
    deckId: deck.id,
    direction: 'forward' as const,
    reps,
    intervalDays: 7,
    dueAt: now + 3 * DAY,
    lapses: 0,
    lastReviewedAt: now,
  });
  const log = (at: number) => ({
    at,
    cardId: apple.id,
    deckId: deck.id,
    direction: 'forward' as const,
    mode: 'learn' as const,
    result: 'correct' as const,
  });
  const logs = [
    log(now - daysAgo * DAY - 60_000),
    ...Array.from({ length: answersToday }, () => log(now)),
  ];
  await repo.saveSession([record(apple.id, 3), record(pear.id, 1)], logs);
  await repo.saveSettings({ ...(await repo.getSettings()), uiLanguage: 'en', dailyGoal: 10 });
  return { repo, deck };
}

function open(path: string) {
  window.location.hash = `#${path}`;
  return render(<App db={db} />);
}

describe('garden screen', () => {
  it('is a tab of its own and the home picture leads there', async () => {
    const user = userEvent.setup();
    await seed();
    open('/');
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Garden' })).toHaveAttribute('href', '#/garden');
    await user.click(await screen.findByRole('link', { name: 'Open your garden' }));
    expect(await screen.findByRole('heading', { name: 'Garden', level: 1 })).toBeInTheDocument();
  });

  it('shows every word as a plant; tapping one tells its word, stage, flower and next review', async () => {
    const user = userEvent.setup();
    await seed();
    open('/garden');
    const beds = await screen.findByRole('heading', { name: 'Beds' });
    const section = beds.closest('section') as HTMLElement;
    // what grows is a plant to tap; the word not studied yet waits in the bag of seeds
    expect(within(section).getAllByRole('button')).toHaveLength(2);
    expect(within(section).getByText('1 seed in the bag')).toBeInTheDocument();
    expect(
      within(section).getByRole('link', { name: 'Plant: learn new words' }),
    ).toBeInTheDocument();
    expect(
      within(section).getByRole('button', { name: 'pear: Leaf: one clean answer, almost there' }),
    ).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: /^apple: Bloom: learned \(/ }));
    const dialog = await screen.findByRole('dialog', { name: /apple/ });
    expect(within(dialog).getByText('яблуко')).toBeInTheDocument();
    expect(within(dialog).getByText(/^Next review:/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^(Common|Rare|Golden)$/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('watering opens once the goal is reached and stays done for the day', async () => {
    const user = userEvent.setup();
    await seed({ answersToday: 9 }); // plus the answer the seed always adds: 10 of 10
    const first = open('/garden');
    await user.click(await screen.findByRole('button', { name: 'Water the garden' }));
    expect(await screen.findByText('Watered today. See you tomorrow!')).toBeInTheDocument();
    expect(document.querySelector('.garden__rain')).not.toBeNull();
    expect(localStorage.getItem('sproutcards.watered')).toBe(String(wateringDay(Date.now())));
    first.unmount();

    open('/garden');
    expect(await screen.findByText('Watered today. See you tomorrow!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Water the garden' })).not.toBeInTheDocument();
  });

  it('before the goal it says how much is left, in the right plural', async () => {
    await seed({ answersToday: 8 }); // plus the answer the seed always adds: 9 of 10
    open('/garden');
    expect(await screen.findByText('1 more answer until watering (9 of 10).')).toBeInTheDocument();
  });

  it('a garden left alone wilts, but every word keeps its progress', async () => {
    const { repo, deck } = await seed({ daysAgo: 3 });
    open('/garden');
    expect(await screen.findByText('Wilting: a few answers bring it back')).toBeInTheDocument();
    expect(document.querySelector('.garden')).toHaveAttribute('data-health', 'wilted');
    expect((await repo.listProgress(deck.id)).map((p) => p.reps).sort()).toEqual([1, 3]);
  });

  it('has a field for each language being learned, and can show just one', async () => {
    const user = userEvent.setup();
    const { repo } = await seed();
    const german = await repo.createDeck({
      name: 'Deutsch',
      learningLang: 'de',
      translationLang: 'uk',
    });
    await repo.addCard(german.id, { term: 'Apfel', translations: ['яблуко'] });
    open('/garden');
    expect(await screen.findByRole('heading', { name: /English field/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /German field/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'German' }));
    expect(screen.queryByRole('heading', { name: /English field/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deutsch' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All languages' }));
    expect(screen.getByRole('heading', { name: /English field/ })).toBeInTheDocument();
  });

  it('a flower grows only where one was earned: one learned word, one flower', async () => {
    const user = userEvent.setup();
    const { repo } = await seed();
    open('/garden');
    const plots = await screen.findByRole('group', { name: 'Plots of your garden' });
    // one learned word earned one daisy: it stands on the first plot, the rest is empty
    expect(within(plots).getByRole('button', { name: 'Plot 1: Daisy' })).toBeInTheDocument();
    expect(screen.getByText(/Planted 1 of 1 earned flowers/)).toBeInTheDocument();

    // nothing else to plant on another plot
    await user.click(within(plots).getByRole('button', { name: 'Empty plot 2: plant a flower' }));
    const empty = await screen.findByRole('dialog', { name: 'Plot 2' });
    expect(
      within(empty).getByText('All your earned flowers are planted already.'),
    ).toBeInTheDocument();
    expect(within(empty).queryByRole('button', { name: 'Plant' })).not.toBeInTheDocument();
    await user.click(within(empty).getByRole('button', { name: 'Cancel' }));

    // take it off plot 1, then plant it on plot 3
    await user.click(within(plots).getByRole('button', { name: 'Plot 1: Daisy' }));
    const first = await screen.findByRole('dialog', { name: 'Plot 1' });
    await user.click(within(first).getByRole('button', { name: 'Take off the plot' }));
    await waitFor(async () => expect((await repo.getSettings()).gardenPlots?.[0]).toBeNull());
    await user.click(
      await within(plots).findByRole('button', { name: 'Empty plot 3: plant a flower' }),
    );
    const third = await screen.findByRole('dialog', { name: 'Plot 3' });
    expect(within(third).getByRole('radio', { name: /Daisy/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(third).getByRole('button', { name: 'Plant' }));
    await waitFor(async () => expect((await repo.getSettings()).gardenPlots?.[2]).toBe('blooms-1'));
    expect(await within(plots).findByRole('button', { name: 'Plot 3: Daisy' })).toBeInTheDocument();
  });

  it('every step of a goal earns a flower, and the next one is shown', async () => {
    await seed();
    open('/garden');
    const heading = await screen.findByRole('heading', { name: 'Flower collection' });
    const collection = heading.closest('section') as HTMLElement;
    expect(within(collection).getByText('1 of 23')).toBeInTheDocument(); // the daisy
    expect(within(collection).getByText('Earned: 1')).toBeInTheDocument();
    expect(screen.getAllByText(/Next: Tulip/)[0]).toHaveTextContent('learn 2 more words');
  });

  it('an empty garden points to the catalog', async () => {
    open('/garden');
    expect(await screen.findByRole('heading', { name: 'Nothing planted yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Deck catalog' })).toBeInTheDocument();
  });
});
