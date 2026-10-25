import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cardsToCsv, parseCsvCards } from '../../core/csv';
import type { ImportIssue } from '../../core/exchange';
import { serializeDeck } from '../../core/exchange';
import { newId } from '../../core/id';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { Button, ButtonLink } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { IssueList } from '../components/IssueList';
import { PageHeader } from '../components/Layout';
import { EmptyState, Notice } from '../components/Notice';
import { downloadText, readTextFile, safeFileName } from '../files';
import { NotFoundScreen } from './NotFoundScreen';

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
  if (deck === undefined || cards === undefined) return null; // loading
  if (deck === null) return <NotFoundScreen />;

  async function exportJson() {
    try {
      const bundle = await repo.exportDeck(deckId);
      downloadText(
        `${safeFileName(bundle.deck.name)}.json`,
        serializeDeck(bundle),
        'application/json',
      );
    } catch {
      setMessage({ kind: 'error', text: t('common.exportFailed') });
    }
  }

  function exportCsv() {
    if (!deck || !cards) return;
    downloadText(`${safeFileName(deck.name)}.csv`, cardsToCsv(cards), 'text/csv');
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
      <p className="muted">
        {languageName(deck.learningLang)} → {languageName(deck.translationLang)} ·{' '}
        {tp('count.cards', cards.length)}
      </p>
      {deck.description && <p>{deck.description}</p>}

      {message && (
        <Notice kind={message.kind}>
          {message.text}
          {message.kind === 'error' && message.issues && <IssueList issues={message.issues} />}
        </Notice>
      )}

      <ButtonLink to={`/decks/${deckId}/cards/new`} block>
        {t('deck.addCard')}
      </ButtonLink>

      <section className="section" aria-labelledby="deck-cards">
        <h2 className="section__title" id="deck-cards">
          {t('deck.cards')}
        </h2>
        {cards.length === 0 ? (
          <EmptyState title={t('deck.noCards.title')} text={t('deck.noCards.text')} />
        ) : (
          <ul className="list">
            {cards.map((card) => (
              <li key={card.id}>
                <Link to={`/decks/${deckId}/cards/${card.id}`} className="list-row">
                  <span className="list-row__main">
                    <span className="list-row__title">{card.term}</span>
                    <span className="muted">{card.translations.join('; ')}</span>
                  </span>
                  {!card.reviewed && (
                    <span className="badge badge--warn">{t('card.unchecked')}</span>
                  )}
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="deck-manage">
        <h2 className="section__title" id="deck-manage">
          {t('deck.manage')}
        </h2>
        <div className="row">
          <ButtonLink to={`/decks/${deckId}/edit`} variant="secondary" small>
            {t('deck.edit')}
          </ButtonLink>
          <Button variant="secondary" small onClick={exportJson}>
            {t('deck.exportJson')}
          </Button>
          <Button variant="secondary" small onClick={exportCsv} disabled={cards.length === 0}>
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
      </section>

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
