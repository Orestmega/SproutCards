import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { MascotMood } from '../../core/cheer';

export type { MascotMood };

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Accessible description. Without it the picture is treated as decoration and hidden from readers. */
  label?: string;
  /**
   * Changing this number replays the mood's short reaction (a hop, a shake, a jump). The idle motion
   * (breathing, blinking, looking around, leaves in the wind) runs on its own. All motion is off under
   * reduced motion.
   */
  reaction?: number;
  /** Sprout's eyes follow the pointer or the finger (only where it is the star of the screen). */
  watch?: boolean;
}

const INK = '#14210f';
const OUTLINE = '#2a6420';
/** How far (in picture units) the pupils may move when following the pointer. */
const LOOK_RANGE = 2.6;

/**
 * Eyes that follow the pointer: the offset is written into CSS variables on the picture, so React does
 * not re-render on every pointer move.
 */
function useWatch(ref: RefObject<SVGSVGElement | null>, on: boolean): void {
  useEffect(() => {
    const svg = ref.current;
    if (!on || !svg) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = svg.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.6);
        const length = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, length / 240);
        svg.style.setProperty('--look-x', `${((dx / length) * LOOK_RANGE * reach).toFixed(2)}px`);
        svg.style.setProperty('--look-y', `${((dy / length) * LOOK_RANGE * reach).toFixed(2)}px`);
      });
    };
    window.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, [ref, on]);
}

/**
 * "Sprout": an original little green character with a page on its head. Drawn in plain SVG with
 * gradients for volume (light from the top left, shade at the bottom right, a soft shadow of the page
 * on the head, a shine and a rim light). The parts that move are separate groups animated in mascot.css.
 */
