/**
 * The word garden: every word grows from a seed to a bloom as it is reviewed correctly.
 * It is only a way of showing `Progress.reps` (no extra data is stored).
 */

export const GROWTH_STAGES = ['seed', 'sprout', 'leaf', 'bloom'] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

export type GrowthCounts = Record<GrowthStage, number>;

/** Right reviews in a row after which a word blooms. */
export const BLOOM_REPS = 2;

/**
 * Every successful step is visible: never studied = seed; studied but with a mistake = sprout;
 * answered cleanly once = leaf; right again at the next review = bloom.
 */
export function growthStage(reps: number | undefined): GrowthStage {
  if (reps === undefined) return 'seed';
  if (reps >= BLOOM_REPS) return 'bloom';
  return reps >= 1 ? 'leaf' : 'sprout';
}

export type GrowthGain = Record<'sprout' | 'leaf' | 'bloom', number>;

/**
 * What a study session grew: how many words moved UP to each stage. `existing` is the progress before
 * the session, `updated` the records the session wrote (same ids replace the old ones).
 */
export function growthGain(
  existing: readonly { id: string; cardId: string; reps: number }[],
  updated: readonly { id: string; cardId: string; reps: number }[],
): GrowthGain {
  const before = bestRepsByCard(existing);
  const merged = new Map(existing.map((p) => [p.id, p]));
  for (const p of updated) merged.set(p.id, p);
  const after = bestRepsByCard([...merged.values()]);
  const gain: GrowthGain = { sprout: 0, leaf: 0, bloom: 0 };
  for (const cardId of new Set(updated.map((p) => p.cardId))) {
    const from = GROWTH_STAGES.indexOf(growthStage(before.get(cardId)));
    const stage = growthStage(after.get(cardId));
    if (stage !== 'seed' && GROWTH_STAGES.indexOf(stage) > from) gain[stage]++;
  }
  return gain;
}

/** Learned words: studied cleanly at least once in some direction (a leaf or a flower). */
export function learnedCount(progress: readonly { cardId: string; reps: number }[]): number {
  let count = 0;
  for (const reps of bestRepsByCard(progress).values()) if (reps >= 1) count++;
  return count;
}

/** The best number of correct reviews in a row per card: the stronger direction decides. */
export function bestRepsByCard(
  progress: readonly { cardId: string; reps: number }[],
): Map<string, number> {
  const best = new Map<string, number>();
  for (const p of progress) best.set(p.cardId, Math.max(best.get(p.cardId) ?? 0, p.reps));
  return best;
}

export function growthCounts(
  cardIds: readonly string[],
  progress: readonly { cardId: string; reps: number }[],
): GrowthCounts {
  const best = bestRepsByCard(progress);
  const counts: GrowthCounts = { seed: 0, sprout: 0, leaf: 0, bloom: 0 };
  for (const id of cardIds) counts[growthStage(best.get(id))]++;
  return counts;
}

/** 0..1, how grown a deck is: a seed counts 0, a sprout 1/3, a leaf 2/3, a bloom 1. */
export function gardenShare(counts: GrowthCounts): number {
  const total = counts.seed + counts.sprout + counts.leaf + counts.bloom;
  if (total === 0) return 0;
  return (counts.sprout + counts.leaf * 2 + counts.bloom * 3) / (total * 3);
}
