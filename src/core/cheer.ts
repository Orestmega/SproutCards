/**
 * How Sprout (the mascot) reacts while you study: its mood after an answer, the "in a row" combo,
 * the mood for a final score and the greeting for the time of day. Pure rules, no React, no browser.
 */

export type MascotMood = 'normal' | 'happy' | 'encouraging' | 'thinking' | 'oops' | 'celebrate';

export type AnswerOutcome = 'correct' | 'almost' | 'wrong';

export interface Reaction {
  mood: MascotMood;
  /** Correct answers in a row after this answer. */
  combo: number;
  /** True when the combo has just reached a number worth cheering about (3, 5, 10, 15, ...). */
  milestone: boolean;
}

/** 3 in a row, then 5, then every 5 more. */
export function isComboMilestone(combo: number): boolean {
  return combo === 3 || (combo >= 5 && combo % 5 === 0);
}

/**
 * The combo after one more answer: a correct answer adds one, a wrong one (or "I don't know") resets it.
 * "Almost" (a small typo) neither adds nor resets: the word was known.
 */
export function nextCombo(combo: number, outcome: AnswerOutcome): number {
  if (outcome === 'correct') return combo + 1;
  if (outcome === 'almost') return combo;
  return 0;
}

/**
 * Sprout's reaction to one answer. `skipped` is "I don't know": honest, so Sprout encourages instead of
 * looking upset.
 */
export function reactTo(combo: number, outcome: AnswerOutcome, skipped = false): Reaction {
  const next = nextCombo(combo, outcome);
  const milestone = outcome === 'correct' && isComboMilestone(next);
  let mood: MascotMood;
  if (outcome === 'correct') mood = milestone ? 'celebrate' : 'happy';
  else if (outcome === 'almost' || skipped) mood = 'encouraging';
  else mood = 'oops';
  return { mood, combo: next, milestone };
}

/** The share of a score from which the result screen celebrates (with confetti). */
export const CELEBRATE_FROM = 0.9;

/** Mood for a final score (0..1). A low score is met with encouragement, never with a sad face. */
export function moodForScore(score: number): MascotMood {
  if (score >= CELEBRATE_FROM) return 'celebrate';
  if (score >= 0.7) return 'happy';
  return 'encouraging';
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** Part of the day for a local hour (0..23): morning 5–11, afternoon 12–16, evening 17–22, night otherwise. */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'night';
}

/** The next line of a list of `count` lines, going round (a tap on Sprout shows the next one). */
export function nextLine(current: number, count: number): number {
  if (count <= 0) return 0;
  return (current + 1) % count;
}
