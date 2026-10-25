import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { UiLanguage } from '../core/types';
import { en } from './en';
import { uk } from './uk';

export type MessageKey = keyof typeof en;
/** Keys that have plural forms: `cards_one`, `cards_few`... are addressed as `cards`. */
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer Base}_other`
    ? Base
    : never
  : never;
export type Params = Record<string, string | number>;

const dictionaries: Record<UiLanguage, Record<string, string>> = { en, uk };

export const UI_LANGUAGES: readonly UiLanguage[] = ['uk', 'en'];

function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Translates a message; falls back to English, then to the key itself (visible in the UI = a bug). */
export function translate(language: UiLanguage, key: MessageKey, params?: Params): string {
  return fill(dictionaries[language][key] ?? en[key] ?? key, params);
}

/**
 * Translates a message with a count. Uses the language's plural rules (Ukrainian has one/few/many/other),
 * e.g. `cards_one`, `cards_few`, `cards_many`, `cards_other`. `{count}` is filled in automatically.
 */
export function translatePlural(
  language: UiLanguage,
  base: PluralKey,
  count: number,
  params?: Params,
): string {
  const category = new Intl.PluralRules(language).select(count);
  const dict = dictionaries[language];
  const template =
    dict[`${base}_${category}`] ??
    dict[`${base}_other`] ??
    (en as Record<string, string>)[`${base}_other`] ??
    base;
  return fill(template, { count, ...params });
}

/** Name of a language in the interface language, e.g. `uk` -> "Ukrainian" / "українська". */
export function languageName(code: string, uiLanguage: UiLanguage): string {
  try {
    return new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code) ?? code;
  } catch {
    return code; // invalid code
  }
}

export interface I18n {
  language: UiLanguage;
  t: (key: MessageKey, params?: Params) => string;
  tp: (base: PluralKey, count: number, params?: Params) => string;
  languageName: (code: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  language,
  children,
}: {
  language: UiLanguage;
  children: ReactNode;
}) {
  const value = useMemo<I18n>(
    () => ({
      language,
      t: (key, params) => translate(language, key, params),
      tp: (base, count, params) => translatePlural(language, base, count, params),
      languageName: (code) => languageName(code, language),
    }),
    [language],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
