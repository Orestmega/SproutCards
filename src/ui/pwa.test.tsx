import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createFixedIntervalScheduler } from '../core/scheduler';
import { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';
import { AppProviders } from './AppProviders';
import { ErrorBoundary } from './components/ErrorBoundary';
import { INERT_PWA, isIosDevice, PwaContext } from './pwa';
import type { PwaState } from './pwa';
import { AppRoutes } from './routes';
import { useWarnBeforeUnload } from './study/useStudy';

let n = 0;
let db: AppDatabase;
let name: string;

beforeEach(() => {
  name = `pwa-test-${++n}`;
  db = new AppDatabase(name);
});

afterEach(async () => {
  db.close();
  await AppDatabase.delete(name);
});

function renderAt(path: string, pwa: Partial<PwaState> = {}) {
  return render(
    <AppProviders db={db}>
      <PwaContext.Provider value={{ ...INERT_PWA, ...pwa }}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </PwaContext.Provider>
    </AppProviders>,
  );
}

describe('isIosDevice', () => {
  it('recognises iPhone and iPad, including iPadOS that calls itself a Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'iPhone', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe(true);
  });

  it('does not take a desktop Mac or Android for iOS', () => {
    expect(isIosDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 0)).toBe(false);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14)', 'Linux armv81', 5)).toBe(false);
  });
});

