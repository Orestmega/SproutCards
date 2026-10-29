import { useState } from 'react';
import { QUIZ_QUESTION_TYPES } from '../../core/quiz';
import type { QuizQuestionType } from '../../core/quiz';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { Button } from '../components/Button';
import { CheckField } from '../components/Fields';

export interface QuizSettings {
  count: number | 'all';
  types: QuizQuestionType[];
}

const COUNTS = [5, 10, 20] as const;
const STORAGE_KEY = 'sproutcards.quizSettings';

const TYPE_LABELS: Record<QuizQuestionType, MessageKey> = {
  choice: 'quiz.type.choice',
  typing: 'quiz.type.typing',
  trueFalse: 'quiz.type.trueFalse',
  matching: 'quiz.type.matching',
};

const DEFAULTS: QuizSettings = { count: 20, types: [...QUIZ_QUESTION_TYPES] };

/** What the user chose last time (a per-device convenience; works without it). */
function loadSaved(): QuizSettings {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<QuizSettings> | null;
    const types = (raw?.types ?? []).filter((t): t is QuizQuestionType =>
      QUIZ_QUESTION_TYPES.includes(t),
    );
    const count =
      raw?.count === 'all' || COUNTS.some((c) => c === raw?.count) ? raw?.count : undefined;
    return {
      count: count ?? DEFAULTS.count,
      types: types.length > 0 ? types : DEFAULTS.types,
    };
  } catch {
    return DEFAULTS;
  }
}

/** The counts offered for a deck of `cardCount` words: 5, 10, 20 where they are fewer than the deck, and "all". */
export function countChoices(cardCount: number): (number | 'all')[] {
  return [...COUNTS.filter((c) => c < cardCount), 'all'];
}

/** The screen before a test: how many questions and which kinds. */
export function QuizSetup({
  cardCount,
  directionLabel,
  onStart,
}: {
  cardCount: number;
  directionLabel: string;
  onStart: (settings: QuizSettings) => void;
}) {
  const { t, tp } = useI18n();
  const choices = countChoices(cardCount);
  const [settings, setSettings] = useState<QuizSettings>(() => {
    const saved = loadSaved();
    return { ...saved, count: choices.includes(saved.count) ? saved.count : 'all' };
  });

  function toggle(type: QuizQuestionType, on: boolean) {
    setSettings((s) => {
      const types = QUIZ_QUESTION_TYPES.filter((x) => (x === type ? on : s.types.includes(x)));
      return types.length === 0 ? s : { ...s, types }; // at least one kind must stay on
    });
  }

  function start() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // not remembering the choice is fine
    }
    onStart(settings);
  }

  return (
    <>
      <p className="muted">
        {directionLabel} · {tp('count.cards', cardCount)}
      </p>

      <section className="section" aria-labelledby="quiz-count">
        <h2 className="section__title" id="quiz-count">
          {t('quiz.setup.count')}
        </h2>
        <div className="seg" role="radiogroup" aria-labelledby="quiz-count">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={settings.count === choice}
              className="seg__btn"
              onClick={() => setSettings((s) => ({ ...s, count: choice }))}
            >
              {choice === 'all' ? t('quiz.setup.countAll', { count: cardCount }) : choice}
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="quiz-types">
        <h2 className="section__title" id="quiz-types">
          {t('quiz.setup.types')}
        </h2>
        {QUIZ_QUESTION_TYPES.map((type) => (
          <CheckField
            key={type}
            label={t(TYPE_LABELS[type])}
            checked={settings.types.includes(type)}
            onChange={(on) => toggle(type, on)}
          />
        ))}
        <p className="muted">{t('quiz.setup.typesHint')}</p>
      </section>

      <Button block onClick={start}>
        {t('quiz.setup.start')}
      </Button>
    </>
  );
}
