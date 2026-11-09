import type { CSSProperties } from 'react';

/**
 * Small garden-style effects, played once when they appear (give a new `key` to play again):
 * `bloom` — petals fly out from the middle (a right answer, a found pair, a known card);
 * `fall` — a wilted leaf drops (a mistake). Decoration only, hidden from screen readers, off under
 * reduced motion. The parent needs `position: relative`.
 */
export type BurstKind = 'bloom' | 'fall';

const PETAL_COLORS = ['#ff8fa8', '#ffc83d', '#ffffff', '#7bc15e', '#ffb3c4', '#a6e08a'];
const PETALS = 12;

export function Burst({ kind }: { kind: BurstKind }) {
  if (kind === 'fall') {
    return (
      <span className="burst burst--fall" aria-hidden="true">
        <span className="burst__leaf" style={{ '--x': '-14px' } as CSSProperties} />
        <span className="burst__leaf burst__leaf--2" style={{ '--x': '18px' } as CSSProperties} />
      </span>
    );
  }
  return (
    <span className="burst burst--bloom" aria-hidden="true">
      {Array.from({ length: PETALS }, (_, i) => {
        const angle = (360 / PETALS) * i + (i % 2 ? 12 : 0);
        const distance = 34 + ((i * 7) % 4) * 9;
        return (
          <span
            key={i}
            className={i % 3 === 0 ? 'burst__petal burst__petal--leaf' : 'burst__petal'}
            style={
              {
                '--a': `${angle}deg`,
                '--d': `${distance}px`,
                background: PETAL_COLORS[i % PETAL_COLORS.length],
                animationDelay: `${(i % 4) * 25}ms`,
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

/** A tiny sprout that grows out of the number of the chosen option. */
export function SproutBadge() {
  return (
    <svg className="sprout-badge" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 21 V11" stroke="#3f8a2a" strokeWidth="2.4" strokeLinecap="round" />
      <path
        className="sprout-badge__leaf"
        d="M12 13 C13 7 19 6 21 8 C19 13 15 14 12 13 Z"
        fill="#58a83c"
      />
      <path
        className="sprout-badge__leaf sprout-badge__leaf--left"
        d="M12 15 C11 10 6 9 3 11 C5 15 9 16 12 15 Z"
        fill="#7bc15e"
      />
    </svg>
  );
}
