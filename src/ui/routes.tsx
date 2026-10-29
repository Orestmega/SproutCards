import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { CardFormScreen } from './screens/CardFormScreen';
import { DeckFormScreen } from './screens/DeckFormScreen';
import { DeckScreen } from './screens/DeckScreen';
import { DecksScreen } from './screens/DecksScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StudyLayout } from './study/StudyLayout';

// Screens used less often (study sessions, catalog, statistics, backup) load on first visit, which
// keeps the first load small. They are still cached for offline use by the service worker.
const BackupScreen = lazy(() =>
  import('./screens/BackupScreen').then((m) => ({ default: m.BackupScreen })),
);
const CatalogScreen = lazy(() =>
  import('./screens/CatalogScreen').then((m) => ({ default: m.CatalogScreen })),
);
const SourcesScreen = lazy(() =>
  import('./screens/SourcesScreen').then((m) => ({ default: m.SourcesScreen })),
);
const StatsScreen = lazy(() =>
  import('./screens/StatsScreen').then((m) => ({ default: m.StatsScreen })),
);
const FlipScreen = lazy(() =>
  import('./study/FlipScreen').then((m) => ({ default: m.FlipScreen })),
);
const LearnScreen = lazy(() =>
  import('./study/LearnScreen').then((m) => ({ default: m.LearnScreen })),
);
const MatchScreen = lazy(() =>
  import('./study/MatchScreen').then((m) => ({ default: m.MatchScreen })),
);
const QuizScreen = lazy(() =>
  import('./study/QuizScreen').then((m) => ({ default: m.QuizScreen })),
);

/** All screens. The router itself (hash or memory) is chosen by the caller. */
export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomeScreen />} />
          <Route path="decks" element={<DecksScreen />} />
          <Route path="decks/new" element={<DeckFormScreen />} />
          <Route path="decks/:deckId" element={<DeckScreen />} />
          <Route path="decks/:deckId/edit" element={<DeckFormScreen />} />
          <Route path="decks/:deckId/cards/new" element={<CardFormScreen />} />
          <Route path="decks/:deckId/cards/:cardId" element={<CardFormScreen />} />
          <Route path="catalog" element={<CatalogScreen />} />
          <Route path="stats" element={<StatsScreen />} />
          <Route path="sources" element={<SourcesScreen />} />
          <Route path="backup" element={<BackupScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
        {/* study screens have their own frame: progress bar on top, no bottom navigation */}
        <Route element={<StudyLayout />}>
          <Route path="decks/:deckId/learn" element={<LearnScreen />} />
          <Route path="decks/:deckId/flip" element={<FlipScreen />} />
          <Route path="decks/:deckId/test" element={<QuizScreen />} />
          <Route path="decks/:deckId/match" element={<MatchScreen />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
