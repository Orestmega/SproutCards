import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { shuffle } from '../../core/random';
import { selectSessionCards, sessionCards } from '../../core/selection';
import { startOfDayPlus } from '../../core/scheduler';
import type { Card, Deck, Direction, Progress } from '../../core/types';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/Notice';
import { NotFoundScreen } from '../screens/NotFoundScreen';

/**
 * While `active`, closing or reloading the tab asks the browser to confirm (an unfinished session
 * has results that are saved only when it ends). Browsers show their own generic text.
 */
export function useWarnBeforeUnload(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}

/** Everything a study session needs, read once when the session starts (not live: it must not change mid-session). */
export interface StudyData {
  deck: Deck;
  cards: Card[];
  progress: Progress[];
  /** New cards the user may still start today. */
  newBudget: number;
  now: number;
}

type Loaded =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; data: StudyData };

/** Reads the study options from the URL: `?dir=backward`, `?all=1` (practice every card), `?starred=1`. */
export function useStudyParams(): {
  deckId: string;
  direction: Direction;
  practice: boolean;
  /** Study only the cards with a star. */
  starred: boolean;
} {
  const { deckId = '' } = useParams();
  const [params] = useSearchParams();
  return {
    deckId,
    direction: params.get('dir') === 'backward' ? 'backward' : 'forward',
    practice: params.get('all') === '1',
    starred: params.get('starred') === '1',
  };
}

/** Loads the data once. To start over, remount the component that calls this (change its `key`). */
function useStudyData(deckId: string, newCardsPerDay: number, starredOnly: boolean): Loaded {
  const { repo } = useApp();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const deck = await repo.getDeck(deckId);
      if (!deck) return { status: 'missing' } as const;
      const now = Date.now();
      const [cards, progress, newToday] = await Promise.all([
        repo.listCards(deckId),
        repo.listProgress(deckId),
        repo.countNewSince(startOfDayPlus(now, 0)),
      ]);
      const data: StudyData = {
        deck,
        cards: starredOnly ? cards.filter((c) => c.starred === true) : cards,
        progress,
        newBudget: Math.max(0, newCardsPerDay - newToday),
        now,
      };
      return { status: 'ready', data } as const;
    })().then(
      (result) => !cancelled && setLoaded(result),
      () => !cancelled && setLoaded({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [repo, deckId, newCardsPerDay, starredOnly]);

  return loaded;
}

/** The cards for a Learn or flip session: what is due plus today's new cards, or everything when practising. */
export function pickSessionCards(data: StudyData, direction: Direction, practice: boolean): Card[] {
  if (practice) return shuffle(data.cards).slice(0, 20);
  const selection = selectSessionCards(
    data.cards,
    data.progress,
    direction,
    data.now,
    data.newBudget,
  );
  return shuffle(sessionCards(selection));
}

/**
 * Loads the deck and shows the loading, not-found and error states, then renders the session.
 * `needsCards(data)` lets a mode say that there is nothing to do (the screen then offers practice).
 */
export function StudyGate({
  deckId,
  mode,
  children,
  emptyFor,
}: {
  deckId: string;
  /** Which route the "practice all" button goes back to. */
  mode: 'flip' | 'learn';
  children: (data: StudyData) => ReactNode;
  /** Return true when the session would have no cards; shows the "nothing to study" screen. */
  emptyFor?: (data: StudyData, direction: Direction) => boolean;
}) {
  const { t } = useI18n();
  const { settings } = useApp();
  const { direction, practice, starred } = useStudyParams();
  const loaded = useStudyData(deckId, settings.newCardsPerDay, starred);

  if (loaded.status === 'loading') return null;
  if (loaded.status === 'missing') return <NotFoundScreen />;
  if (loaded.status === 'error') {
    return (
      <EmptyState title={t('study.loadFailed.title')} text={t('study.loadFailed.text')}>
        <ButtonLink to={`/decks/${deckId}`}>{t('study.backToDeck')}</ButtonLink>
      </EmptyState>
    );
  }
  const { data } = loaded;
  if (data.cards.length === 0 && starred) {
    return (
      <EmptyState title={t('study.noStarred.title')} text={t('study.noStarred.text')}>
        <ButtonLink to={`/decks/${deckId}`}>{t('study.noStarred.back')}</ButtonLink>
      </EmptyState>
    );
  }
  if (data.cards.length === 0) {
    return (
      <EmptyState title={t('study.noCards.title')} text={t('study.noCards.text')}>
        <ButtonLink to={`/decks/${deckId}/cards/new`}>{t('deck.addCard')}</ButtonLink>
        <ButtonLink to={`/decks/${deckId}`} variant="secondary">
          {t('study.backToDeck')}
        </ButtonLink>
      </EmptyState>
    );
  }
  if (!practice && emptyFor?.(data, direction)) {
    return (
      <EmptyState
        title={t('study.nothingDue.title')}
        text={t('study.nothingDue.text')}
        mood="happy"
      >
        <ButtonLink
          to={`/decks/${deckId}/${mode}?dir=${direction}&all=1${starred ? '&starred=1' : ''}`}
        >
          {t('study.practiceAll')}
        </ButtonLink>
        <ButtonLink to={`/decks/${deckId}`} variant="secondary">
          {t('study.backToDeck')}
        </ButtonLink>
      </EmptyState>
    );
  }
  return <>{children(data)}</>;
}
