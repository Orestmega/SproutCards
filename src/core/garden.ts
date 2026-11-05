/**
 * The word garden: every word grows from a seed to a bloom as it is reviewed correctly.
 * It is only a way of showing `Progress.reps` (no extra data is stored).
 */
import { LEARNED_REPS } from './stats';

export const GROWTH_STAGES = ['seed', 'sprout', 'leaf', 'bloom'] as const;
export type GrowthStage = (typeof GROWTH_STAGES)[number];

export type GrowthCounts = Record<GrowthStage, number>;

/** `undefined` reps: never studied. A bloom is a learned word (see `LEARNED_REPS`). */
export function growthStage(reps: number | undefined): GrowthStage {
  if (reps === undefined) return 'seed';
  if (reps >= LEARNED_REPS) return 'bloom';
  return reps >= 2 ? 'leaf' : 'sprout';
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

/**
 * What stands on the `slots` plots of the garden picture: most grown first, each stage in proportion to
 * its share of the words (a stage that exists gets at least one plot while there is room).
 */
export function gardenPlots(counts: GrowthCounts, slots: number): GrowthStage[] {
  const total = GROWTH_STAGES.reduce((sum, stage) => sum + counts[stage], 0);
  if (total === 0) return [];
  const plots: GrowthStage[] = [];
  const stages = [...GROWTH_STAGES].reverse();
  const size = Math.min(slots, total);
  stages.forEach((stage, i) => {
    if (counts[stage] === 0) return;
    const later = stages.slice(i + 1).filter((s) => counts[s] > 0).length;
    const room = size - plots.length - later; // keep a plot for each stage still to come
    const share = Math.max(1, Math.round((counts[stage] / total) * size));
    for (let n = Math.min(share, room); n > 0; n--) plots.push(stage);
  });
  return plots;
}

/** 0..1, how grown a deck is: a seed counts 0, a sprout 1/3, a leaf 2/3, a bloom 1. */
export function gardenShare(counts: GrowthCounts): number {
  const total = counts.seed + counts.sprout + counts.leaf + counts.bloom;
  if (total === 0) return 0;
  return (counts.sprout + counts.leaf * 2 + counts.bloom * 3) / (total * 3);
}
