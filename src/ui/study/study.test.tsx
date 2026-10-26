import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { App } from '../../App';
import { startOfDayPlus } from '../../core/scheduler';
import { AppDatabase } from '../../db/db';
import { createRepo } from '../../db/repo';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  name = `study-test-${++n}`;
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
const ANSWERS = new Map<string, string>(
  WORDS.flatMap(([a, b]) => [[a, b] as [string, string], [b, a] as [string, string]]),
);

async function seedDeck(words: [string, string][] = WORDS) {
  const repo = createRepo(db);
  const deck = await repo.createDeck({
    name: 'Test deck',
    learningLang: 'en',
    translationLang: 'uk',
  });
  for (const [term, translation] of words)
    await repo.addCard(deck.id, { term, translations: [translation] });
  return { repo, deck };
}

function open(path: string) {
  window.location.hash = `#${path}`;
  return render(<App db={db} />);
}

const promptText = () => document.querySelector('.prompt__text span')?.textContent ?? '';

/** Answers the question on screen. `right: false` gives a deliberately wrong answer. */
async function answerCurrent(user: UserEvent, right = true) {
  const prompt = promptText();
  const answer = right ? (ANSWERS.get(prompt) as string) : 'zzz-wrong';
  const group = screen.queryByRole('group', { name: 'Answer options' });
  if (group) {
    const buttons = within(group).getAllByRole('button');
    const pick = right
      ? buttons.find((b) => b.textContent?.includes(answer))
      : buttons.find((b) => !b.textContent?.includes(ANSWERS.get(prompt) as string));
    await user.click(pick as HTMLElement);
  } else {
    await user.type(screen.getByRole('textbox'), answer);
    await user.click(screen.getByRole('button', { name: 'Check' }));
  }
}

/** Plays Learn to the end answering everything right; returns how many answers it took. */
async function playLearnPerfectly(user: UserEvent): Promise<number> {
  let answers = 0;
  while (!screen.queryByRole('heading', { name: 'Session summary' })) {
    await screen.findByRole('group', { name: /./ }).catch(() => undefined);
    await answerCurrent(user);
    answers++;
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    if (answers > 50) throw new Error('session does not end');
  }
  return answers;
}

