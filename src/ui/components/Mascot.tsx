import type { ReactNode } from 'react';
import type { MascotMood } from '../../core/cheer';
import blankPicture from '../../assets/mascot/sprout-blank.webp';
import noEyesPicture from '../../assets/mascot/sprout-noeyes.webp';
import fullPicture from '../../assets/mascot/sprout.webp';

export type { MascotMood };

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Accessible description. Without it the picture is treated as decoration and hidden from readers. */
  label?: string;
  /**
   * Changing this number replays the mood's short reaction (a hop, a shake, a jump). The idle motion
   * (breathing, a gentle sway, blinking) runs on its own. All motion is off under reduced motion.
   */
  reaction?: number;
}

/**
 * Which picture a mood uses: the owner's picture as it is (closed, smiling eyes), the picture without
 * eyes (open eyes are drawn on it) or without eyes and mouth (the whole face is drawn).
 */
type Face = 'picture' | 'open' | 'drawn';
const FACE: Record<MascotMood, Face> = {
  normal: 'open',
  encouraging: 'open',
  happy: 'picture',
  celebrate: 'picture',
  thinking: 'drawn',
  oops: 'drawn',
  sleepy: 'drawn',
};
const PICTURE: Record<Face, string> = {
  picture: fullPicture,
  open: noEyesPicture,
  drawn: blankPicture,
};

/** The face's ink: the dark green of the eyes and mouth in the owner's picture. */
const INK = '#2b4a26';
/** Where the eyes and the mouth are in the picture (see scripts/mascot/build.mjs). */
const EYE_Y = 69.2;
const EYES_X = [46.4, 73.6];

/**
 * "Sprout": the owner's character (generated with Nano Banana from the owner's description, see
 * `design/mascot/`). One picture moves as a whole, so nothing comes apart; the faces the picture does not
 * have (open eyes, asleep, thinking, oops) are drawn on it in the same dark green.
 */
export function Mascot({ mood = 'normal', size = 96, label, reaction = 0 }: MascotProps) {
  const face = FACE[mood];
  return (
    <svg
      className={`mascot mascot--${mood}`}
      data-mood={mood}
      data-face={face}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* a new key replays the reaction animation of this group */}
      <g className="mascot__actor" key={reaction}>
        <g className="mascot__sway">
          <g className="mascot__torso">
            <image href={PICTURE[face]} x="0" y="0" width="120" height="120" />
            {face !== 'picture' && <Eyes mood={mood} />}
            {face === 'drawn' && <Mouth mood={mood} />}
          </g>
        </g>
        <Extras mood={mood} />
      </g>
    </svg>
  );
}

/** Open eyes (with a light in each), or closed ones when asleep. */
function Eyes({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'sleepy') {
    return (
      <g stroke={INK} strokeWidth="2.8" strokeLinecap="round" fill="none">
        {EYES_X.map((x) => (
          <path
            key={x}
            d={`M${x - 6} ${EYE_Y - 0.5} Q${x} ${EYE_Y + 4.5} ${x + 6} ${EYE_Y - 0.5}`}
          />
        ))}
      </g>
    );
  }
  // thinking: looking up and to the side
  const look = mood === 'thinking' ? { x: 1.4, y: -1.6 } : { x: 0, y: 0 };
  return (
    <g>
      <g className="mascot__look">
        <g className="mascot__eyes">
          {EYES_X.map((x) => (
            <g key={x}>
              <ellipse cx={x + look.x} cy={EYE_Y + look.y} rx="4.4" ry="5.6" fill={INK} />
              <circle cx={x + 1.5 + look.x} cy={EYE_Y - 2 + look.y} r="1.7" fill="#ffffff" />
              <circle
                cx={x - 1.4 + look.x}
                cy={EYE_Y + 2.2 + look.y}
                r="0.75"
                fill="#ffffff"
                opacity="0.85"
              />
            </g>
          ))}
        </g>
      </g>
      {mood === 'oops' && (
        // worried brows: the inner ends go up
        <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M40 61 Q45 60.5 50 57.5" />
          <path d="M80 61 Q75 60.5 70 57.5" />
        </g>
      )}
      {mood === 'thinking' && (
        <g stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M41 60.5 Q46 58.5 51 60.5" />
          <path d="M69 58 Q74 56 79 58.5" />
        </g>
      )}
    </g>
  );
}

/** The mouths the picture does not have: asleep, thinking, oops. */
function Mouth({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'oops') return <ellipse cx="60" cy="86" rx="3.4" ry="4.2" fill={INK} />;
  if (mood === 'sleepy') return <ellipse cx="60" cy="85.5" rx="2.4" ry="2.8" fill={INK} />;
  return (
    <path
      d="M54 86.5 Q59.5 84.8 66 86"
      stroke={INK}
      strokeWidth="2.6"
      strokeLinecap="round"
      fill="none"
    />
  );
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
