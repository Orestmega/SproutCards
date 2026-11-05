import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cardsToCsv, parseCsvCards } from '../../core/csv';
import type { ImportIssue } from '../../core/exchange';
import { bestRepsByCard, growthCounts, growthStage } from '../../core/garden';
import { serializeDeck } from '../../core/exchange';
import { newId } from '../../core/id';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { Button, ButtonLink } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DeckAvatar } from '../components/DeckCard';
import { SearchField } from '../components/Fields';
import { GrowthBar, GrowthLegend } from '../components/GrowthBar';
import { IssueList } from '../components/IssueList';
import { PageHeader } from '../components/Layout';
import { Plant } from '../components/Plant';
import { StarButton } from '../components/StarButton';
import { EmptyState, Notice } from '../components/Notice';
import { downloadText, readTextFile, safeFileName } from '../files';
import { StudyPanel } from '../study/StudyPanel';
import { NotFoundScreen } from './NotFoundScreen';

type CardFilter = 'all' | 'starred' | 'hard';
/** Below this a list fits on a screen: no search box. */
const SEARCH_FROM = 8;

type Message =
  { kind: 'success'; text: string } | { kind: 'error'; text: string; issues?: ImportIssue[] };

export function DeckScreen() {
  const { deckId = '' } = useParams();
  const { t, tp, languageName } = useI18n();
  const repo = useRepo();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const deck = useLiveQuery(async () => (await repo.getDeck(deckId)) ?? null, [repo, deckId]);
  const cards = useLiveQuery(() => repo.listCards(deckId), [repo, deckId]);
  const progress = useLiveQuery(() => repo.listProgress(deckId), [repo, deckId]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CardFilter>('all');
  const bestReps = useMemo(() => bestRepsByCard(progress ?? []), [progress]);
  const hardIds = useMemo(
    () => new Set((progress ?? []).filter((p) => p.lapses > 0).map((p) => p.cardId)),
    [progress],
  );
  if (deck === undefined || cards === undefined || progress === undefined) return null; // loading
  if (deck === null) return <NotFoundScreen />;

  const growth = growthCounts(
    cards.map((c) => c.id),
    progress,
  );
  const starredCount = cards.filter((c) => c.starred).length;
  const wanted = query.trim().toLowerCase();
  const shown = cards.filter((card) => {
    if (filter === 'starred' && !card.starred) return false;
    if (filter === 'hard' && !hardIds.has(card.id)) return false;
    return (
      wanted === '' ||
      card.term.toLowerCase().includes(wanted) ||
      card.translations.some((text) => text.toLowerCase().includes(wanted))
    );
  });

  async function exportJson() {
    try {
      const bundle = await repo.exportDeck(deckId);
      await downloadText(
        `${safeFileName(bundle.deck.name)}.json`,
        serializeDeck(bundle),
        'application/json',
      );
    } catch {
      setMessage({ kind: 'error', text: t('common.exportFailed') });
    }
  }

  async function exportCsv() {
    if (!deck || !cards) return;
    try {
      await downloadText(`${safeFileName(deck.name)}.csv`, cardsToCsv(cards), 'text/csv');
    } catch {
      setMessage({ kind: 'error', text: t('common.exportFailed') });
    }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    const read = await readTextFile(file);
    if (!read.ok) {
      setMessage({
        kind: 'error',
        text: t(read.reason === 'too_large' ? 'backup.tooLarge' : 'backup.unreadable'),
      });
      return;
    }
    const parsed = parseCsvCards(read.text, deckId, newId, Date.now());
    if (!parsed.ok) {
      setMessage({ kind: 'error', text: t('deck.csvRefused'), issues: parsed.errors });
      return;
    }
    try {
      await repo.addCards(deckId, parsed.value);
      setMessage({ kind: 'success', text: tp('deck.csvAdded', parsed.value.length) });
    } catch {
      setMessage({ kind: 'error', text: t('common.saveFailed') });
    }
  }

  async function removeDeck() {
    try {
      await repo.deleteDeck(deckId);
      navigate('/decks', { replace: true });
    } catch {
      setConfirmDelete(false);
      setMessage({ kind: 'error', text: t('common.deleteFailed') });
    }
  }

  return (
    <>
      <PageHeader title={deck.name} backTo="/decks" />
      <div className="card deck-head">
        <div className="deck-head__top">
          <DeckAvatar id={deck.id} name={deck.name} />
          <div className="list-row__main">
            <span className="muted">
              {languageName(deck.learningLang)} → {languageName(deck.translationLang)} ·{' '}
              {tp('count.cards', cards.length)}
            </span>
            {deck.description && <span>{deck.description}</span>}
          </div>
        </div>
        {cards.length > 0 && (
          <>
            <GrowthBar growth={growth} />
            <GrowthLegend growth={growth} />
          </>
        )}
      </div>

      {message && (
        <Notice kind={message.kind}>
          {message.text}
          {message.kind === 'error' && message.issues && <IssueList issues={message.issues} />}
        </Notice>
      )}

      <StudyPanel deck={deck} cardCount={cards.length} starredCount={starredCount} />

      <section className="section" aria-labelledby="deck-cards">
        <h2 className="section__title" id="deck-cards">
          {t('deck.cards')}
        </h2>
        <div className="row">
          <ButtonLink to={`/decks/${deckId}/cards/new`} small>
            {t('deck.addCard')}
          </ButtonLink>
          <ButtonLink to={`/decks/${deckId}/cards/bulk`} variant="secondary" small>
            {t('deck.addMany')}
          </ButtonLink>
        </div>
        {cards.length >= SEARCH_FROM && (
          <SearchField label={t('deck.search')} value={query} onChange={setQuery} />
        )}
        {(starredCount > 0 || hardIds.size > 0) && (
          <div className="chips" role="group" aria-label={t('deck.filters')}>
            {(['all', 'starred', 'hard'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {t(`deck.filter.${value}`)}
              </button>
            ))}
          </div>
        )}
        {cards.length === 0 ? (
          <EmptyState title={t('deck.noCards.title')} text={t('deck.noCards.text')} />
        ) : shown.length === 0 ? (
          <p className="muted">{t('common.nothingFound')}</p>
        ) : (
          <ul className="list">
            {shown.map((card) => (
              <li key={card.id} className="list-row list-row--split">
                <Link to={`/decks/${deckId}/cards/${card.id}`} className="list-row__link">
                  <Plant
                    stage={growthStage(bestReps.get(card.id))}
                    label={t(`growth.one.${growthStage(bestReps.get(card.id))}`)}
                  />
                  <span className="list-row__main">
                    <span className="list-row__title">{card.term}</span>
                    <span className="muted">{card.translations.join('; ')}</span>
                  </span>
                  {!card.reviewed && (
                    <span className="badge badge--warn">{t('card.unchecked')}</span>
                  )}
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </Link>
                <StarButton cardId={card.id} term={card.term} starred={card.starred === true} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="manage">
        <summary>{t('deck.manage')}</summary>
        <div className="manage__body">
          <div className="row">
            <ButtonLink to={`/decks/${deckId}/edit`} variant="secondary" small>
              {t('deck.edit')}
            </ButtonLink>
            <Button variant="secondary" small onClick={exportJson}>
              {t('deck.exportJson')}
            </Button>
            <Button
              variant="secondary"
              small
              onClick={() => void exportCsv()}
              disabled={cards.length === 0}
            >
              {t('deck.exportCsv')}
            </Button>
            <Button variant="secondary" small onClick={() => fileInput.current?.click()}>
              {t('deck.importCsv')}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={importCsv}
            />
          </div>
          <p className="muted">{t('deck.csvHint')}</p>
          <Button variant="danger" small onClick={() => setConfirmDelete(true)}>
            {t('deck.delete')}
          </Button>
        </div>
      </details>

      {confirmDelete && (
        <ConfirmDialog
          title={t('deck.deleteConfirm.title')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={removeDeck}
          onCancel={() => setConfirmDelete(false)}
        >
          <p>{t('deck.deleteConfirm.text', { name: deck.name })}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
