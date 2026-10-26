import { createContext, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { ProgressBar } from '../components/ProgressBar';

interface StudyChrome {
  /** Progress bar value (0..1); set by the active screen. */
  setProgress: (value: number) => void;
  /** Close button handler; set by the active screen (it may need to save first). */
  setOnClose: (handler: (() => void) | null) => void;
}

const ChromeContext = createContext<StudyChrome | null>(null);

export function useStudyChrome(): StudyChrome {
  const value = useContext(ChromeContext);
  if (!value) throw new Error('useStudyChrome must be used inside <StudyLayout>');
  return value;
}

/** Focused frame for study screens: progress bar on top, a close button, no bottom navigation. */
export function StudyLayout() {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [onClose, setOnClose] = useState<(() => void) | null>(null);

  // Stable object: screens list it in effect dependencies, a new one every render would loop.
  const chrome = useMemo<StudyChrome>(
    () => ({
      setProgress,
      // wrap in a function: `setState(fn)` would call `fn` as an updater
      setOnClose: (handler) => setOnClose(() => handler),
    }),
    [],
  );

  return (
    <ChromeContext.Provider value={chrome}>
      <div className="app study">
        <header className="study__top">
          <ProgressBar value={progress} label={t('study.progress')} top />
          <div className="study__bar">
            <button
              type="button"
              className="icon-btn"
              aria-label={t('study.close')}
              onClick={() => onClose?.()}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </header>
        <main className="app__main" id="main">
          <Outlet />
        </main>
      </div>
    </ChromeContext.Provider>
  );
}
