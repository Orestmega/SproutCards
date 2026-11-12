import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import type { Deck, Direction } from '../../core/types';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useApp, useRepo } from '../AppProviders';
import { SESSION_SIZES, sessionSizeOf } from '../../core/selection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CheckField } from '../components/Fields';
import { Icon } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { snapshotProgress } from '../../core/resume';
import { readSnapshot } from '../resume';
import type { IconName } from '../components/Icons';

const MODES: { path: string; title: MessageKey; desc: MessageKey; icon: IconName }[] = [
  { path: 'learn', title: 'study.learn', desc: 'study.learnDesc', icon: 'learn' },
  { path: 'flip', title: 'study.flip', desc: 'study.flipDesc', icon: 'flip' },
  { path: 'test', title: 'study.quiz', desc: 'study.quizDesc', icon: 'test' },
  { path: 'match', title: 'study.match', desc: 'study.matchDesc', icon: 'match' },
];

/** "Study" section of the deck screen: choose the direction, then a mode. */
export function StudyPanel({
  deck,
  cardCount,
  starredCount,
}: {
  deck: Deck;
  cardCount: number;
  starredCount: number;
}) {
  const { t, tp, languageName } = useI18n();
  const repo = useRepo();
  const { settings, updateSettings } = useApp();
  const size = sessionSizeOf(settings.sessionSize);
  const navigate = useNavigate();
  /** Learn, flashcards and the whole deck first ask how many words (the last choice is ready). */
  const [asking, setAsking] = useState<string | null>(null);
  const [chosen, setChosen] = useState(size);
  const ask = (to: string) => {
    setChosen(size);
    setAsking(to);
  };
  const [direction, setDirection] = useState<Direction>('forward');
  const [starredOnly, setStarredOnly] = useState(false);
  const counts = useLiveQuery(async () => {
    const now = Date.now();
    const progress = await repo.listProgress(deck.id, direction);
    return {
      due: progress.filter((p) => p.dueAt <= now).length,
      // learned in this direction: answered cleanly at least once (as in the garden)
      learned: progress.filter((p) => p.reps >= 1).length,
    };
  }, [repo, deck.id, direction]);
  const due = counts?.due;
  const learned = Math.min(cardCount, counts?.learned ?? 0);

  const snapshot = readSnapshot(deck.id, direction);
  const resumable = snapshot && snapshot.state.current !== null ? snapshotProgress(snapshot) : null;
  const from = languageName(deck.learningLang);
  const to = languageName(deck.translationLang);
  const query = `?dir=${direction}${starredOnly ? '&starred=1' : ''}`;
  const base = `/decks/${deck.id}`;

  return (
    <section className="section" aria-labelledby="deck-study">
      <h2 className="section__title" id="deck-study">
        {t('study.title')}
      </h2>
      <div className="seg" role="radiogroup" aria-label={t('study.direction')}>
        {(['forward', 'backward'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            className="seg__btn"
            onClick={() => setDirection(value)}
          >
            {value === 'forward' ? `${from} → ${to}` : `${to} → ${from}`}
          </button>
        ))}
      </div>
      {cardCount === 0 ? (
        <p className="muted">{t('study.needCards')}</p>
      ) : (
        <>
          {due !== undefined && due > 0 && <p className="muted">{tp('count.due', due)}</p>}
          {starredCount > 0 && (
            <CheckField
              label={t('study.starredOnly', { count: starredCount })}
              checked={starredOnly}
              onChange={setStarredOnly}
            />
          )}
          {resumable && (
            <Link to={`${base}/learn?dir=${direction}&resume=1`} className="resume-card">
              <span className="resume-card__icon" aria-hidden="true">
                <Icon name="learn" />
              </span>
              <span className="list-row__main">
                <span className="list-row__title">{t('resume.continue')}</span>
                <span className="muted">
                  {t('resume.progress', {
                    percent: resumable.percent,
                    done: resumable.done,
                    total: resumable.total,
                  })}
                </span>
              </span>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </Link>
          )}
          <button
            type="button"
            className="whole-card"
            onClick={() => ask(`${base}/learn?dir=${direction}&whole=1`)}
          >
            <span className="whole-card__top">
              <span className="list-row__title">{t('whole.title')}</span>
              <span className="muted">{t('whole.progress', { learned, total: cardCount })}</span>
            </span>
            <ProgressBar
              value={cardCount ? learned / cardCount : 0}
              label={t('whole.progress', { learned, total: cardCount })}
            />
            <span className="muted">
              {learned >= cardCount ? t('whole.allDone') : t('whole.desc', { size })}
            </span>
          </button>
          <div className="modes">
            {MODES.map((mode) => {
              const to = `${base}/${mode.path}${query}`;
              const inner = (
                <>
                  <span className={`mode__icon mode__icon--${mode.icon}`}>
                    <Icon name={mode.icon} />
                  </span>
                  <span className="mode__title">{t(mode.title)}</span>
                  {/* read as the description, so the name stays just the mode */}
                  <span className="mode__desc" id={`mode-desc-${mode.path}`} aria-hidden="true">
                    {t(mode.desc)}
                  </span>
                </>
              );
              const className = mode.path === 'learn' ? 'mode mode--main' : 'mode';
              return mode.path === 'learn' || mode.path === 'flip' ? (
                <button
                  key={mode.path}
                  type="button"
                  className={className}
                  aria-describedby={`mode-desc-${mode.path}`}
                  onClick={() => ask(to)}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  key={mode.path}
                  to={to}
                  className={className}
                  aria-describedby={`mode-desc-${mode.path}`}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
          {asking !== null && (
            <ConfirmDialog
              title={t('study.sizeTitle')}
              confirmLabel={t('study.start')}
              onCancel={() => setAsking(null)}
              onConfirm={() => {
                // remembered for next time; the session gets the number in its address
                void updateSettings({ sessionSize: chosen }).catch(() => undefined);
                navigate(`${asking}&size=${chosen}`);
              }}
            >
              <div className="seg" role="radiogroup" aria-label={t('study.size')}>
                {SESSION_SIZES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={chosen === n}
                    className="seg__btn"
                    onClick={() => setChosen(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </ConfirmDialog>
          )}
        </>
      )}
    </section>
  );
}
