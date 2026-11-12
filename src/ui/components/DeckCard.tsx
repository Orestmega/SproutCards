import { deckName } from '../../core/catalog';
import { Link } from 'react-router-dom';
import type { DeckSummary } from '../../db/repo';
import { useI18n } from '../../i18n';
import { GrowthBar } from './GrowthBar';

/** The same deck always gets the same colour (a small hash of its id; see `.deck-avatar--N`). */
function avatarClass(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `deck-avatar deck-avatar--${hash % 6}`;
}

/** The first letter of the name (whole characters, so a letter outside the basic range is not cut). */
function initial(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function DeckAvatar({ id, name }: { id: string; name: string }) {
  return (
    <span className={avatarClass(id)} aria-hidden="true">
      {initial(name)}
    </span>
  );
}

/** A deck in a list: its name, how much is waiting and how far its words have grown. */
export function DeckCard({ summary }: { summary: DeckSummary }) {
  const { t, tp, language, languageName } = useI18n();
  const { deck, cardCount, dueCount, growth } = summary;
  const name = deckName(deck, language);
  return (
    <li>
      <Link to={`/decks/${deck.id}`} className="deck-card">
        <span className="deck-card__top">
          <DeckAvatar id={deck.id} name={name} />
          <span className="list-row__main">
            <span className="deck-card__name">{name}</span>
            <span className="muted">
              {languageName(deck.learningLang)} → {languageName(deck.translationLang)}
            </span>
          </span>
          <span className="chevron" aria-hidden="true">
            ›
          </span>
        </span>
        <GrowthBar growth={growth} />
        <span className="deck-card__foot">
          <span className="muted">
            {tp('count.cards', cardCount)} ·{' '}
            {/* learned: answered cleanly at least once (a leaf or a bush), as in the garden */}
            {t('deck.grown', { learned: growth.leaf + growth.bloom, total: cardCount })}
          </span>
          {dueCount > 0 && <span className="badge">{tp('count.due', dueCount)}</span>}
        </span>
      </Link>
    </li>
  );
}
