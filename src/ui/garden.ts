// The garden as the screens use it: every word as a plant (with its deck, stage and flower), the
// garden's health, the earned decorations and the watering of the day.
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { evaluateAchievements } from '../core/achievements';
import type { AchievementState } from '../core/achievements';
import { cheatsOf } from '../core/cheats';
import { growthStage, learnedCount } from '../core/garden';
import type { GrowthStage } from '../core/garden';
import {
  decorations,
  GOLDEN_REPS,
  gardenHealth,
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
import { streakState } from '../core/freeze';
import type { StreakState } from '../core/freeze';
import { todayCount } from '../core/habit';
import { finishedChallenges, fullWeeks, weeklyGoalTimes, weekState } from '../core/weekly';
import type { WeekState } from '../core/weekly';
import type { Card, Deck } from '../core/types';
import { useRepo, useSettings } from './AppProviders';

export interface GardenPlant {
  card: Card;
  deck: Deck;
  stage: GrowthStage;
  /** Only meaningful for a bloom. */
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
  /** This week's goal and challenges. */
  week: WeekState;
  /** Days in a row, with the streak freezes earned by weekly goals. */
  streak: StreakState;
}

export function useGarden(now: number): Garden | undefined {
  const repo = useRepo();
  const { dailyGoal, cheats: savedCheats } = useSettings();
  return useLiveQuery(async () => {
    const cheats = cheatsOf(savedCheats);
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
    // the first time each word was studied, for "new words this week"
    const firstSeen = new Map<string, number>();
    for (const p of progress) {
      const at = p.firstSeenAt ?? p.lastReviewedAt;
      firstSeen.set(p.cardId, Math.min(firstSeen.get(p.cardId) ?? Infinity, at));
    }
    const firstTimes = [...firstSeen.values()];
    const week = weekState(logs, firstTimes, now, dailyGoal);
    // each weekly goal reached earns a freeze that saves a missed day
    const streak = streakState(times, weeklyGoalTimes(logs, dailyGoal), now);
    // what earns flowers: learned words, the best streak, long-known words, weekly challenges
    // (plus the bonuses of the cheat panel, which only exist for trying things out)
    const reps = [...best.values()].map((r) => r.reps);
    const facts: RewardFacts = {
      blooms: learnedCount(progress) + cheats.learned,
      bestStreak: streak.best + cheats.streak,
      goldenWords: reps.filter((r) => r >= GOLDEN_REPS).length + cheats.golden,
      challenges: finishedChallenges(logs, firstTimes, now, dailyGoal) + cheats.challenges,
      fullWeeks: fullWeeks(logs, firstTimes, now, dailyGoal) + cheats.weeks,
    };
    const earned = earnedRewards(facts);
    const found = foundKinds(earned);
    const plants = cards.flatMap((card): GardenPlant[] => {
      const deck = deckById.get(card.deckId);
      if (!deck) return [];
      const record = best.get(card.id);
      const stage = growthStage(record?.reps);
      return [
        {
          card,
          deck,
          stage,
          reps: record?.reps ?? 0,
          dueAt: record ? record.dueAt : null,
        },
      ];
    });
    const achievements = evaluateAchievements({
      totalReviews: logs.length + cheats.reviews,
      bestStreak: facts.bestStreak,
      blooms: facts.blooms,
      decks: decks.length + cheats.decks,
      modesUsed: new Set(logs.map((log) => log.mode)).size + cheats.modes,
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
      week,
      streak,
    };
  }, [repo, now, dailyGoal, savedCheats]);
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
