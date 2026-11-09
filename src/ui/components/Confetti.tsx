import type { CSSProperties } from 'react';

/** A shower of petals and leaves, the garden's own confetti. */
const COLORS = ['#ff8fa8', '#ffc83d', '#7bc15e', '#ffffff', '#58a83c', '#ffb3c4', '#b07cd8'];
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
    // a leaf (pointed at two corners) or a petal (round with one point)
    borderRadius: i % 3 === 0 ? '0 80% 0 80%' : '60% 60% 60% 0',
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
