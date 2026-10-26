import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { computeStreak } from '../../core/stats';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { DeckRow } from '../components/DeckRow';
import { MascotBubble } from '../components/Mascot';

const DAY_MS = 86_400_000;

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
  if (!summaries || streak === undefined) return null;

  const due = summaries.reduce((sum, s) => sum + s.dueCount, 0);
  const cards = summaries.reduce((sum, s) => sum + s.cardCount, 0);

  // the deck with the most reviews waiting
  const dueDeck = summaries
    .filter((s) => s.dueCount > 0)
    .sort((a, b) => b.dueCount - a.dueCount)[0];

  let mood: 'normal' | 'happy' | 'encouraging' = 'normal';
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

  return (
    <>
      <h1 className="visually-hidden">{t('nav.home')}</h1>
      <MascotBubble mood={mood}>{message}</MascotBubble>

      {dueDeck && (
        <ButtonLink to={`/decks/${dueDeck.deck.id}`} block>
          {t('home.review', { name: dueDeck.deck.name })}
        </ButtonLink>
      )}

      <div className="stats" role="group" aria-label={t('home.stats')}>
        <div className="stat">
          <span className="stat__value">{due}</span>
          <span className="muted">{t('home.statDue')}</span>
        </div>
        <div className="stat">
          <span className="stat__value">{streak}</span>
          <span className="muted">{t('home.statStreak')}</span>
        </div>
        <div className="stat">
          <span className="stat__value">{cards}</span>
          <span className="muted">{t('home.statCards')}</span>
        </div>
      </div>

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
