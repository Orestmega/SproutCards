import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { localize, prepareCatalogBundle } from '../../core/catalog';
import type { CatalogEntry, CatalogIndex } from '../../core/catalog';
import { useI18n } from '../../i18n';
import { useApp, useRepo } from '../AppProviders';
import { catalogUrl, fetchCatalogDeck, fetchCatalogIndex } from '../catalog';
import type { CatalogFailure } from '../catalog';
import { Button } from '../components/Button';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';

type Loaded =
  | { status: 'loading' }
  | { status: 'ready'; index: CatalogIndex }
  | { status: 'failed'; reason: CatalogFailure };

type Message =
  | { kind: 'success'; deckId: string; name: string }
  | { kind: 'error'; reason: CatalogFailure | 'save'; name: string };

/** Ready-made decks. Adding one copies it into the device storage, so it works offline afterwards. */
export function CatalogScreen() {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchCatalogIndex().then((result) => {
      if (cancelled) return;
      setLoaded(
        result.ok
          ? { status: 'ready', index: result.value }
          : { status: 'failed', reason: result.reason },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <>
      <PageHeader title={t('catalog.title')} backTo="/decks" />
      <p className="muted">{t('catalog.intro')}</p>

      {loaded.status === 'loading' && <p role="status">{t('catalog.loading')}</p>}
      {loaded.status === 'failed' && (
        <Notice kind="error">
          {t(loaded.reason === 'network' ? 'catalog.error.network' : 'catalog.error.invalid')}
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button
              small
              variant="secondary"
              onClick={() => {
                setLoaded({ status: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('catalog.retry')}
            </Button>
          </div>
        </Notice>
      )}
      {loaded.status === 'ready' && <CatalogList index={loaded.index} />}

      <Link to="/sources">{t('catalog.sources')}</Link>
    </>
  );
}

function CatalogList({ index }: { index: CatalogIndex }) {
  const { t, tp, language, languageName } = useI18n();
  const repo = useRepo();
  const { settings } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  // catalog id -> id of the deck the user already has
  const added = useLiveQuery(
    async () =>
      new Map(
        (await repo.listDecks()).flatMap((d) =>
          d.catalogId ? [[d.catalogId, d.id] as const] : [],
        ),
      ),
    [repo],
  );

  const add = useCallback(
    async (entry: CatalogEntry) => {
      const now = Date.now();
      const name = localize(entry.title, language);
      setBusyId(entry.id);
      setMessage(null);
      try {
        const got = await fetchCatalogDeck(entry);
        if (!got.ok) {
          setMessage({ kind: 'error', reason: got.reason, name });
          return;
        }
        const bundle = prepareCatalogBundle(got.value, entry, settings.uiLanguage, now);
        const [deck] = await repo.importBundles([bundle]);
        if (deck) setMessage({ kind: 'success', deckId: deck.id, name });
      } catch {
        setMessage({ kind: 'error', reason: 'save', name });
      } finally {
        setBusyId(null);
      }
    },
    [repo, language, settings.uiLanguage],
  );

  return (
    <>
      {message?.kind === 'success' && (
        <Notice kind="success">
          {t('catalog.addedMessage', { name: message.name })}{' '}
          <Link to={`/decks/${message.deckId}`}>{t('catalog.open')}</Link>
        </Notice>
      )}
      {message?.kind === 'error' && (
        <Notice kind="error">
          {t(
            message.reason === 'network'
              ? 'catalog.addFailed.network'
              : message.reason === 'invalid'
                ? 'catalog.addFailed.invalid'
                : 'catalog.addFailed.save',
            { name: message.name },
          )}
        </Notice>
      )}

      <ul className="list">
        {index.decks.map((entry) => {
          const existing = added?.get(entry.id);
          return (
            <li key={entry.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div className="list-row__main" style={{ gap: 'var(--space-2)' }}>
                <span className="list-row__head">
                  <span className="list-row__title">{localize(entry.title, language)}</span>
                  {!entry.reviewed && (
                    <span className="badge badge--warn">{t('catalog.unchecked')}</span>
                  )}
                </span>
                <span>{localize(entry.description, language)}</span>
                <span className="muted">
                  {languageName(entry.learningLang)} → {languageName(entry.translationLang)} ·{' '}
                  {tp('count.cards', entry.cardCount)} ·{' '}
                  {tp('catalog.examples', entry.exampleCount)}
                </span>
                <span className="muted">
                  <a href={catalogUrl(entry.attribution)} target="_blank" rel="noopener noreferrer">
                    {t('catalog.authors')}
                  </a>
                </span>
                {existing ? (
                  <Link to={`/decks/${existing}`} className="btn btn--secondary btn--small">
                    {t('catalog.alreadyAdded')}
                  </Link>
                ) : (
                  <Button
                    small
                    disabled={busyId !== null}
                    onClick={() => void add(entry)}
                    aria-label={t('catalog.addLabel', { name: localize(entry.title, language) })}
                  >
                    {busyId === entry.id ? t('catalog.adding') : t('catalog.add')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
