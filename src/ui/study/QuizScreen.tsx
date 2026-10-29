import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createQuiz,
  DEFAULT_QUIZ_CONFIG,
  gradeQuiz,
  missedCardIds,
  quizToLogs,
} from '../../core/quiz';
import type { Quiz, QuizAnswer, QuizResult, QuizUnit } from '../../core/quiz';
import type { CardSide } from '../../core/types';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SpeakButton } from '../components/SpeakButton';
import { ChoiceList, instructionKey, TypingForm } from './parts';
import { MatchingView, TrueFalseView } from './quizParts';
import { QuizSetup } from './QuizSetup';
import type { QuizSettings } from './QuizSetup';
import { useStudyChrome } from './StudyLayout';
import { SummaryView } from './SummaryView';
import type { SaveState } from './SummaryView';
import { StudyGate, useStudyParams, useWarnBeforeUnload } from './useStudy';
import type { StudyData } from './useStudy';

export function QuizScreen() {
  const { deckId } = useStudyParams();
  return (
    <StudyGate deckId={deckId} mode="learn">
      {(data) => <QuizFlow data={data} />}
    </StudyGate>
  );
}

/** Setup -> questions -> result; from the result: retake only the missed words, or start a new test. */
function QuizFlow({ data }: { data: StudyData }) {
  const { t, languageName } = useI18n();
  const { direction } = useStudyParams();
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [retake, setRetake] = useState<string[] | null>(null);
  const [run, setRun] = useState(0); // a new value starts a new test

  if (!settings) {
    const from = languageName(data.deck.learningLang);
    const to = languageName(data.deck.translationLang);
    return (
      <>
        <h2 className="visually-hidden">{t('quiz.setup.title')}</h2>
        <QuizSetup
          cardCount={data.cards.length}
          directionLabel={direction === 'forward' ? `${from} → ${to}` : `${to} → ${from}`}
          onStart={setSettings}
        />
      </>
    );
  }
  return (
    <QuizSession
      key={run}
      data={data}
      settings={settings}
      retake={retake}
      onRetake={(ids) => {
        setRetake(ids);
        setRun((r) => r + 1);
      }}
      onNewTest={() => {
        setSettings(null);
        setRetake(null);
        setRun((r) => r + 1);
      }}
    />
  );
}

function QuizSession({
  data,
  settings,
  retake,
  onRetake,
  onNewTest,
}: {
  data: StudyData;
  settings: QuizSettings;
  retake: string[] | null;
  onRetake: (cardIds: string[]) => void;
  onNewTest: () => void;
}) {
  const { t } = useI18n();
  const app = useApp();
  const { direction } = useStudyParams();
  const [quiz] = useState<Quiz>(() =>
    createQuiz(data.cards, direction, {
      ...DEFAULT_QUIZ_CONFIG,
      ignoreDiacritics: app.settings.ignoreDiacritics,
      questionCount: retake ? 'all' : settings.count,
      types: settings.types,
      restrictTo: retake ?? undefined,
    }),
  );
  if (quiz.units.length === 0) {
    // Only possible when no card can be studied (empty term or translations).
    return <p>{t('study.noCards.text')}</p>;
  }
  return (
    <QuizRun
      data={data}
      quiz={quiz}
      retaking={retake !== null}
      onRetake={onRetake}
      onNewTest={onNewTest}
    />
  );
}

