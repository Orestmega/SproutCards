import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useSettings } from '../AppProviders';
import { speak } from '../speech';
import type { SpeakResult } from '../speech';

/**
 * A "listen" button. Hidden when speech is turned off in the settings. If the device cannot speak the
 * language, a short explanation appears instead of silence.
 */
export function SpeakButton({ text, lang }: { text: string; lang: string }) {
  const { t, languageName } = useI18n();
  const { speechEnabled } = useSettings();
  const [problem, setProblem] = useState<Exclude<SpeakResult, 'ok'> | null>(null);
  if (!speechEnabled) return null;

  async function onClick() {
    const result = await speak(text, lang);
    setProblem(result === 'ok' ? null : result);
  }

  return (
    <span className="speak">
      <button
        type="button"
        className="icon-btn"
        aria-label={t('speech.listen', { text })}
        onClick={() => void onClick()}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 9v6h4l5 4V5L8 9z" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      </button>
      {problem && (
        <span className="field__error" role="status">
          {problem === 'unsupported'
            ? t('speech.unsupported')
            : problem === 'no_voice'
              ? t('speech.noVoice', { language: languageName(lang) })
              : t('speech.error')}
        </span>
      )}
    </span>
  );
}