export function Mascot({
  mood = 'normal',
  size = 96,
  label,
  reaction = 0,
  watch = false,
}: MascotProps) {
  // gradients need ids that are unique on the page and safe inside url(#...)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ref = useRef<SVGSVGElement>(null);
  useWatch(ref, watch);
  const url = (name: string) => `url(#${id}${name})`;
  const armsUp = mood === 'celebrate';
  const waving = mood === 'encouraging' || armsUp;
  const body =
    'M60 44 C84 44 98 60 98 80 C98 100 83 110 60 110 C37 110 22 100 22 80 C22 60 36 44 60 44 Z';

  return (
    <svg
      ref={ref}
      className={`mascot mascot--${mood}${watch ? ' mascot--watch' : ''}`}
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
        <radialGradient id={`${id}body`} cx="36%" cy="26%" r="88%">
          <stop offset="0%" stopColor="#d4f7b8" />
          <stop offset="22%" stopColor="#92dc6c" />
          <stop offset="58%" stopColor="#56b13b" />
          <stop offset="100%" stopColor="#2c7420" />
        </radialGradient>
        <radialGradient id={`${id}shade`} cx="78%" cy="92%" r="62%">
          <stop offset="0%" stopColor="#14420c" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#14420c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}shine`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}cheek`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff7f8f" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ff7f8f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}eye`} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3d5537" />
          <stop offset="55%" stopColor="#16240f" />
          <stop offset="100%" stopColor="#060c04" />
        </radialGradient>
        <linearGradient id={`${id}leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#b8ef92" />
          <stop offset="55%" stopColor="#66bd45" />
          <stop offset="100%" stopColor="#3b8a28" />
        </linearGradient>
        <linearGradient id={`${id}page`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e3ecdb" />
        </linearGradient>
        <linearGradient id={`${id}foot`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5cb840" />
          <stop offset="100%" stopColor="#2a6420" />
        </linearGradient>
        <radialGradient id={`${id}ground`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={INK} stopOpacity="0.3" />
          <stop offset="100%" stopColor={INK} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d8f7c2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d8f7c2" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}clip`}>
          <path d={body} />
        </clipPath>
      </defs>

      <ellipse className="mascot__shadow" cx="60" cy="112" rx="36" ry="6" fill={url('ground')} />

      {/* a new key replays the reaction animation of this group */}
      <g className="mascot__actor" key={reaction}>
        {/* feet */}
        <g fill={url('foot')} stroke={OUTLINE} strokeWidth="2.4">
          <ellipse cx="44" cy="107" rx="11.5" ry="6.2" />
          <ellipse cx="76" cy="107" rx="11.5" ry="6.2" />
        </g>
        <g fill="#ffffff" opacity="0.35">
          <ellipse cx="41" cy="104.2" rx="5" ry="1.7" />
          <ellipse cx="73" cy="104.2" rx="5" ry="1.7" />
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
            <g className="mascot__leaf mascot__leaf--right">
              <path
                d="M60 9 C64 0 77 0 81 6 C75 13 66 14 60 9 Z"
                fill={url('leaf')}
                stroke={OUTLINE}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path
                d="M62 8.5 Q70 5 78 5.6"
                stroke={OUTLINE}
                strokeWidth="1.1"
                fill="none"
                opacity="0.55"
              />
              <path
                d="M66 4 Q70 2.4 74 2.8"
                stroke="#ffffff"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />
            </g>
            <g className="mascot__leaf mascot__leaf--left">
              <path
                d="M60 12 C55 4 45 4 41 9 C46 15 55 16 60 12 Z"
                fill={url('leaf')}
                stroke={OUTLINE}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path
                d="M58 11.5 Q51 8.5 44 9"
                stroke={OUTLINE}
                strokeWidth="1.1"
                fill="none"
                opacity="0.55"
              />
            </g>
          </g>

          {/* the page, tucked behind the head, with a folded corner */}
          <g transform="rotate(-8 60 34)">
            <path
              d="M45 17 H72 L80 25 V49 A4 4 0 0 1 76 53 H45 A4 4 0 0 1 41 49 V21 A4 4 0 0 1 45 17 Z"
              fill={url('page')}
              stroke={OUTLINE}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <path
              d="M72 17 V25 H80"
              fill="#d6e2cd"
              stroke={OUTLINE}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M47 29 H67 M47 36 H74 M47 43 H65"
              stroke="#b4c6aa"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </g>

          {/* arms: resting at the sides, or raised (behind the body) */}
          {waving ? (
            <Arm side="right" fill={url('body')} />
          ) : (
            <RestingArm side="right" fill={url('body')} />
          )}
          {armsUp ? (
            <Arm side="left" fill={url('body')} />
          ) : (
            <RestingArm side="left" fill={url('body')} />
          )}

          {/* body: a soft drop, lit from the top left */}
          <path d={body} fill={url('body')} />
          <g clipPath={url('clip')}>
            {/* shade at the bottom right and the page's shadow on the head */}
            <rect x="20" y="40" width="80" height="72" fill={url('shade')} />
            <ellipse cx="60" cy="45" rx="24" ry="7" fill="#1b4d12" opacity="0.3" />
            {/* light bouncing back from the ground */}
            <ellipse cx="60" cy="112" rx="32" ry="10" fill={url('glow')} />
            {/* rim light on the right edge */}
            <path
              d="M92 66 C97 76 97 88 92 98"
              stroke="#e6ffd4"
              strokeWidth="2.4"
              fill="none"
              opacity="0.55"
            />
          </g>
          <path d={body} fill="none" stroke={OUTLINE} strokeWidth="2.8" />
          <ellipse cx="60" cy="94" rx="24" ry="14" fill={url('glow')} />
          {/* shine */}
          <ellipse
            className="mascot__shine"
            cx="40"
            cy="58"
            rx="11"
            ry="6.5"
            transform="rotate(-28 40 58)"
            fill={url('shine')}
          />
          <circle cx="31.5" cy="71" r="2.2" fill="#ffffff" opacity="0.55" />

          <g
            className="mascot__cheeks"
            opacity={mood === 'happy' || mood === 'celebrate' ? 1 : 0.55}
          >
            <ellipse cx="37" cy="87" rx="7.5" ry="5" fill={url('cheek')} />
            <ellipse cx="83" cy="87" rx="7.5" ry="5" fill={url('cheek')} />
          </g>

          <Eyes mood={mood} eye={url('eye')} />
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
      strokeWidth="2.4"
    />
  );
}

function Arm({ side, fill }: { side: 'left' | 'right'; fill: string }) {
  const right = side === 'right';
  const path = right ? 'M92 80 C100 74 102 66 100 58' : 'M28 80 C20 74 18 66 20 58';
  return (
    <g className={`mascot__arm mascot__arm--${side}`}>
      <path d={path} stroke={OUTLINE} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d={path} stroke="#5cb840" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle
        cx={right ? 100 : 20}
        cy="55"
        r="7.5"
        fill={fill}
        stroke={OUTLINE}
        strokeWidth="2.4"
      />
      <circle cx={right ? 98 : 18} cy="52.5" r="2.2" fill="#ffffff" opacity="0.55" />
    </g>
  );
}

