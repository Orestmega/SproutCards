import { useLiveQuery } from 'dexie-react-hooks';
import { accuracy, computeStreak, dailyCounts, stageCounts } from '../../core/stats';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { EmptyState } from '../components/Notice';
import { PageHeader } from '../components/Layout';

const DAY_MS = 86_400_000;
const CHART_DAYS = 14;
const ACCURACY_DAYS = 7;

export function StatsScreen() {
  const { t, language } = useI18n();
  const repo = useRepo();
  const data = useLiveQuery(async () => {
    const now = Date.now();
    const snapshot = await repo.statsSnapshot(now - 400 * DAY_MS);
    return { now, ...snapshot };
  }, [repo]);
  if (!data) return null;

  const { now, decks, cardIdsByDeck, progress, logs, totalReviews } = data;
  if (totalReviews === 0 && progress.length === 0) {
    return (
      <>
        <PageHeader title={t('stats.title')} backTo="/" />
        <EmptyState title={t('stats.empty.title')} text={t('stats.empty.text')} />
      </>
    );
  }

  const times = logs.map((log) => log.at);
  const days = dailyCounts(times, now, CHART_DAYS);
  const peak = Math.max(1, ...days.map((d) => d.count));
  const weekStart = days[CHART_DAYS - ACCURACY_DAYS]?.dayStart ?? 0;
  const weekAccuracy = accuracy(logs.filter((l) => l.at >= weekStart).map((l) => l.result));
  const perDeck = decks.map((deck) => ({
    deck,
    stages: stageCounts(cardIdsByDeck[deck.id] ?? [], progress),
  }));
  const learned = perDeck.reduce((sum, d) => sum + d.stages.learned, 0);

  const dateFormat = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 });

  return (
    <>
      <PageHeader title={t('stats.title')} backTo="/" />

      <div className="stats stats--two" role="group" aria-label={t('stats.numbers')}>
        <Stat value={String(computeStreak(times, now))} label={t('stats.streak')} />
        <Stat value={String(learned)} label={t('stats.learned')} />
        <Stat value={String(totalReviews)} label={t('stats.reviews')} />
        <Stat
          value={weekAccuracy === null ? '–' : percent.format(weekAccuracy)}
          label={t('stats.accuracy')}
        />
      </div>

      <section className="section" aria-labelledby="stats-activity">
        <h2 className="section__title" id="stats-activity">
          {t('stats.activity')}
        </h2>
        <figure className="chart" aria-label={t('stats.chartLabel', { days: CHART_DAYS })}>
          {/* The bars are decoration; screen readers get the same numbers as a list. */}
          <div className="chart__bars" aria-hidden="true">
            {days.map((d) => (
              <div className="chart__col" key={d.dayStart}>
                <div className="chart__value">{d.count > 0 ? d.count : ''}</div>
                <div
                  className={`chart__bar${d.count === 0 ? ' chart__bar--empty' : ''}`}
                  style={{ height: `${(d.count / peak) * 100}%` }}
                />
                <div className="chart__day">{new Date(d.dayStart).getDate()}</div>
              </div>
            ))}
          </div>
          <ul className="visually-hidden">
            {days.map((d) => (
              <li key={d.dayStart}>
                {t('stats.dayReviews', { date: dateFormat.format(d.dayStart), count: d.count })}
              </li>
            ))}
          </ul>
        </figure>
      </section>

      {perDeck.length > 0 && (
        <section className="section" aria-labelledby="stats-decks">
          <h2 className="section__title" id="stats-decks">
            {t('stats.decks')}
          </h2>
          <ul className="list">
            {perDeck.map(({ deck, stages }) => {
              const total = stages.learned + stages.learning + stages.fresh;
              const share = (n: number) => (total === 0 ? 0 : (n / total) * 100);
              return (
                <li className="list-row stages-row" key={deck.id}>
                  <strong className="list-row__title">{deck.name}</strong>
                  <div className="stages" aria-hidden="true">
                    <span
                      className="stages__learned"
                      style={{ width: `${share(stages.learned)}%` }}
                    />
                    <span
                      className="stages__learning"
                      style={{ width: `${share(stages.learning)}%` }}
                    />
                  </div>
                  <span className="muted">{t('stats.deckSummary', { ...stages })}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted">{t('stats.learnedHint')}</p>
        </section>
      )}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}
