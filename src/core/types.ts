// Domain types shared by the pure core, the storage layer and the UI.
// Nothing here depends on React or on browser APIs.

/** BCP 47 language code, e.g. `en`, `uk`, `de`, `pt-BR`. The app never hard-codes a language pair. */
export type LangCode = string;

/**
 * Which side of the card is shown first.
 * `forward`: learning language -> translation. `backward`: translation -> learning language.
 */
export type Direction = 'forward' | 'backward';

/** A card has two sides: the word in the language being learned and its translation(s). */
export type CardSide = 'term' | 'translation';

export interface Example {
  text: string;
  translation?: string;
}

export interface Deck {
  id: string;
  name: string;
  /** Language being learned (language of `Card.term`). */
  learningLang: LangCode;
  /** Language of the translations. */
  translationLang: LangCode;
  description?: string;
  /** Where the content came from (free text, e.g. a source name). */
  source?: string;
  /** Set when the deck was added from the built-in catalog: the catalog entry's id. */
  catalogId?: string;
  createdAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  term: string;
  /** All accepted translations; the first one is the primary one shown to the user. */
  translations: string[];
  examples: Example[];
  notes?: string;
  /** `false` for machine-generated or otherwise unverified content. */
  reviewed: boolean;
  /** Marked by the user as hard or important; "only starred" study uses it. Absent = not starred. */
  starred?: boolean;
  createdAt: number;
}

/**
 * Scheduling state of one card in one direction. Kept free of scheduler-specific meaning so that a
 * different `Scheduler` (SM-2, FSRS) can reuse it; extra numbers go to `extra`.
 */
export interface ScheduleState {
  /** Number of successful reviews in a row (0 after a mistake). */
  reps: number;
  intervalDays: number;
  /** Timestamp (ms) from which the card is due. */
  dueAt: number;
  /** How many times the card was answered wrongly after being scheduled. */
  lapses: number;
  extra?: Record<string, number>;
}

export interface Progress extends ScheduleState {
  /** `${cardId}:${direction}`, see `progressId`. */
  id: string;
  cardId: string;
  deckId: string;
  direction: Direction;
  lastReviewedAt: number;
  /** When the card was first studied in this direction (used for the "new cards per day" limit). */
  firstSeenAt?: number;
}

export function progressId(cardId: string, direction: Direction): string {
  return `${cardId}:${direction}`;
}

export type StudyMode = 'flip' | 'learn' | 'test' | 'match';

/** `almost` = a small typo: shown with the right answer, but not counted as fully correct. */
export type ReviewResult = 'correct' | 'almost' | 'wrong';

export interface ReviewLog {
  id?: number;
  at: number;
  cardId: string;
  deckId: string;
  direction: Direction;
  mode: StudyMode;
  /** Learn level at the time of the answer (Learn mode only). */
  level?: number;
  result: ReviewResult;
}

export type UiLanguage = 'uk' | 'en';

export interface Settings {
  uiLanguage: UiLanguage;
  speechEnabled: boolean;
  newCardsPerDay: number;
  /** When true, `e` and `é` are the same when checking typed answers. */
  ignoreDiacritics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: 'uk',
  speechEnabled: true,
  newCardsPerDay: 10,
  ignoreDiacritics: true,
};
