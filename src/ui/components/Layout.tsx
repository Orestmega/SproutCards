import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { Mascot } from './Mascot';
import { PwaBanner } from './PwaBanner';

const ICONS = {
  home: 'M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  decks: 'M5 4h12a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2zM9 4v14',
  progress: 'M5 20V12M12 20V5M19 20v-9',
  settings:
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
} as const;

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="nav__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  );
}

/** The name with a small Sprout. */
export function Logo() {
  return (
    <Link to="/" className="logo">
      <Mascot size={34} />
      SproutCards
    </Link>
  );
}

const NAV: { to: string; label: MessageKey; icon: keyof typeof ICONS; end?: boolean }[] = [
  { to: '/', label: 'nav.home', icon: 'home', end: true },
  { to: '/decks', label: 'nav.decks', icon: 'decks' },
  { to: '/stats', label: 'nav.progress', icon: 'progress' },
  { to: '/settings', label: 'nav.settings', icon: 'settings' },
];

/** Page frame with the bottom navigation (hidden on focused screens such as study sessions). */
export function AppLayout() {
  const { t } = useI18n();
  return (
    <div className="app app--shell">
      <main className="app__main" id="main">
        <PwaBanner />
        <Outlet />
      </main>
      <nav className="nav" aria-label={t('nav.label')}>
        <div className="nav__brand">
          <Logo />
        </div>
        <div className="nav__inner">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav__link">
              <span className="nav__pill">
                <NavIcon path={ICONS[item.icon]} />
              </span>
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  backTo,
  actions,
}: {
  title: string;
  backTo?: string;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <header className="page-header">
      {backTo && (
        <Link to={backTo} className="back-link" aria-label={t('common.back')}>
          <span aria-hidden="true">←</span>
        </Link>
      )}
      <h1 className="page-header__title">{title}</h1>
      {actions}
    </header>
  );
}
