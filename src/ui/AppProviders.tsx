import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS } from '../core/types';
import type { Settings, UiLanguage } from '../core/types';
import type { AppDatabase } from '../db/db';
import { createRepo } from '../db/repo';
import type { Repo } from '../db/repo';
import { I18nProvider, useI18n } from '../i18n';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Mascot } from './components/Mascot';

/** Interface language guessed from the browser, used until the user chooses one. */
export function detectUiLanguage(browserLanguage: string | undefined): UiLanguage {
  return browserLanguage?.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

interface AppContextValue {
  db: AppDatabase;
  repo: Repo;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProviders>');
  return value;
}

export const useRepo = (): Repo => useApp().repo;
export const useSettings = (): Settings => useApp().settings;

type OpenState = 'opening' | 'ready' | 'failed';

/**
 * Opens the database, loads the settings and provides both (and the interface language) to the app.
 * If storage is unavailable (blocked, private mode, quota) it shows an explanation instead of a
 * broken app.
 */
export function AppProviders({ db, children }: { db: AppDatabase; children: ReactNode }) {
  const repo = useMemo(() => createRepo(db), [db]);
  const [openState, setOpenState] = useState<OpenState>('opening');
  const browserLanguage = detectUiLanguage(
    typeof navigator === 'undefined' ? undefined : navigator.language,
  );

  useEffect(() => {
    let cancelled = false;
    db.open().then(
      () => !cancelled && setOpenState('ready'),
      () => !cancelled && setOpenState('failed'),
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  const defaults = useMemo<Settings>(
    () => ({ ...DEFAULT_SETTINGS, uiLanguage: browserLanguage }),
    [browserLanguage],
  );
  const settings = useLiveQuery(
    () => (openState === 'ready' ? repo.getSettings(defaults) : undefined),
    [repo, openState, defaults],
  );

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await repo.saveSettings({ ...(await repo.getSettings(defaults)), ...patch });
    },
    [repo, defaults],
  );

  useEffect(() => {
    document.documentElement.lang = settings?.uiLanguage ?? browserLanguage;
  }, [settings?.uiLanguage, browserLanguage]);

  if (openState === 'failed') {
    return (
      <I18nProvider language={browserLanguage}>
        <StorageError />
      </I18nProvider>
    );
  }
  if (!settings) return null; // a few milliseconds while IndexedDB opens

  return (
    <AppContext.Provider value={{ db, repo, settings, updateSettings }}>
      <I18nProvider language={settings.uiLanguage}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </I18nProvider>
    </AppContext.Provider>
  );
}

function StorageError() {
  const { t } = useI18n();
  return (
    <div className="app__main" role="alert">
      <div className="empty">
        <Mascot mood="encouraging" size={104} />
        <h1>{t('error.storage.title')}</h1>
        <p className="muted">{t('error.storage.text')}</p>
      </div>
    </div>
  );
}
