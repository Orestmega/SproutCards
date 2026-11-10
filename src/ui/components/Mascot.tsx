import type { ReactNode } from 'react';
import type { MascotMood } from '../../core/cheer';
import armLeft from '../../assets/mascot/armLeft.webp';
import armRight from '../../assets/mascot/armRight.webp';
import bodyPicture from '../../assets/mascot/body.webp';
import footLeft from '../../assets/mascot/footLeft.webp';
import footRight from '../../assets/mascot/footRight.webp';
import leaves from '../../assets/mascot/leaves.webp';
import page from '../../assets/mascot/page.webp';

export type { MascotMood };

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Accessible description. Without it the picture is treated as decoration and hidden from readers. */
  label?: string;
  /**
   * Changing this number replays the mood's short reaction (a hop, a shake, a jump). The idle motion
   * (breathing, the page and the sprout swaying, arms swinging, feet tapping) runs on its own. All
   * motion is off under reduced motion.
   */
  reaction?: number;
}

/** One layer of the picture: every layer covers the whole 120 × 120 square, so they stack exactly. */
function Layer({ href }: { href: string }) {
  return <image href={href} x="0" y="0" width="120" height="120" />;
}

/**
 * "Sprout": the owner's character (drawn with Nano Banana from the owner's description), cut into layers
 * (`design/mascot/`) so that each part moves on its own: the page, the sprout, the arms and the feet.
 * The moods change the motion and add small things (sparkles, thought dots, a drop, z's) drawn in SVG.
 */
export function Mascot({ mood = 'normal', size = 96, label, reaction = 0 }: MascotProps) {
  // waving arms (encouraging: the right one, celebrating: both) get the `mascot__arm` motion
  const wavesRight = mood === 'encouraging' || mood === 'celebrate';
  const wavesLeft = mood === 'celebrate';
  const arm = (side: 'left' | 'right', waves: boolean) =>
    waves ? `mascot__arm mascot__arm--${side}` : `mascot__rest mascot__rest--${side}`;
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
      {/* a new key replays the reaction animation of this group */}
      <g className="mascot__actor" key={reaction}>
        {/* the back layers first: feet, the page with the sprout, the arms; the body goes over them */}
        <g className="mascot__foot mascot__foot--left">
          <Layer href={footLeft} />
        </g>
        <g className="mascot__foot mascot__foot--right">
          <Layer href={footRight} />
        </g>
        <g className="mascot__torso">
          <g className="mascot__page">
            <Layer href={page} />
            <g className="mascot__sprout">
              <Layer href={leaves} />
            </g>
          </g>
          <g className={arm('left', wavesLeft)}>
            <Layer href={armLeft} />
          </g>
          <g className={arm('right', wavesRight)}>
            <Layer href={armRight} />
          </g>
          <Layer href={bodyPicture} />
        </g>
        <Extras mood={mood} />
      </g>
    </svg>
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
