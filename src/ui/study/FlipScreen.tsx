import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  answerFlip,
  canUndoFlip,
  continueFlip,
  currentFlipCard,
  flipFace,
  flipProgress,
  flipToLogs,
  flipToProgress,
  isFlipFinished,
  startFlip,
  summarizeFlip,
  undoFlip,
} from '../../core/flip';
import type { FlipState } from '../../core/flip';
import { moodForScore } from '../../core/cheer';
import { growthGain } from '../../core/garden';
import type { GrowthGain } from '../../core/garden';
import { createFixedIntervalScheduler } from '../../core/scheduler';
import { selectSessionCards } from '../../core/selection';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icons';
import { SpeakButton } from '../components/SpeakButton';
import { StarButton } from '../components/StarButton';
import { MascotBubble } from '../components/Mascot';
import { useCue } from '../cues';
import { speak } from '../speech';
import { useStudyChrome } from './StudyLayout';
import { SwipeCard } from './SwipeCard';
import { SummaryView } from './SummaryView';
import type { SaveState } from './SummaryView';
import { pickSessionCards, StudyGate, useStudyParams } from './useStudy';
import type { StudyData } from './useStudy';

const scheduler = createFixedIntervalScheduler();

export function FlipScreen() {
  const { deckId } = useStudyParams();
  const [run, setRun] = useState(0);
  return (
    <StudyGate
      key={run}
      deckId={deckId}
      mode="flip"
      emptyFor={(data, direction) => {
        const s = selectSessionCards(
          data.cards,
          data.progress,
          direction,
          data.now,
          data.newBudget,
        );
        return s.due.length + s.fresh.length === 0;
      }}
    >
      {(data) => <FlipSession data={data} onRestart={() => setRun((r) => r + 1)} />}
    </StudyGate>
  );
}

