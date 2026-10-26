import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createQuiz, DEFAULT_QUIZ_CONFIG, gradeQuiz, quizToLogs } from '../../core/quiz';
import type { Quiz, QuizResult } from '../../core/quiz';
import type { CardSide } from '../../core/types';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SpeakButton } from '../components/SpeakButton';
import { ChoiceList, instructionKey, TypingForm } from './parts';
import { useStudyChrome } from './StudyLayout';
import { SummaryView } from './SummaryView';
import type { SaveState } from './SummaryView';
import { StudyGate, useStudyParams } from './useStudy';
import type { StudyData } from './useStudy';

export function QuizScreen() {
  const { deckId } = useStudyParams();
  const [run, setRun] = useState(0);
  return (
    <StudyGate key={run} deckId={deckId} mode="learn">
      {(data) => <QuizSession data={data} onRestart={() => setRun((r) => r + 1)} />}
    </StudyGate>
  );
}

function QuizSession({ data, onRestart }: { data: StudyData; onRestart: () => void }) {
  const { t } = useI18n();
  const { settings } = useApp();
  const { direction } = useStudyParams();
  const [quiz] = useState<Quiz>(() =>
    createQuiz(data.cards, direction, {
      ...DEFAULT_QUIZ_CONFIG,
      ignoreDiacritics: settings.ignoreDiacritics,
    }),
  );
  if (quiz.questions.length === 0) {
    // Only possible when no card can be studied (empty term or translations).
    return <p>{t('study.noCards.text')}</p>;
  }
  return <QuizRun data={data} quiz={quiz} onRestart={onRestart} />;
}

function QuizRun({
  data,
  quiz,
  onRestart,
}: {
  data: StudyData;
  quiz: Quiz;
  onRestart: () => void;
}) {
  const { t } = useI18n();
  const { repo } = useApp();
  const chrome = useStudyChrome();
  const navigate = useNavigate();
  const { deck } = data;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);

  const question = quiz.questions[index];
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

  useEffect(
    () => chrome.setProgress(result ? 1 : index / quiz.questions.length),
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
  function commit(answer: string | null) {
    const next = [...answers, answer];
    setAnswers(next);
    setPicked(null);
    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1);
      return;
    }
    const graded = gradeQuiz(quiz, next);
    setResult(graded);
    saved.current = true;
    void save(graded);
  }

  if (result) {
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
        onAgain={onRestart}
        againLabel={t('quiz.again')}
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
                    <span className="list-row__title">{item.question.prompt}</span>
                    <span className="muted">
                      {t('learn.correctAnswer')}: {item.question.acceptable[0]}
                      {item.result !== 'correct' && (
                        <>
                          {' · '}
                          {t('learn.yourAnswer')}: {item.answer ?? t('quiz.skipped')}
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
  if (!question) return null;

  const last = index + 1 === quiz.questions.length;
  return (
    <>
      <p className="muted" aria-live="polite">
        {t('quiz.counter', { n: index + 1, total: quiz.questions.length })}
      </p>
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
          <ChoiceList question={question} picked={picked} reveal={false} onPick={setPicked} />
          <Button block disabled={picked === null} onClick={() => commit(picked)}>
            {last ? t('quiz.finish') : t('quiz.next')}
          </Button>
          <Button variant="secondary" block onClick={() => commit(null)}>
            {t('quiz.skip')}
          </Button>
        </>
      ) : (
        <TypingForm
          key={index}
          labelId="instruction"
          submitLabel={last ? t('quiz.finish') : t('quiz.next')}
          onSubmit={(text) => commit(text.trim() === '' ? null : text)}
          onSkip={() => commit(null)}
          skipLabel={t('quiz.skip')}
        />
      )}

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
