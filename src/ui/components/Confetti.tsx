import type { CSSProperties } from 'react';

const COLORS = ['#58a83c', '#f2c94c', '#7bc15e', '#4f8fd6', '#e8737a', '#b07cd8'];
const PIECES = 36;

/** Positions are fixed (not random) so a render is predictable; they still look scattered. */
const pieces = Array.from({ length: PIECES }, (_, i) => {
  const spread = (i * 37) % 100; // 0..99, jumping around
  return {
    left: `${spread}%`,
    background: COLORS[i % COLORS.length],
    '--delay': `${(i % 9) * 0.09}s`,
    '--fall': `${1.8 + ((i * 13) % 10) / 10}s`,
    '--drift': `${((i * 53) % 120) - 60}px`,
    '--spin': `${360 + ((i * 97) % 540)}deg`,
    borderRadius: i % 3 === 0 ? '50%' : '2px',
  } as CSSProperties;
});

/** A short burst of falling confetti over the screen. Decoration only; off under reduced motion. */
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <span key={i} className="confetti__piece" style={style} />
      ))}
    </div>
  );
}
