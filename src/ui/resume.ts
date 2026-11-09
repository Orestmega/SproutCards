// Snapshots of unfinished Learn sessions, one per deck and direction. They live in localStorage: a
// convenience of this device (the words finished so far are saved in the database when leaving).
import type { LearnSnapshot } from '../core/resume';
import type { Direction } from '../core/types';

const PREFIX = 'sproutcards.learn.';

const key = (deckId: string, direction: Direction) => `${PREFIX}${deckId}.${direction}`;

function parse(text: string | null): LearnSnapshot | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as LearnSnapshot;
    return value && value.version === 1 && value.state ? value : null;
  } catch {
    return null;
  }
}

export function readSnapshot(deckId: string, direction: Direction): LearnSnapshot | null {
  try {
    return parse(localStorage.getItem(key(deckId, direction)));
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: LearnSnapshot): void {
  try {
    localStorage.setItem(key(snapshot.deckId, snapshot.direction), JSON.stringify(snapshot));
  } catch {
    // full or blocked storage: the session simply cannot be continued later
  }
}

export function clearSnapshot(deckId: string, direction: Direction): void {
  try {
    localStorage.removeItem(key(deckId, direction));
  } catch {
    // nothing to do
  }
}

/** Every unfinished session on this device, the latest first. */
export function listSnapshots(): LearnSnapshot[] {
  const found: LearnSnapshot[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i);
      if (!name?.startsWith(PREFIX)) continue;
      const snapshot = parse(localStorage.getItem(name));
      if (snapshot && snapshot.state.current !== null) found.push(snapshot);
    }
  } catch {
    return [];
  }
  return found.sort((a, b) => b.savedAt - a.savedAt);
}
