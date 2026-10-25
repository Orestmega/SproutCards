import { useLiveQuery } from 'dexie-react-hooks';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { DeckRow } from '../components/DeckRow';
import { PageHeader } from '../components/Layout';
import { EmptyState } from '../components/Notice';

export function DecksScreen() {
  const { t } = useI18n();
  const repo = useRepo();
  const summaries = useLiveQuery(() => repo.deckSummaries(Date.now()), [repo]);
  if (!summaries) return null;

  return (
    <>
      <PageHeader title={t('decks.title')} />
      {summaries.length === 0 ? (
        <EmptyState title={t('decks.empty.title')} text={t('decks.empty.text')}>
          <ButtonLink to="/decks/new">{t('decks.new')}</ButtonLink>
          <ButtonLink to="/backup" variant="secondary">
            {t('decks.backup')}
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          <ul className="list">
            {summaries.map((s) => (
              <DeckRow key={s.deck.id} summary={s} />
            ))}
          </ul>
          <div className="row">
            <ButtonLink to="/decks/new">{t('decks.new')}</ButtonLink>
            <ButtonLink to="/backup" variant="secondary">
              {t('decks.backup')}
            </ButtonLink>
          </div>
        </>
      )}
    </>
  );
}