function Eyes({ mood, eye }: { mood: MascotMood; eye: string }): ReactNode {
  if (mood === 'sleepy') {
    return (
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M39 72 Q45 78 51 72" />
        <path d="M69 72 Q75 78 81 72" />
      </g>
    );
  }
  if (mood === 'happy' || mood === 'celebrate') {
    // closed, smiling eyes
    return (
      <g stroke={INK} strokeWidth="3.8" strokeLinecap="round" fill="none">
        <path d="M38 74 Q45 64 52 74" />
        <path d="M68 74 Q75 64 82 74" />
      </g>
    );
  }
  // looking up and to the side while thinking
  const look = mood === 'thinking' ? { x: 2, y: -2.5 } : { x: 0, y: 0 };
  return (
    <g>
      <g className="mascot__eyes">
        {[45, 75].map((x) => (
          <g key={x}>
            {/* the white around the pupil gives depth */}
            <ellipse
              cx={x}
              cy="73"
              rx="8.4"
              ry="10"
              fill="#ffffff"
              stroke={OUTLINE}
              strokeWidth="1.6"
            />
            <g className="mascot__look">
              <ellipse cx={x + look.x} cy={74 + look.y} rx="6.2" ry="7.6" fill={eye} />
              <circle cx={x + 2.3 + look.x} cy={70.6 + look.y} r="2.5" fill="#ffffff" />
              <circle
                cx={x - 2.1 + look.x}
                cy={77.4 + look.y}
                r="1.1"
                fill="#ffffff"
                opacity="0.85"
              />
            </g>
          </g>
        ))}
      </g>
      {mood === 'encouraging' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M37 60 Q45 53 53 59" />
          <path d="M83 60 Q75 53 67 59" />
        </g>
      )}
      {mood === 'oops' && (
        // worried brows: the inner ends go up
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M37 60 Q44 59 52 54" />
          <path d="M83 60 Q76 59 68 54" />
        </g>
      )}
      {mood === 'thinking' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M38 59 Q45 56 53 59" />
          <path d="M67 56 Q74 53 82 57" />
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
          d={big ? 'M47 85 Q60 109 73 85 Z' : 'M49 86 Q60 104 71 86 Z'}
          fill="#3a1414"
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={big ? 'M53 96 Q60 103 67 96 Q60 91 53 96 Z' : 'M54 94 Q60 100 66 94 Q60 90 54 94 Z'}
          fill="#ff7b86"
        />
        <path
          d={big ? 'M50 86.5 H70' : 'M51.5 87.5 H68.5'}
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
      </g>
    );
  }
  if (mood === 'oops') return <ellipse cx="60" cy="91" rx="4.6" ry="5.6" fill="#3a1414" />;
  if (mood === 'sleepy') return <ellipse cx="60" cy="90" rx="3" ry="3.6" fill="#3a1414" />;
  const d =
    mood === 'encouraging'
      ? 'M51 89 Q60 95 69 89'
      : mood === 'thinking'
        ? 'M53 91 Q59 89 67 90'
        : 'M50 88 Q60 97 70 88';
  return <path d={d} stroke={INK} strokeWidth="3.6" strokeLinecap="round" fill="none" />;
}

/** Small things around Sprout: thought dots, sparkles, a drop of sweat, sleepy z's. */
function Extras({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'sleepy') {
    return (
      <g
        className="mascot__dots mascot__zzz"
        stroke="#9db58f"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M90 44 h6 l-6 7 h6" />
        <path d="M101 30 h8 l-8 9 h8" />
      </g>
    );
  }
  if (mood === 'thinking') {
    return (
      <g className="mascot__dots" fill="#9db58f">
        <circle cx="92" cy="42" r="2.5" />
        <circle cx="99" cy="34" r="3.5" />
        <circle cx="108" cy="24" r="4.5" />
      </g>
    );
  }
  if (mood === 'celebrate') {
    const star = 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z';
    return (
      <g fill="#ffd23f" stroke="#b07d12" strokeWidth="1">
        {[
          [12, 30, 1.2],
          [108, 24, 1],
          [8, 72, 0.8],
          [113, 66, 0.9],
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
        d="M90 50 C86 56 86 60 90 61 C94 60 94 56 90 50 Z"
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
