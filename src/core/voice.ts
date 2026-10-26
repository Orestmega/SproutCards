/** The few fields of a browser `SpeechSynthesisVoice` that we use (keeps this file free of DOM types). */
export interface VoiceInfo {
  lang: string;
  name: string;
  localService?: boolean;
  default?: boolean;
}

const norm = (lang: string) => lang.toLowerCase().replace('_', '-');

/**
 * Picks the best voice for a language code.
 * 1. exact match (`pt-BR` for `pt-BR`), 2. same base language (`en-US` for `en`), else null.
 * Within a group prefer voices stored on the device (they work offline), then the default voice.
 * Returns null when the device has no voice for the language: the UI must say so.
 */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[], lang: string): T | null {
  const wanted = norm(lang);
  const base = wanted.split('-')[0] as string;
  const rank = (v: T) => (v.localService ? 0 : 2) + (v.default ? 0 : 1);
  const best = (list: T[]) => [...list].sort((a, b) => rank(a) - rank(b))[0] ?? null;
  const exact = voices.filter((v) => norm(v.lang) === wanted);
  if (exact.length > 0) return best(exact);
  return best(voices.filter((v) => (norm(v.lang).split('-')[0] as string) === base));
}
