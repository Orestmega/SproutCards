import { Link } from 'react-router-dom';
import type { DeckSummary } from '../../db/repo';
import { useI18n } from '../../i18n';

/** Compact deck list entry linking to the deck screen. */
export function DeckRow({ summary }: { summary: DeckSummary }) {
  const { tp, languageName } = useI18n();
  const { deck, cardCount, dueCount } = summary;
  return (
    <li>
      <Link to={`/decks/${deck.id}`} className="list-row">
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
        <span aria-hidden="true">›</span>
      </Link>
    </li>
  );
}
