import { useEffect, useState } from 'react';
import type { MatchingUnit, TrueFalseUnit } from '../../core/quiz';
import type { CardSide } from '../../core/types';
import { useI18n } from '../../i18n';
import { Button } from '../components/Button';
import { SpeakButton } from '../components/SpeakButton';

type LangOf = (side: CardSide) => string;

/** "Is this a correct pair?" Two big buttons; keys 1 (true) and 2 (false) work too. */
export function TrueFalseView({
  unit,
  langOf,
  onAnswer,
  onSkip,
}: {
  unit: TrueFalseUnit;
  langOf: LangOf;
  onAnswer: (value: boolean) => void;
  onSkip: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '1') onAnswer(true);
      else if (event.key === '2') onAnswer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return (
    <>
      <section className="prompt" aria-labelledby="instruction">
        <p id="instruction" className="muted">
          {t('quiz.tf.question')}
        </p>
        <div className="statement">
          <span lang={langOf(unit.promptSide)}>
            {unit.prompt} <SpeakButton text={unit.prompt} lang={langOf(unit.promptSide)} />
          </span>
          <span className="statement__equals" aria-hidden="true">
            =
          </span>
          <span className="visually-hidden"> — </span>
          <span lang={langOf(unit.answerSide)}>{unit.shown}</span>
        </div>
      </section>
      <div className="row">
        <Button onClick={() => onAnswer(true)}>✓ {t('quiz.true')}</Button>
        <Button variant="secondary" onClick={() => onAnswer(false)}>
          ✗ {t('quiz.false')}
        </Button>
      </div>
      <Button variant="secondary" block onClick={onSkip}>
        {t('quiz.skip')}
      </Button>
    </>
  );
}

/**
 * Connect each item on the left with its pair on the right: tap a left item, then its pair. Linked
 * pairs are shown by a number on both tiles (never by colour alone). Tapping a linked right tile
 * without a left item selected unlinks it.
 */
export function MatchingView({
  unit,
  langOf,
  nextLabel,
  onCommit,
  onSkip,
}: {
  unit: MatchingUnit;
  langOf: LangOf;
  nextLabel: string;
  onCommit: (picks: Record<string, string | null>) => void;
  onSkip: () => void;
}) {
  const { t } = useI18n();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);

  const numberOf = (cardId: string) => unit.pairs.findIndex((p) => p.cardId === cardId) + 1;
  const ownerOf = (right: string) => Object.keys(picks).find((id) => picks[id] === right);
  const allLinked = Object.keys(picks).length === unit.pairs.length;

  function tapLeft(cardId: string) {
    setActive((current) => (current === cardId ? null : cardId));
  }

  function tapRight(option: string) {
    const owner = ownerOf(option);
    if (active !== null) {
      setPicks((current) => {
        const next = { ...current };
        if (owner !== undefined) delete next[owner]; // the option moves to the new left item
        next[active] = option;
        return next;
      });
      setActive(null);
    } else if (owner !== undefined) {
      setPicks((current) => {
        const next = { ...current };
        delete next[owner];
        return next;
      });
    }
  }

  function commit() {
    onCommit(Object.fromEntries(unit.pairs.map((p) => [p.cardId, picks[p.cardId] ?? null])));
  }

  return (
    <>
      <section className="prompt" aria-labelledby="instruction">
        <p id="instruction" className="muted">
          {t('quiz.match.instruction')}
        </p>
      </section>
      <div className="pairs">
        <ul className="pairs__col" aria-label={t('quiz.match.left')} lang={langOf(unit.promptSide)}>
          {unit.pairs.map((pair) => {
            const linkedTo = picks[pair.cardId];
            return (
              <li key={pair.cardId}>
                <button
                  type="button"
                  className="tile"
                  aria-pressed={active === pair.cardId}
                  aria-label={`${numberOf(pair.cardId)} ${pair.left}, ${
                    active === pair.cardId
                      ? t('quiz.match.selected')
                      : linkedTo
                        ? t('quiz.match.linked', { pair: linkedTo })
                        : t('quiz.match.notLinked')
                  }`}
                  onClick={() => tapLeft(pair.cardId)}
                >
                  <span className="tile__badge" aria-hidden="true">
                    {numberOf(pair.cardId)}
                  </span>{' '}
                  <span aria-hidden="true">{pair.left}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul
          className="pairs__col"
          aria-label={t('quiz.match.right')}
          lang={langOf(unit.answerSide)}
        >
          {unit.options.map((option) => {
            const owner = ownerOf(option);
            const left = unit.pairs.find((p) => p.cardId === owner);
            return (
              <li key={option}>
                <button
                  type="button"
                  className="tile"
                  aria-label={`${owner !== undefined ? `${numberOf(owner)} ` : ''}${option}, ${
                    left ? t('quiz.match.linked', { pair: left.left }) : t('quiz.match.notLinked')
                  }`}
                  onClick={() => tapRight(option)}
                >
                  {owner !== undefined && (
                    <span className="tile__badge" aria-hidden="true">
                      {numberOf(owner)}
                    </span>
                  )}{' '}
                  <span aria-hidden="true">{option}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <Button block disabled={!allLinked} onClick={commit}>
        {nextLabel}
      </Button>
      <Button variant="secondary" block onClick={onSkip}>
        {t('quiz.skip')}
      </Button>
    </>
  );
}
