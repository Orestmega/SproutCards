import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { dayPart, nextLine } from '../../core/cheer';
import type { MascotMood } from '../../core/cheer';
import { gardenPlotsOf } from '../../core/gardenLife';
import { pickOfTheDay } from '../../core/habit';
import { computeStreak } from '../../core/stats';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useRepo, useSettings } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { DeckCard } from '../components/DeckCard';
import { GardenScene } from '../components/GardenScene';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icons';
import { Logo } from '../components/Layout';
import { Mascot } from '../components/Mascot';
import { SpeakButton } from '../components/SpeakButton';
import { TodayCard } from '../components/TodayCard';
import { WeekCard } from '../components/WeekCard';
import { useGarden } from '../garden';
import { listSnapshots } from '../resume';
import { snapshotProgress } from '../../core/resume';

const DAY_MS = 86_400_000;
/** The list on the home screen stays short; the rest is on the Decks tab. */
const HOME_DECKS = 4;

/** What Sprout says when patted, one after another. */
const PAT_LINES = [
  'mascot.line.0',
  'mascot.line.1',
  'mascot.line.2',
  'mascot.line.3',
  'mascot.line.4',
] as const satisfies readonly MessageKey[];

export function HomeScreen() {
  const { t, tp, languageName } = useI18n();
  const repo = useRepo();
  const settings = useSettings();
  const summaries = useLiveQuery(() => repo.deckSummaries(Date.now()), [repo]);
  const logTimes = useLiveQuery(async () => {
    const logs = await repo.listLogs(Date.now() - 400 * DAY_MS);
    return logs.map((log) => log.at);
  }, [repo]);
  const due = summaries?.reduce((sum, s) => sum + s.dueCount, 0);
  const [now] = useState(() => Date.now());
  const [pats, setPats] = useState(0);
  const [line, setLine] = useState(-1); // -1: the usual message, not a pat line
  const garden = useGarden(now);

  // a word from a deck that has cards; the same one all day
  const wordDeck = pickOfTheDay(summaries?.filter((s) => s.cardCount > 0) ?? [], now)?.deck;
  const word = useLiveQuery(
    async () => (wordDeck ? pickOfTheDay(await repo.listCards(wordDeck.id), now) : undefined),
    [repo, wordDeck?.id, now],
  );

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

  if (!summaries || due === undefined || !logTimes) return null;

  const part = dayPart(new Date(now).getHours());
  // the home picture has room for the first 9 plots of the garden
  const homePlots = garden
    ? gardenPlotsOf(settings.gardenPlots, garden.earned)
        .slice(0, 9)
        .map((reward) => (reward ? { stage: 'bloom' as const, variety: reward.variety } : null))
    : [];
  // unfinished Learn sessions of decks that still exist
  const resumeList = listSnapshots()
    .flatMap((snapshot) => {
      const deck = summaries.find((s) => s.deck.id === snapshot.deckId)?.deck;
      return deck ? [{ snapshot, deck, ...snapshotProgress(snapshot) }] : [];
    })
    .slice(0, 2);
  const streak = computeStreak(logTimes, now);
  const cards = summaries.reduce((sum, s) => sum + s.cardCount, 0);

  // the deck with the most reviews waiting, else one with words not studied yet
  const dueDeck = [...summaries]
    .sort((a, b) => b.dueCount - a.dueCount)
    .find((s) => s.dueCount > 0);
  const freshDeck = summaries.find((s) => s.growth.seed > 0);

  let mood: MascotMood = part === 'night' ? 'sleepy' : 'normal';
  let message = t('home.welcome');
  if (summaries.length > 0 && due > 0) {
    mood = 'encouraging';
    message = tp('home.dueMessage', due);
  } else if (cards > 0) {
    if (part !== 'night') mood = 'happy';
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
      <div className="home-top">
        <Logo />
        <h1 className="home-top__title">{t('nav.home')}</h1>
        <div className="home-top__right">
          <Link
            to="/stats"
            className={streak > 0 ? 'streak-chip streak-chip--alive' : 'streak-chip'}
            aria-label={t('home.streakLabel', { count: streak })}
          >
            <Icon name="flame" />
            {streak}
          </Link>
          <Link to="/profile" className="profile-chip" aria-label={t('profile.open')}>
            <Avatar avatar={settings.avatar} size={40} />
          </Link>
        </div>
      </div>

      <div className="home-grid">
        <div className="home-grid__main">
          <GardenScene
            part={part}
            plants={homePlots}
            decorations={garden?.decorations.filter((d) => d.earned).map((d) => d.id)}
            health={garden?.health}
          >
            {/* the whole picture opens the garden; Sprout and the bubble sit above this link */}
            <Link to="/garden" className="garden__open">
              <span className="visually-hidden">{t('garden.open')}</span>
            </Link>
            <div className="garden__say">
              <p className="garden__greet">{t(`home.greeting.${part}`)}</p>
              <div aria-live="polite">
                {/* a new key replays the appearing animation for each new line */}
                <p className="garden__message" key={line}>
                  {message}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mascot-btn garden__sprout"
              aria-label={t('mascot.pat')}
              onClick={() => {
                setPats((p) => p + 1);
                setLine((l) => nextLine(l, PAT_LINES.length));
              }}
            >
              <Mascot mood={mood} size={124} reaction={pats} />
            </button>
          </GardenScene>

          {resumeList.map(({ snapshot, deck, percent, total }) => (
            <Link
              key={`${deck.id}-${snapshot.direction}`}
              to={`/decks/${deck.id}/learn?dir=${snapshot.direction}&resume=1`}
              className="resume-card"
            >
              <span className="resume-card__icon" aria-hidden="true">
                <Icon name="learn" />
              </span>
              <span className="list-row__main">
                <span className="list-row__title">
                  {t('resume.continueDeck', { name: deck.name })}
                </span>
                <span className="muted">{t('resume.progress', { percent, total })}</span>
              </span>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          ))}

          {dueDeck ? (
            <ButtonLink to={`/decks/${dueDeck.deck.id}/learn`} block>
              {t('home.review', { name: dueDeck.deck.name })}
            </ButtonLink>
          ) : (
            freshDeck && (
              <ButtonLink to={`/decks/${freshDeck.deck.id}/learn`} block>
                {t('home.learnNew', { name: freshDeck.deck.name })}
              </ButtonLink>
            )
          )}
        </div>

        <div className="home-grid__side">
          <TodayCard times={logTimes} now={now} />
          {garden && <WeekCard week={garden.week} now={now} />}

          {word && wordDeck && (
            <section className="card wotd" aria-labelledby="wotd-title">
              <h2 className="wotd__label" id="wotd-title">
                {t('home.wordOfDay')}
              </h2>
              <p className="wotd__word">
                <span lang={wordDeck.learningLang}>{word.term}</span>
                <SpeakButton text={word.term} lang={wordDeck.learningLang} />
              </p>
              <p className="muted" lang={wordDeck.translationLang}>
                {word.translations.join('; ')}
              </p>
              <p className="muted">
                {wordDeck.name} · {languageName(wordDeck.learningLang)}
              </p>
            </section>
          )}
        </div>

        <div className="home-grid__decks">
          <section className="section" aria-labelledby="home-decks">
            <div className="section__head">
              <h2 className="section__title" id="home-decks">
                {t('home.decks')}
              </h2>
              {summaries.length > 0 && (
                <Link className="section__link" to="/decks">
                  {t('home.allDecks')}
                </Link>
              )}
            </div>
            {summaries.length === 0 ? (
              <>
                <ButtonLink to="/catalog" block>
                  {t('decks.catalog')}
                </ButtonLink>
                <ButtonLink to="/decks/new" variant="secondary" block>
                  {t('decks.new')}
                </ButtonLink>
              </>
            ) : (
              <ul className="deck-grid">
                {summaries.slice(0, HOME_DECKS).map((s) => (
                  <DeckCard key={s.deck.id} summary={s} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
