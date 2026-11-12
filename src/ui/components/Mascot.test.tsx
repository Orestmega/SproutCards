import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { AppDatabase } from '../../db/db';
import { createRepo } from '../../db/repo';
import { Mascot } from './Mascot';
import type { MascotMood } from './Mascot';

const MOODS: MascotMood[] = [
  'normal',
  'happy',
  'encouraging',
  'thinking',
  'oops',
  'celebrate',
  'sleepy',
];

describe('Mascot', () => {
  it.each(MOODS)('draws the "%s" mood', (mood) => {
    const { container } = render(<Mascot mood={mood} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('data-mood', mood);
    expect(svg).toHaveClass(`mascot--${mood}`);
  });

  it('is decoration without a label and a named picture with one', () => {
    const { container, rerender } = render(<Mascot />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<Mascot label="Sprout waves" />);
    expect(screen.getByRole('img', { name: 'Sprout waves' })).toBeInTheDocument();
  });

  it('open eyes by default, the smile of the picture when happy, a drawn face for the rest', () => {
    const face = (mood: MascotMood) => {
      const { container, unmount } = render(<Mascot mood={mood} />);
      const svg = container.querySelector('svg');
      const found = {
        face: svg?.getAttribute('data-face'),
        openEyes: container.querySelector('.mascot__eyes') !== null,
      };
      unmount();
      return found;
    };
    expect(face('normal')).toEqual({ face: 'open', openEyes: true });
    expect(face('happy')).toEqual({ face: 'picture', openEyes: false });
    expect(face('celebrate')).toEqual({ face: 'picture', openEyes: false });
    expect(face('sleepy')).toEqual({ face: 'drawn', openEyes: false });
    expect(face('oops')).toEqual({ face: 'drawn', openEyes: true });
  });

  it('only the moods that need them get sparkles, thought dots or a drop', () => {
    const parts = (mood: MascotMood) => {
      const { container, unmount } = render(<Mascot mood={mood} />);
      const found = {
        sparkles: container.querySelectorAll('.mascot__sparkle').length,
        dots: container.querySelector('.mascot__dots') !== null,
        drop: container.querySelector('.mascot__drop') !== null,
      };
      unmount();
      return found;
    };
    expect(parts('normal')).toEqual({ sparkles: 0, dots: false, drop: false });
    expect(parts('celebrate')).toMatchObject({ sparkles: 4 });
    expect(parts('thinking')).toMatchObject({ dots: true });
    expect(parts('oops')).toMatchObject({ drop: true });
  });

  it('a new reaction number replays the animation (the moving group is drawn anew)', () => {
    const { container, rerender } = render(<Mascot mood="happy" reaction={1} />);
    const before = container.querySelector('.mascot__actor');
    rerender(<Mascot mood="happy" reaction={1} />);
    expect(container.querySelector('.mascot__actor')).toBe(before);
    rerender(<Mascot mood="happy" reaction={2} />);
    expect(container.querySelector('.mascot__actor')).not.toBe(before);
  });
});

describe('Home: pat Sprout', () => {
  let db: AppDatabase;
  const name = 'mascot-home-test';

  beforeEach(() => {
    db = new AppDatabase(name);
  });

  afterEach(async () => {
    db.close();
    await AppDatabase.delete(name);
  });

  it('greets by the time of day; a tap makes Sprout happy and say its lines in turn', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/';
    render(<App db={db} />);
    expect(
      await screen.findByText("Hi! I'm Sprout. Let's make your first deck of cards."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^(Good morning!|Good afternoon!|Good evening!|Up late\?)$/),
    ).toBeInTheDocument();

    const sprout = screen.getByRole('button', { name: 'Pat Sprout' });
    await user.click(sprout);
    expect(screen.getByText('Hehe, that tickles!')).toBeInTheDocument();
    expect(sprout.querySelector('svg')).toHaveAttribute('data-mood', 'happy');
    await user.click(sprout);
    expect(screen.getByText('A few words a day is all it takes.')).toBeInTheDocument();
    await user.click(sprout);
    expect(sprout.querySelector('svg')).toHaveAttribute('data-mood', 'celebrate');
  });

  it('late at night Sprout dozes even with reviews waiting; a pat wakes it only for a moment', async () => {
    const late = new Date();
    late.setHours(23, 0, 0, 0);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(late.getTime());
    try {
      const repo = createRepo(db);
      const deck = await repo.createDeck({
        name: 'Night',
        learningLang: 'en',
        translationLang: 'uk',
      });
      const card = await repo.addCard(deck.id, { term: 'moon', translations: ['місяць'] });
      await repo.saveSession(
        [
          {
            id: `${card.id}:forward`,
            cardId: card.id,
            deckId: deck.id,
            direction: 'forward',
            reps: 1,
            intervalDays: 1,
            dueAt: late.getTime() - 1000, // due: there is something to review
            lapses: 0,
            lastReviewedAt: late.getTime() - 86_400_000,
          },
        ],
        [],
      );
      await repo.saveSettings({ ...(await repo.getSettings()), uiLanguage: 'en' });
      const user = userEvent.setup();
      window.location.hash = '#/';
      render(<App db={db} />);
      const sprout = await screen.findByRole('button', { name: 'Pat Sprout' });
      await waitFor(() =>
        expect(sprout.querySelector('svg')).toHaveAttribute('data-mood', 'sleepy'),
      );
      await user.click(sprout);
      expect(sprout.querySelector('svg')).toHaveAttribute('data-mood', 'happy');
      // and it dozes off again
      await waitFor(
        () => expect(sprout.querySelector('svg')).toHaveAttribute('data-mood', 'sleepy'),
        {
          timeout: 8000,
        },
      );
    } finally {
      clock.mockRestore();
    }
  }, 20000);
});
