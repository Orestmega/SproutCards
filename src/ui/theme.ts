// Light or dark colours. The choice lives in the settings (IndexedDB); a copy in localStorage lets the
// first paint use the right colours, before the database has opened.
import type { ThemeChoice } from '../core/types';

const STORAGE_KEY = 'sproutcards.theme';
const THEME_COLORS = { light: '#e6f4dd', dark: '#16291d' } as const;

export function rememberedTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function rememberTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // the first paint may use the system colours: harmless
  }
}

function setResolved(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** Applies the colours. With `system` it keeps following the device; returns how to stop that. */
export function applyTheme(choice: ThemeChoice): () => void {
  if (choice !== 'system') {
    setResolved(choice);
    return () => undefined;
  }
  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  const update = () => setResolved(query?.matches ? 'dark' : 'light');
  update();
  query?.addEventListener('change', update);
  return () => query?.removeEventListener('change', update);
}
