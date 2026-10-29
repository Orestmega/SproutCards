import { useState } from 'react';
import type { Settings, UiLanguage } from '../../core/types';
import { UI_LANGUAGES, useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Button, ButtonLink } from '../components/Button';
import { CheckField, TextField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { usePwa } from '../pwa';

/** Language names are written in the language itself, so they can be found whatever the UI language. */
const NATIVE_NAMES: Record<UiLanguage, string> = { uk: 'Українська', en: 'English' };

const MAX_NEW_CARDS = 200;

export function SettingsScreen() {
  const { t } = useI18n();
  const { settings, updateSettings } = useApp();
  const pwa = usePwa();
  const [saveFailed, setSaveFailed] = useState(false);
  /** Saves a change; the switch snaps back (settings come from storage) and a message explains why. */
  const save = (patch: Partial<Settings>) => {
    setSaveFailed(false);
    updateSettings(patch).catch(() => setSaveFailed(true));
  };
  const [newCards, setNewCards] = useState(String(settings.newCardsPerDay));
  const parsed = Number(newCards);
  const newCardsValid = /^\d+$/.test(newCards) && parsed >= 0 && parsed <= MAX_NEW_CARDS;

  return (
    <>
      <PageHeader title={t('settings.title')} />
      {saveFailed && <Notice kind="error">{t('common.saveFailed')}</Notice>}

      <fieldset className="section" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="section__title">{t('settings.language')}</legend>
        <div className="row" role="radiogroup" aria-label={t('settings.language')}>
          {UI_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={settings.uiLanguage === lang}
              className={`btn btn--${settings.uiLanguage === lang ? 'primary' : 'secondary'}`}
              onClick={() => save({ uiLanguage: lang })}
              lang={lang}
            >
              {NATIVE_NAMES[lang]}
            </button>
          ))}
        </div>
      </fieldset>

      <section className="section" aria-labelledby="settings-learning">
        <h2 className="section__title" id="settings-learning">
          {t('settings.learning')}
        </h2>
        <TextField
          label={t('settings.newCards')}
          hint={t('settings.newCardsHint', { max: MAX_NEW_CARDS })}
          inputMode="numeric"
          value={newCards}
          error={newCardsValid ? undefined : t('settings.newCardsInvalid', { max: MAX_NEW_CARDS })}
          onChange={(e) => setNewCards(e.target.value)}
          // Saved when the field loses focus; an invalid value is discarded, not stored half-way.
          onBlur={() => {
            if (newCardsValid) save({ newCardsPerDay: parsed });
            else setNewCards(String(settings.newCardsPerDay));
          }}
        />
        <CheckField
          label={t('settings.diacritics')}
          checked={settings.ignoreDiacritics}
          onChange={(checked) => save({ ignoreDiacritics: checked })}
        />
        <p className="muted">{t('settings.diacriticsHint')}</p>
        <CheckField
          label={t('settings.speech')}
          checked={settings.speechEnabled}
          onChange={(checked) => save({ speechEnabled: checked })}
        />
      </section>

      <section className="section" aria-labelledby="settings-app">
        <h2 className="section__title" id="settings-app">
          {t('settings.app')}
        </h2>
        {pwa.native && <p>{t('settings.app.native')}</p>}
        {pwa.installed && !pwa.native && <p>{t('settings.app.installed')}</p>}
        {pwa.canInstall && (
          <Button onClick={() => void pwa.install()}>{t('settings.app.install')}</Button>
        )}
        {pwa.needsIosInstructions && <p>{t('settings.app.ios')}</p>}
        {!pwa.native && (
          <>
            <p>
              {pwa.offlineActive
                ? t('settings.app.offlineOn')
                : pwa.offlineUnavailable
                  ? t('settings.app.offlineUnavailable')
                  : t('settings.app.offlineOff')}
            </p>
            {pwa.storagePersistent !== null && (
              <p>
                {pwa.storagePersistent
                  ? t('settings.app.storageOk')
                  : t('settings.app.storageRisk')}
              </p>
            )}
            <p className="muted">{t('settings.app.reminders')}</p>
          </>
        )}
      </section>

      <section className="section" aria-labelledby="settings-data">
        <h2 className="section__title" id="settings-data">
          {t('settings.data')}
        </h2>
        <p>{t('settings.dataText')}</p>
        <ButtonLink to="/backup" variant="secondary">
          {t('settings.backup')}
        </ButtonLink>
        <ButtonLink to="/sources" variant="secondary">
          {t('settings.sources')}
        </ButtonLink>
      </section>
    </>
  );
}
