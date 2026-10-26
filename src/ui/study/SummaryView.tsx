import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Card } from '../../core/types';
import { useI18n } from '../../i18n';
import { Button, ButtonLink } from '../components/Button';
import { MascotBubble } from '../components/Mascot';
import type { MascotMood } from '../components/Mascot';
import { Notice } from '../components/Notice';

export type SaveState = 'saving' | 'saved' | 'error';

/** End-of-session screen shared by flip, Learn and quiz: result numbers, cards to review, next steps. */
export function SummaryView({
  deckId,
  mood,
  message,
  headline,
  stats,
  weak,
  saveState,
  onRetrySave,
  onAgain,
  againLabel,
  extra,
}: {
  deckId: string;
  mood: MascotMood;
  message: string;
  /** A big number or word, e.g. "85%". */
  headline?: string;
  stats: { label: string; value: string | number }[];
  /** Cards that were missed, shown for a quick look. */
  weak: Card[];
  saveState: SaveState;
  onRetrySave: () => void;
  onAgain?: () => void;
  againLabel?: string;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <>
      <h1 className="visually-hidden">{t('study.summary')}</h1>
      <MascotBubble mood={mood}>{message}</MascotBubble>
      {headline && (
        <p className="headline" aria-live="polite">
          {headline}
        </p>
      )}
      <div className="stats" role="group" aria-label={t('study.summary')}>
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat__value">{s.value}</span>
            <span className="muted">{s.label}</span>
          </div>
        ))}
      </div>

      {saveState === 'error' && (
        <Notice kind="error">
          {t('study.saveFailed')}
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button small variant="secondary" onClick={onRetrySave}>
              {t('study.retrySave')}
            </Button>
          </div>
        </Notice>
      )}

      {extra}

      {weak.length > 0 && (
        <section className="section" aria-labelledby="weak-title">
          <h2 className="section__title" id="weak-title">
            {t('study.toReview')}
          </h2>
          <ul className="list">
            {weak.map((card) => (
              <li key={card.id}>
                <Link to={`/decks/${deckId}/cards/${card.id}`} className="list-row">
                  <span className="list-row__main">
                    <span className="list-row__title">{card.term}</span>
                    <span className="muted">{card.translations.join('; ')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="stack">
        {onAgain && (
          <Button block onClick={onAgain}>
            {againLabel ?? t('study.again')}
          </Button>
        )}
        <ButtonLink to={`/decks/${deckId}`} variant="secondary" block>
          {t('study.backToDeck')}
        </ButtonLink>
      </div>
    </>
  );
}
