// Helpers for tests only.
import type { Card } from './types';

let counter = 0;

export function makeCard(
  term: string,
  translations: string | string[],
  extra: Partial<Card> = {},
): Card {
  counter++;
  return {
    id: extra.id ?? `c${counter}`,
    deckId: 'd1',
    term,
    translations: Array.isArray(translations) ? translations : [translations],
    examples: [],
    reviewed: true,
    createdAt: 1_000 + counter,
    ...extra,
  };
}

/** A small English -> Ukrainian deck. */
export function sampleCards(): Card[] {
  return [
    makeCard('apple', 'яблуко', { id: 'apple' }),
    makeCard('house', ['будинок', 'дім'], { id: 'house' }),
    makeCard('water', 'вода', { id: 'water' }),
    makeCard('book', 'книга', { id: 'book' }),
    makeCard('cat', 'кіт', { id: 'cat' }),
  ];
}
