import { applySessionToProgress, sessionToLogs, startSession, submitAnswer } from './learn';
import type { LearnConfig, LearnState } from './learn';
import { isResumable, markSaved, snapshotProgress, unsaved, withCurrentCards } from './resume';
import type { LearnSnapshot } from './resume';
import { createFixedIntervalScheduler } from './scheduler';
import { makeCard } from './testUtils';

const NOW = new Date(2026, 5, 10, 12).getTime();
const cards = [makeCard('apple', 'яблуко', { id: 'a' }), makeCard('water', 'вода', { id: 'w' })];
/** One level only (multiple choice): one right answer finishes a word. */
const config: LearnConfig = {
  levels: [{ kind: 'choice', prompt: 'term' }],
  choiceCount: 2,
  requeueGap: { min: 1, max: 1 },
  ignoreDiacritics: true,
};

/** Answers the current question right. */
function right(state: LearnState): LearnState {
  const q = state.current;
  if (!q) throw new Error('finished');
  return submitAnswer(state, q.acceptable[0] ?? '', NOW).state;
}

function snap(state: LearnState, extra: Partial<LearnSnapshot> = {}): LearnSnapshot {
  return {
    version: 1,
    deckId: 'd',
    direction: 'forward',
    state,
    savedCardIds: [],
    savedEvents: 0,
    savedAt: NOW,
    ...extra,
  };
}

describe('resume', () => {
  const start = startSession(cards, 'forward', config);

  it('tells how far the session got', () => {
    expect(snapshotProgress(snap(start))).toEqual({ done: 0, total: 2, percent: 0 });
    expect(snapshotProgress(snap(right(start)))).toEqual({ done: 1, total: 2, percent: 50 });
  });

  it('can be continued only for the same deck and direction, unfinished, fresh, with all words', () => {
    const s = snap(right(start));
    expect(isResumable(s, 'd', 'forward', cards, NOW)).toBe(true);
    expect(isResumable(null, 'd', 'forward', cards, NOW)).toBe(false);
    expect(isResumable(s, 'other', 'forward', cards, NOW)).toBe(false);
    expect(isResumable(s, 'd', 'backward', cards, NOW)).toBe(false);
    expect(isResumable(s, 'd', 'forward', cards.slice(0, 1), NOW)).toBe(false); // a word was deleted
    expect(isResumable(s, 'd', 'forward', cards, NOW + 15 * 86_400_000)).toBe(false);
    expect(isResumable(snap(right(right(start))), 'd', 'forward', cards, NOW)).toBe(false);
  });

  it('uses the cards as they are now', () => {
    const edited = [{ ...cards[0], translations: ['яблучко'] }, cards[1]] as typeof cards;
    expect(withCurrentCards(start, edited).cards.a?.translations).toEqual(['яблучко']);
  });

  it('leaving and finishing later stores every word and every answer exactly once', () => {
    const scheduler = createFixedIntervalScheduler();
    // first visit: one word done, the user leaves and it is saved
    const half = right(start);
    const firstSave = unsaved(
      applySessionToProgress(half, [], scheduler, NOW),
      sessionToLogs(half),
      [],
      0,
    );
    expect(firstSave.progress.map((p) => p.cardId)).toEqual([half.events[0]?.cardId]);
    expect(firstSave.logs).toHaveLength(1);
    const left = markSaved(snap(half), NOW);
    expect(left.savedEvents).toBe(1);

    // second visit: the other word, then the end
    const done = right(left.state);
    const secondSave = unsaved(
      applySessionToProgress(done, firstSave.progress, scheduler, NOW),
      sessionToLogs(done),
      left.savedCardIds,
      left.savedEvents,
    );
    expect(secondSave.progress).toHaveLength(1);
    expect(secondSave.progress[0]?.cardId).not.toBe(firstSave.progress[0]?.cardId);
    expect(secondSave.logs).toHaveLength(1);
  });
});
