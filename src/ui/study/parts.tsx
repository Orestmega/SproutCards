import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { maxHintLetters, revealHint } from '../../core/hint';
import type { Question } from '../../core/learn';
import { useI18n } from '../../i18n';
import { Button } from '../components/Button';
import { ChoiceCard } from '../components/ChoiceCard';

/** Instruction line above a question, e.g. "Choose the translation". */
export function instructionKey(question: Question) {
  const choice = question.kind === 'choice';
  const translation = question.answerSide === 'translation';
  if (choice) return translation ? 'learn.chooseTranslation' : 'learn.chooseTerm';
  return translation ? 'learn.typeTranslation' : 'learn.typeTerm';
}

/**
 * The options of a choice question. Keys 1–4 pick an option. After the answer is known (`reveal`)
 * the right option gets ✓ and a wrongly picked one gets ✗ (plus colour, never colour alone).
 */
export function ChoiceList({
  question,
  picked,
  reveal,
  onPick,
}: {
  question: Question;
  picked: string | null;
  /** When set, options are locked and the correct/wrong marks are shown. */
  reveal: boolean;
  onPick: (option: string) => void;
}) {
  const { t } = useI18n();
  const correct = question.acceptable[0];

  useEffect(() => {
    if (reveal) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const index = Number(event.key) - 1;
      const option = question.options[index];
      if (option !== undefined) onPick(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, reveal, onPick]);

  return (
    <div className="stack" role="group" aria-label={t('learn.options')}>
      {question.options.map((option, i) => {
        const isRight = reveal && question.acceptable.includes(option);
        const isWrongPick = reveal && picked === option && !isRight;
        return (
          <ChoiceCard
            key={option}
            selected={picked === option}
            state={isRight ? 'correct' : isWrongPick ? 'wrong' : undefined}
            mark={isRight ? '✓' : isWrongPick ? '✗' : undefined}
            disabled={reveal}
            onClick={() => onPick(option)}
          >
            <span className="choice__num" aria-hidden="true">
              {i + 1}
            </span>
            {option}
            {isRight && option === correct && (
              <span className="visually-hidden"> {t('learn.correctOption')}</span>
            )}
            {isWrongPick && <span className="visually-hidden"> {t('learn.wrongOption')}</span>}
          </ChoiceCard>
        );
      })}
    </div>
  );
}

/** Text answer field with a submit button (Enter submits) and an optional skip button. */
export function TypingForm({
  labelId,
  submitLabel,
  onSubmit,
  onSkip,
  skipLabel,
  initial = '',
  onChange,
  hintFor,
}: {
  /** id of the element that holds the instruction (used as the input's accessible name). */
  labelId: string;
  submitLabel: string;
  onSubmit: (text: string) => void;
  onSkip?: () => void;
  skipLabel?: string;
  initial?: string;
  onChange?: (text: string) => void;
  /** The answer; when given, a button reveals its letters one by one (Learn only, never in a test). */
  hintFor?: string;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(initial);
  const [hintLetters, setHintLetters] = useState(0);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(text);
  }
  return (
    <form className="form" onSubmit={submit}>
      <input
        className="input input--big"
        aria-labelledby={labelId}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange?.(e.target.value);
        }}
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
      />
      {hintLetters > 0 && hintFor !== undefined && (
        <p className="hint" aria-live="polite">
          {revealHint(hintFor, hintLetters)}
        </p>
      )}
      <Button type="submit" block>
        {submitLabel}
      </Button>
      {hintFor !== undefined && (
        <Button
          variant="secondary"
          block
          disabled={hintLetters >= maxHintLetters(hintFor)}
          onClick={() => setHintLetters((n) => n + 1)}
        >
          {t('learn.hint')}
        </Button>
      )}
      {onSkip && (
        <Button variant="secondary" block onClick={onSkip}>
          {skipLabel}
        </Button>
      )}
    </form>
  );
}
