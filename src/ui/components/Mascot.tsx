import { useId } from 'react';
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
const OUTLINE = '#2f6e22';
const LEAF = '#58a83c';

/**
 * "Sprout": an original little green character with a page on its head. Drawn in plain SVG; the parts
 * that move are separate groups (`mascot__sprout`, `mascot__eyes`, ...) animated in components.css.
 */
export function Mascot({ mood = 'normal', size = 96, label, reaction = 0 }: MascotProps) {
  // a gradient needs an id that is unique on the page and safe inside url(#...)
  const bodyId = useId().replace(/[^a-zA-Z0-9]/g, '');
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
      <defs>
        <radialGradient id={bodyId} cx="38%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#a8e785" />
          <stop offset="45%" stopColor="#62bb45" />
          <stop offset="100%" stopColor="#3b8a28" />
        </radialGradient>
        <linearGradient id={`${bodyId}leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9be07a" />
          <stop offset="100%" stopColor="#4f9e36" />
        </linearGradient>
        <linearGradient id={`${bodyId}foot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f9e36" />
          <stop offset="100%" stopColor="#2f6e22" />
        </linearGradient>
      </defs>
      <ellipse
        className="mascot__shadow"
        cx="60"
        cy="113"
        rx="30"
        ry="4"
        fill={INK}
        opacity="0.12"
      />

      {/* a new key replays the reaction animation of this group */}
      <g className="mascot__actor" key={reaction}>
        {/* feet */}
        <g fill={`url(#${bodyId}foot)`} stroke={OUTLINE} strokeWidth="2.5">
          <ellipse cx="45" cy="107" rx="11" ry="6" />
          <ellipse cx="75" cy="107" rx="11" ry="6" />
        </g>
        <g fill="#ffffff" opacity="0.3">
          <ellipse cx="42" cy="104.5" rx="4.5" ry="1.6" />
          <ellipse cx="72" cy="104.5" rx="4.5" ry="1.6" />
        </g>

        <g className="mascot__torso">
          {/* sprout on top of the page */}
          <g className="mascot__sprout">
            <path
              d="M60 22 C60 16 61 11 60 6"
              stroke={OUTLINE}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              className="mascot__leaf mascot__leaf--right"
              d="M60 9 C64 0 77 0 81 6 C75 13 66 14 60 9 Z"
              fill={`url(#${bodyId}leaf)`}
              stroke={OUTLINE}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M62 8.5 Q70 5 78 5.6"
              stroke={OUTLINE}
              strokeWidth="1.2"
              fill="none"
              opacity="0.6"
            />
            <path
              className="mascot__leaf mascot__leaf--left"
              d="M60 12 C55 4 45 4 41 9 C46 15 55 16 60 12 Z"
              fill={`url(#${bodyId}leaf)`}
              stroke={OUTLINE}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M58 11.5 Q51 8.5 44 9"
              stroke={OUTLINE}
              strokeWidth="1.2"
              fill="none"
              opacity="0.6"
            />
          </g>

          {/* the page, tucked behind the head, with a folded corner */}
          <g transform="rotate(-8 60 34)">
            <path
              d="M45 17 H72 L80 25 V49 A4 4 0 0 1 76 53 H45 A4 4 0 0 1 41 49 V21 A4 4 0 0 1 45 17 Z"
              fill="#ffffff"
              stroke={OUTLINE}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M72 17 V25 H80"
              fill="#e4eedd"
              stroke={OUTLINE}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M47 29 H67 M47 36 H74 M47 43 H65"
              stroke="#b9c9b0"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* arms: resting at the sides, or raised (behind the body) */}
          {waving ? <Arm side="right" /> : <RestingArm side="right" fill={`url(#${bodyId})`} />}
          {armsUp ? <Arm side="left" /> : <RestingArm side="left" fill={`url(#${bodyId})`} />}

          {/* body: a soft drop, wider at the bottom */}
          <path
            d="M60 44 C84 44 98 60 98 80 C98 100 83 110 60 110 C37 110 22 100 22 80 C22 60 36 44 60 44 Z"
            fill={`url(#${bodyId})`}
            stroke={OUTLINE}
            strokeWidth="3"
          />
          <ellipse cx="60" cy="92" rx="22" ry="13" fill="#b6eb98" opacity="0.4" />
          {/* light from the top left */}
          <path
            d="M33 66 C36 56 44 50 53 48.5"
            stroke="#ffffff"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            opacity="0.45"
          />
          <circle cx="31" cy="73" r="2" fill="#ffffff" opacity="0.4" />

          <g fill="#ff8f9a" opacity={mood === 'happy' || mood === 'celebrate' ? 0.7 : 0.35}>
            <ellipse cx="38" cy="87" rx="6" ry="4" />
            <ellipse cx="82" cy="87" rx="6" ry="4" />
          </g>

          <Eyes mood={mood} />
          <Mouth mood={mood} />
        </g>

        <Extras mood={mood} />
      </g>
    </svg>
  );
}

/** An arm hanging at the side when it is not raised. */
function RestingArm({ side, fill }: { side: 'left' | 'right'; fill: string }) {
  const right = side === 'right';
  const x = right ? 96 : 24;
  return (
    <ellipse
      className="mascot__rest"
      cx={x}
      cy="86"
      rx="6.5"
      ry="10"
      transform={`rotate(${right ? -22 : 22} ${x} 86)`}
      fill={fill}
      stroke={OUTLINE}
      strokeWidth="2.5"
    />
  );
}

function Arm({ side }: { side: 'left' | 'right' }) {
  const right = side === 'right';
  return (
    <g className={`mascot__arm mascot__arm--${side}`}>
      <path
        d={right ? 'M92 80 C100 74 102 66 100 58' : 'M28 80 C20 74 18 66 20 58'}
        stroke={OUTLINE}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={right ? 100 : 20} cy="55" r="7" fill={LEAF} stroke={OUTLINE} strokeWidth="2" />
    </g>
  );
}

function Eyes({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'sleepy') {
    return (
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M40 71 Q46 77 52 71" />
        <path d="M68 71 Q74 77 80 71" />
      </g>
    );
  }
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
        {[45, 75].map((x) => (
          <g key={x}>
            <ellipse cx={x + look.x} cy={73 + look.y} rx="6.8" ry="8.6" fill={INK} />
            <circle cx={x + 2.2 + look.x} cy={69.6 + look.y} r="2.6" fill="#ffffff" />
            <circle
              cx={x - 2.2 + look.x}
              cy={76.6 + look.y}
              r="1.2"
              fill="#ffffff"
              opacity="0.85"
            />
          </g>
        ))}
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
  if (mood === 'sleepy') return <ellipse cx="60" cy="88" rx="3" ry="3.6" fill={INK} />;
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
  if (mood === 'sleepy') {
    return (
      <g
        className="mascot__dots mascot__zzz"
        stroke="#9db58f"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      >
        <path d="M90 44 h6 l-6 7 h6" />
        <path d="M101 30 h8 l-8 9 h8" />
      </g>
    );
  }
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
