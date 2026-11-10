import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GOAL_OPTIONS } from '../../core/habit';
import type { Settings, ThemeChoice, UiLanguage } from '../../core/types';
import { UI_LANGUAGES, useI18n } from '../../i18n';
import { useApp } from '../AppProviders';
import { Avatar } from '../components/Avatar';
import { Button, ButtonLink } from '../components/Button';
import { CheatPanel } from '../components/CheatPanel';
import { CheckField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { playCue } from '../cues';
import { usePwa } from '../pwa';

/** Language names are written in the language itself, so they can be found whatever the UI language. */
const NATIVE_NAMES: Record<UiLanguage, string> = { uk: 'Українська', en: 'English' };
const THEMES: ThemeChoice[] = ['system', 'light', 'dark'];

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

  return (
    <>
      <PageHeader title={t('settings.title')} />
      {saveFailed && <Notice kind="error">{t('common.saveFailed')}</Notice>}

      <Link to="/profile" className="list-row profile-row">
        <Avatar avatar={settings.avatar} size={44} />
        <span className="list-row__main">
          <span className="list-row__title">{settings.profileName || t('profile.noName')}</span>
          <span className="muted">{t('settings.profile')}</span>
        </span>
        <span className="chevron" aria-hidden="true">
          ›
        </span>
      </Link>

      <section className="section" aria-labelledby="settings-look">
        <h2 className="section__title" id="settings-look">
          {t('settings.look')}
        </h2>
        <div className="setting-group">
          <div className="field">
            <span className="field__label" id="settings-theme">
              {t('settings.theme')}
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="settings-theme">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === theme}
                  className="seg__btn"
                  onClick={() => save({ theme })}
                >
                  {t(`settings.theme.${theme}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field__label" id="settings-language">
              {t('settings.language')}
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="settings-language">
              {UI_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={settings.uiLanguage === lang}
                  className="seg__btn"
                  onClick={() => save({ uiLanguage: lang })}
                  lang={lang}
                >
                  {NATIVE_NAMES[lang]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="settings-learning">
        <h2 className="section__title" id="settings-learning">
          {t('settings.learning')}
        </h2>
        <div className="setting-group">
          <div className="field">
            <span className="field__label" id="settings-goal">
              {t('settings.goal')}
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="settings-goal">
              {GOAL_OPTIONS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  role="radio"
                  aria-checked={settings.dailyGoal === goal}
                  className="seg__btn"
                  onClick={() => save({ dailyGoal: goal })}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <CheckField
              label={t('settings.diacritics')}
              checked={settings.ignoreDiacritics}
              onChange={(checked) => save({ ignoreDiacritics: checked })}
            />
            <p className="muted">{t('settings.diacriticsHint')}</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="settings-feel">
        <h2 className="section__title" id="settings-feel">
          {t('settings.feel')}
        </h2>
        <div className="setting-group">
          <CheckField
            label={t('settings.speech')}
            checked={settings.speechEnabled}
            onChange={(checked) => save({ speechEnabled: checked })}
          />
          <CheckField
            label={t('settings.autoSpeak')}
            checked={settings.autoSpeak}
            onChange={(checked) => save({ autoSpeak: checked })}
          />
          <CheckField
            label={t('settings.sound')}
            checked={settings.soundEnabled}
            onChange={(checked) => {
              save({ soundEnabled: checked });
              if (checked) playCue('correct', true, false); // so the user hears what was turned on
            }}
          />
          <CheckField
            label={t('settings.haptics')}
            checked={settings.hapticsEnabled}
            onChange={(checked) => {
              save({ hapticsEnabled: checked });
              if (checked) playCue('correct', false, true);
            }}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="settings-app">
        <h2 className="section__title" id="settings-app">
          {t('settings.app')}
        </h2>
        <div className="setting-group">
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
        </div>
      </section>

      <section className="section" aria-labelledby="settings-data">
        <h2 className="section__title" id="settings-data">
          {t('settings.data')}
        </h2>
        <div className="setting-group">
          <p>{t('settings.dataText')}</p>
          <ButtonLink to="/backup" variant="secondary">
            {t('settings.backup')}
          </ButtonLink>
          <ButtonLink to="/sources" variant="secondary">
            {t('settings.sources')}
          </ButtonLink>
        </div>
      </section>

      <section className="section" aria-label={t('cheats.title')}>
        <CheatPanel value={settings.cheats} onChange={(cheats) => save({ cheats })} />
      </section>
    </>
  );
}
