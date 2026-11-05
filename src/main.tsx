import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, rememberedTheme } from './ui/theme';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/study.css';
import './styles/mascot.css';

applyTheme(rememberedTheme()); // before the first paint, so a dark device never flashes white

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// Demo data for screenshots and manual testing: `npm run dev`, then open `/?seed`. Removed from builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('seed')) {
  const [{ seedDemoData }, { getDb }] = await Promise.all([
    import('./dev/seed'),
    import('./db/db'),
  ]);
  await seedDemoData(getDb());
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
