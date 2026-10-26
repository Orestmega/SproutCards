import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  applySessionToProgress,
  DEFAULT_LEARN_CONFIG,
  isFinished,
  progressFraction,
  sessionToLogs,
  startSession,
  submitAnswer,
  summarize,
} from '../../core/learn';
import type { Feedback, LearnState, Question } from '../../core/learn';
import { createFixedIntervalScheduler } from '../../core/scheduler';
import type { CardSide, Direction } from '../../core/types';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Notice } from '../components/Notice';
import { SpeakButton } from '../components/SpeakButton';
import { ChoiceList, instructionKey, TypingForm } from './parts';
import { useStudyChrome } from './StudyLayout';
import { SummaryView } from './SummaryView';
import type { SaveState } from './SummaryView';
import { pickSessionCards, StudyGate, useStudyParams, useWarnBeforeUnload } from './useStudy';
import type { StudyData } from './useStudy';

const scheduler = createFixedIntervalScheduler();

export function LearnScreen() {
  const { deckId } = useStudyParams();
  // Changing the key reloads the data and starts a fresh session ("Study again").
  const [run, setRun] = useState(0);
  return (
    <StudyGate
      key={run}
      deckId={deckId}
      mode="learn"
      emptyFor={(data, direction) => pickSessionCards(data, direction, false).length === 0}
    >
      {(data) => <LearnSession data={data} onRestart={() => setRun((r) => r + 1)} />}
    </StudyGate>
  );
}

/** What the user just answered, kept on screen until they press Continue. */
interface Answered {
  question: Question;
  input: string | null;
  feedback: Feedback;
}

