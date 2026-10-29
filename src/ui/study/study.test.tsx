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
  localStorage.clear(); // the test settings are remembered between visits
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
/** A bigger deck, for tests that need more than 3 words (true/false, matching, retakes). */
const WORDS6: [string, string][] = [
  ...WORDS,
  ['house', 'будинок'],
  ['tree', 'дерево'],
  ['bread', 'хліб'],
];
const ANSWERS = new Map<string, string>(
  WORDS6.flatMap(([a, b]) => [[a, b] as [string, string], [b, a] as [string, string]]),
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

    // one card was not known: the round ends and the missed card comes back in round 2
    expect(await screen.findByRole('heading', { name: 'Round 1 complete' })).toBeInTheDocument();
    expect(screen.getByText('You know 2 of 3. Still learning: 1.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go through 1 card again' }));
    expect(await screen.findByText('Round 2 · card 1 of 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show answer/ }));
    await user.keyboard('{ArrowRight}');

    expect(await screen.findByRole('heading', { name: 'Session summary' })).toBeInTheDocument();
    await waitFor(async () => expect(await repo.listProgress(deck.id)).toHaveLength(3));
    const progress = await repo.listProgress(deck.id);
    expect(progress.filter((p) => p.reps === 1)).toHaveLength(2);
    expect(progress.filter((p) => p.lapses === 1)).toHaveLength(1);
    // every answer of every round is logged: 3 in round 1 + 1 in round 2
    expect((await db.reviewLogs.toArray()).filter((l) => l.mode === 'flip')).toHaveLength(4);
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

const KINDS = ['Multiple choice', 'Typing', 'True / false', 'Matching'] as const;

/** The test settings screen: keep only the wanted kinds of questions on, then start. */
async function startQuiz(user: UserEvent, wanted: readonly (typeof KINDS)[number][]) {
  for (const kind of KINDS.filter((k) => !wanted.includes(k))) {
    await user.click(await screen.findByRole('checkbox', { name: kind }));
  }
  await user.click(screen.getByRole('button', { name: 'Start the test' }));
}

/** Answers the current choice or typing question (right or deliberately wrong) and moves on. */
async function answerQuizQuestion(user: UserEvent, last: boolean, right = true) {
  const prompt = promptText();
  const group = screen.queryByRole('group', { name: 'Answer options' });
  if (group) {
    const buttons = within(group).getAllByRole('button');
    const pick = right
      ? buttons.find((b) => b.textContent?.includes(ANSWERS.get(prompt) as string))
      : buttons.find((b) => !b.textContent?.includes(ANSWERS.get(prompt) as string));
    await user.click(pick as HTMLElement);
  } else {
    await user.type(screen.getByRole('textbox'), right ? (ANSWERS.get(prompt) as string) : 'zzz');
  }
  await user.click(screen.getByRole('button', { name: last ? 'Finish' : 'Next' }));
}

describe('Quiz: settings', () => {
  it('asks how many questions and which kinds before it starts, and keeps at least one kind on', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6);
    open(`/decks/${deck.id}/test`);
    expect(await screen.findByText('Test settings', { selector: 'h2' })).toBeInTheDocument();

    // 6 words: 5 questions or all
    const counts = screen.getByRole('radiogroup', { name: 'Number of questions' });
    expect(
      within(counts)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['5', 'All (6)']);
    expect(within(counts).getByRole('radio', { name: 'All (6)' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    // all four kinds are on at first; the last one cannot be switched off
    for (const kind of ['Typing', 'True / false', 'Matching']) {
      await user.click(screen.getByRole('checkbox', { name: kind }));
    }
    const choice = screen.getByRole('checkbox', { name: 'Multiple choice' });
    expect(choice).toBeChecked();
    await user.click(choice);
    expect(choice).toBeChecked();

    await user.click(within(counts).getByRole('radio', { name: '5' }));
    await user.click(screen.getByRole('button', { name: 'Start the test' }));
    expect(await screen.findByText('Question 1 of 5')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Answer options' })).toBeInTheDocument();
  });

  it('remembers the choice for the next test on this device', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6);
    const first = open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Typing']);
    await screen.findByText('Question 1 of 6');
    first.unmount();

    open(`/decks/${deck.id}/test`);
    expect(await screen.findByRole('checkbox', { name: 'Typing' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Multiple choice' })).not.toBeChecked();
  });
});

describe('Quiz', () => {
  it('answers without feedback, grades at the end, and changes no review dates', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Multiple choice', 'Typing']);
    expect(await screen.findByText('Question 1 of 3')).toBeInTheDocument();

    for (let i = 0; i < 3; i++) {
      await answerQuizQuestion(user, i === 2);
      // no feedback is shown during the quiz
      expect(screen.queryByText('Correct!')).not.toBeInTheDocument();
    }

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Excellent! You know this deck well.')).toBeInTheDocument();
    await waitFor(async () =>
      expect((await db.reviewLogs.toArray()).filter((l) => l.mode === 'test')).toHaveLength(3),
    );
    expect(await repo.listProgress(deck.id)).toEqual([]);
    // nothing was missed: there is nothing to retake
    expect(screen.queryByRole('button', { name: /^Retake/ })).not.toBeInTheDocument();
  });

  it('skipping everything gives 0% and lists the correct answers', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Multiple choice', 'Typing']);
    await screen.findByText('Question 1 of 3');
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Your answers')).toBeInTheDocument();
    expect(screen.getAllByText(/\(skipped\)/)).toHaveLength(3);
  });

  it('a choice must be selected before moving on', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Multiple choice']);
    await screen.findByText('Question 1 of 3');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('true/false: the statement is shown, the answer is graded', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6);
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['True / false']);
    await screen.findByText('Question 1 of 6');

    for (let i = 0; i < 6; i++) {
      const spans = document.querySelectorAll('.statement > span');
      const prompt = spans[0]?.textContent?.trim() as string;
      const shown = spans[spans.length - 1]?.textContent as string;
      const isTrue = ANSWERS.get(prompt) === shown;
      await user.click(screen.getByRole('button', { name: isTrue ? /True/ : /False/ }));
    }
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('true/false: a wrong answer is listed with the statement that was shown', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6);
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['True / false']);
    await screen.findByText('Question 1 of 6');
    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByText('0%')).toBeInTheDocument();
    expect(screen.getAllByText(/^Shown: .+ = .+$/)).toHaveLength(6);
  });

  it('matching: link each item with its pair, then finish', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6.slice(0, 4));
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Matching']);
    await screen.findByText('Question 1 of 1');

    const finish = screen.getByRole('button', { name: 'Finish' });
    expect(finish).toBeDisabled(); // not everything is linked yet
    for (const [term, translation] of WORDS6.slice(0, 4)) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^\\d ${term},`) }));
      await user.click(screen.getByRole('button', { name: new RegExp(`^(\\d )?${translation},`) }));
    }
    // a linked pair is named on both tiles
    expect(screen.getAllByRole('button', { name: /^1 .+, linked with .+$/ })).toHaveLength(2); // both tiles
    expect(finish).toBeEnabled();
    await user.click(finish);
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('matching: a wrongly linked pair costs points; tapping a linked pair again unlinks it', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6.slice(0, 2));
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Matching']);
    await screen.findByText('Question 1 of 1');
    const [[t1, a1], [t2, a2]] = WORDS6.slice(0, 2) as [[string, string], [string, string]];

    // link crosswise: both wrong
    await user.click(screen.getByRole('button', { name: new RegExp(`^\\d ${t1},`) }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^(\\d )?${a2},`) }));
    // unlink the second option (no left item selected), then link it properly
    await user.click(screen.getByRole('button', { name: new RegExp(`^\\d ${a2}, linked`) }));
    expect(
      screen.getByRole('button', { name: new RegExp(`^${a2}, not linked`) }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: new RegExp(`^\\d ${t2},`) }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^(\\d )?${a2},`) }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^\\d ${t1},`) }));
    await user.click(screen.getByRole('button', { name: new RegExp(`^(\\d )?${a1},`) }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('retake only the missed words until everything is right', async () => {
    const user = userEvent.setup();
    const { deck } = await seedDeck(WORDS6);
    open(`/decks/${deck.id}/test`);
    await startQuiz(user, ['Multiple choice']);
    await screen.findByText('Question 1 of 6');

    // 4 right, 2 wrong
    for (let i = 0; i < 6; i++) await answerQuizQuestion(user, i === 5, i < 4);
    expect(await screen.findByText('67%')).toBeInTheDocument();
    const retake = screen.getByRole('button', { name: 'Retake the 2 words you missed' });
    await user.click(retake);

    // a new test with exactly those two words
    expect(await screen.findByText(/Question 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/Retake: only the words you missed/)).toBeInTheDocument();
    // still real choices: the options come from the whole deck
    expect(
      within(screen.getByRole('group', { name: 'Answer options' })).getAllByRole('button'),
    ).toHaveLength(4);

    // get one wrong again: only that one is left to retake
    await answerQuizQuestion(user, false, true);
    await answerQuizQuestion(user, true, false);
    expect(await screen.findByText('50%')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retake the 1 word you missed' }));
    expect(await screen.findByText(/Question 1 of 1/)).toBeInTheDocument();
    await answerQuizQuestion(user, true, true);
    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Retake/ })).not.toBeInTheDocument();

    // from the result a completely new test is possible too
    await user.click(screen.getByRole('button', { name: 'New test' }));
    expect(await screen.findByText('Test settings', { selector: 'h2' })).toBeInTheDocument();
  });
});

