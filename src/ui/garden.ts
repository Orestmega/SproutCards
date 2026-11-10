// The garden as the screens use it: every word as a plant (with its deck, stage and flower), the
// garden's health, the earned decorations and the watering of the day.
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { evaluateAchievements } from '../core/achievements';
import type { AchievementState } from '../core/achievements';
import { growthStage } from '../core/garden';
import type { GrowthStage } from '../core/garden';
import {
  decorations,
  flowerVariety,
  GOLDEN_REPS,
  gardenHealth,
  rarityOf,
  earnedRewards,
  foundKinds,
  wateringDay,
} from '../core/gardenLife';
import type {
  DecorationState,
  GardenHealth,
  Reward,
  RewardFacts,
  VarietyId,
} from '../core/gardenLife';
import { bestStreak, todayCount } from '../core/habit';
import type { Card, Deck } from '../core/types';
import { useRepo } from './AppProviders';

export interface GardenPlant {
  card: Card;
  deck: Deck;
  stage: GrowthStage;
  /** Only meaningful for a bloom. */
  variety: VarietyId;
  /** Drawing order: golden flowers, then rare ones, then the rest. */
  rank: number;
  reps: number;
  /** When the card is due next (the earlier direction), if it was studied. */
  dueAt: number | null;
}

export interface Garden {
  decks: Deck[];
  plants: GardenPlant[];
  times: number[];
  health: GardenHealth;
  answersToday: number;
  achievements: AchievementState[];
  decorations: DecorationState[];
  /** What earns flowers; the flowers earned (one per reward); the kinds found among them. */
  facts: RewardFacts;
  earned: Reward[];
  found: VarietyId[];
}

const RANK = { golden: 2, rare: 1, common: 0 } as const;

export function useGarden(now: number): Garden | undefined {
  const repo = useRepo();
  return useLiveQuery(async () => {
    const { decks, cards, progress, logs } = await repo.gardenSnapshot();
    const deckById = new Map(decks.map((d) => [d.id, d]));
    const best = new Map<string, { reps: number; dueAt: number }>();
    for (const p of progress) {
      const seen = best.get(p.cardId);
      best.set(p.cardId, {
        reps: Math.max(seen?.reps ?? 0, p.reps),
        dueAt: Math.min(seen?.dueAt ?? Infinity, p.dueAt),
      });
    }
    const times = logs.map((log) => log.at);
    // the kinds of flower open now depend on learned words, the best streak and long-known words
    const reps = [...best.values()].map((r) => r.reps);
    const facts: RewardFacts = {
      blooms: reps.filter((r) => growthStage(r) === 'bloom').length,
      bestStreak: bestStreak(times),
      goldenWords: reps.filter((r) => r >= GOLDEN_REPS).length,
    };
    const earned = earnedRewards(facts);
    const found = foundKinds(earned);
    const plants = cards.flatMap((card): GardenPlant[] => {
      const deck = deckById.get(card.deckId);
      if (!deck) return [];
      const record = best.get(card.id);
      const stage = growthStage(record?.reps);
      const variety = flowerVariety(card.id, record?.reps ?? 0, found);
      return [
        {
          card,
          deck,
          stage,
          variety,
          rank: stage === 'bloom' ? RANK[rarityOf(variety)] : 0,
          reps: record?.reps ?? 0,
          dueAt: record ? record.dueAt : null,
        },
      ];
    });
    const achievements = evaluateAchievements({
      totalReviews: logs.length,
      bestStreak: facts.bestStreak,
      blooms: plants.filter((p) => p.stage === 'bloom').length,
      decks: decks.length,
      modesUsed: new Set(logs.map((log) => log.mode)).size,
    });
    return {
      decks,
      plants,
      times,
      health: gardenHealth(times, now),
      answersToday: todayCount(times, now),
      achievements,
      decorations: decorations(achievements),
      facts,
      earned,
      found,
    };
  }, [repo, now]);
}

const WATERED_KEY = 'sproutcards.watered';

function readWatered(): number | null {
  try {
    const value = Number(localStorage.getItem(WATERED_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * The day the garden was last watered on this device. It is only a small ritual (the progress itself
 * is in the database), so it lives in localStorage and nothing breaks if storage is unavailable.
 */
export function useWatering(): [number | null, (now: number) => void] {
  const [day, setDay] = useState<number | null>(readWatered);
  const water = useCallback((now: number) => {
    const today = wateringDay(now);
    setDay(today);
    try {
      localStorage.setItem(WATERED_KEY, String(today));
    } catch {
      // the rain still falls; tomorrow the button is back anyway
    }
  }, []);
  return [day, water];
}