function LearnSession({ data, onRestart }: { data: StudyData; onRestart: () => void }) {
  const { t, tp, languageName } = useI18n();
  const { repo, settings } = useApp();
  const chrome = useStudyChrome();
  const navigate = useNavigate();
  const { direction, practice } = useStudyParams();
  const { deck } = data;

  const [state, setState] = useState<LearnState>(() => {
    const cards = pickSessionCards(data, direction, practice);
    return startSession(cards, direction, {
      ...DEFAULT_LEARN_CONFIG,
      ignoreDiacritics: settings.ignoreDiacritics,
    });
  });
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);

  const finished = !answered && isFinished(state);
  const shown = answered?.question ?? state.current;
  const langOf = (side: CardSide) => (side === 'term' ? deck.learningLang : deck.translationLang);

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      const progress = practice
        ? [] // practising ahead of schedule must not move the review dates
        : applySessionToProgress(state, data.progress, scheduler, Date.now());
      await repo.saveSession(progress, sessionToLogs(state));
      setSaveState('saved');
    } catch {
      saved.current = false;
      setSaveState('error');
    }
  }, [state, data.progress, practice, repo]);

  // Save once, when the last card is done.
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    void save();
  }, [finished, save]);

  useWarnBeforeUnload(!finished && state.events.length > 0);

  useEffect(() => chrome.setProgress(progressFraction(state)), [chrome, state]);

  // The close button: leave at once if nothing was answered or the session is over, else ask first.
  useEffect(() => {
    chrome.setOnClose(() => {
      if (finished || state.events.length === 0) navigate(`/decks/${deck.id}`);
      else setConfirmLeave(true);
    });
    return () => chrome.setOnClose(null);
  }, [chrome, finished, state.events.length, navigate, deck.id]);

  const answer = useCallback(
    (input: string | null) => {
      if (!state.current || answered) return;
      const result = submitAnswer(state, input, Date.now());
      setState(result.state);
      setAnswered({ question: state.current, input, feedback: result.feedback });
    },
    [state, answered],
  );

  const pickOption = useCallback(
    (option: string) => {
      setPicked(option);
      answer(option);
    },
    [answer],
  );

  async function leaveAndSave() {
    if (!saved.current) {
      saved.current = true;
      await save(); // only cards that already passed are scheduled
    }
    navigate(`/decks/${deck.id}`);
  }

  if (finished) {
    const summary = summarize(state);
    const weakIds = new Set(summary.outcomes.filter((o) => o.mistakes > 0).map((o) => o.cardId));
    const mood = summary.accuracy >= 0.7 ? 'happy' : 'encouraging';
    return (
      <SummaryView
        deckId={deck.id}
        mood={mood}
        message={t(summary.accuracy >= 0.7 ? 'learn.summaryGood' : 'learn.summaryKeepGoing')}
        headline={`${Math.round(summary.accuracy * 100)}%`}
        stats={[
          { label: t('learn.statCorrect'), value: summary.correct },
          { label: t('learn.statAlmost'), value: summary.almost },
          { label: t('learn.statWrong'), value: summary.wrong },
        ]}
        weak={Object.values(state.cards).filter((c) => weakIds.has(c.id))}
        saveState={saveState}
        onRetrySave={() => {
          saved.current = true;
          void save();
        }}
        onAgain={onRestart}
        extra={
          <p className="muted">
            {tp('learn.cardsLearned', summary.passedCards)}
            {practice ? ` ${t('learn.practiceNote')}` : ''}
          </p>
        }
      />
    );
  }
  if (!shown) return null;

  const dir: Direction = direction;
  return (
    <>
      <section className="prompt" aria-labelledby="instruction">
        <p id="instruction" className="muted">
          {t(instructionKey(shown))}
        </p>
        <div className="prompt__text" lang={langOf(shown.promptSide)}>
          <span>{shown.prompt}</span>
          <SpeakButton text={shown.prompt} lang={langOf(shown.promptSide)} />
        </div>
        <p className="muted">
          {t(dir === 'forward' ? 'study.dirForward' : 'study.dirBackward', {
            from: languageName(deck.learningLang),
            to: languageName(deck.translationLang),
          })}
        </p>
      </section>

      {shown.kind === 'choice' ? (
        <ChoiceList
          question={shown}
          picked={picked}
          reveal={answered !== null}
          onPick={pickOption}
        />
      ) : (
        !answered && (
          <TypingForm
            key={`${shown.cardId}-${state.events.length}`}
            labelId="instruction"
            submitLabel={t('learn.check')}
            onSubmit={(text) => answer(text)}
            onSkip={() => answer(null)}
            skipLabel={t('learn.dontKnow')}
          />
        )
      )}
      {shown.kind === 'choice' && !answered && (
        <Button variant="secondary" block onClick={() => answer(null)}>
          {t('learn.dontKnow')}
        </Button>
      )}

      {answered && (
        <FeedbackPanel
          answered={answered}
          answerLang={langOf(answered.question.answerSide)}
          onContinue={() => {
            setAnswered(null);
            setPicked(null);
          }}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title={t('learn.leave.title')}
          confirmLabel={t('learn.leave.confirm')}
          onConfirm={() => void leaveAndSave()}
          onCancel={() => setConfirmLeave(false)}
        >
          <p>{t('learn.leave.text')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}

function FeedbackPanel({
  answered,
  answerLang,
  onContinue,
}: {
  answered: Answered;
  answerLang: string;
  onContinue: () => void;
}) {
  const { t } = useI18n();
  const { feedback, input, question } = answered;
  const kind =
    feedback.result === 'correct' ? 'success' : feedback.result === 'almost' ? 'warn' : 'error';
  const title =
    feedback.result === 'correct'
      ? t('learn.correct')
      : feedback.result === 'almost'
        ? t('learn.almost')
        : input === null
          ? t('learn.dontKnowFeedback')
          : t('learn.wrong');
  return (
    <>
      <Notice kind={kind}>
        <strong>{title}</strong>
        {feedback.result !== 'correct' && (
          <>
            <p lang={answerLang}>
              {t('learn.correctAnswer')}: <strong>{feedback.expected}</strong>{' '}
              <SpeakButton text={feedback.expected} lang={answerLang} />
            </p>
            {question.kind === 'typing' && input && input.trim() !== '' && (
              <p className="muted">
                {t('learn.yourAnswer')}: {input}
              </p>
            )}
          </>
        )}
        {feedback.passed && <p>{t('learn.cardDone')}</p>}
      </Notice>
      <Button block onClick={onContinue} autoFocus>
        {t('learn.continue')}
      </Button>
    </>
  );
}
