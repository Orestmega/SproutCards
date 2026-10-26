// Text-to-speech through the browser's Web Speech API (`speechSynthesis`).
// Which voices exist depends on the device, so every outcome is reported and the UI explains it:
// silence without a message would look like a bug.

import { pickVoice } from '../core/voice';

export type SpeakResult = 'ok' | 'unsupported' | 'no_voice' | 'error';

export function speechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

/** Voices load asynchronously in some browsers: wait for them, but not forever. */
function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener('voiceschanged', done);
  });
}

/** Speaks `text` in `lang` (BCP 47). Resolves when speech has started or failed to. */
export async function speak(text: string, lang: string): Promise<SpeakResult> {
  if (!speechSupported()) return 'unsupported';
  try {
    const voice = pickVoice(await loadVoices(), lang);
    if (!voice) return 'no_voice';
    const synth = window.speechSynthesis;
    synth.cancel(); // stop whatever is still being read
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    return await new Promise<SpeakResult>((resolve) => {
      utterance.onstart = () => resolve('ok');
      utterance.onerror = () => resolve('error');
      synth.speak(utterance);
      setTimeout(() => resolve('ok'), 2000); // some engines never fire `start`
    });
  } catch {
    return 'error';
  }
}
