import type { GrowthStage } from '../../core/garden';

const STEM = '#3f8a2a';
const LEAF = '#58a83c';
const LEAF_LIGHT = '#7bc15e';

/** The drawing of a stage in a 32×32 box, standing on the bottom edge. */
export function PlantArt({ stage }: { stage: GrowthStage }) {
  if (stage === 'seed') {
    return (
      <g>
        <ellipse cx="16" cy="28" rx="11" ry="4" fill="#8a6041" />
        <ellipse
          cx="16"
          cy="24.5"
          rx="4.2"
          ry="5.4"
          fill="#b98a5e"
          stroke="#7a5335"
          strokeWidth="1.4"
        />
        <path d="M14.4 22.5 Q16 21 17.6 22.5" stroke="#7a5335" strokeWidth="1.1" fill="none" />
      </g>
    );
  }
  if (stage === 'sprout') {
    return (
      <g>
        <ellipse cx="16" cy="28" rx="11" ry="4" fill="#8a6041" />
        <path d="M16 28 V16" stroke={STEM} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 18 C18 12 24 11 27 13 C25 18 20 20 16 18 Z" fill={LEAF} />
        <path d="M16 20 C14 15 9 14 6 16 C8 20 12 22 16 20 Z" fill={LEAF_LIGHT} />
      </g>
    );
  }
  if (stage === 'leaf') {
    return (
      <g>
        <ellipse cx="16" cy="28" rx="11" ry="4" fill="#8a6041" />
        <path d="M16 28 V7" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M16 20 C19 15 25 15 28 18 C25 22 20 23 16 20 Z" fill={LEAF} />
        <path d="M16 23 C13 18 7 18 4 21 C7 25 12 26 16 23 Z" fill={LEAF_LIGHT} />
        <path d="M16 13 C18 8 24 7 26 9 C25 14 20 16 16 13 Z" fill={LEAF_LIGHT} />
        <path d="M16 15 C14 10 9 9 6 11 C8 15 12 17 16 15 Z" fill={LEAF} />
        <path d="M16 8 C15 4 16 2 16 1 C17 3 18 5 16 8 Z" fill={LEAF} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="16" cy="28" rx="11" ry="4" fill="#8a6041" />
      <path d="M16 28 V12" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M16 24 C19 19 25 19 27 22 C24 26 20 27 16 24 Z" fill={LEAF} />
      <path d="M16 25 C13 20 7 20 5 23 C8 27 12 28 16 25 Z" fill={LEAF_LIGHT} />
      {/* petals around the centre */}
      <g fill="#ff8fa8" stroke="#e8627f" strokeWidth="0.8">
        {[0, 72, 144, 216, 288].map((angle) => (
          <ellipse
            key={angle}
            cx="16"
            cy="5.5"
            rx="3.4"
            ry="4.4"
            transform={`rotate(${angle} 16 10)`}
          />
        ))}
      </g>
      <circle cx="16" cy="10" r="3" fill="#ffc83d" stroke="#d99a12" strokeWidth="0.8" />
    </g>
  );
}

/** One plant as an icon. Decoration unless given a `label`. */
export function Plant({
  stage,
  size = 32,
  label,
}: {
  stage: GrowthStage;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      className="plant"
      data-stage={stage}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <PlantArt stage={stage} />
    </svg>
  );
}