describe('Learn: the full cycle', () => {
  it('learn a deck, save the schedule for tomorrow, then there is nothing due today', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    const first = open(`/decks/${deck.id}/learn`);

    // first question is a multiple choice with the term as the prompt
    expect(await screen.findByText('Choose the translation')).toBeInTheDocument();
    expect(
      within(await screen.findByRole('group', { name: 'Answer options' })).getAllByRole('button'),
    ).toHaveLength(3);

    const answers = await playLearnPerfectly(user);
    expect(answers).toBe(9); // 3 cards x 3 levels

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('3 cards learned in this session.')).toBeInTheDocument();

    // saved: three records, due at the start of tomorrow, plus a log row per answer
    await waitFor(async () => expect(await repo.listProgress(deck.id)).toHaveLength(3));
    const tomorrow = startOfDayPlus(Date.now(), 1);
    for (const p of await repo.listProgress(deck.id)) {
      expect(p).toMatchObject({ direction: 'forward', reps: 1, intervalDays: 1, dueAt: tomorrow });
    }
    expect(await db.reviewLogs.count()).toBe(9);

    // "restart" and try again: nothing is due today
    first.unmount();
    db.close();
    db = new AppDatabase(name);
    open(`/decks/${deck.id}/learn`);
    expect(await screen.findByText('Nothing to study right now')).toBeInTheDocument();
    expect(await createRepo(db).countNewSince(startOfDayPlus(Date.now(), 0))).toBe(3);
  });

  it('shows the right answer after a mistake and the mistaken card comes back', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Choose the translation');
    const missed = promptText();
    await answerCurrent(user, false);

    expect(await screen.findByText('Not quite.')).toBeInTheDocument();
    expect(
      screen.getByText(ANSWERS.get(missed) as string, { selector: 'strong' }),
    ).toBeInTheDocument();
    // options are locked and marked with text, not just colour
    const group = screen.getByRole('group', { name: 'Answer options' });
    expect(within(group).getByText(/correct answer/)).toBeInTheDocument();
    expect(within(group).getByText(/your wrong answer/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const prompts: string[] = [];
    while (!screen.queryByRole('heading', { name: 'Session summary' })) {
      prompts.push(promptText());
      await answerCurrent(user);
      await user.click(await screen.findByRole('button', { name: 'Continue' }));
    }
    expect(prompts).toContain(missed);
    // a card with a mistake is scheduled as "wrong": it counts as a lapse
    await waitFor(async () =>
      expect((await repo.listProgress(deck.id)).some((p) => p.lapses === 1)).toBe(true),
    );
  });

  it('"I don\'t know" counts as wrong and shows the answer', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Choose the translation');
    const prompt = promptText();
    await user.click(screen.getByRole('button', { name: 'I don’t know' }));
    expect(await screen.findByText('No problem, now you know.')).toBeInTheDocument();
    expect(
      screen.getByText(ANSWERS.get(prompt) as string, { selector: 'strong' }),
    ).toBeInTheDocument();
  });

  it('typing with a small typo is "almost" and shows the right spelling', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck([['house', 'будинок']]); // one card: typing right away
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Type the translation');
    await user.type(screen.getByRole('textbox'), 'будинк');
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Almost! Watch the spelling.')).toBeInTheDocument();
    expect(screen.getByText('будинок', { selector: 'strong' })).toBeInTheDocument();
  });

  it('works in the backward direction (translation is the prompt)', async () => {
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/learn?dir=backward`);
    await screen.findByText('Choose the word');
    expect(['яблуко', 'вода', 'книга']).toContain(promptText());
  });

  it('keys 1-4 pick an option', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Choose the translation');
    await user.keyboard('1');
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});

describe('Learn: limits and edge cases', () => {
  it('respects the new-cards-per-day setting', async () => {
    const user = userEvent.setup();
    const many: [string, string][] = ['a', 'b', 'c', 'd', 'e'].map((w) => [`w-${w}`, `с-${w}`]);
    for (const [a, b] of many) {
      ANSWERS.set(a, b);
      ANSWERS.set(b, a);
    }
    const { repo, deck } = await seedDeck(many);
    await repo.saveSettings({ ...(await repo.getSettings()), newCardsPerDay: 2, uiLanguage: 'en' });
    open(`/decks/${deck.id}/learn`);
    await screen.findByText(/Choose the translation|Type the translation/);
    const seen = new Set<string>();
    while (!screen.queryByRole('heading', { name: 'Session summary' })) {
      // the prompt is the term on some levels and the translation on others: count cards, not prompts
      const prompt = promptText();
      seen.add(prompt.startsWith('w-') ? prompt : (ANSWERS.get(prompt) as string));
      await answerCurrent(user);
      await user.click(await screen.findByRole('button', { name: 'Continue' }));
    }
    expect(seen.size).toBe(2);
  });

  it('an empty deck explains itself instead of showing a broken screen', async () => {
    const { deck } = await seedDeck([]);
    open(`/decks/${deck.id}/learn`);
    expect(await screen.findByText('No cards to study')).toBeInTheDocument();
  });

  it('an unknown deck shows the not-found screen', async () => {
    open('/decks/nope/learn');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('practising everything does not change review dates', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    const first = open(`/decks/${deck.id}/learn`);
    await playLearnPerfectly(user);
    await waitFor(async () => expect(await repo.listProgress(deck.id)).toHaveLength(3));
    const before = await repo.listProgress(deck.id);
    first.unmount();

    open(`/decks/${deck.id}/learn?all=1`);
    await playLearnPerfectly(user);
    expect(await screen.findByText(/review dates did not change/)).toBeInTheDocument();
    await waitFor(async () => expect(await db.reviewLogs.count()).toBe(18)); // history still recorded
    expect(await repo.listProgress(deck.id)).toEqual(before);
  });

  it('closing the session asks first and keeps finished cards only', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Choose the translation');
    await answerCurrent(user); // one answer, no card has passed yet
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Leave' }));
    expect(await screen.findByRole('heading', { name: 'Test deck' })).toBeInTheDocument();
    expect(await repo.listProgress(deck.id)).toEqual([]); // nothing passed, nothing scheduled
    expect(await db.reviewLogs.count()).toBe(1); // but the answer is in the history
  });

  it('closing before answering leaves at once', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Choose the translation');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('heading', { name: 'Test deck' })).toBeInTheDocument();
  });

  it('shows an error and a retry when saving fails', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck([['house', 'будинок']]);
    ANSWERS.set('house', 'будинок');
    ANSWERS.set('будинок', 'house');
    open(`/decks/${deck.id}/learn`);
    await screen.findByText('Type the translation');
    const original = db.progress.bulkPut.bind(db.progress);
    db.progress.bulkPut = (() =>
      Promise.reject(new Error('disk full'))) as unknown as typeof db.progress.bulkPut;
    for (let i = 0; i < 3; i++) {
      await answerCurrent(user);
      if (i < 2) await user.click(await screen.findByRole('button', { name: 'Continue' }));
    }
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Your results could not be saved.')).toBeInTheDocument();
    db.progress.bulkPut = original;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(async () => expect(await db.progress.count()).toBe(1));
    await waitFor(() =>
      expect(screen.queryByText('Your results could not be saved.')).not.toBeInTheDocument(),
    );
  });
});

describe('Flashcards', () => {
  it('turn the card, answer know / dont know, see the summary, schedule is saved', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}/flip`);
    expect(await screen.findByText('Card 1 of 3')).toBeInTheDocument();

    // the back and the answer buttons are hidden until the card is turned over
    expect(screen.queryByRole('button', { name: /I know it/ })).not.toBeInTheDocument();
    const front = document.querySelector('.flip-card__text')?.textContent as string;
    await user.click(screen.getByRole('button', { name: /Show answer/ }));
    expect(await screen.findByRole('button', { name: /I know it/ })).toBeInTheDocument();
    expect(screen.getByText(ANSWERS.get(front) as string, { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /I know it/ }));

    // next cards: arrow keys answer once the card is turned over
    await screen.findByText('Card 2 of 3');
    await user.click(screen.getByRole('button', { name: /Show answer/ }));
    await user.keyboard('{ArrowLeft}'); // dont know
    await screen.findByText('Card 3 of 3');
    await user.click(screen.getByRole('button', { name: /Show answer/ }));
    await user.keyboard('{ArrowRight}'); // know

    expect(await screen.findByRole('heading', { name: 'Session summary' })).toBeInTheDocument();
    await waitFor(async () => expect(await repo.listProgress(deck.id)).toHaveLength(3));
    const progress = await repo.listProgress(deck.id);
    expect(progress.filter((p) => p.reps === 1)).toHaveLength(2);
    expect(progress.filter((p) => p.lapses === 1)).toHaveLength(1);
    expect((await db.reviewLogs.toArray()).filter((l) => l.mode === 'flip')).toHaveLength(3);
    // the card that was not known is listed for review
    expect(screen.getByText('Cards to review')).toBeInTheDocument();
  });

  it('backward direction shows the translation on the front', async () => {
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/flip?dir=backward`);
    await screen.findByText('Card 1 of 3');
    expect(['яблуко', 'вода', 'книга']).toContain(
      document.querySelector('.flip-card__text')?.textContent,
    );
  });
});

describe('Quiz', () => {
  it('answers without feedback, grades at the end, and changes no review dates', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}/test`);
    expect(await screen.findByText('Question 1 of 3')).toBeInTheDocument();

    for (let i = 0; i < 3; i++) {
      const prompt = promptText();
      const next = screen.getByRole('button', { name: i === 2 ? 'Finish' : 'Next' });
      const group = screen.queryByRole('group', { name: 'Answer options' });
      if (group) {
        const option = within(group)
          .getAllByRole('button')
          .find((b) => b.textContent?.includes(ANSWERS.get(prompt) as string));
        await user.click(option as HTMLElement);
      } else {
        await user.type(screen.getByRole('textbox'), ANSWERS.get(prompt) as string);
      }
      await user.click(next);
      // no feedback is shown during the quiz
      expect(screen.queryByText('Correct!')).not.toBeInTheDocument();
    }

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Excellent! You know this deck well.')).toBeInTheDocument();
    await waitFor(async () =>
      expect((await db.reviewLogs.toArray()).filter((l) => l.mode === 'test')).toHaveLength(3),
    );
    expect(await repo.listProgress(deck.id)).toEqual([]);
  });

  it('skipping everything gives 0% and lists the correct answers', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/test`);
    await screen.findByText('Question 1 of 3');
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Your answers')).toBeInTheDocument();
    expect(screen.getAllByText(/\(skipped\)/)).toHaveLength(3);
  });

  it('a choice must be selected before moving on', async () => {
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/test`);
    await screen.findByText('Question 1 of 3');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('Deck screen study panel and speech', () => {
  it('offers the three modes and both directions', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}`);
    expect(await screen.findByRole('link', { name: 'Learn' })).toHaveAttribute(
      'href',
      `#/decks/${deck.id}/learn?dir=forward`,
    );
    expect(screen.getByRole('link', { name: 'Flashcards' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quiz' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Ukrainian → English/ }));
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute(
      'href',
      `#/decks/${deck.id}/learn?dir=backward`,
    );
  });

  it('with no cards, modes are not offered', async () => {
    const { deck } = await seedDeck([]);
    open(`/decks/${deck.id}`);
    expect(await screen.findByText('Add some cards to start studying.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Learn' })).not.toBeInTheDocument();
  });

  it('says so when the browser cannot speak (no silent failure)', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/flip`);
    await screen.findByText('Card 1 of 3');
    await user.click(screen.getAllByRole('button', { name: /^Listen:/ })[0] as HTMLElement);
    expect(await screen.findByText('This browser cannot read text aloud.')).toBeInTheDocument();
  });

  it('speech buttons are hidden when speech is turned off in the settings', async () => {
    const { repo, deck } = await seedDeck();
    await repo.saveSettings({
      ...(await repo.getSettings()),
      uiLanguage: 'en',
      speechEnabled: false,
    });
    open(`/decks/${deck.id}/flip`);
    await screen.findByText('Card 1 of 3');
    expect(screen.queryByRole('button', { name: /^Listen:/ })).not.toBeInTheDocument();
  });

  it('reports a missing voice for the language', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    const spoken: string[] = [];
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ lang: 'de-DE', name: 'Anna' }],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        cancel: () => undefined,
        speak: (u: { text: string }) => spoken.push(u.text),
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {},
    });
    try {
      open(`/decks/${deck.id}/flip`);
      await screen.findByText('Card 1 of 3');
      await user.click(screen.getAllByRole('button', { name: /^Listen:/ })[0] as HTMLElement);
      expect(
        await screen.findByText(/No voice for .* is installed on this device\./),
      ).toBeInTheDocument();
      expect(spoken).toEqual([]);
    } finally {
      Reflect.deleteProperty(window, 'speechSynthesis');
      Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
    }
  });
});
