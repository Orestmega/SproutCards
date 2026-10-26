import { useEffect, useState } from 'react';
import type { CatalogIndex } from '../../core/catalog';
import { localize } from '../../core/catalog';
import { useI18n } from '../../i18n';
import { catalogUrl, fetchCatalogIndex } from '../catalog';
import { PageHeader } from '../components/Layout';

/** `Sat, 24 Oct 2026 06:41:06 GMT` -> "24 October 2026" in the interface language (raw text if unparseable). */
function formatDate(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(language, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** "Sources and licenses": where the content comes from, under which licence, and who must be credited. */
export function SourcesScreen() {
  const { t, language } = useI18n();
  const [index, setIndex] = useState<CatalogIndex | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchCatalogIndex().then((r) => !cancelled && setIndex(r.ok ? r.value : null));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title={t('sources.title')} backTo="/settings" />
      <p className="muted">{t('sources.intro')}</p>

      <section className="section" aria-labelledby="src-tatoeba">
        <h2 className="section__title" id="src-tatoeba">
          {t('sources.tatoeba.title')}
        </h2>
        <p>{t('sources.tatoeba.text')}</p>
        <p>
          <a href="https://tatoeba.org" target="_blank" rel="noopener noreferrer">
            tatoeba.org
          </a>{' '}
          ·{' '}
          <a
            href="https://creativecommons.org/licenses/by/2.0/fr/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('sources.tatoeba.license')}
          </a>
        </p>
        {index && (
          <p className="muted">
            {t('sources.tatoeba.export', { date: formatDate(index.tatoebaExport, language) })}
          </p>
        )}
        <p>{t('sources.tatoeba.credit')}</p>
        <h3 className="section__title">{t('sources.authors')}</h3>
        {index === undefined && <p role="status">{t('catalog.loading')}</p>}
        {index === null && <p>{t('sources.authorsOffline')}</p>}
        {index && (
          <ul className="list">
            {index.decks.map((entry) => (
              <li key={entry.id}>
                <a
                  className="list-row"
                  href={catalogUrl(entry.attribution)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="list-row__main">
                    <span className="list-row__title">{localize(entry.title, language)}</span>
                    <span className="muted">{t('sources.authorsFile')}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section" aria-labelledby="src-ai">
        <h2 className="section__title" id="src-ai">
          {t('sources.ai.title')}
        </h2>
        <p>{t('sources.ai.text')}</p>
      </section>

      <section className="section" aria-labelledby="src-app">
        <h2 className="section__title" id="src-app">
          {t('sources.app.title')}
        </h2>
        <p>{t('sources.app.text')}</p>
        <p>{t('sources.nonCommercial')}</p>
      </section>
    </>
  );
}
