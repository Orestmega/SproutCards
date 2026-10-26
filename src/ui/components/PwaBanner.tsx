import { useI18n } from '../../i18n';
import { usePwa } from '../pwa';
import { Button } from './Button';

/**
 * Update and "ready offline" messages. Shown on normal screens only (never inside a study
 * session), so applying an update cannot interrupt a lesson.
 */
export function PwaBanner() {
  const { t } = useI18n();
  const pwa = usePwa();

  if (pwa.updateReady) {
    return (
      <div className="notice notice--info banner" role="status">
        <div>
          <strong>{t('pwa.updateReady')}</strong>
          <p className="muted">{t('pwa.updateKept')}</p>
          <div className="row">
            <Button small onClick={pwa.applyUpdate}>
              {t('pwa.update')}
            </Button>
            <Button small variant="secondary" onClick={pwa.dismissUpdate}>
              {t('pwa.later')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (pwa.offlineReady) {
    return (
      <div className="notice notice--success banner" role="status">
        <div className="row">
          <span>{t('pwa.offlineReady')}</span>
          <Button small variant="secondary" onClick={pwa.dismissOfflineReady}>
            {t('pwa.dismiss')}
          </Button>
        </div>
      </div>
    );
  }
  return null;
}
