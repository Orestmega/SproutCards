// Short sounds and vibrations for answers. The sounds are synthesised on the spot (no audio files), so
// they add nothing to the download. Where a device cannot do this, nothing happens.
import { useMemo } from 'react';
import { useSettings } from './AppProviders';

export type Cue = 'correct' | 'almost' | 'wrong' | 'combo' | 'finish' | 'flip';

/** Notes of each cue: [frequency in Hz, start in seconds, length in seconds]. */
const NOTES: Record<Cue, [number, number, number][]> = {
  correct: [
    [659, 0, 0.1],
    [988, 0.08, 0.16],
  ],
  almost: [[587, 0, 0.14]],
  wrong: [
    [233, 0, 0.12],
    [196, 0.1, 0.18],
  ],
  combo: [
    [659, 0, 0.09],
    [880, 0.08, 0.09],
    [1175, 0.16, 0.18],
  ],
  finish: [
    [523, 0, 0.12],
    [659, 0.11, 0.12],
    [784, 0.22, 0.12],
    [1047, 0.33, 0.3],
  ],
  flip: [[420, 0, 0.05]],
};

const VIBRATIONS: Partial<Record<Cue, number | number[]>> = {
  correct: 15,
  wrong: [30, 40, 30],
  combo: [15, 30, 15],
  finish: [20, 40, 20, 40, 40],
};

let audio: AudioContext | null = null;

function playNotes(cue: Cue): void {
  if (typeof AudioContext === 'undefined') return;
  audio ??= new AudioContext();
  void audio.resume();
  const start = audio.currentTime;
  for (const [frequency, at, length] of NOTES[cue]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = cue === 'wrong' ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency;
    // a quick rise and a soft fall, so a note does not click
    gain.gain.setValueAtTime(0, start + at);
    gain.gain.linearRampToValueAtTime(0.13, start + at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + at + length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start + at);
    oscillator.stop(start + at + length + 0.02);
  }
}

/** Sound and vibration are extras: a failure here must never disturb the session. */
export function playCue(cue: Cue, sound: boolean, haptics: boolean): void {
  try {
    if (sound) playNotes(cue);
    const vibration = VIBRATIONS[cue];
    if (haptics && vibration !== undefined) navigator.vibrate?.(vibration);
  } catch {
    // stay silent
  }
}

/** `cue('correct')`, respecting the user's settings. */
export function useCue(): (cue: Cue) => void {
  const { soundEnabled, hapticsEnabled } = useSettings();
  return useMemo(
    () => (cue: Cue) => playCue(cue, soundEnabled, hapticsEnabled),
    [soundEnabled, hapticsEnabled],
  );
}