describe('Match game', () => {
  it('pairs words with translations, counts mistakes and saves a log without touching the schedule', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}/match`);
    expect(await screen.findByText(/Tap a word, then its translation/)).toBeInTheDocument();

    const tile = (text: string) => screen.getByRole('button', { name: new RegExp(`^${text}`) });
    // a wrong pair first: a mistake, both tiles marked
    await user.click(tile('apple'));
    await user.click(tile('вода'));
    expect(screen.getByRole('status')).toHaveTextContent('Mistakes: 1');
    expect(screen.getAllByText('not a pair')).toHaveLength(2);

    for (const [term, translation] of WORDS) {
      await user.click(tile(term));
      await user.click(tile(translation));
    }
    expect(await screen.findByText('All matched!')).toBeInTheDocument();
    expect(screen.getByText('Mistakes')).toBeInTheDocument();
    await waitFor(async () =>
      expect((await db.reviewLogs.toArray()).filter((l) => l.mode === 'match')).toHaveLength(3),
    );
    const logs = (await db.reviewLogs.toArray()).filter((l) => l.mode === 'match');
    expect(logs.filter((l) => l.result === 'wrong')).toHaveLength(2); // apple and water took part in the wrong try
    expect(await repo.listProgress(deck.id)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(await screen.findByText(/Tap a word, then its translation/)).toBeInTheDocument();
  });

  it('needs at least two cards', async () => {
    const { deck } = await seedDeck([WORDS[0] as [string, string]]);
    open(`/decks/${deck.id}/match`);
    expect(await screen.findByText(/Add at least two cards/)).toBeInTheDocument();
  });
});

describe('Starred cards', () => {
  it('star a card on the deck screen, then study only the starred ones', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    open(`/decks/${deck.id}`);
    await user.click(await screen.findByRole('button', { name: 'Add a star to book' }));
    expect(screen.getByRole('button', { name: 'Remove the star from book' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(async () =>
      expect((await repo.listCards(deck.id)).filter((c) => c.starred)).toHaveLength(1),
    );

    // the study panel offers "only starred" and the links carry it
    await user.click(await screen.findByRole('checkbox', { name: 'Only starred cards (1)' }));
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute(
      'href',
      `#/decks/${deck.id}/learn?dir=forward&starred=1`,
    );
    expect(screen.getByRole('link', { name: 'Match' })).toBeInTheDocument();
  });

  it('a session with ?starred=1 contains only starred cards', async () => {
    const { repo, deck } = await seedDeck();
    const cards = await repo.listCards(deck.id);
    await repo.setStarred(cards[2]!.id, true);
    open(`/decks/${deck.id}/flip?starred=1`);
    expect(await screen.findByText('Card 1 of 1')).toBeInTheDocument();
    expect(document.querySelector('.flip-card__text')?.textContent).toBe(cards[2]!.term);
  });

  it('says so when no card is starred', async () => {
    const { deck } = await seedDeck();
    open(`/decks/${deck.id}/learn?starred=1`);
    expect(await screen.findByText('No starred cards')).toBeInTheDocument();
  });

  it('un-star again', async () => {
    const user = userEvent.setup();
    const { repo, deck } = await seedDeck();
    const [card] = await repo.listCards(deck.id);
    await repo.setStarred(card!.id, true);
    open(`/decks/${deck.id}`);
    await user.click(
      await screen.findByRole('button', { name: `Remove the star from ${card!.term}` }),
    );
    await waitFor(async () => expect((await repo.getCard(card!.id))?.starred).toBe(false));
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
