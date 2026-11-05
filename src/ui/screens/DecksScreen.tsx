import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { DeckCard } from '../components/DeckCard';
import { SearchField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { EmptyState } from '../components/Notice';

/** Below this the list fits on a screen and a search box would only be in the way. */
const SEARCH_FROM = 5;

export function DecksScreen() {
  const { t } = useI18n();
  const repo = useRepo();
  const summaries = useLiveQuery(() => repo.deckSummaries(Date.now()), [repo]);
  const [query, setQuery] = useState('');
  if (!summaries) return null;

  const wanted = query.trim().toLowerCase();
  const shown = summaries.filter((s) => s.deck.name.toLowerCase().includes(wanted));

  return (
    <>
      <PageHeader title={t('decks.title')} />
      {summaries.length === 0 ? (
        <EmptyState title={t('decks.empty.title')} text={t('decks.empty.text')}>
          <ButtonLink to="/catalog">{t('decks.catalog')}</ButtonLink>
          <ButtonLink to="/decks/new" variant="secondary">
            {t('decks.new')}
          </ButtonLink>
          <ButtonLink to="/backup" variant="secondary">
            {t('decks.backup')}
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          <div className="row">
            <ButtonLink to="/decks/new">{t('decks.new')}</ButtonLink>
            <ButtonLink to="/catalog" variant="secondary">
              {t('decks.catalog')}
            </ButtonLink>
          </div>
          {summaries.length >= SEARCH_FROM && (
            <SearchField label={t('decks.search')} value={query} onChange={setQuery} />
          )}
          {shown.length === 0 ? (
            <p className="muted">{t('common.nothingFound')}</p>
          ) : (
            <ul className="deck-grid">
              {shown.map((s) => (
                <DeckCard key={s.deck.id} summary={s} />
              ))}
            </ul>
          )}
          <ButtonLink to="/backup" variant="secondary">
            {t('decks.backup')}
          </ButtonLink>
        </>
      )}
    </>
  );
}
