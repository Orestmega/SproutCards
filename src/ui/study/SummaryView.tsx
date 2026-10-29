import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Card } from '../../core/types';
import { useI18n } from '../../i18n';
import { Button, ButtonLink } from '../components/Button';
import { Confetti } from '../components/Confetti';
import { MascotBubble } from '../components/Mascot';
import type { MascotMood } from '../components/Mascot';
import { Notice } from '../components/Notice';

export type SaveState = 'saving' | 'saved' | 'error';

const RING_RADIUS = 72;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** A ring that fills up to the score, with the big number inside (the ring itself is decoration). */
function ScoreRing({ score, children }: { score: number; children: ReactNode }) {
  const share = Math.min(1, Math.max(0, score));
  return (
    <div className="score">
      <svg className="score__ring" viewBox="0 0 168 168" aria-hidden="true" focusable="false">
        <circle
          className="score__track"
          cx="84"
          cy="84"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="14"
        />
        <circle
          className="score__value"
          cx="84"
          cy="84"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="14"
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - share)}
          style={{ '--ring-length': RING_LENGTH } as CSSProperties}
        />
      </svg>
      {children}
    </div>
  );
}

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
  onRetryMissed,
  retryMissedLabel,
  extra,
  score,
}: {
  deckId: string;
  mood: MascotMood;
  message: string;
  /** A big number or word, e.g. "85%". */
  headline?: string;
  /** The share behind the headline (0..1): drawn as a ring around it. */
  score?: number;
  stats: { label: string; value: string | number }[];
  /** Cards that were missed, shown for a quick look. */
  weak: Card[];
  saveState: SaveState;
  onRetrySave: () => void;
  onAgain?: () => void;
  againLabel?: string;
  /** "Practise only what you got wrong": shown first, as the main action, when there were mistakes. */
  onRetryMissed?: () => void;
  retryMissedLabel?: string;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <>
      <h2 className="visually-hidden">{t('study.summary')}</h2>
      {mood === 'celebrate' && <Confetti />}
      <MascotBubble mood={mood} size={104}>
        {message}
      </MascotBubble>
      {headline &&
        (score === undefined ? (
          <p className="headline" aria-live="polite">
            {headline}
          </p>
        ) : (
          <ScoreRing score={score}>
            <p className="headline" aria-live="polite">
              {headline}
            </p>
          </ScoreRing>
        ))}
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

      {/* the next steps come first: after a long list of answers they would be out of sight */}
      <div className="stack">
        {onRetryMissed && (
          <Button block onClick={onRetryMissed}>
            {retryMissedLabel}
          </Button>
        )}
        {onAgain && (
          <Button block variant={onRetryMissed ? 'secondary' : 'primary'} onClick={onAgain}>
            {againLabel ?? t('study.again')}
          </Button>
        )}
        <ButtonLink to={`/decks/${deckId}`} variant="secondary" block>
          {t('study.backToDeck')}
        </ButtonLink>
      </div>

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
    </>
  );
}
