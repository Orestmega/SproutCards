import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { ImportIssue } from '../../core/exchange';
import { parseExchange, serializeBackup } from '../../core/exchange';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { Button } from '../components/Button';
import { IssueList } from '../components/IssueList';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { downloadText, readTextFile } from '../files';

type Result =
  | { kind: 'success'; decks: number; cards: number; skipped: number }
  | { kind: 'error'; text?: string; issues?: ImportIssue[] };

export function BackupScreen() {
  const { t, tp } = useI18n();
  const repo = useRepo();
  const fileInput = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const deckCount = useLiveQuery(() => repo.listDecks().then((d) => d.length), [repo]);

  async function exportAll() {
    try {
      const bundles = await repo.exportAll();
      const day = new Date().toISOString().slice(0, 10);
      downloadText(`sproutcards-backup-${day}.json`, serializeBackup(bundles), 'application/json');
      setResult(null);
    } catch {
      setResult({ kind: 'error', text: t('common.exportFailed') });
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setBusy(true);
    try {
      const read = await readTextFile(file);
      if (!read.ok) {
        setResult({
          kind: 'error',
          text: t(read.reason === 'too_large' ? 'backup.tooLarge' : 'backup.unreadable'),
        });
        return;
      }
      const parsed = parseExchange(read.text);
      if (!parsed.ok) {
        setResult({ kind: 'error', issues: parsed.errors });
        return;
      }
      const decks = await repo.importBundles(parsed.value);
      setResult({
        kind: 'success',
        decks: decks.length,
        cards: parsed.value.reduce((n, b) => n + b.cards.length, 0),
        skipped: parsed.warnings.length,
      });
    } catch {
      setResult({ kind: 'error', text: t('backup.importFailed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t('backup.title')} backTo="/settings" />
      <p className="muted">{t('backup.intro')}</p>

      <section className="section" aria-labelledby="backup-export">
        <h2 className="section__title" id="backup-export">
          {t('backup.exportTitle')}
        </h2>
        <p>{t('backup.exportText')}</p>
        <Button onClick={exportAll} disabled={!deckCount}>
          {t('backup.exportButton')}
        </Button>
      </section>

      <section className="section" aria-labelledby="backup-import">
        <h2 className="section__title" id="backup-import">
          {t('backup.importTitle')}
        </h2>
        <p>{t('backup.importText')}</p>
        <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
          {t('backup.importButton')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={importFile}
        />
      </section>

      {result?.kind === 'success' && (
        <Notice kind="success">
          {t('backup.imported', {
            decks: tp('count.decks', result.decks),
            cards: tp('count.cards', result.cards),
          })}
          {result.skipped > 0 && <p>{tp('backup.skipped', result.skipped)}</p>}
        </Notice>
      )}
      {result?.kind === 'error' && (
        <Notice kind="error">
          {result.text ?? t('backup.refused')}
          {result.issues && <IssueList issues={result.issues} />}
        </Notice>
      )}
    </>
  );
}