function QuizRun({
  data,
  quiz,
  retaking,
  onRetake,
  onNewTest,
}: {
  data: StudyData;
  quiz: Quiz;
  retaking: boolean;
  onRetake: (cardIds: string[]) => void;
  onNewTest: () => void;
}) {
  const { t, tp } = useI18n();
  const { repo } = useApp();
  const chrome = useStudyChrome();
  const navigate = useNavigate();
  const { deck } = data;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);

  const unit = quiz.units[index];
  const langOf = (side: CardSide) => (side === 'term' ? deck.learningLang : deck.translationLang);
  const cardsById = useMemo(
    () => Object.fromEntries(data.cards.map((c) => [c.id, c])),
    [data.cards],
  );

  const save = useCallback(
    async (graded: QuizResult) => {
      setSaveState('saving');
      try {
        // A quiz only writes the review log; it never moves review dates.
        await repo.saveSession([], quizToLogs(quiz, graded, cardsById, Date.now()));
        setSaveState('saved');
      } catch {
        saved.current = false;
        setSaveState('error');
      }
    },
    [repo, quiz, cardsById],
  );

  useWarnBeforeUnload(!result && answers.length > 0);

  useEffect(
    () => chrome.setProgress(result ? 1 : index / quiz.units.length),
    [chrome, index, result, quiz],
  );

  useEffect(() => {
    chrome.setOnClose(() => {
      if (result || answers.length === 0) navigate(`/decks/${deck.id}`);
      else setConfirmLeave(true);
    });
    return () => chrome.setOnClose(null);
  }, [chrome, result, answers.length, navigate, deck.id]);

  /** Records the answer for the current question and moves on (or grades the quiz after the last one). */
  const commit = useCallback(
    (answer: QuizAnswer) => {
      const next = [...answers, answer];
      setAnswers(next);
      setPicked(null);
      if (index + 1 < quiz.units.length) {
        setIndex(index + 1);
        return;
      }
      const graded = gradeQuiz(quiz, next);
      setResult(graded);
      saved.current = true;
      void save(graded);
    },
    [answers, index, quiz, save],
  );

  if (result) {
    const missed = missedCardIds(result);
    return (
      <SummaryView
        deckId={deck.id}
        mood={result.grade === 'excellent' || result.grade === 'good' ? 'happy' : 'encouraging'}
        message={t(`quiz.grade.${result.grade}`)}
        headline={`${result.percent}%`}
        stats={[
          { label: t('learn.statCorrect'), value: result.correct },
          { label: t('learn.statAlmost'), value: result.almost },
          { label: t('learn.statWrong'), value: result.wrong },
        ]}
        weak={[]} // the detailed list below already shows every missed question
        saveState={saveState}
        onRetrySave={() => {
          saved.current = true;
          void save(result);
        }}
        onRetryMissed={missed.length > 0 ? () => onRetake(missed) : undefined}
        retryMissedLabel={tp('quiz.retake', missed.length)}
        onAgain={onNewTest}
        againLabel={t('quiz.newTest')}
        extra={
          <section className="section" aria-labelledby="quiz-details">
            <h2 className="section__title" id="quiz-details">
              {t('quiz.details')}
            </h2>
            <ul className="list">
              {result.items.map((item, i) => (
                <li key={i} className="list-row">
                  <span aria-hidden="true">
                    {item.result === 'correct' ? '✓' : item.result === 'almost' ? '≈' : '✗'}
                  </span>
                  <span className="list-row__main">
                    <span className="list-row__title">{item.prompt}</span>
                    {item.shown !== undefined && (
                      <span className="muted">
                        {t('quiz.statement', { prompt: item.prompt, shown: item.shown })}
                      </span>
                    )}
                    <span className="muted">
                      {t('learn.correctAnswer')}: {item.expected}
                      {item.result !== 'correct' && (
                        <>
                          {' · '}
                          {item.kind === 'trueFalse'
                            ? t('quiz.yourAnswerTf', {
                                answer:
                                  item.answer === null
                                    ? t('quiz.skipped')
                                    : item.answer
                                      ? t('quiz.true')
                                      : t('quiz.false'),
                              })
                            : `${t('learn.yourAnswer')}: ${
                                typeof item.answer === 'string' ? item.answer : t('quiz.skipped')
                              }`}
                        </>
                      )}
                    </span>
                    <span className="visually-hidden">{t(`quiz.result.${item.result}`)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="muted">{t('quiz.pointsNote')}</p>
          </section>
        }
      />
    );
  }
  if (!unit) return null;

  const last = index + 1 === quiz.units.length;
  const nextLabel = last ? t('quiz.finish') : t('quiz.next');
  return (
    <>
      <p className="muted" aria-live="polite">
        {t('quiz.counter', { n: index + 1, total: quiz.units.length })}
        {retaking && ` · ${t('quiz.retakeNote')}`}
      </p>
      <QuestionView
        key={index}
        unit={unit}
        langOf={langOf}
        nextLabel={nextLabel}
        picked={picked}
        onPick={setPicked}
        onCommit={commit}
      />

      {confirmLeave && (
        <ConfirmDialog
          title={t('quiz.leave.title')}
          confirmLabel={t('quiz.leave.confirm')}
          danger
          onConfirm={() => navigate(`/decks/${deck.id}`)}
          onCancel={() => setConfirmLeave(false)}
        >
          <p>{t('quiz.leave.text')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

/** One question of any kind, with its own way of answering. */
function QuestionView({
  unit,
  langOf,
  nextLabel,
  picked,
  onPick,
  onCommit,
}: {
  unit: QuizUnit;
  langOf: (side: CardSide) => string;
  nextLabel: string;
  picked: string | null;
  onPick: (option: string) => void;
  onCommit: (answer: QuizAnswer) => void;
}) {
  const { t } = useI18n();

  if (unit.kind === 'trueFalse') {
    return (
      <TrueFalseView
        unit={unit}
        langOf={langOf}
        onAnswer={onCommit}
        onSkip={() => onCommit(null)}
      />
    );
  }
  if (unit.kind === 'matching') {
    return (
      <MatchingView
        unit={unit}
        langOf={langOf}
        nextLabel={nextLabel}
        onCommit={onCommit}
        onSkip={() => onCommit(null)}
      />
    );
  }

  const { question } = unit;
  return (
    <>
      <section className="prompt" aria-labelledby="instruction">
        <p id="instruction" className="muted">
          {t(instructionKey(question))}
        </p>
        <div className="prompt__text" lang={langOf(question.promptSide)}>
          <span>{question.prompt}</span>
          <SpeakButton text={question.prompt} lang={langOf(question.promptSide)} />
        </div>
      </section>

      {question.kind === 'choice' ? (
        <>
          <ChoiceList question={question} picked={picked} reveal={false} onPick={onPick} />
          <Button block disabled={picked === null} onClick={() => onCommit(picked)}>
            {nextLabel}
          </Button>
          <Button variant="secondary" block onClick={() => onCommit(null)}>
            {t('quiz.skip')}
          </Button>
        </>
      ) : (
        <TypingForm
          labelId="instruction"
          submitLabel={nextLabel}
          onSubmit={(text) => onCommit(text.trim() === '' ? null : text)}
          onSkip={() => onCommit(null)}
          skipLabel={t('quiz.skip')}
        />
      )}
    </>
  );
}
