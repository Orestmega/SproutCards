import { Link } from 'react-router-dom';
import type { DeckSummary } from '../../db/repo';
import { useI18n } from '../../i18n';

/** Soft colours for the deck letter squares (dark text on all of them is above 10:1). */
const AVATAR_COLORS = ['#dff1d4', '#e3effc', '#ffeadb', '#f3e8fd', '#fdf3c9', '#dcf3f0'];

/** The same deck always gets the same colour (a small hash of its id). */
function avatarColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? '#dff1d4';
}

/** The first letter of the name (whole characters, so a letter outside the basic range is not cut). */
function initial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

/** Compact deck list entry linking to the deck screen. */
export function DeckRow({ summary }: { summary: DeckSummary }) {
  const { tp, languageName } = useI18n();
  const { deck, cardCount, dueCount } = summary;
  return (
    <li>
      <Link to={`/decks/${deck.id}`} className="list-row">
        <span
          className="deck-avatar"
          style={{ background: avatarColor(deck.id) }}
          aria-hidden="true"
        >
          {initial(deck.name)}
        </span>
        <span className="list-row__main">
          <span className="list-row__head">
            <span className="list-row__title">{deck.name}</span>
            {dueCount > 0 && <span className="badge">{tp('count.due', dueCount)}</span>}
          </span>
          <span className="muted">
            {languageName(deck.learningLang)} → {languageName(deck.translationLang)} ·{' '}
            {tp('count.cards', cardCount)}
          </span>
        </span>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  );
}
