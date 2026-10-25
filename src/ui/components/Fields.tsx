import { useId, useState } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useI18n } from '../../i18n';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
}

type TextFieldProps = FieldShellProps &
  (
    | ({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>)
    | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>)
  );

/** Labelled input/textarea with optional hint and error, wired up for screen readers. */
export function TextField(props: TextFieldProps) {
  const id = useId();
  const { label, hint, error, multiline, ...rest } = props;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  const common = {
    id,
    className: 'input',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  };
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/** Languages offered in the picker; any other BCP 47 code can be typed in. */
export const COMMON_LANGUAGES = [
  'en',
  'uk',
  'de',
  'fr',
  'es',
  'it',
  'pl',
  'pt',
  'nl',
  'cs',
  'sv',
  'tr',
  'ja',
  'ko',
  'zh',
] as const;

const OTHER = '__other__';
export const LANGUAGE_CODE_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** Language picker: a list of common languages plus "Other..." to type a code. */
export function LanguageField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
}) {
  const { t, languageName } = useI18n();
  const id = useId();
  const known = (COMMON_LANGUAGES as readonly string[]).includes(value);
  const [custom, setCustom] = useState(!known && value !== '');
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input"
        value={custom ? OTHER : value}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(e.target.value);
          }
        }}
      >
        {COMMON_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {languageName(code)}
          </option>
        ))}
        <option value={OTHER}>{t('form.languageOther')}</option>
      </select>
      {custom && (
        <input
          className="input"
          aria-label={t('form.languageCode')}
          placeholder={t('form.languageCodePlaceholder')}
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          autoCapitalize="off"
          spellCheck={false}
        />
      )}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
