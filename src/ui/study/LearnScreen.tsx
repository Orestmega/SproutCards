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
import { moodForScore, reactTo } from '../../core/cheer';
import { growthGain } from '../../core/garden';
import type { GrowthGain } from '../../core/garden';
import { isResumable, markSaved, unsaved, withCurrentCards } from '../../core/resume';
import { createFixedIntervalScheduler } from '../../core/scheduler';
import type { CardSide, Direction } from '../../core/types';
import { deckLearning, mergeProgress } from '../../core/wholeDeck';
import type { DeckLearning } from '../../core/wholeDeck';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProgressBar } from '../components/ProgressBar';
import { SpeakButton } from '../components/SpeakButton';
import { ChoiceList, instructionKey, TypingForm } from './parts';
import { useCue } from '../cues';
import { clearSnapshot, readSnapshot, writeSnapshot } from '../resume';
import { speak } from '../speech';
import { useStudyChrome } from './StudyLayout';
import { SummaryView } from './SummaryView';
import type { SaveState } from './SummaryView';
import { pickSessionCards, StudyGate, useStudyParams, useWarnBeforeUnload } from './useStudy';
import type { StudyData } from './useStudy';

const scheduler = createFixedIntervalScheduler();

export function LearnScreen() {
  const { deckId, whole } = useStudyParams();
  // Changing the key reloads the data and starts a fresh session ("Study again").
  const [run, setRun] = useState(0);
  return (
    <StudyGate
      key={run}
      deckId={deckId}
      mode="learn"
      emptyFor={(data, direction) => pickSessionCards(data, direction, false, whole).length === 0}
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
  /** The session before this answer: "count it as right" answers again from here. */
  before: LearnState;
  /** The answer was counted as right by the learner. */
  overridden?: boolean;
}

function LearnSession({ data, onRestart }: { data: StudyData; onRestart: () => void }) {
  const { t, tp, languageName } = useI18n();
  const { repo, settings } = useApp();
  const chrome = useStudyChrome();
  const cue = useCue();
  const navigate = useNavigate();
  const { direction, practice, resume, whole } = useStudyParams();
  const { deck } = data;

  // A session left half-way can be continued (`?resume=1`); practice sessions are not kept.
  const [start] = useState(() => {
    const snapshot = resume && !practice ? readSnapshot(deck.id, direction) : null;
    if (isResumable(snapshot, deck.id, direction, data.cards, data.now)) {
      return {
        state: withCurrentCards(snapshot.state, data.cards),
        saved: { cards: snapshot.savedCardIds, events: snapshot.savedEvents },
      };
    }
    const cards = pickSessionCards(data, direction, practice, whole);
    return {
      state: startSession(cards, direction, {
        ...DEFAULT_LEARN_CONFIG,
        ignoreDiacritics: settings.ignoreDiacritics,
      }),
      saved: { cards: [] as string[], events: 0 },
    };
  });
  const [state, setState] = useState<LearnState>(start.state);
  /** What earlier visits of this session already stored (so nothing is stored twice). */
  const stored = useRef(start.saved);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [grown, setGrown] = useState<GrowthGain | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [combo, setCombo] = useState(0); // correct answers in a row, for Sprout's cheers
  /** "Learn the whole deck": how many words of the deck are learned after this session. */
  const [wholeAfter, setWholeAfter] = useState<DeckLearning | null>(null);
  const saved = useRef(false);

  const finished = !answered && isFinished(state);
  const shown = answered?.question ?? state.current;
  const langOf = (side: CardSide) => (side === 'term' ? deck.learningLang : deck.translationLang);

  /** Writes in order: the saves as you go never overlap each other or the final one. */
  const writing = useRef<Promise<void>>(Promise.resolve());

  // Save as you go: after every answer the new answers and the cards passed so far are stored, so
  // the learned count grows at once, even if the session is left through the menu or the tab is closed.
  useEffect(() => {
    if (practice || state.events.length === 0 || isFinished(state)) return;
    const current = state;
    writing.current = writing.current
      .then(async () => {
        const now = Date.now();
        const all = applySessionToProgress(current, data.progress, scheduler, now);
        const logs = sessionToLogs(current);
        const rest = unsaved(all, logs, stored.current.cards, stored.current.events);
        if (rest.progress.length === 0 && rest.logs.length === 0) return;
        await repo.saveSession(rest.progress, rest.logs);
        stored.current = {
          cards: [...new Set([...stored.current.cards, ...rest.progress.map((p) => p.cardId)])],
          events: logs.length,
        };
        // the snapshot must know what is stored, or continuing would store the answers twice
        writeSnapshot({
          version: 1,
          deckId: deck.id,
          direction,
          state: current,
          savedCardIds: stored.current.cards,
          savedEvents: stored.current.events,
          savedAt: now,
        });
      })
      .catch(() => {
        // not stored now: the final save (or the next answer) tries again with the same data
      });
  }, [state, practice, data.progress, repo, deck.id, direction]);

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      await writing.current; // let a save in progress finish first
      const now = Date.now();
      const all = practice
        ? [] // practising ahead of schedule must not move the review dates
        : applySessionToProgress(state, data.progress, scheduler, now);
      const rest = unsaved(all, sessionToLogs(state), stored.current.cards, stored.current.events);
      // what grew in the whole session (part of it may have been stored along the way)
      setGrown(growthGain(data.progress, all));
      await repo.saveSession(rest.progress, rest.logs);
      if (whole)
        setWholeAfter(deckLearning(data.cards, mergeProgress(data.progress, all), direction));
      if (isFinished(state) || practice) {
        clearSnapshot(deck.id, direction);
      } else {
        // left half-way: what is done is stored; the snapshot remembers it for next time
        const marked = markSaved(
          {
            version: 1,
            deckId: deck.id,
            direction,
            state,
            savedCardIds: stored.current.cards,
            savedEvents: stored.current.events,
            savedAt: now,
          },
          now,
        );
        stored.current = { cards: marked.savedCardIds, events: marked.savedEvents };
        writeSnapshot(marked);
      }
      setSaveState('saved');
    } catch {
      saved.current = false;
      setSaveState('error');
    }
  }, [state, data.progress, data.cards, practice, whole, repo, deck.id, direction]);

  // Keep a snapshot after every answer, so the session can be continued even if the tab is closed.
  useEffect(() => {
    if (practice || state.events.length === 0 || isFinished(state)) return;
    writeSnapshot({
      version: 1,
      deckId: deck.id,
      direction,
      state,
      savedCardIds: stored.current.cards,
      savedEvents: stored.current.events,
      savedAt: Date.now(),
    });
  }, [state, practice, deck.id, direction]);

  // Save once, when the last card is done.
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    void save();
  }, [finished, save]);

  useWarnBeforeUnload(!finished && state.events.length > 0);

  // read the prompt aloud as it appears, if the user asked for that
  const promptText = answered ? null : (state.current?.prompt ?? null);
  const promptLang =
    state.current?.promptSide === 'translation' ? deck.translationLang : deck.learningLang;
  const answersSoFar = state.events.length;
  useEffect(() => {
    if (promptText && settings.autoSpeak && settings.speechEnabled) {
      void speak(promptText, promptLang);
    }
  }, [promptText, promptLang, answersSoFar, settings.autoSpeak, settings.speechEnabled]);

  useEffect(() => chrome.setProgress(progressFraction(state)), [chrome, state]);

  // at the end Sprout in the top bar shows the same mood as the result screen
  const accuracy = finished ? summarize(state).accuracy : null;
  useEffect(() => {
    if (accuracy !== null) chrome.react(moodForScore(accuracy));
  }, [chrome, accuracy]);

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
      setAnswered({ question: state.current, input, feedback: result.feedback, before: state });
      const reaction = reactTo(combo, result.feedback.result, input === null);
      setCombo(reaction.combo);
      chrome.react(
        reaction.mood,
        reaction.milestone ? t('buddy.combo', { count: reaction.combo }) : undefined,
      );
      cue(reaction.milestone ? 'combo' : result.feedback.result);
    },
    [state, answered, combo, chrome, t, cue],
  );

  // A tap only chooses an option (it can still be changed); "Check" or Enter gives the answer.
  const pickOption = useCallback(
    (option: string) => {
      if (answered) return;
      setPicked(option);
    },
    [answered],
  );

  const choiceReady = !answered && picked !== null && state.current?.kind === 'choice';
  useEffect(() => {
    if (!choiceReady) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat) return;
      event.preventDefault(); // Enter on a focused option must not also re-click it
      answer(picked);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choiceReady, picked, answer]);

  // a typed answer marked wrong, but the learner knows it was right (a typo, an apostrophe, a synonym)
  function countAsRight() {
    if (!answered || answered.feedback.result === 'correct') return;
    const result = submitAnswer(answered.before, answered.input, Date.now(), Math.random, true);
    setState(result.state);
    setAnswered({ ...answered, feedback: result.feedback, overridden: true });
    setCombo((c) => c + 1);
    chrome.react('happy');
    cue('correct');
  }

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
    return (
      <SummaryView
        deckId={deck.id}
        mood={moodForScore(summary.accuracy)}
        score={summary.accuracy}
        message={t(summary.accuracy >= 0.7 ? 'learn.summaryGood' : 'learn.summaryKeepGoing')}
        headline={`${Math.round(summary.accuracy * 100)}%`}
        stats={[
          { label: t('learn.statCorrect'), value: summary.correct },
          { label: t('learn.statAlmost'), value: summary.almost },
          { label: t('learn.statWrong'), value: summary.wrong },
        ]}
        weak={Object.values(state.cards).filter((c) => weakIds.has(c.id))}
        saveState={saveState}
        grown={grown}
        onRetrySave={() => {
          saved.current = true;
          void save();
        }}
        onAgain={onRestart}
        againLabel={
          whole && wholeAfter && wholeAfter.learned < wholeAfter.total ? t('whole.next') : undefined
        }
        extra={
          <>
            <p className="muted">
              {tp('learn.cardsLearned', summary.passedCards)}
              {practice ? ` ${t('learn.practiceNote')}` : ''}
            </p>
            {whole && wholeAfter && (
              <div className="stack">
                <p className="whole-note">
                  {t('whole.progress', { learned: wholeAfter.learned, total: wholeAfter.total })}
                </p>
                <ProgressBar
                  value={wholeAfter.total ? wholeAfter.learned / wholeAfter.total : 0}
                  label={t('whole.progress', {
                    learned: wholeAfter.learned,
                    total: wholeAfter.total,
                  })}
                />
              </div>
            )}
          </>
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
        <Button block disabled={picked === null} onClick={() => answer(picked)}>
          {t('learn.check')}
        </Button>
      )}

      {answered && (
        <FeedbackPanel
          answered={answered}
          answerLang={langOf(answered.question.answerSide)}
          onCountAsRight={countAsRight}
          onContinue={() => {
            setAnswered(null);
            setPicked(null);
            chrome.react('normal');
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
  onCountAsRight,
}: {
  answered: Answered;
  answerLang: string;
  onContinue: () => void;
  /** Count a typed answer that was marked wrong as right after all. */
  onCountAsRight: () => void;
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
    <div className={`sheet sheet--${kind}`}>
      <div className="sheet__inner">
        <div className="sheet__head" role={kind === 'error' ? 'alert' : 'status'}>
          <span className="notice__icon" aria-hidden="true">
            {kind === 'success' ? '✓' : kind === 'warn' ? '≈' : '✗'}
          </span>
          <div>
            <p className="sheet__title">{title}</p>
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
            {answered.overridden && <p className="muted">{t('learn.countedAsRight')}</p>}
            {feedback.passed && <p>{t('learn.cardDone')}</p>}
          </div>
        </div>
        {question.kind === 'typing' &&
          input !== null &&
          input.trim() !== '' &&
          feedback.result !== 'correct' && (
            <p className="override">
              {t('learn.overrideText')}{' '}
              <button type="button" className="override__btn" onClick={onCountAsRight}>
                {t('learn.overrideButton')}
              </button>
            </p>
          )}
        <Button block onClick={onContinue} autoFocus>
          {t('learn.continue')}
        </Button>
      </div>
    </div>
  );
}
