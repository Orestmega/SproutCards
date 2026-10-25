import type { ReactNode } from 'react';

export type MascotMood = 'normal' | 'happy' | 'encouraging';

interface MascotProps {
  mood?: MascotMood;
  size?: number;
  /** Accessible description. Without it the picture is treated as decoration and hidden from readers. */
  label?: string;
}

const INK = '#1d2b1a';

/** "Sprout": an original little green character with a page on its head. Drawn in plain SVG. */
export function Mascot({ mood = 'normal', size = 96, label }: MascotProps) {
  return (
    <svg
      className="mascot"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {/* sprout on top of the page */}
      <path d="M60 22 V8" stroke="#3f8a2a" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path
        d="M60 11 C66 2 78 3 80 9 C74 15 65 15 60 11 Z"
        fill="#58a83c"
        stroke="#3f8a2a"
        strokeWidth="2"
      />
      <path
        d="M60 14 C54 7 45 8 43 13 C48 18 55 18 60 14 Z"
        fill="#7bc15e"
        stroke="#3f8a2a"
        strokeWidth="2"
      />

      {/* the page, tucked behind the head */}
      <g transform="rotate(-7 60 36)">
        <rect
          x="41"
          y="20"
          width="38"
          height="34"
          rx="4"
          fill="#ffffff"
          stroke="#3f8a2a"
          strokeWidth="3"
        />
        <path
          d="M47 30 H73 M47 37 H73 M47 44 H64"
          stroke="#b9c9b0"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* feet */}
      <ellipse cx="46" cy="108" rx="11" ry="5" fill="#3f8a2a" />
      <ellipse cx="74" cy="108" rx="11" ry="5" fill="#3f8a2a" />

      {/* raised arm when encouraging */}
      {mood === 'encouraging' && (
        <g>
          <path
            d="M92 80 C100 74 102 66 100 58"
            stroke="#3f8a2a"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="100" cy="55" r="7" fill="#58a83c" stroke="#3f8a2a" strokeWidth="2" />
        </g>
      )}

      {/* body */}
      <ellipse cx="60" cy="78" rx="36" ry="31" fill="#58a83c" stroke="#3f8a2a" strokeWidth="3" />
      <ellipse cx="60" cy="88" rx="22" ry="16" fill="#7bc15e" opacity="0.55" />

      {mood === 'happy' && (
        <>
          <circle cx="40" cy="86" r="5" fill="#f4a3a3" opacity="0.7" />
          <circle cx="80" cy="86" r="5" fill="#f4a3a3" opacity="0.7" />
        </>
      )}

      <Eyes mood={mood} />
      <Mouth mood={mood} />
    </svg>
  );
}

function Eyes({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'happy') {
    // closed, smiling eyes
    return (
      <g stroke={INK} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M40 73 Q46 64 52 73" />
        <path d="M68 73 Q74 64 80 73" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="46" cy="72" rx="5.5" ry="7.5" fill={INK} />
      <ellipse cx="74" cy="72" rx="5.5" ry="7.5" fill={INK} />
      <circle cx="47.8" cy="69.5" r="2" fill="#ffffff" />
      <circle cx="75.8" cy="69.5" r="2" fill="#ffffff" />
      {mood === 'encouraging' && (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d="M38 63 Q46 56 54 62" fill="none" />
          <path d="M82 63 Q74 56 66 62" fill="none" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }): ReactNode {
  if (mood === 'happy') {
    return (
      <g>
        <path
          d="M49 84 Q60 103 71 84 Z"
          fill={INK}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M54 92 Q60 98 66 92 Q60 88 54 92 Z" fill="#e8737a" />
      </g>
    );
  }
  return (
    <path
      d={mood === 'encouraging' ? 'M52 87 Q60 92 68 87' : 'M51 86 Q60 94 69 86'}
      stroke={INK}
      strokeWidth="3.5"
      strokeLinecap="round"
      fill="none"
    />
  );
}

/** The mascot with a speech bubble. */
export function MascotBubble({
  mood,
  children,
  size = 80,
}: {
  mood?: MascotMood;
  children: ReactNode;
  size?: number;
}) {
  return (
    <div className="bubble-row">
      <Mascot mood={mood} size={size} />
      <div className="bubble">{children}</div>
    </div>
  );
}
