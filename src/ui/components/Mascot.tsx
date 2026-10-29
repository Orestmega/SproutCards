import type { ReactNode } from 'react';
import type { MascotMood } from '../../core/cheer';

export type { MascotMood };

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Accessible description. Without it the picture is treated as decoration and hidden from readers. */
  label?: string;
  /**
   * Changing this number replays the mood's short reaction (a hop, a shake, a jump). The idle motion
   * (breathing, blinking, leaves in the wind) runs on its own. All motion is off under reduced motion.
   */
  reaction?: number;
}

const INK = '#1d2b1a';
const LINE = '#3f8a2a';
const LEAF = '#58a83c';
const LEAF_LIGHT = '#7bc15e';

/**
 * "Sprout": an original little green character with a page on its head. Drawn in plain SVG; the parts
 * that move are separate groups (`mascot__sprout`, `mascot__eyes`, ...) animated in components.css.
 */
export function Mascot({ mood = 'normal', size = 96, label, reaction = 0 }: MascotProps) {
  const armsUp = mood === 'celebrate';
  const waving = mood === 'encouraging' || armsUp;
  return (
    <svg
      className={`mascot mascot--${mood}`}
      data-mood={mood}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <ellipse
        className="mascot__shadow"
        cx="60"
        cy="113"
        rx="30"
        ry="4"
        fill={INK}
        opacity="0.1"
      />

      {/* a new key replays the reaction animation of this group */}
      <g className="mascot__actor" key={reaction}>
        {/* feet */}
        <ellipse cx="46" cy="108" rx="11" ry="5" fill={LINE} />
        <ellipse cx="74" cy="108" rx="11" ry="5" fill={LINE} />

        <g className="mascot__torso">
          {/* sprout on top of the page */}
          <g className="mascot__sprout">
            <path d="M60 22 V8" stroke={LINE} strokeWidth="3" strokeLinecap="round" fill="none" />
            <path
              d="M60 11 C66 2 78 3 80 9 C74 15 65 15 60 11 Z"
              fill={LEAF}
              stroke={LINE}
              strokeWidth="2"
            />
            <path
              d="M60 14 C54 7 45 8 43 13 C48 18 55 18 60 14 Z"
              fill={LEAF_LIGHT}
              stroke={LINE}
              strokeWidth="2"
            />
          </g>

          {/* the page, tucked behind the head */}
          <g transform="rotate(-7 60 36)">
            <rect
              x="41"
              y="20"
              width="38"
              height="34"
              rx="4"
              fill="#ffffff"
              stroke={LINE}
              strokeWidth="3"
            />
            <path
              d="M47 30 H73 M47 37 H73 M47 44 H64"
              stroke="#b9c9b0"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* raised arms (behind the body) */}
          {waving && <Arm side="right" />}
          {armsUp && <Arm side="left" />}

          {/* body */}
          <ellipse cx="60" cy="78" rx="36" ry="31" fill={LEAF} stroke={LINE} strokeWidth="3" />
          <ellipse cx="60" cy="88" rx="22" ry="16" fill={LEAF_LIGHT} opacity="0.55" />

          {(mood === 'happy' || mood === 'celebrate') && (
            <>
              <circle cx="40" cy="86" r="5" fill="#f4a3a3" opacity="0.7" />
              <circle cx="80" cy="86" r="5" fill="#f4a3a3" opacity="0.7" />
            </>
          )}

          <Eyes mood={mood} />
          <Mouth mood={mood} />
        </g>

        <Extras mood={mood} />
      </g>
    </svg>
  );
}

function Arm({ side }: { side: 'left' | 'right' }) {
  const right = side === 'right';
  return (
    <g className={`mascot__arm mascot__arm--${side}`}>
      <path
        d={right ? 'M92 80 C100 74 102 66 100 58' : 'M28 80 C20 74 18 66 20 58'}
        stroke={LINE}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={right ? 100 : 20} cy="55" r="7" fill={LEAF} stroke={LINE} strokeWidth="2" />
    </g>
  );
}

