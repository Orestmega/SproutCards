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
   * (breathing, blinking, leaves, arms, feet, cheeks) runs on its own. All motion is off under reduced
   * motion.
   */
  reaction?: number;
}

const INK = '#1f3a19';
const OUTLINE = '#2e6b22';
const LEAF = '#58a83c';

/**
 * "Sprout": an original round green character with a page on its head and a sprout growing from the
 * page. Drawn in plain SVG; every part that moves is its own group (`mascot__page`, `mascot__leaf`,
 * `mascot__rest`, `mascot__foot`, `mascot__cheeks`, `mascot__mouth`, ...) animated in mascot.css.
 */
export function Mascot({ mood = 'normal', size = 96, label, reaction = 0 }: MascotProps) {
  // a gradient needs an id that is unique on the page and safe inside url(#...)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const armsUp = mood === 'celebrate';
  const waving = mood === 'encouraging' || armsUp;
  const body = `url(#${id}body)`;
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
        {/* soft cel shading: a darker ball, with a lighter one drawn over it a little up and left */}
        <radialGradient id={`${id}shade`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#5fb43f" />
          <stop offset="100%" stopColor="#3a8528" />
        </radialGradient>
        <radialGradient id={`${id}body`} cx="40%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#b9eb94" />
          <stop offset="55%" stopColor="#79c855" />
          <stop offset="100%" stopColor="#5cb03d" />
        </radialGradient>
        <clipPath id={`${id}clip`}>
          <circle cx="60" cy="78" r="35" />
        </clipPath>
        <filter id={`${id}soft`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <linearGradient id={`${id}leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a9e182" />
          <stop offset="100%" stopColor="#56a43a" />
        </linearGradient>
        <linearGradient id={`${id}foot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5aab3d" />
          <stop offset="100%" stopColor="#357a26" />
        </linearGradient>
      </defs>
      <ellipse
        className="mascot__shadow"
        cx="60"
        cy="116"
        rx="32"
        ry="4"
        fill={INK}
        opacity="0.14"
      />

      {/* a new key replays the reaction animation of this group */}
      <g className="mascot__actor" key={reaction}>
        {/* feet, peeking out under the body; each one taps now and then */}
        {[46, 74].map((x, i) => (
          <g key={x} className={`mascot__foot mascot__foot--${i === 0 ? 'left' : 'right'}`}>
            <ellipse
              cx={x}
              cy="111"
              rx="10.5"
              ry="6.5"
              fill={`url(#${id}foot)`}
              stroke={OUTLINE}
              strokeWidth="2.5"
            />
            <ellipse cx={x - 3} cy="109" rx="4" ry="1.6" fill="#ffffff" opacity="0.3" />
          </g>
        ))}

        <g className="mascot__torso">
          {/* a clean paper document behind the head, a little tilted; the sprout grows from its top */}
          <g className="mascot__page">
            <g transform="rotate(-7 60 38)">
              <path
                d="M47 15 H70 L79 24 V54 A6 6 0 0 1 73 60 H47 A6 6 0 0 1 41 54 V21 A6 6 0 0 1 47 15 Z"
                fill="#ffffff"
                stroke={OUTLINE}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M70 15 V21 A3 3 0 0 0 73 24 H79"
                fill="#e3ebdd"
                stroke={OUTLINE}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M48 24 H70 M48 30 H70 M48 36 H64"
                stroke="#b5bfb0"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              {/* the sprout stands upright on the tilted page; its two leaves mirror each other */}
              <g transform="rotate(7 60 15)">
                <g className="mascot__sprout">
                  <path
                    d="M60 17 V10"
                    stroke={OUTLINE}
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {(['left', 'right'] as const).map((side) => (
                    // the mirror is on the outer group: CSS animates the inner one's transform
                    <g
                      key={side}
                      transform={side === 'left' ? 'translate(120 0) scale(-1 1)' : undefined}
                    >
                      <g className={`mascot__leaf mascot__leaf--${side}`}>
                        <path
                          d="M60 11.5 C63 3.5 76 0.8 84 5.5 C79 14.5 68 17.5 60 11.5 Z"
                          fill={`url(#${id}leaf)`}
                          stroke={OUTLINE}
                          strokeWidth="2.2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M62 11 Q71 7 81 6.7"
                          stroke={OUTLINE}
                          strokeWidth="1.2"
                          fill="none"
                          opacity="0.55"
                        />
                      </g>
                    </g>
                  ))}
                </g>
              </g>
            </g>
          </g>

          {/* arms: little round nubs at the sides that swing, or raised (behind the body) */}
          {waving ? <Arm side="right" /> : <RestingArm side="right" fill={body} />}
          {armsUp ? <Arm side="left" /> : <RestingArm side="left" fill={body} />}

          {/* body: a plump, perfectly round ball */}
          <circle cx="60" cy="78" r="35" fill={`url(#${id}shade)`} />
          <g clipPath={`url(#${id}clip)`}>
            <circle cx="56" cy="73" r="33" fill={body} filter={`url(#${id}soft)`} />
            {/* the gloss: a soft light from the top left */}
            <ellipse
              cx="44"
              cy="57"
              rx="14"
              ry="7"
              transform="rotate(-28 44 57)"
              fill="#ffffff"
              opacity="0.35"
            />
            <circle cx="32" cy="69" r="2.3" fill="#ffffff" opacity="0.45" />
          </g>
          <circle cx="60" cy="78" r="35" fill="none" stroke={OUTLINE} strokeWidth="3" />

          <g
            className="mascot__cheeks"
            fill="#ff8f9c"
            opacity={mood === 'oops' || mood === 'sleepy' ? 0.55 : 0.9}
          >
            <ellipse cx="34" cy="85" rx="7" ry="5.6" />
            <ellipse cx="86" cy="85" rx="7" ry="5.6" />
          </g>

          <Eyes mood={mood} />
          <g className="mascot__mouth">
            <Mouth mood={mood} />
          </g>
        </g>

        <Extras mood={mood} />
      </g>
    </svg>
  );
}

/** A little arm at the side when it is not raised, half hidden behind the body. */
function RestingArm({ side, fill }: { side: 'left' | 'right'; fill: string }) {
  const right = side === 'right';
  const x = right ? 97 : 23;
  return (
    <g className={`mascot__rest mascot__rest--${side}`}>
      <ellipse
        cx={x}
        cy="87"
        rx="7"
        ry="10.5"
        transform={`rotate(${right ? -24 : 24} ${x} 87)`}
        fill={fill}
        stroke={OUTLINE}
        strokeWidth="2.5"
      />
    </g>
  );
}

function Arm({ side }: { side: 'left' | 'right' }) {
  const right = side === 'right';
  return (
    <g className={`mascot__arm mascot__arm--${side}`}>
      <path
        d={right ? 'M93 80 C101 74 103 66 101 58' : 'M27 80 C19 74 17 66 19 58'}
        stroke={OUTLINE}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={right ? 101 : 19} cy="55" r="7" fill={LEAF} stroke={OUTLINE} strokeWidth="2" />
    </g>
  );
}

function Eyes({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'sleepy') {
    return (
      <g stroke={INK} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M38 74 Q45 80 52 74" />
        <path d="M68 74 Q75 80 82 74" />
      </g>
    );
  }
  if (mood === 'normal' || mood === 'happy' || mood === 'celebrate') {
    // closed, smiling eyes; they squeeze now and then
    return (
      <g className="mascot__arcs" stroke={INK} strokeWidth="4.5" strokeLinecap="round" fill="none">
        <path d="M38 76 Q45 65 52 76" />
        <path d="M68 76 Q75 65 82 76" />
      </g>
    );
  }
  // looking up and to the side while thinking
  const look = mood === 'thinking' ? { x: 2, y: -2 } : { x: 0, y: 0 };
  return (
    <g>
      <g className="mascot__look">
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
      </g>
      {mood === 'encouraging' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M38 62 Q46 55 54 61" />
          <path d="M82 62 Q74 55 66 61" />
        </g>
      )}
      {mood === 'oops' && (
        // worried brows: the inner ends go up
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M38 61 Q45 60 52 56" />
          <path d="M82 61 Q75 60 68 56" />
        </g>
      )}
      {mood === 'thinking' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M39 60 Q46 57 53 60" />
          <path d="M67 57 Q74 54 81 58" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'normal' || mood === 'happy' || mood === 'celebrate') {
    // an open smile with a tongue; wider when happy, widest when celebrating
    const w = mood === 'celebrate' ? 12 : mood === 'happy' ? 10.5 : 9;
    const h = mood === 'celebrate' ? 17 : mood === 'happy' ? 15 : 13;
    return (
      <g>
        <path
          d={`M${60 - w} 84 H${60 + w} Q${60 + w} ${84 + h} 60 ${84 + h} Q${60 - w} ${84 + h} ${60 - w} 84 Z`}
          fill={INK}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={`M${60 - w * 0.62} ${84 + h * 0.8} Q60 ${84 + h * 0.42} ${60 + w * 0.62} ${84 + h * 0.8} Q60 ${84 + h * 1.02} ${60 - w * 0.62} ${84 + h * 0.8} Z`}
          fill="#f2898e"
        />
      </g>
    );
  }
  if (mood === 'oops') return <ellipse cx="60" cy="90" rx="4.5" ry="5.5" fill={INK} />;
  if (mood === 'sleepy') return <ellipse cx="60" cy="89" rx="3" ry="3.6" fill={INK} />;
  const d = mood === 'encouraging' ? 'M51 87 Q60 94 69 87' : 'M53 90 Q59 88 67 89';
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
