import type { WeekState } from '../../core/weekly';
import { useI18n } from '../../i18n';
import { ProgressBar } from './ProgressBar';

const DAY_MS = 86_400_000;

/** This week's goal and two challenges, with how far each one is. Each finished one earns a flower. */
export function WeekCard({ week, now }: { week: WeekState; now: number }) {
  const { t, tp } = useI18n();
  const daysLeft = Math.max(1, Math.ceil((week.end - now) / DAY_MS));
  const done = week.items.filter((i) => i.done).length;
  return (
    <section className="card weekly" aria-labelledby="weekly-title">
      <div className="weekly__head">
        <h2 className="today__title" id="weekly-title">
          {t('week.title')}
        </h2>
        <span className="muted">{tp('week.daysLeft', daysLeft)}</span>
      </div>
      <ul className="weekly__list">
        {week.items.map((item) => {
          const { kind, target } = item.challenge;
          const name = item.goal ? t('week.goal') : t('week.challenge');
          const what = tp(`week.kind.${kind}`, target);
          const shown = Math.min(item.value, target);
          return (
            <li
              className={item.done ? 'weekly__item weekly__item--done' : 'weekly__item'}
              key={`${kind}-${target}`}
            >
              <div className="weekly__row">
                <span>
                  <span className="weekly__name">{name}</span> {what}
                </span>
                <span className="weekly__count">
                  {item.done ? (
                    <>
                      <span aria-hidden="true">✓</span>
                      <span className="visually-hidden">{t('stats.achievementDone')}</span>
                    </>
                  ) : (
                    `${shown} / ${target}`
                  )}
                </span>
              </div>
              <ProgressBar value={shown / target} label={`${what}: ${shown} / ${target}`} />
            </li>
          );
        })}
      </ul>
      <p className="muted">
        {t('week.done', { done, total: week.items.length })} {t('week.reward')}
      </p>
    </section>
  );
}
