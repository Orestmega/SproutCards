/**
 * The week: a weekly goal (answers) and two challenges that change every week, the same for everyone on
 * the same week. All worked out from the review log and the first time each word was studied, so past
 * weeks can be counted too (each finished challenge earns a flower, see `gardenLife.ts`).
 */

export type ChallengeKind = 'answers' | 'days' | 'newWords' | 'correct' | 'modes';

export interface Challenge {
  kind: ChallengeKind;
  target: number;
}

/** The challenges a week can bring. Two are picked for each week. */
export const CHALLENGE_POOL: readonly Challenge[] = [
  { kind: 'days', target: 4 },
  { kind: 'days', target: 5 },
  { kind: 'newWords', target: 10 },
  { kind: 'newWords', target: 20 },
  { kind: 'correct', target: 80 },
  { kind: 'correct', target: 120 },
  { kind: 'modes', target: 3 },
];

export interface WeekLog {
  at: number;
  result: string;
  mode: string;
}

export interface WeekItem {
  challenge: Challenge;
  /** The weekly goal (always first) or a challenge of the week. */
  goal: boolean;
  value: number;
  done: boolean;
}

export interface WeekState {
  start: number;
  /** The first moment of the next week. */
  end: number;
  items: WeekItem[];
}

const DAY = 86_400_000;

/** Monday 00:00 (local time) of the week containing `time`. */
export function weekStart(time: number): number {
  const d = new Date(time);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function nextWeek(start: number): number {
  return weekStart(start + 8 * DAY);
}

/** A stable number for the week (the same on every device). */
function weekNumber(start: number): number {
  const d = new Date(start);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / (7 * DAY));
}

/** The two challenges of a week: different kinds, picked from the pool by the week's number. */
export function weekChallenges(start: number): Challenge[] {
  const n = weekNumber(start);
  const first = CHALLENGE_POOL[n % CHALLENGE_POOL.length] as Challenge;
  let i = (n * 3 + 1) % CHALLENGE_POOL.length;
  while ((CHALLENGE_POOL[i] as Challenge).kind === first.kind) i = (i + 1) % CHALLENGE_POOL.length;
  return [first, CHALLENGE_POOL[i] as Challenge];
}

function measure(
  kind: ChallengeKind,
  logs: readonly WeekLog[],
  firstSeen: readonly number[],
  start: number,
  end: number,
): number {
  const inWeek = logs.filter((l) => l.at >= start && l.at < end);
  switch (kind) {
    case 'answers':
      return inWeek.length;
    case 'correct':
      return inWeek.filter((l) => l.result === 'correct').length;
    case 'days':
      return new Set(inWeek.map((l) => new Date(l.at).toDateString())).size;
    case 'modes':
      return new Set(inWeek.map((l) => l.mode)).size;
    case 'newWords':
      return firstSeen.filter((t) => t >= start && t < end).length;
  }
}

/**
 * The week of `time`: the weekly goal (`dailyGoal` × 5 answers) and the two challenges, with how far
 * each got. `firstSeen` is, per word, the first time it was studied.
 */
export function weekState(
  logs: readonly WeekLog[],
  firstSeen: readonly number[],
  time: number,
  dailyGoal: number,
): WeekState {
  const start = weekStart(time);
  const end = nextWeek(start);
  const goal: Challenge = { kind: 'answers', target: dailyGoal * 5 };
  const items = [goal, ...weekChallenges(start)].map((challenge, i): WeekItem => {
    const value = measure(challenge.kind, logs, firstSeen, start, end);
    return { challenge, goal: i === 0, value, done: value >= challenge.target };
  });
  return { start, end, items };
}

/** How many weekly goals and challenges were finished, over every week from the first answer to now. */
export function finishedChallenges(
  logs: readonly WeekLog[],
  firstSeen: readonly number[],
  now: number,
  dailyGoal: number,
): number {
  if (logs.length === 0) return 0;
  let first = Infinity;
  for (const l of logs) first = Math.min(first, l.at);
  let total = 0;
  for (let start = weekStart(first); start <= now; start = nextWeek(start)) {
    total += weekState(logs, firstSeen, start, dailyGoal).items.filter((i) => i.done).length;
  }
  return total;
}
