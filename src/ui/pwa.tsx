import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isNativeApp } from './native';

/** The browser's "install this app" event (Chromium only; not in the TypeScript DOM types). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** Running inside the Android/iOS app: no service worker, no install prompt, files are in the app. */
  native: boolean;
  /** A new version was downloaded and waits to be activated. */
  updateReady: boolean;
  /** The app was cached for the first time just now (shown once as a message). */
  offlineReady: boolean;
  /** A service worker controls the page, so the app starts without a network. */
  offlineActive: boolean;
  /** Service worker could not be registered (unsupported browser, private mode, insecure address). */
  offlineUnavailable: boolean;
  /** The browser offers an install prompt (Chromium). */
  canInstall: boolean;
  /** iPhone/iPad Safari has no install prompt; the user must use "Add to Home Screen". */
  needsIosInstructions: boolean;
  /** Running as an installed app already. */
  installed: boolean;
  /** `true` when the browser promised not to evict the data, `false` when it may, `null` unknown. */
  storagePersistent: boolean | null;
  applyUpdate(): void;
  dismissUpdate(): void;
  dismissOfflineReady(): void;
  install(): Promise<void>;
}

export const INERT_PWA: PwaState = {
  native: false,
  updateReady: false,
  offlineReady: false,
  offlineActive: false,
  offlineUnavailable: false,
  canInstall: false,
  needsIosInstructions: false,
  installed: false,
  storagePersistent: null,
  applyUpdate: () => undefined,
  dismissUpdate: () => undefined,
  dismissOfflineReady: () => undefined,
  install: async () => undefined,
};

export const PwaContext = createContext<PwaState>(INERT_PWA);
export const usePwa = (): PwaState => useContext(PwaContext);

/** iPhone, iPad (including iPadOS, which reports itself as a Mac) and iPod. */
export function isIosDevice(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true
  );
}

/**
 * Registers the service worker and exposes install / update / offline state to the app.
 *
 * Updates are never applied by surprise: a new version waits until the user taps "Update"
 * (the screen reloads then; the data in IndexedDB is untouched by an update).
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineActive, setOfflineActive] = useState(
    () =>
      isNativeApp() ||
      ('serviceWorker' in navigator && navigator.serviceWorker.controller !== null),
  );
  const [offlineUnavailable, setOfflineUnavailable] = useState(
    () => !isNativeApp() && !('serviceWorker' in navigator),
  );
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isNativeApp() || isStandalone());
  const [storagePersistent, setStoragePersistent] = useState<boolean | null>(null);
  const updateSW = useRef<(reload?: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (isNativeApp() || !('serviceWorker' in navigator)) return; // the app already contains its files
    updateSW.current = registerSW({
      onNeedRefresh: () => setUpdateReady(true),
      onOfflineReady: () => {
        setOfflineReady(true);
        setOfflineActive(true);
      },
      onRegisterError: () => setOfflineUnavailable(true),
    });
  }, []);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault(); // keep the event: we show our own button instead of the mini-bar
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Ask the browser not to evict the database when storage is low. Some browsers grant this
  // silently, some only for installed apps, some ask the user; the answer is shown in Settings.
  useEffect(() => {
    const storage = navigator.storage;
    if (isNativeApp() || !storage?.persist) return;
    let cancelled = false;
    storage
      .persisted()
      .then((already) => (already ? true : storage.persist()))
      .then((granted) => !cancelled && setStoragePersistent(granted))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } catch {
      // the browser refused to show the prompt; the user can still install from the browser menu
    }
    setInstallEvent(null); // the event can be used only once
  }, [installEvent]);

  const value = useMemo<PwaState>(
    () => ({
      native: isNativeApp(),
      updateReady,
      offlineReady,
      offlineActive,
      offlineUnavailable,
      canInstall: installEvent !== null && !installed,
      needsIosInstructions:
        !installed &&
        isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
      installed,
      storagePersistent,
      applyUpdate: () => void updateSW.current(true).catch(() => undefined),
      dismissUpdate: () => setUpdateReady(false),
      dismissOfflineReady: () => setOfflineReady(false),
      install,
    }),
    [
      updateReady,
      offlineReady,
      offlineActive,
      offlineUnavailable,
      installEvent,
      installed,
      storagePersistent,
      install,
    ],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
