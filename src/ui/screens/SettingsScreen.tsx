import { useState } from 'react';
import type { UiLanguage } from '../../core/types';
import { UI_LANGUAGES, useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { ButtonLink } from '../components/Button';
import { CheckField, TextField } from '../components/Fields';
import { PageHeader } from '../components/Layout';

/** Language names are written in the language itself, so they can be found whatever the UI language. */
const NATIVE_NAMES: Record<UiLanguage, string> = { uk: 'Українська', en: 'English' };

const MAX_NEW_CARDS = 200;

export function SettingsScreen() {
  const { t } = useI18n();
  const { settings, updateSettings } = useApp();
  const [newCards, setNewCards] = useState(String(settings.newCardsPerDay));
  const parsed = Number(newCards);
  const newCardsValid = /^\d+$/.test(newCards) && parsed >= 0 && parsed <= MAX_NEW_CARDS;

  return (
    <>
      <PageHeader title={t('settings.title')} />

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
              onClick={() => void updateSettings({ uiLanguage: lang })}
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
            if (newCardsValid) void updateSettings({ newCardsPerDay: parsed });
            else setNewCards(String(settings.newCardsPerDay));
          }}
        />
        <CheckField
          label={t('settings.diacritics')}
          checked={settings.ignoreDiacritics}
          onChange={(checked) => void updateSettings({ ignoreDiacritics: checked })}
        />
        <p className="muted">{t('settings.diacriticsHint')}</p>
        <CheckField
          label={t('settings.speech')}
          checked={settings.speechEnabled}
          onChange={(checked) => void updateSettings({ speechEnabled: checked })}
        />
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
