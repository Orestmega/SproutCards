import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { parseBulkCards } from '../../core/bulk';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { Button } from '../components/Button';
import { TextField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { NotFoundScreen } from './NotFoundScreen';

/** Paste a whole list of words at once. The preview shows what will be added before anything is saved. */
export function BulkAddScreen() {
  const { deckId = '' } = useParams();
  const { t, tp } = useI18n();
  const repo = useRepo();
  const navigate = useNavigate();
  const deck = useLiveQuery(async () => (await repo.getDeck(deckId)) ?? null, [repo, deckId]);
  const cards = useLiveQuery(() => repo.listCards(deckId), [repo, deckId]);
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  if (deck === undefined || cards === undefined) return null;
  if (deck === null) return <NotFoundScreen />;

  const result = parseBulkCards(
    text,
    cards.map((c) => c.term),
  );

  async function add() {
    setFailed(false);
    try {
      await repo.addNewCards(deckId, result.cards);
      navigate(`/decks/${deckId}`);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <PageHeader title={t('bulk.title')} backTo={`/decks/${deckId}`} />
      <p className="muted">{t('bulk.intro')}</p>
      <div className="form">
        <TextField
          multiline
          label={t('bulk.label')}
          hint={t('bulk.hint')}
          rows={10}
          value={text}
          placeholder={t('bulk.placeholder')}
          onChange={(e) => setText(e.target.value)}
        />
        {result.badLines.length > 0 && (
          <Notice kind="warn">{t('bulk.badLines', { lines: result.badLines.join(', ') })}</Notice>
        )}
        {result.duplicates.length > 0 && (
          <Notice kind="info">
            {t('bulk.duplicates', { words: result.duplicates.join(', ') })}
          </Notice>
        )}
        {failed && <Notice kind="error">{t('common.saveFailed')}</Notice>}
        {result.cards.length > 0 && (
          <ul className="list" aria-label={t('bulk.preview')}>
            {result.cards.slice(0, 50).map((card) => (
              <li className="list-row" key={card.term}>
                <span className="list-row__main">
                  <span className="list-row__title">{card.term}</span>
                  <span className="muted">{card.translations.join('; ')}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button block disabled={result.cards.length === 0} onClick={() => void add()}>
          {result.cards.length === 0 ? t('bulk.add') : tp('bulk.addCount', result.cards.length)}
        </Button>
      </div>
    </>
  );
}
