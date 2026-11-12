import { deckName } from '../../core/catalog';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { GROWTH_STAGES, growthCounts } from '../../core/garden';
import { heatmapWeeks, reviewForecast } from '../../core/habit';
import { accuracy } from '../../core/stats';
import { useI18n } from '../../i18n';
import { useState } from 'react';
import { useRepo } from '../AppProviders';
import { GrowthBar, GrowthLegend } from '../components/GrowthBar';
import { Icon } from '../components/Icons';
import { PageHeader } from '../components/Layout';
import { EmptyState } from '../components/Notice';
import { ProgressBar } from '../components/ProgressBar';
import { WeekCard } from '../components/WeekCard';
import { useGarden } from '../garden';

const DAY_MS = 86_400_000;
const FORECAST_DAYS = 7;
const HEATMAP_WEEKS = 18;
const ACCURACY_DAYS = 7;

export function StatsScreen() {
  const { t, language } = useI18n();
  const repo = useRepo();
  const [opened] = useState(() => Date.now());
  // achievements and the week come from the garden, the same numbers that earn flowers
  const garden = useGarden(opened);
  const data = useLiveQuery(async () => {
    const snapshot = await repo.statsSnapshot(0); // all answers: the longest streak needs them
    return { now: Date.now(), ...snapshot };
  }, [repo]);
  if (!data || !garden) return null;

  const { now, decks, cardIdsByDeck, progress, logs, totalReviews } = data;
  const times = logs.map((log) => log.at);
  const perDeck = decks.map((deck) => ({
    deck,
    growth: growthCounts(cardIdsByDeck[deck.id] ?? [], progress),
  }));
  const growth = growthCounts(Object.values(cardIdsByDeck).flat(), progress);
  const { achievements } = garden;
  const best = garden.facts.bestStreak;
  const reached = achievements.filter((a) => a.done).length;
  const achievementsBlock = (
    <section className="section" aria-labelledby="stats-achievements">
      <div className="section__head">
        <h2 className="section__title" id="stats-achievements">
          {t('stats.achievements')}
        </h2>
        <span className="muted">
          {t('stats.achievementsCount', { done: reached, total: achievements.length })}
        </span>
      </div>
      <ul className="ach-grid">
        {achievements.map((a) => (
          <li key={a.id}>
            <div className={a.done ? 'ach ach--done' : 'ach'}>
              <span className="ach__medal">
                <Icon name="medal" />
              </span>
              <span className="ach__name">{t(`achievement.${a.id}`)}</span>
              <span className="muted">{t(`achievement.${a.id}.how`)}</span>
              {a.done ? (
                <span className="visually-hidden">{t('stats.achievementDone')}</span>
              ) : (
                <ProgressBar
                  value={a.share}
                  label={`${t(`achievement.${a.id}`)}: ${a.value} / ${a.target}`}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  if (totalReviews === 0 && progress.length === 0) {
    return (
      <>
        <PageHeader title={t('stats.title')} />
        <EmptyState title={t('stats.empty.title')} text={t('stats.empty.text')} />
        <WeekCard
          week={garden.week}
          now={opened}
          fullWeeks={garden.facts.fullWeeks}
          freezes={garden.streak.freezes}
        />
        {achievementsBlock}
      </>
    );
  }

  const weekStart = now - ACCURACY_DAYS * DAY_MS;
  const weekAccuracy = accuracy(logs.filter((l) => l.at >= weekStart).map((l) => l.result));
  const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 });
  const dayFormat = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'short' });

  const weeks = heatmapWeeks(times, now, HEATMAP_WEEKS);
  const activeDays = weeks.flat().filter((d) => d.count > 0);
  const forecast = reviewForecast(
    progress.map((p) => p.dueAt),
    now,
    FORECAST_DAYS,
  );
  const peak = Math.max(1, ...forecast.map((d) => d.count));

  return (
    <>
      <PageHeader title={t('stats.title')} />

      <section className="card stack" aria-labelledby="stats-garden">
        <h2 className="section__title" id="stats-garden">
          {t('stats.garden')}
        </h2>
        <GrowthBar growth={growth} />
        <GrowthLegend growth={growth} />
        <p className="muted">{t('stats.learnedHint')}</p>
        <Link to="/garden">{t('garden.open')}</Link>
      </section>

      <div className="stats stats--two" role="group" aria-label={t('stats.numbers')}>
        <Stat value={String(garden.streak.current)} label={t('stats.streak')} />
        <Stat value={String(best)} label={t('stats.bestStreak')} />
        <Stat value={String(totalReviews)} label={t('stats.reviews')} />
        <Stat
          value={weekAccuracy === null ? '–' : percent.format(weekAccuracy)}
          label={t('stats.accuracy')}
        />
      </div>

      <WeekCard
        week={garden.week}
        now={opened}
        fullWeeks={garden.facts.fullWeeks}
        freezes={garden.streak.freezes}
      />

      <section className="section" aria-labelledby="stats-activity">
        <h2 className="section__title" id="stats-activity">
          {t('stats.activity')}
        </h2>
        <figure className="chart" style={{ margin: 0 }}>
          {/* The squares are decoration; screen readers get the numbers as a list. */}
          <div className="heatmap" aria-hidden="true">
            {weeks.map((week) => (
              <div className="heatmap__week" key={week[0]?.dayStart}>
                {week.map((day) => (
                  <span
                    key={day.dayStart}
                    title={`${dayFormat.format(day.dayStart)}: ${day.count}`}
                    className={
                      day.future
                        ? 'heatmap__day heatmap__day--future'
                        : `heatmap__day heatmap__day--${day.level}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <ul
            className="visually-hidden"
            aria-label={t('stats.chartLabel', { days: HEATMAP_WEEKS * 7 })}
          >
            {activeDays.map((d) => (
              <li key={d.dayStart}>
                {t('stats.dayReviews', { date: dayFormat.format(d.dayStart), count: d.count })}
              </li>
            ))}
          </ul>
        </figure>
      </section>

      <section className="section" aria-labelledby="stats-forecast">
        <h2 className="section__title" id="stats-forecast">
          {t('stats.forecast')}
        </h2>
        <figure className="chart">
          <div className="chart__bars" aria-hidden="true">
            {forecast.map((d) => (
              <div className="chart__col" key={d.dayStart}>
                <div className="chart__value">{d.count > 0 ? d.count : ''}</div>
                <div
                  className={`chart__bar${d.count === 0 ? ' chart__bar--empty' : ''}`}
                  style={{ height: `${(d.count / peak) * 100}%` }}
                />
                <div className="chart__day">{weekday.format(d.dayStart)}</div>
              </div>
            ))}
          </div>
          <ul className="visually-hidden">
            {forecast.map((d) => (
              <li key={d.dayStart}>
                {t('stats.dayReviews', { date: dayFormat.format(d.dayStart), count: d.count })}
              </li>
            ))}
          </ul>
        </figure>
      </section>

      {achievementsBlock}

      {perDeck.length > 0 && (
        <section className="section" aria-labelledby="stats-decks">
          <h2 className="section__title" id="stats-decks">
            {t('stats.decks')}
          </h2>
          <ul className="list">
            {perDeck.map(({ deck, growth: deckGrowth }) => (
              <li className="list-row stages-row" key={deck.id}>
                <strong className="list-row__title">{deckName(deck, language)}</strong>
                <GrowthBar growth={deckGrowth} />
                <span className="muted">
                  {GROWTH_STAGES.map(
                    (stage) => `${t(`growth.${stage}`)}: ${deckGrowth[stage]}`,
                  ).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
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