function Eyes({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'happy' || mood === 'celebrate') {
    // closed, smiling eyes
    return (
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M40 73 Q46 64 52 73" />
        <path d="M68 73 Q74 64 80 73" />
      </g>
    );
  }
  // looking up and to the side while thinking
  const look = mood === 'thinking' ? { x: 2, y: -2 } : { x: 0, y: 0 };
  return (
    <g>
      <g className="mascot__eyes">
        <ellipse cx={46 + look.x} cy={72 + look.y} rx="5.5" ry="7.5" fill={INK} />
        <ellipse cx={74 + look.x} cy={72 + look.y} rx="5.5" ry="7.5" fill={INK} />
        <circle cx={47.8 + look.x} cy={69.5 + look.y} r="2" fill="#ffffff" />
        <circle cx={75.8 + look.x} cy={69.5 + look.y} r="2" fill="#ffffff" />
      </g>
      {mood === 'encouraging' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M38 63 Q46 56 54 62" />
          <path d="M82 63 Q74 56 66 62" />
        </g>
      )}
      {mood === 'oops' && (
        // worried brows: the inner ends go up
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M38 62 Q45 61 52 57" />
          <path d="M82 62 Q75 61 68 57" />
        </g>
      )}
      {mood === 'thinking' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M39 61 Q46 58 53 61" />
          <path d="M67 58 Q74 55 81 59" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'happy' || mood === 'celebrate') {
    const big = mood === 'celebrate';
    return (
      <g>
        <path
          d={big ? 'M47 83 Q60 107 73 83 Z' : 'M49 84 Q60 103 71 84 Z'}
          fill={INK}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={big ? 'M53 94 Q60 101 67 94 Q60 89 53 94 Z' : 'M54 92 Q60 98 66 92 Q60 88 54 92 Z'}
          fill="#e8737a"
        />
      </g>
    );
  }
  if (mood === 'oops') return <ellipse cx="60" cy="89" rx="4.5" ry="5.5" fill={INK} />;
  const d =
    mood === 'encouraging'
      ? 'M52 87 Q60 92 68 87'
      : mood === 'thinking'
        ? 'M53 89 Q59 87 67 88'
        : 'M51 86 Q60 94 69 86';
  return <path d={d} stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none" />;
}

/** Small things around Sprout: thought dots, sparkles, a drop of sweat. */
function Extras({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'thinking') {
    return (
      <g className="mascot__dots" fill="#9db58f">
        <circle cx="90" cy="42" r="2.5" />
        <circle cx="97" cy="34" r="3.5" />
        <circle cx="106" cy="24" r="4.5" />
      </g>
    );
  }
  if (mood === 'celebrate') {
    const star = 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z';
    return (
      <g fill="#f2c94c" stroke="#b07d12" strokeWidth="1">
        {[
          [14, 30, 1.2],
          [106, 24, 1],
          [10, 72, 0.8],
          [111, 66, 0.9],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path className="mascot__sparkle" d={star} style={{ animationDelay: `${i * 180}ms` }} />
          </g>
        ))}
      </g>
    );
  }
  if (mood === 'oops') {
    return (
      <path
        className="mascot__drop"
        d="M88 52 C84 58 84 62 88 63 C92 62 92 58 88 52 Z"
        fill="#bfe3f5"
        stroke="#3a8fb7"
        strokeWidth="1.5"
      />
    );
  }
  return null;
}

/** The mascot with a speech bubble. */
export function MascotBubble({
  mood,
  children,
  size = 80,
  reaction,
}: {
  mood?: MascotMood;
  children: ReactNode;
  size?: number;
  reaction?: number;
}) {
  return (
    <div className="bubble-row">
      <Mascot mood={mood} size={size} reaction={reaction} />
      <div className="bubble">{children}</div>
    </div>
  );
}