function FlipSession({ data, onRestart }: { data: StudyData; onRestart: () => void }) {
  const { t, tp } = useI18n();
  const { repo, settings } = useApp();
  const chrome = useStudyChrome();
  const cue = useCue();
  const navigate = useNavigate();
  const { direction, practice } = useStudyParams();
  const { deck } = data;

  const [state, setState] = useState<FlipState>(() =>
    startFlip(pickSessionCards(data, direction, practice), direction),
  );
  const [flipped, setFlipped] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [grown, setGrown] = useState<GrowthGain | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);
  const finished = isFlipFinished(state);
  const card = currentFlipCard(state);

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      const progress = practice ? [] : flipToProgress(state, data.progress, scheduler);
      setGrown(growthGain(data.progress, progress));
      await repo.saveSession(progress, flipToLogs(state));
      setSaveState('saved');
    } catch {
      saved.current = false;
      setSaveState('error');
    }
  }, [state, data.progress, practice, repo]);

  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    void save();
  }, [finished, save]);

  useEffect(() => chrome.setProgress(flipProgress(state)), [chrome, state]);

  useEffect(() => {
    chrome.setOnClose(() => {
      if (finished || state.results.length === 0) navigate(`/decks/${deck.id}`);
      else setConfirmLeave(true);
    });
    return () => chrome.setOnClose(null);
  }, [chrome, finished, state.results.length, navigate, deck.id]);

  const answer = useCallback(
    (known: boolean) => {
      const now = Date.now(); // read outside the updater so the updater stays pure
      setState((s) => answerFlip(s, known, now));
      setFlipped(false);
      chrome.react(known ? 'happy' : 'encouraging');
      cue(known ? 'correct' : 'almost');
    },
    [chrome, cue],
  );

  const turn = useCallback(() => {
    setFlipped((f) => !f);
    cue('flip');
  }, [cue]);

  const undo = useCallback(() => {
    setState((s) => undoFlip(s));
    setFlipped(false);
    chrome.react('normal');
  }, [chrome]);

  // read the word aloud as it appears, if the user asked for that
  const spokenFront = card ? flipFace(card, direction).front : null;
  const spokenLang = direction === 'forward' ? deck.learningLang : deck.translationLang;
  useEffect(() => {
    if (spokenFront && settings.autoSpeak && settings.speechEnabled) {
      void speak(spokenFront, spokenLang);
    }
  }, [spokenFront, spokenLang, state.position, settings.autoSpeak, settings.speechEnabled]);

  // Arrow keys: ← "don't know", → "know" (only once the card is turned over).
  useEffect(() => {
    if (!flipped) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') answer(true);
      else if (event.key === 'ArrowLeft') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, answer]);

  async function leaveAndSave() {
    if (!saved.current) {
      saved.current = true;
      await save(); // keeps the cards answered so far
    }
    navigate(`/decks/${deck.id}`);
  }

  if (state.phase === 'roundEnd') {
    const summary = summarizeFlip(state);
    return (
      <>
        <h2 className="visually-hidden">{t('flip.roundEnd.title', { round: state.round })}</h2>
        <MascotBubble mood="encouraging" size={96}>
          <strong>{t('flip.roundEnd.title', { round: state.round })}</strong>
          <br />
          {t('flip.roundEnd.counts', {
            known: summary.known,
            total: summary.total,
            learning: summary.stillLearning,
          })}
        </MascotBubble>
        <Button block onClick={() => setState((s) => continueFlip(s))} autoFocus>
          {tp('flip.roundEnd.continue', state.missed.length)}
        </Button>
        <Button block variant="secondary" onClick={undo}>
          {t('flip.undo')}
        </Button>
      </>
    );
  }

  if (finished) {
    const summary = summarizeFlip(state);
    const weak = state.cards.filter((c) => summary.struggledCardIds.includes(c.id));
    const ratio = summary.total === 0 ? 1 : 1 - summary.struggledCardIds.length / summary.total;
    return (
      <SummaryView
        deckId={deck.id}
        mood={moodForScore(ratio)}
        message={t(ratio >= 0.7 ? 'learn.summaryGood' : 'learn.summaryKeepGoing')}
        stats={[
          { label: t('flip.statKnown'), value: summary.known },
          { label: t('flip.statRounds'), value: summary.rounds },
          { label: t('flip.statStruggled'), value: summary.struggledCardIds.length },
        ]}
        weak={weak}
        saveState={saveState}
        grown={grown}
        onRetrySave={() => {
          saved.current = true;
          void save();
        }}
        onAgain={onRestart}
        extra={practice ? <p className="muted">{t('learn.practiceNote')}</p> : undefined}
      />
    );
  }
  if (!card) return null;

  const face = flipFace(card, direction);
  const left = state.order.length - state.position;
  const frontLang = direction === 'forward' ? deck.learningLang : deck.translationLang;
  const backLang = direction === 'forward' ? deck.translationLang : deck.learningLang;

  return (
    <>
      <div className="fc-bar">
        <p className="muted" aria-live="polite">
          {state.round === 1
            ? t('flip.counter', { n: state.position + 1, total: state.order.length })
            : t('flip.counterRound', {
                round: state.round,
                n: state.position + 1,
                total: state.order.length,
              })}
        </p>
        {canUndoFlip(state) && (
          <button type="button" className="icon-btn" aria-label={t('flip.undo')} onClick={undo}>
            <Icon name="undo" />
          </button>
        )}
      </div>

      <div className={left <= 1 ? 'fc-stage fc-stage--last' : 'fc-stage'}>
        {/* a new key per answer: the next card arrives fresh, unturned */}
        <SwipeCard
          key={`${state.round}-${state.position}`}
          enabled={flipped}
          onSwipe={answer}
          knowLabel={t('flip.stampKnow')}
          learnLabel={t('flip.stampLearn')}
        >
          <div className="fc__tools">
            <SpeakButton text={face.front} lang={frontLang} />
            <StarButton cardId={card.id} term={card.term} starred={card.starred === true} />
          </div>
          <div className={flipped ? 'fc__inner fc__inner--flipped' : 'fc__inner'}>
            <button
              type="button"
              className="fc__face fc__face--front"
              onClick={turn}
              aria-expanded={flipped}
            >
              <span className="flip-card__text" lang={frontLang}>
                {face.front}
              </span>
              <span className="muted">{t('flip.tapHint')}</span>
              {/* the accessible name is the card text plus this action, so the word is still read out */}
              <span className="visually-hidden">{t('flip.showAnswer')}</span>
            </button>
            <section className="fc__face fc__face--back" aria-live="polite" lang={backLang}>
              {flipped && (
                <>
                  <p className="muted" lang={frontLang}>
                    {face.front}
                  </p>
                  <ul className="flip-answer__list">
                    {face.back.map((text, i) => (
                      <li key={i}>
                        {text} <SpeakButton text={text} lang={backLang} />
                      </li>
                    ))}
                  </ul>
                  {card.examples.length > 0 && (
                    <ul className="muted flip-answer__examples">
                      {card.examples.map((e, i) => (
                        <li key={i}>
                          {e.text}
                          {e.translation ? ` — ${e.translation}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {card.notes && <p className="muted">{card.notes}</p>}
                  <button type="button" className="fc-turn" onClick={turn}>
                    {t('flip.hideAnswer')}
                  </button>
                </>
              )}
            </section>
          </div>
        </SwipeCard>
      </div>

      {flipped ? (
        <>
          <div className="fc-actions">
            <Button variant="secondary" onClick={() => answer(false)}>
              ✗ {t('flip.dontKnow')}
            </Button>
            <Button onClick={() => answer(true)} autoFocus>
              ✓ {t('flip.know')}
            </Button>
          </div>
          <p className="muted" style={{ textAlign: 'center' }}>
            {t('flip.swipeHint')}
          </p>
        </>
      ) : (
        <p className="muted" style={{ textAlign: 'center' }}>
          {t('flip.keysHint')}
        </p>
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
