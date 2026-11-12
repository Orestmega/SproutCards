import { useEffect, useId, useState } from 'react';
import { MAX_FREEZES } from '../../core/freeze';
import { weekFlower } from '../../core/gardenLife';
import type { WeekItem, WeekState } from '../../core/weekly';
import { useI18n } from '../../i18n';
import { useCue } from '../cues';
import type { VarietyId } from '../../core/gardenLife';
import { Plant, PlantArt } from './Plant';
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
  // the chest opens with its animation once: the first time this device sees the week full
  const chestKey = `${week.start}:chest`;
  const [opening] = useState(() => full && !readSeen().includes(chestKey));
  useEffect(() => {
    if (fresh.size === 0 && !opening) return;
    writeSeen([...readSeen(), ...fresh, ...(opening ? [chestKey] : [])]);
    cue('finish');
  }, [fresh, opening, chestKey, cue]);

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
          if (item.done) {
            // finished: one line with a tick (it already brought its flower)
            return (
              <li className={classes.filter(Boolean).join(' ')} key={key}>
                <span className="weekly__tick" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <span className="weekly__name">{name}</span> {what}
                </span>
                <span className="visually-hidden">{t('week.got')}</span>
              </li>
            );
          }
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
        <ChestIcon open={full} opening={opening} flower={chestFlower} />
        <div className="chest__text">
          <span className="weekly__name">{t('week.chest.title')}</span>
          <span className="muted">
            {t(full ? 'week.chest.open' : 'week.chest.closed', {
              flower: t(`flower.${chestFlower}`),
            })}
          </span>
        </div>
        <span
          className={opening ? 'chest__flower chest__flower--pop' : 'chest__flower'}
          aria-hidden="true"
        >
          <Plant stage="bloom" variety={chestFlower} size={40} />
        </span>
      </div>

      <p className="weekly__freezes" title={t('week.freezesHint')}>
        <span aria-hidden="true">❄️</span> {t('week.freezes', { count: freezes, max: MAX_FREEZES })}
      </p>
    </section>
  );
}

/**
 * The chest of the week (the owner's design, design/feedback/chest-demo.html): a wooden chest with gold
 * bands. Closed, it rocks a little now and then. Opening (`opening`, played once): it shakes, the lid flips
 * up, light and rays come out and the flower of the week rises. Open: it stays like that.
 */
