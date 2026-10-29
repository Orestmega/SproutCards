import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import type { Deck, Direction } from '../../core/types';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useRepo } from '../AppProviders';
import { CheckField } from '../components/Fields';
import { Icon } from '../components/Icons';
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
  const [direction, setDirection] = useState<Direction>('forward');
  const [starredOnly, setStarredOnly] = useState(false);
  const due = useLiveQuery(async () => {
    const now = Date.now();
    return (await repo.listProgress(deck.id, direction)).filter((p) => p.dueAt <= now).length;
  }, [repo, deck.id, direction]);

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
          <div className="modes">
            {MODES.map((mode) => (
              <Link
                key={mode.path}
                to={`${base}/${mode.path}${query}`}
                className={mode.path === 'learn' ? 'mode mode--main' : 'mode'}
                aria-describedby={`mode-desc-${mode.path}`}
              >
                <span className={`mode__icon mode__icon--${mode.icon}`}>
                  <Icon name={mode.icon} />
                </span>
                <span className="mode__title">{t(mode.title)}</span>
                {/* read as the link's description, so the link's name stays just the mode */}
                <span className="mode__desc" id={`mode-desc-${mode.path}`} aria-hidden="true">
                  {t(mode.desc)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
