/**
 * How the garden is laid out, whatever languages are learned: one field per language being learned,
 * one bed per deck in it. A bed shows only the words that already grow; words not studied yet are
 * counted as a bag of seeds, so a deck of a thousand new words is still one small bag, not a thousand
 * plants on the screen.
 */
import type { GrowthStage } from './garden';

export interface BedPlant {
  stage: GrowthStage;
  /** Higher is shown first (a golden flower before a common one). */
  rank: number;
  deck: { id: string; name: string; learningLang: string };
}

export interface Bed<P extends BedPlant> {
  deckId: string;
  deckName: string;
  /** Sprouts, leaves and flowers, most grown first. */
  growing: P[];
  seeds: number;
  blooms: number;
}

export interface Field<P extends BedPlant> {
  /** BCP 47 code of the language being learned. */
  lang: string;
  beds: Bed<P>[];
  growing: number;
  seeds: number;
  blooms: number;
}

const ORDER: Record<GrowthStage, number> = { bloom: 3, leaf: 2, sprout: 1, seed: 0 };

/** Fields sorted by how much grows in them, beds in the same way; decks with no words are left out. */
export function gardenFields<P extends BedPlant>(plants: readonly P[]): Field<P>[] {
  const byLang = new Map<string, Map<string, P[]>>();
  for (const plant of plants) {
    const decks = byLang.get(plant.deck.learningLang) ?? new Map<string, P[]>();
    byLang.set(plant.deck.learningLang, decks);
    const list = decks.get(plant.deck.id) ?? [];
    list.push(plant);
    decks.set(plant.deck.id, list);
  }
  const fields = [...byLang].map(([lang, decks]): Field<P> => {
    const beds = [...decks.values()].map((list): Bed<P> => {
      const growing = list
        .filter((p) => p.stage !== 'seed')
        .sort((a, b) => ORDER[b.stage] - ORDER[a.stage] || b.rank - a.rank);
      const first = list[0] as P;
      return {
        deckId: first.deck.id,
        deckName: first.deck.name,
        growing,
        seeds: list.length - growing.length,
        blooms: list.filter((p) => p.stage === 'bloom').length,
      };
    });
    beds.sort(
      (a, b) => b.growing.length - a.growing.length || a.deckName.localeCompare(b.deckName),
    );
    return {
      lang,
      beds,
      growing: beds.reduce((sum, b) => sum + b.growing.length, 0),
      seeds: beds.reduce((sum, b) => sum + b.seeds, 0),
      blooms: beds.reduce((sum, b) => sum + b.blooms, 0),
    };
  });
  return fields.sort((a, b) => b.growing - a.growing || a.lang.localeCompare(b.lang));
}
