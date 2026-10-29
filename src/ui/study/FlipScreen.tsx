import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  answerFlip,
  continueFlip,
  currentFlipCard,
  flipFace,
  flipProgress,
  flipToLogs,
  flipToProgress,
  isFlipFinished,
  startFlip,
  summarizeFlip,
} from '../../core/flip';
import type { FlipState } from '../../core/flip';
import { moodForScore } from '../../core/cheer';
import { createFixedIntervalScheduler } from '../../core/scheduler';
import { selectSessionCards } from '../../core/selection';
import { useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SpeakButton } from '../components/SpeakButton';
import { StarButton } from '../components/StarButton';
import { MascotBubble } from '../components/Mascot';
import { useStudyChrome } from './StudyLayout';
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
  const { repo } = useApp();
  const chrome = useStudyChrome();
  const navigate = useNavigate();
  const { direction, practice } = useStudyParams();
  const { deck } = data;

  const [state, setState] = useState<FlipState>(() =>
    startFlip(pickSessionCards(data, direction, practice), direction),
  );
  const [flipped, setFlipped] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const saved = useRef(false);
  const finished = isFlipFinished(state);
  const card = currentFlipCard(state);

  const save = useCallback(async () => {
    setSaveState('saving');
    try {
      const progress = practice ? [] : flipToProgress(state, data.progress, scheduler);
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
    },
    [chrome],
  );

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
  const frontLang = direction === 'forward' ? deck.learningLang : deck.translationLang;
  const backLang = direction === 'forward' ? deck.translationLang : deck.learningLang;

  return (
    <>
      <p className="muted" aria-live="polite">
        {state.round === 1
          ? t('flip.counter', { n: state.position + 1, total: state.order.length })
          : t('flip.counterRound', {
              round: state.round,
              n: state.position + 1,
              total: state.order.length,
            })}
      </p>

      <div className="flip">
        <button
          type="button"
          className={flipped ? 'flip-card flip-card--back' : 'flip-card'}
          onClick={() => setFlipped((f) => !f)}
          aria-expanded={flipped}
        >
          <span className="flip-card__text" lang={frontLang}>
            {face.front}
          </span>
          {!flipped && <span className="muted">{t('flip.tapHint')}</span>}
          {/* the accessible name is the card text plus this action, so the word is still read out */}
          <span className="visually-hidden">
            {flipped ? t('flip.hideAnswer') : t('flip.showAnswer')}
          </span>
        </button>
        <SpeakButton text={face.front} lang={frontLang} />
        <StarButton cardId={card.id} term={card.term} starred={card.starred === true} />
      </div>

      {flipped && (
        <section className="flip-answer" aria-live="polite" lang={backLang}>
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
        </section>
      )}

      {flipped && (
        <div className="row">
          <Button variant="secondary" onClick={() => answer(false)}>
            ✗ {t('flip.dontKnow')}
          </Button>
          <Button onClick={() => answer(true)} autoFocus>
            ✓ {t('flip.know')}
          </Button>
        </div>
      )}
      <p className="muted">{t('flip.keysHint')}</p>

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
