import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { dayPart, nextLine } from '../../core/cheer';
import type { MascotMood } from '../../core/cheer';
import { computeStreak } from '../../core/stats';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useRepo } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { DeckRow } from '../components/DeckRow';
import { Icon } from '../components/Icons';
import { Mascot } from '../components/Mascot';

const DAY_MS = 86_400_000;

/** What Sprout says when patted, one after another. */
const PAT_LINES = [
  'mascot.line.0',
  'mascot.line.1',
  'mascot.line.2',
  'mascot.line.3',
  'mascot.line.4',
] as const satisfies readonly MessageKey[];

export function HomeScreen() {
  const { t, tp } = useI18n();
  const repo = useRepo();
  const summaries = useLiveQuery(() => repo.deckSummaries(Date.now()), [repo]);
  const streak = useLiveQuery(async () => {
    const now = Date.now();
    const logs = await repo.listLogs(now - 400 * DAY_MS);
    return computeStreak(
      logs.map((log) => log.at),
      now,
    );
  }, [repo]);
  const due = summaries?.reduce((sum, s) => sum + s.dueCount, 0);
  const [hour] = useState(() => new Date().getHours());
  const [pats, setPats] = useState(0);
  const [line, setLine] = useState(-1); // -1: the usual message, not a pat line

  // Where the system supports it, the installed app's icon shows the number of due reviews.
  // It is refreshed only while the app runs; a web app cannot wake itself up to update it.
  useEffect(() => {
    if (due === undefined) return;
    const badging = navigator as Navigator & {
      setAppBadge?: (count: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    const update = due > 0 ? badging.setAppBadge?.(due) : badging.clearAppBadge?.();
    update?.catch(() => undefined);
  }, [due]);

  if (!summaries || due === undefined || streak === undefined) return null;

  const cards = summaries.reduce((sum, s) => sum + s.cardCount, 0);

  // the deck with the most reviews waiting
  const dueDeck = summaries
    .filter((s) => s.dueCount > 0)
    .sort((a, b) => b.dueCount - a.dueCount)[0];

  let mood: MascotMood = 'normal';
  let message = t('home.welcome');
  if (summaries.length > 0 && due > 0) {
    mood = 'encouraging';
    message = tp('home.dueMessage', due);
  } else if (cards > 0) {
    mood = 'happy';
    message = t('home.nothingDue');
  } else if (summaries.length > 0) {
    message = t('home.addCardsMessage');
  }
  // after a pat Sprout jumps for joy and says one of its lines instead
  const patLine = PAT_LINES[line];
  if (patLine) {
    mood = pats % 3 === 0 ? 'celebrate' : 'happy';
    message = t(patLine);
  }

  return (
    <>
      <h1 className="visually-hidden">{t('nav.home')}</h1>
      <div className="hero">
        <div className="hero__text">
          <p className="hero__greet">{t(`home.greeting.${dayPart(hour)}`)}</p>
          <div aria-live="polite">
            {/* a new key replays the appearing animation for each new line */}
            <p className="hero__message" key={line}>
              {message}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="mascot-btn"
          aria-label={t('mascot.pat')}
          onClick={() => {
            setPats((p) => p + 1);
            setLine((l) => nextLine(l, PAT_LINES.length));
          }}
        >
          <Mascot mood={mood} size={112} reaction={pats} />
        </button>
      </div>

      {dueDeck && (
        <ButtonLink to={`/decks/${dueDeck.deck.id}`} block>
          {t('home.review', { name: dueDeck.deck.name })}
        </ButtonLink>
      )}

      <div className="stats" role="group" aria-label={t('home.stats')}>
        <div className="stat">
          <span className="stat__icon stat__icon--due">
            <Icon name="clock" />
          </span>
          <span className="stat__value">{due}</span>
          <span className="muted">{t('home.statDue')}</span>
        </div>
        <div className="stat">
          <span
            className={
              streak > 0
                ? 'stat__icon stat__icon--streak stat__icon--alive'
                : 'stat__icon stat__icon--streak'
            }
          >
            <Icon name="flame" />
          </span>
          <span className="stat__value">{streak}</span>
          <span className="muted">{t('home.statStreak')}</span>
        </div>
        <div className="stat">
          <span className="stat__icon stat__icon--cards">
            <Icon name="cards" />
          </span>
          <span className="stat__value">{cards}</span>
          <span className="muted">{t('home.statCards')}</span>
        </div>
      </div>

      <Link to="/stats">{t('home.statistics')}</Link>

      <section className="section" aria-labelledby="home-decks">
        <h2 className="section__title" id="home-decks">
          {t('home.decks')}
        </h2>
        {summaries.length === 0 ? (
          <>
            <ButtonLink to="/decks/new" block>
              {t('decks.new')}
            </ButtonLink>
            <ButtonLink to="/catalog" variant="secondary" block>
              {t('decks.catalog')}
            </ButtonLink>
          </>
        ) : (
          <>
            <ul className="list">
              {summaries.map((s) => (
                <DeckRow key={s.deck.id} summary={s} />
              ))}
            </ul>
            <Link to="/decks">{t('home.allDecks')}</Link>
          </>
        )}
      </section>
    </>
  );
}
