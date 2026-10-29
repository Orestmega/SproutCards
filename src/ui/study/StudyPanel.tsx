import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Deck, Direction } from '../../core/types';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { CheckField } from '../components/Fields';

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
          <div className="stack">
            <ButtonLink to={`${base}/learn${query}`} block>
              {t('study.learn')}
            </ButtonLink>
            <ButtonLink to={`${base}/flip${query}`} variant="secondary" block>
              {t('study.flip')}
            </ButtonLink>
            <ButtonLink to={`${base}/test${query}`} variant="secondary" block>
              {t('study.quiz')}
            </ButtonLink>
            <ButtonLink to={`${base}/match${query}`} variant="secondary" block>
              {t('study.match')}
            </ButtonLink>
          </div>
        </>
      )}
    </section>
  );
}
