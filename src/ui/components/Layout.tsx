import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useSettings } from '../AppProviders';
import { Avatar } from './Avatar';
import { Mascot } from './Mascot';
import { PwaBanner } from './PwaBanner';

/** One path per moving part: the book has two pages, the chart three bars (see the tab animations). */
const ICONS: Record<string, string | string[]> = {
  home: 'M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  decks: [
    'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5',
    'M12 6.5c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5',
    'M12 6.5v13',
  ],
  progress: ['M5 20V12', 'M12 20V5', 'M19 20v-9'],
  garden:
    'M12 21v-8M12 13c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c0-3 2-5 5-5 0 3-2 5-5 5zM12 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 21h12',
  settings:
    'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
};

function NavIcon({ path, name }: { path: string | string[]; name: string }) {
  return (
    <svg
      className={`nav__icon nav__icon--${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {(Array.isArray(path) ? path : [path]).map((d, i) => (
        <path key={d} className={`nav__part nav__part--${i + 1}`} d={d} />
      ))}
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

const NAV: {
  to: string;
  label: MessageKey;
  icon: 'home' | 'decks' | 'garden' | 'progress' | 'settings';
  end?: boolean;
}[] = [
  { to: '/', label: 'nav.home', icon: 'home', end: true },
  { to: '/decks', label: 'nav.decks', icon: 'decks' },
  { to: '/garden', label: 'nav.garden', icon: 'garden' },
  { to: '/stats', label: 'nav.progress', icon: 'progress' },
  { to: '/settings', label: 'nav.settings', icon: 'settings' },
];

/** Page frame with the bottom navigation (hidden on focused screens such as study sessions). */
export function AppLayout() {
  const { t } = useI18n();
  const settings = useSettings();
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
                <NavIcon path={ICONS[item.icon] ?? ''} name={item.icon} />
              </span>
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </div>
        {/* big screens only: the profile at the bottom of the side panel */}
        <NavLink to="/profile" className="nav__link nav__profile">
          <Avatar avatar={settings.avatar} size={32} />
          <span>{settings.profileName || t('nav.profile')}</span>
        </NavLink>
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