export function ChestIcon({
  open,
  opening,
  flower,
}: {
  open: boolean;
  opening: boolean;
  flower: VarietyId;
}) {
  // gradients need ids that are unique on the page
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const url = (name: string) => `url(#${id}${name})`;
  const classes = ['chest__icon', open && 'chest__icon--open', opening && 'chest__icon--opening'];
  return (
    <svg
      className={classes.filter(Boolean).join(' ')}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2a561" />
          <stop offset="1" stopColor="#b9783a" />
        </linearGradient>
        <linearGradient id={`${id}woodLid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eab36c" />
          <stop offset="1" stopColor="#cf8f4c" />
        </linearGradient>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f0b429" />
        </linearGradient>
        <radialGradient id={`${id}glowG`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff6c9" />
          <stop offset=".55" stopColor="#ffe27a" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}inner`} cx=".5" cy=".4" r=".7">
          <stop offset="0" stopColor="#ffe9a0" />
          <stop offset="1" stopColor="#6b4423" />
        </radialGradient>
        <clipPath id={`${id}up`}>
          <rect x="-10" y="-10" width="84" height="40" />
        </clipPath>
      </defs>
      <ellipse cx="32" cy="58" rx="23" ry="3.6" fill="#3a2a14" opacity=".18" />
      <g className="chest__rock">
        {/* the inside of the lid, standing up behind the chest */}
        <g className="chest__backlid">
          <path
            d="M11 31V21a9 9 0 0 1 9-9h24a9 9 0 0 1 9 9v10z"
            fill="#8f5a2b"
            stroke="#6b4423"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M16 31V22a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v9z" fill="#a8703a" opacity=".55" />
        </g>
        <g className="chest__glow">
          <circle cx="32" cy="26" r="23" fill={url('glowG')} />
        </g>
        <g clipPath={url('up')}>
          <g className="chest__rays" fill="#fff1a8">
            <path d="M32 29 L24 -6 L30 -6Z" />
            <path d="M32 29 L10 -2 L17 -5Z" />
            <path d="M32 29 L-4 12 L-2 5Z" />
            <path d="M32 29 L40 -6 L34 -6Z" />
            <path d="M32 29 L54 -2 L47 -5Z" />
            <path d="M32 29 L68 12 L66 5Z" />
          </g>
        </g>
        {/* the flower of the week rises out of the chest */}
        <g transform="translate(16 -3)">
          <g className="chest__fl">
            <g className="chest__bob">
              <svg width="32" height="32" viewBox="0 0 32 32" overflow="visible">
                <PlantArt stage="bloom" variety={flower} noSoil />
              </svg>
            </g>
          </g>
        </g>
        {/* the body */}
        <path
          d="M9 30h46v24a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z"
          fill={url('wood')}
          stroke="#7a4f24"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M10 39.5h44M10 48h44" stroke="#9c6430" strokeWidth="1.1" opacity=".7" />
        <path d="M11 32h42" stroke="#fff" strokeWidth="1.4" opacity=".25" strokeLinecap="round" />
        <rect
          x="14"
          y="30"
          width="6"
          height="28"
          fill={url('gold')}
          stroke="#7a4f24"
          strokeWidth="1.6"
        />
        <rect
          x="44"
          y="30"
          width="6"
          height="28"
          fill={url('gold')}
          stroke="#7a4f24"
          strokeWidth="1.6"
        />
        <g fill="#7a4f24">
          <circle cx="17" cy="35" r=".9" />
          <circle cx="17" cy="53" r=".9" />
          <circle cx="47" cy="35" r=".9" />
          <circle cx="47" cy="53" r=".9" />
        </g>
        {/* the dark opening with light inside */}
        <ellipse
          className="chest__rim"
          cx="32"
          cy="30"
          rx="22.5"
          ry="3.4"
          fill={url('inner')}
          stroke="#6b4423"
          strokeWidth="1.8"
        />
        {/* the lock */}
        <rect
          x="26.5"
          y="34"
          width="11"
          height="12"
          rx="2.4"
          fill={url('gold')}
          stroke="#7a4f24"
          strokeWidth="1.8"
        />
        <circle cx="32" cy="39" r="1.7" fill="#5a3a18" />
        <path d="M32 40v3" stroke="#5a3a18" strokeWidth="1.8" strokeLinecap="round" />
        {/* the lid (closed) */}
        <g className="chest__lid">
          <path
            d="M8 31V22a10 10 0 0 1 10-10h28a10 10 0 0 1 10 10v9z"
            fill={url('woodLid')}
            stroke="#7a4f24"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path d="M10 22.5h44" stroke="#9c6430" strokeWidth="1.1" opacity=".7" />
          <path
            d="M14 17.5c2-2.2 5-3 8-3"
            stroke="#fff"
            strokeWidth="1.5"
            opacity=".35"
            strokeLinecap="round"
            fill="none"
          />
          <rect
            x="14"
            y="12.6"
            width="6"
            height="18.4"
            fill={url('gold')}
            stroke="#7a4f24"
            strokeWidth="1.6"
          />
          <rect
            x="44"
            y="12.6"
            width="6"
            height="18.4"
            fill={url('gold')}
            stroke="#7a4f24"
            strokeWidth="1.6"
          />
          <path
            d="M27 31v-3a5 5 0 0 1 10 0v3z"
            fill={url('gold')}
            stroke="#7a4f24"
            strokeWidth="1.6"
          />
        </g>
      </g>
    </svg>
  );
}