describe('update and offline messages', () => {
  it('offers the update, says data is kept, and applies it only on request', async () => {
    const user = userEvent.setup();
    const applyUpdate = vi.fn();
    const dismissUpdate = vi.fn();
    renderAt('/', { updateReady: true, applyUpdate, dismissUpdate });
    expect(await screen.findByText('A new version of SproutCards is ready.')).toBeInTheDocument();
    expect(screen.getByText('Your decks and progress are kept.')).toBeInTheDocument();
    expect(applyUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(dismissUpdate).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Update now' }));
    expect(applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('is not shown inside a study session, so an update cannot interrupt a lesson', async () => {
    const repo = createRepo(db);
    const deck = await repo.createDeck({ name: 'D', learningLang: 'en', translationLang: 'uk' });
    await repo.addCard(deck.id, { term: 'cat', translations: ['кіт'] });
    renderAt(`/decks/${deck.id}/learn`, { updateReady: true });
    await screen.findByText('cat');
    expect(screen.queryByText('A new version of SproutCards is ready.')).not.toBeInTheDocument();
  });

  it('tells the user once that the app is ready for offline use', async () => {
    const user = userEvent.setup();
    const dismissOfflineReady = vi.fn();
    renderAt('/', { offlineReady: true, dismissOfflineReady });
    expect(await screen.findByText('Ready to work offline.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(dismissOfflineReady).toHaveBeenCalled();
  });
});

describe('settings: app on this device', () => {
  it('offers installing when the browser allows it', async () => {
    const user = userEvent.setup();
    const install = vi.fn(async () => undefined);
    renderAt('/settings', { canInstall: true, install });
    await user.click(await screen.findByRole('button', { name: 'Install the app' }));
    expect(install).toHaveBeenCalled();
  });

  it('shows Add to Home Screen instructions on iPhone, where there is no install prompt', async () => {
    renderAt('/settings', { needsIosInstructions: true });
    expect(await screen.findByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install the app' })).not.toBeInTheDocument();
  });

  it('says honestly whether offline mode is active, unavailable or not yet on', async () => {
    const first = renderAt('/settings', { offlineActive: true });
    expect(await screen.findByText(/Offline mode is on/)).toBeInTheDocument();
    first.unmount();

    const second = renderAt('/settings', { offlineUnavailable: true });
    expect(await screen.findByText(/cannot run the app offline/)).toBeInTheDocument();
    second.unmount();

    renderAt('/settings');
    expect(await screen.findByText(/Offline mode is not active yet/)).toBeInTheDocument();
  });

  it('warns when the browser may delete the data', async () => {
    renderAt('/settings', { storagePersistent: false });
    expect(await screen.findByText(/may delete your data/)).toBeInTheDocument();
  });

  it('is open about reminders: no notifications while the app is closed', async () => {
    renderAt('/settings');
    expect(
      await screen.findByText(/cannot send notifications while it is closed/),
    ).toBeInTheDocument();
  });

  it('shows a message and keeps the old value when a setting cannot be saved', async () => {
    const user = userEvent.setup();
    renderAt('/settings');
    const english = await screen.findByRole('radio', { name: 'English' });
    vi.spyOn(db.settings, 'put').mockRejectedValue(new Error('quota'));
    await user.click(screen.getByRole('radio', { name: 'Українська' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(english).toHaveAttribute('aria-checked', 'true');
  });
});

describe('app icon badge', () => {
  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>).setAppBadge;
    delete (navigator as unknown as Record<string, unknown>).clearAppBadge;
  });

  it('shows the number of due reviews where the system supports it', async () => {
    const setAppBadge = vi.fn(async () => undefined);
    Object.assign(navigator, { setAppBadge, clearAppBadge: vi.fn(async () => undefined) });
    const repo = createRepo(db);
    const deck = await repo.createDeck({ name: 'D', learningLang: 'en', translationLang: 'uk' });
    const card = await repo.addCard(deck.id, { term: 'cat', translations: ['кіт'] });
    const state = createFixedIntervalScheduler().review(undefined, 'correct', 1000);
    await repo.saveSession(
      [
        {
          ...state,
          id: `${card.id}:forward`,
          cardId: card.id,
          deckId: deck.id,
          direction: 'forward',
          lastReviewedAt: 1000,
        },
      ],
      [],
    );
    renderAt('/');
    await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(1));
  });

  it('does nothing on browsers without the Badging API', async () => {
    renderAt('/');
    expect(await screen.findByText(/Sprout/)).toBeInTheDocument();
  });
});

describe('statistics', () => {
  it('shows an empty state before any studying', async () => {
    renderAt('/stats');
    expect(await screen.findByText('No statistics yet')).toBeInTheDocument();
  });

  it('shows streak, learned words, total reviews, accuracy, the chart and deck progress', async () => {
    const repo = createRepo(db);
    const deck = await repo.createDeck({
      name: 'Travel',
      learningLang: 'en',
      translationLang: 'uk',
    });
    const cat = await repo.addCard(deck.id, { term: 'cat', translations: ['кіт'] });
    await repo.addCard(deck.id, { term: 'dog', translations: ['пес'] });
    const now = Date.now();
    const log = (result: 'correct' | 'wrong') => ({
      at: now,
      cardId: cat.id,
      deckId: deck.id,
      direction: 'forward' as const,
      mode: 'learn' as const,
      result,
    });
    await repo.saveSession(
      [
        {
          reps: 3,
          intervalDays: 7,
          dueAt: now + 86_400_000,
          lapses: 0,
          id: `${cat.id}:forward`,
          cardId: cat.id,
          deckId: deck.id,
          direction: 'forward',
          lastReviewedAt: now,
        },
      ],
      [log('correct'), log('correct'), log('wrong')],
    );

    renderAt('/stats');
    const numbers = await screen.findByRole('group', { name: 'Your numbers' });
    const value = (label: string) =>
      within(numbers).getByText(label).parentElement?.querySelector('.stat__value')?.textContent;
    expect(value('Day streak')).toBe('1');
    expect(value('Words learned')).toBe('1');
    expect(value('Reviews in total')).toBe('3');
    expect(value('Correct, last 7 days')).toBe('67%');

    // the chart has a text version for screen readers: today has 3 reviews
    const chart = screen.getByRole('figure', { name: /over the last 14 days/ });
    expect(within(chart).getAllByRole('listitem')).toHaveLength(14);
    expect(within(chart).getAllByRole('listitem').at(-1)).toHaveTextContent(/: 3$/);

    expect(screen.getByText('1 learned, 0 in progress, 1 new')).toBeInTheDocument();
  });
});

describe('error boundary', () => {
  it('shows an explanation and a reload button instead of a blank page', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Broken(): never {
      throw new Error('boom');
    }
    render(
      <AppProviders db={db}>
        <ErrorBoundary>
          <Broken />
        </ErrorBoundary>
      </AppProviders>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe('leaving an unfinished study session', () => {
  function Probe({ active }: { active: boolean }) {
    useWarnBeforeUnload(active);
    return null;
  }
  const closeTab = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('asks the browser to confirm closing the tab only while there is something to lose', () => {
    const view = render(<Probe active={false} />);
    expect(closeTab()).toBe(false);
    view.rerender(<Probe active />);
    expect(closeTab()).toBe(true);
    view.rerender(<Probe active={false} />);
    expect(closeTab()).toBe(false);
    view.rerender(<Probe active />);
    view.unmount();
    expect(closeTab()).toBe(false);
  });
});
