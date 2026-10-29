import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  elapsedMs,
  isMatchFinished,
  isTileMatched,
  matchProgress,
  matchToLogs,
  pickTile,
  startMatch,
} from '../../core/match';
import type { MatchState } from '../../core/match';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/Notice';
import { useStudyChrome } from './StudyLayout';
import { SummaryView } from './SummaryView';
import type { SaveState } from './SummaryView';
import { StudyGate, useStudyParams } from './useStudy';
import type { StudyData } from './useStudy';

/** How long a wrong pair stays marked. */
const WRONG_FLASH_MS = 700;

export function MatchScreen() {
  const { deckId, direction } = useStudyParams();
  const [run, setRun] = useState(0);
  return (
    <StudyGate key={run} deckId={deckId} mode="learn">
      {(data) => (
        <MatchGame
          data={data}
          bestKey={`sproutcards.matchBest.${deckId}.${direction}`}
          onAgain={() => setRun((r) => r + 1)}
        />
      )}
    </StudyGate>
  );
}

function formatSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

/** The best time of this deck and direction on this device (a convenience; works without storage). */
function readBest(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function MatchGame({
  data,
  bestKey,
  onAgain,
}: {
  data: StudyData;
  bestKey: string;
  onAgain: () => void;
}) {
  const { t } = useI18n();
  const { repo, settings } = useApp();
  const chrome = useStudyChrome();
  const navigate = useNavigate();
  const { direction } = useStudyParams();
  const { deck } = data;

  const [state, setState] = useState<MatchState>(() =>
    startMatch(data.cards, direction, Math.random, undefined, settings.ignoreDiacritics),
  );
  const [now, setNow] = useState(() => Date.now());
  // the wrong pair that has already been shown for its moment (so the marking goes away by itself)
  const [shown, setShown] = useState<readonly [string, string] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [previousBest] = useState(() => readBest(bestKey));
  const saved = useRef(false);
  const finished = isMatchFinished(state);
  const running = state.startedAt !== null && !finished;

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      await repo.saveSession([], matchToLogs(state, data.cards, Date.now()));
      setSaveState('saved');
    } catch {
      saved.current = false;
      setSaveState('error');
    }
  }, [repo, state, data.cards]);

  // the clock
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);

  // mark a wrong pair for a moment
  const lastWrong = state.lastWrong;
  useEffect(() => {
    if (!lastWrong) return;
    const timer = setTimeout(() => setShown(lastWrong), WRONG_FLASH_MS);
    return () => clearTimeout(timer);
  }, [lastWrong]);
  const flash = lastWrong !== shown ? lastWrong : null;

  // save the result and the best time once, when the last pair is found
  const time = elapsedMs(state, now);
  useEffect(() => {
    if (!finished || saved.current || state.matched.length === 0) return;
    saved.current = true;
    void save();
    try {
      const total = elapsedMs(state, now);
      if (previousBest === null || total < previousBest)
        localStorage.setItem(bestKey, String(total));
    } catch {
      // not remembering the best time is fine
    }
  }, [finished, save, state, now, previousBest, bestKey]);

  useEffect(() => chrome.setProgress(matchProgress(state)), [chrome, state]);
  useEffect(() => {
    chrome.setOnClose(() => navigate(`/decks/${deck.id}`));
    return () => chrome.setOnClose(null);
  }, [chrome, navigate, deck.id]);

  const tap = useCallback(
    (tileId: string) => {
      const at = Date.now();
      const next = pickTile(state, tileId, at);
      setNow(at);
      setState(next);
      // Sprout cheers a found pair and winces at a wrong one
      if (next.matched.length > state.matched.length)
        chrome.react(isMatchFinished(next) ? 'celebrate' : 'happy');
      else if (next.mistakes > state.mistakes) chrome.react('oops');
    },
    [state, chrome],
  );

  if (state.tiles.length < 4) {
    return (
      <EmptyState title={t('study.noCards.title')} text={t('match.noCards')}>
        <ButtonLink to={`/decks/${deck.id}`}>{t('study.backToDeck')}</ButtonLink>
      </EmptyState>
    );
  }

  if (finished) {
    const total = elapsedMs(state, now);
    const isBest = previousBest === null || total < previousBest;
    return (
      <SummaryView
        deckId={deck.id}
        mood={isBest || state.mistakes === 0 ? 'celebrate' : 'happy'}
        message={isBest && previousBest !== null ? t('match.newBest') : t('match.done')}
        headline={t('match.seconds', { seconds: formatSeconds(total) })}
        stats={[
          { label: t('match.time'), value: t('match.seconds', { seconds: formatSeconds(total) }) },
          { label: t('match.mistakes'), value: state.mistakes },
          {
            label: t('match.best'),
            value: t('match.seconds', {
              seconds: formatSeconds(isBest ? total : (previousBest as number)),
            }),
          },
        ]}
        weak={[]}
        saveState={saveState}
        onRetrySave={() => {
          saved.current = true;
          void save();
        }}
        onAgain={onAgain}
        againLabel={t('match.again')}
      />
    );
  }

  return (
    <>
      <p className="muted">{t('match.instruction')}</p>
      <div className="hud">
        <span>
          <span className="muted">{t('match.time')}: </span>
          <span className="timer">{formatSeconds(time)}</span>
        </span>
        <span role="status">
          <span className="muted">{t('match.mistakes')}: </span>
          <strong>{state.mistakes}</strong>
        </span>
      </div>
      <div className="tiles" role="group" aria-label={t('match.board')}>
        {state.tiles.map((tile) => {
          const matched = isTileMatched(state, tile);
          const wrong = flash !== null && flash.includes(tile.id);
          const lang = tile.side === 'term' ? deck.learningLang : deck.translationLang;
          return (
            <button
              key={tile.id}
              type="button"
              lang={lang}
              className={`tile${matched ? ' tile--matched' : ''}${wrong ? ' tile--wrong' : ''}`}
              aria-pressed={state.selected === tile.id}
              disabled={matched}
              onClick={() => tap(tile.id)}
            >
              {matched && <span aria-hidden="true">✓</span>}
              {wrong && <span aria-hidden="true">✗</span>}
              <span>{tile.text}</span>
              {matched && <span className="visually-hidden">{t('match.tileMatched')}</span>}
              {wrong && <span className="visually-hidden">{t('match.notPair')}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}
