import { useEffect, useState } from 'react';
import { MAX_FREEZES } from '../../core/freeze';
import { weekFlower } from '../../core/gardenLife';
import type { WeekItem, WeekState } from '../../core/weekly';
import { useI18n } from '../../i18n';
import { useCue } from '../cues';
import { Plant } from './Plant';
import { ProgressBar } from './ProgressBar';

const DAY_MS = 86_400_000;
const SEEN_KEY = 'sproutcards.weekSeen';

const itemKey = (week: WeekState, item: WeekItem) =>
  `${week.start}:${item.challenge.kind}-${item.challenge.target}`;

/** The finished items this device has already celebrated (a convenience: losing it only replays a glow). */
function readSeen(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeen(keys: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys.slice(-30)));
  } catch {
    // private mode or full storage: the glow simply shows again next time
  }
}

/**
 * This week's goal and two challenges: how far each is and what it gives (a rare flower; the weekly goal
 * also a streak freeze). An item finished since the last visit glows gold once. All three finished open
 * the chest with a flower of the week.
 */
export function WeekCard({
  week,
  now,
  fullWeeks,
  freezes,
}: {
  week: WeekState;
  now: number;
  /** Full weeks so far, this one included when it is full. */
  fullWeeks: number;
  /** Streak freezes left. */
  freezes: number;
}) {
  const { t, tp } = useI18n();
  const cue = useCue();
  const daysLeft = Math.max(1, Math.ceil((week.end - now) / DAY_MS));
  const done = week.items.filter((i) => i.done).length;
  const full = done === week.items.length;
  // the flower of this week's chest: the one already given, or the one it will give
  const chestFlower = weekFlower(full ? fullWeeks : fullWeeks + 1);
  // items finished since this device last showed the card glow once
  const [fresh] = useState(() => {
    const seen = new Set(readSeen());
    return new Set(
      week.items.filter((i) => i.done && !seen.has(itemKey(week, i))).map((i) => itemKey(week, i)),
    );
  });
  useEffect(() => {
    if (fresh.size === 0) return;
    writeSeen([...readSeen(), ...fresh]);
    cue('finish');
  }, [fresh, cue]);

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
          const key = itemKey(week, item);
          const classes = [
            'weekly__item',
            item.done && 'weekly__item--done',
            fresh.has(key) && 'weekly__item--new',
          ];
          return (
            <li className={classes.filter(Boolean).join(' ')} key={key}>
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
              <span className="weekly__gives">
                {item.done
                  ? t('week.got')
                  : item.goal
                    ? t('week.gives.goal')
                    : t('week.gives.challenge')}
              </span>
            </li>
          );
        })}
      </ul>

      <div className={full ? 'chest chest--open' : 'chest'}>
        <ChestIcon open={full} />
        <div className="chest__text">
          <span className="weekly__name">{t('week.chest.title')}</span>
          <span className="muted">
            {t(full ? 'week.chest.open' : 'week.chest.closed', {
              flower: t(`flower.${chestFlower}`),
            })}
          </span>
        </div>
        <span className="chest__flower" aria-hidden="true">
          <Plant stage="bloom" variety={chestFlower} size={40} />
        </span>
      </div>

      <p className="weekly__freezes">
        <span aria-hidden="true">❄️</span> {t('week.freezes', { count: freezes, max: MAX_FREEZES })}
        <span className="muted"> {t('week.freezesHint')}</span>
      </p>
    </section>
  );
}

/** A little chest: closed, or open with light coming out. */
function ChestIcon({ open }: { open: boolean }) {
  return (
    <svg className="chest__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {open && <circle cx="24" cy="22" r="16" fill="#ffe27a" opacity="0.5" />}
      <rect
        x="8"
        y="22"
        width="32"
        height="18"
        rx="3"
        fill="#c98a4b"
        stroke="#7a4f24"
        strokeWidth="2"
      />
      <rect
        x="21"
        y="26"
        width="6"
        height="7"
        rx="1.5"
        fill="#ffd23f"
        stroke="#7a4f24"
        strokeWidth="1.5"
      />
      <g className="chest__lid">
        <path
          d="M8 22 V18 a6 6 0 0 1 6-6 h20 a6 6 0 0 1 6 6 V22 Z"
          fill="#d99a58"
          stroke="#7a4f24"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
