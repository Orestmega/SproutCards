import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { useSettings } from '../AppProviders';
import { useCatalogNames } from '../catalogNames';
import { Avatar } from './Avatar';
import { Mascot } from './Mascot';
import { PwaBanner } from './PwaBanner';

type NavIconName = 'home' | 'decks' | 'garden' | 'progress' | 'settings';

/**
 * The tab icons (the owner's design, design/feedback/nav-demo.html). Each moving part has its own class;
 * the parts come alive when their tab is opened (see "Tab icons" in components.css).
 */
function IconParts({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      // the two halves are drawn from the roof's peak down to the door
      return (
        <g className="home">
          <path
            className="home__fill"
            d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"
          />
          <path className="home__half" pathLength={1} d="M12 4 4 11v9a1 1 0 0 0 1 1h4v-6h3" />
          <path className="home__half" pathLength={1} d="M12 4l8 7v9a1 1 0 0 1-1 1h-4v-6h-3" />
        </g>
      );
    case 'decks':
      // the cover opens to the left and shows the page under it
      return (
        <g className="book">
          <path d="M7 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7z" />
          <path className="book__page" strokeWidth="1.6" d="M10.5 9h4M10.5 12.5h4M10.5 16h2.5" />
          <g className="book__cover">
            <path className="book__face" d="M7 4h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7z" />
            <path strokeWidth="1.6" d="M10.5 9h4M10.5 12.5h4M10.5 16h2.5" />
          </g>
        </g>
      );
    case 'garden':
      return (
        <>
          <path d="M6 21h12" />
          <path className="g__stem" d="M12 21v-11" />
          <path className="g__l" d="M12 16c-3 0-5-2-5-5 3 0 5 2 5 5z" />
          <path className="g__r" d="M12 14c0-3 2-5 5-5 0 3-2 5-5 5z" />
          <g className="g__flower">
            <circle cx="12" cy="6.5" r="2.6" />
          </g>
        </>
      );
    case 'progress':
      return (
        <>
          <path className="p__bar" d="M5 20V12" />
          <path className="p__bar" d="M12 20V5" />
          <path className="p__bar" d="M19 20v-9" />
        </>
      );
    case 'settings':
      return (
        <g className="s__all">
          <circle className="s__core" cx="12" cy="12" r="3.5" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
        </g>
      );
  }
}

function NavIcon({ name }: { name: NavIconName }) {
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
      <IconParts name={name} />
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
  icon: NavIconName;
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
  useCatalogNames();
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
                <NavIcon name={item.icon} />
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
