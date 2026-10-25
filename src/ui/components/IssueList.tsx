import type { ImportIssue } from '../../core/exchange';
import { useI18n } from '../../i18n';
import type { MessageKey } from '../../i18n';

const MAX_SHOWN = 10;

/** Human-readable (translated) list of import problems; shows the first few and counts the rest. */
export function IssueList({ issues }: { issues: readonly ImportIssue[] }) {
  const { t } = useI18n();
  const shown = issues.slice(0, MAX_SHOWN);
  return (
    <ul className="notice__list">
      {shown.map((issue, i) => (
        <li key={i}>{t(`issue.${issue.code}` as MessageKey, { path: issue.path || '—' })}</li>
      ))}
      {issues.length > shown.length && (
        <li>{t('issue.more', { count: issues.length - shown.length })}</li>
      )}
    </ul>
  );
}
