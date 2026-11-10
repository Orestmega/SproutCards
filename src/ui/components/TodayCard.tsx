import { todayCount, weekDays } from '../../core/habit';
import { useI18n } from '../../i18n';
import { useSettings } from '../AppProviders';
import { GoalRing } from './GoalRing';

/**
 * Today's goal and the current week; `times` are the moments of recent answers, `frozenDays` the starts
 * of the days a streak freeze saved (they show a snowflake).
 */
export function TodayCard({
  times,
  now,
  frozenDays = [],
}: {
  times: readonly number[];
  now: number;
  frozenDays?: readonly number[];
}) {
  const { t, language } = useI18n();
  const { dailyGoal } = useSettings();
  const count = todayCount(times, now);
  const week = weekDays(times, now);
  const dayName = new Intl.DateTimeFormat(language, { weekday: 'narrow' });
  const longDay = new Intl.DateTimeFormat(language, { weekday: 'long' });
  const left = Math.max(0, dailyGoal - count);
  return (
    <section className="card today" aria-labelledby="today-title">
      <div className="today__top">
        <GoalRing share={count / dailyGoal}>{Math.round((count / dailyGoal) * 100)}%</GoalRing>
        <div>
          <h2 className="today__title" id="today-title">
            {t('home.goal.title')}
          </h2>
          <p>{t('home.goal.count', { count, goal: dailyGoal })}</p>
          <p className="muted">{left > 0 ? t('home.goal.left', { left }) : t('home.goal.done')}</p>
        </div>
      </div>
      <ol className="week" aria-label={t('home.goal.week')}>
        {week.map((day) => {
          const done = day.count > 0;
          const frozen = !done && frozenDays.includes(day.dayStart);
          const classes = [
            'week__dot',
            done && 'week__dot--done',
            frozen && 'week__dot--frozen',
            day.today && 'week__dot--today',
          ];
          return (
            <li key={day.dayStart}>
              <span className="visually-hidden">
                {longDay.format(day.dayStart)}:{' '}
                {done
                  ? t('home.goal.dayDone')
                  : frozen
                    ? t('home.goal.dayFrozen')
                    : t('home.goal.dayNot')}
              </span>
              <span aria-hidden="true">{dayName.format(day.dayStart)}</span>
              <span className={classes.filter(Boolean).join(' ')} aria-hidden="true">
                {done ? '✓' : frozen ? '❄' : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
