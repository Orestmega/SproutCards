import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { BackupScreen } from './screens/BackupScreen';
import { CardFormScreen } from './screens/CardFormScreen';
import { DeckFormScreen } from './screens/DeckFormScreen';
import { DeckScreen } from './screens/DeckScreen';
import { DecksScreen } from './screens/DecksScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { FlipScreen } from './study/FlipScreen';
import { LearnScreen } from './study/LearnScreen';
import { QuizScreen } from './study/QuizScreen';
import { StudyLayout } from './study/StudyLayout';

/** All screens. The router itself (hash or memory) is chosen by the caller. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeScreen />} />
        <Route path="decks" element={<DecksScreen />} />
        <Route path="decks/new" element={<DeckFormScreen />} />
        <Route path="decks/:deckId" element={<DeckScreen />} />
        <Route path="decks/:deckId/edit" element={<DeckFormScreen />} />
        <Route path="decks/:deckId/cards/new" element={<CardFormScreen />} />
        <Route path="decks/:deckId/cards/:cardId" element={<CardFormScreen />} />
        <Route path="backup" element={<BackupScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
      {/* study screens have their own frame: progress bar on top, no bottom navigation */}
      <Route element={<StudyLayout />}>
        <Route path="decks/:deckId/learn" element={<LearnScreen />} />
        <Route path="decks/:deckId/flip" element={<FlipScreen />} />
        <Route path="decks/:deckId/test" element={<QuizScreen />} />
      </Route>
    </Routes>
  );
}
