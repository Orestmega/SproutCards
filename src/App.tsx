import { HashRouter } from 'react-router-dom';
import { getDb } from './db/db';
import type { AppDatabase } from './db/db';
import { AppProviders } from './ui/AppProviders';
import { AppRoutes } from './ui/routes';

/**
 * The whole app. A hash router is used on purpose: the app is a static site that must work offline
 * and on any static host without server-side rewrites (`/#/decks/...`).
 */
export function App({ db = getDb() }: { db?: AppDatabase }) {
  return (
    <AppProviders db={db}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProviders>
  );
}
