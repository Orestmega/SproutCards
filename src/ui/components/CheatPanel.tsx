import { ALL_CHEATS, cheatsOf, hasCheats, NO_CHEATS } from '../../core/cheats';
import type { Cheats } from '../../core/cheats';
import { useI18n } from '../../i18n';
import { Button } from './Button';

const ROWS: (keyof Cheats)[] = [
  'learned',
  'streak',
  'golden',
  'challenges',
  'weeks',
  'reviews',
  'decks',
  'modes',
];
const STEPS = [1, 5, 25];

/**
 * The cheat panel: adds bonuses to the numbers that earn flowers, achievements and decorations, to try
 * them out. The real progress (schedules, the review log) stays untouched; "Reset" removes every bonus.
 */
export function CheatPanel({
  value,
  onChange,
}: {
  value: Partial<Cheats> | null | undefined;
  onChange: (cheats: Cheats) => void;
}) {
  const { t } = useI18n();
  const cheats = cheatsOf(value);
  return (
    <details className="manage cheats">
      <summary>{t('cheats.title')}</summary>
      <div className="manage__body">
        <p className="muted">{t('cheats.text')}</p>
        <ul className="cheats__list">
          {ROWS.map((key) => (
            <li className="cheats__row" key={key}>
              <span className="cheats__label">
                {t(`cheats.${key}`)}
                <span className="cheats__value">+{cheats[key]}</span>
              </span>
              <span className="cheats__buttons">
                {STEPS.map((step) => (
                  <Button
                    key={step}
                    small
                    variant="secondary"
                    aria-label={t('cheats.add', { count: step, what: t(`cheats.${key}`) })}
                    onClick={() => onChange({ ...cheats, [key]: cheats[key] + step })}
                  >
                    +{step}
                  </Button>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="cheats__actions">
          <Button small onClick={() => onChange(ALL_CHEATS)}>
            {t('cheats.all')}
          </Button>
          <Button
            small
            variant="secondary"
            disabled={!hasCheats(cheats)}
            onClick={() => onChange(NO_CHEATS)}
          >
            {t('cheats.reset')}
          </Button>
        </div>
      </div>
    </details>
  );
}
