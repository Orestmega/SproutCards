// Development-only demo data, enabled by opening the app with `?seed` (see main.tsx).
// It is never included in the production build and only runs on an empty database.
import { createFixedIntervalScheduler } from '../core/scheduler';
import { progressId } from '../core/types';
import type { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';

const DAY = 86_400_000;

export async function seedDemoData(db: AppDatabase): Promise<void> {
  const repo = createRepo(db);
  await db.open();
  if ((await repo.listDecks()).length > 0) return;

  const travel = await repo.createDeck({
    name: 'Travel',
    learningLang: 'en',
    translationLang: 'uk',
    description: 'Words for trips',
  });
  const words: [string, string[], string?][] = [
    ['ticket', ['квиток'], 'One ticket, please.'],
    ['train', ['потяг', 'поїзд'], 'The train is late.'],
    ['airport', ['аеропорт']],
    ['luggage', ['багаж']],
    ['passport', ['паспорт'], 'Do not forget your passport.'],
  ];
  const cards = [];
  for (const [term, translations, example] of words) {
    cards.push(
      await repo.addCard(travel.id, {
        term,
        translations,
        examples: example ? [{ text: example }] : [],
      }),
    );
  }
  await repo.addCard(travel.id, { term: 'souvenir', translations: ['сувенір'], reviewed: false });

  const food = await repo.createDeck({ name: 'Food', learningLang: 'en', translationLang: 'uk' });
  await repo.addCard(food.id, { term: 'bread', translations: ['хліб'] });
  await repo.addCard(food.id, { term: 'cheese', translations: ['сир'] });

  // Two cards due now and a few days of history, so the home screen has something to show.
  const scheduler = createFixedIntervalScheduler();
  const now = Date.now();
  const progress = cards.slice(0, 2).map((card) => ({
    ...scheduler.review(undefined, 'correct', now - 2 * DAY),
    id: progressId(card.id, 'forward'),
    cardId: card.id,
    deckId: travel.id,
    direction: 'forward' as const,
    lastReviewedAt: now - 2 * DAY,
  }));
  const first = cards[0];
  if (!first) return;
  // a bit of everything in the garden: a learned word and one on its way
  const grown = cards.slice(2, 4).map((card, i) => ({
    reps: i === 0 ? 6 : 2, // a golden flower and a leaf
    intervalDays: 7,
    lapses: i,
    dueAt: now + (i + 2) * DAY,
    id: progressId(card.id, 'forward'),
    cardId: card.id,
    deckId: travel.id,
    direction: 'forward' as const,
    lastReviewedAt: now - DAY,
  }));
  progress.push(...grown);
  // days of history with gaps, so the activity map has something to show
  const days = [0, 1, 2, 3, 5, 6, 8, 12, 13, 15, 20, 21, 22, 29, 36, 43, 44];
  const logs = days
    .flatMap((daysAgo) => Array.from({ length: 1 + (daysAgo % 5) }, () => daysAgo))
    .map((daysAgo) => ({
      at: now - daysAgo * DAY,
      cardId: first.id,
      deckId: travel.id,
      direction: 'forward' as const,
      mode: 'learn' as const,
      result: 'correct' as const,
    }));
  await repo.saveSession(progress, logs);
}
