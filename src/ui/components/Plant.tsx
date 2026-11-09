import type { GrowthStage } from '../../core/garden';
import type { VarietyId } from '../../core/gardenLife';

const STEM = '#3f8a2a';
const LEAF = '#58a83c';
const LEAF_LIGHT = '#7bc15e';
const SOIL = '#8a6041';

function Soil() {
  return (
    <g>
      <ellipse cx="16" cy="28.4" rx="11.5" ry="3.8" fill={SOIL} />
      <ellipse cx="14" cy="27.6" rx="6" ry="1.4" fill="#a3754f" opacity="0.6" />
    </g>
  );
}

function Leaves({ low = false }: { low?: boolean }) {
  const y = low ? 3 : 0;
  return (
    <g>
      <path
        d={`M16 ${24 + y} C19 ${19 + y} 25 ${19 + y} 27 ${22 + y} C24 ${26 + y} 20 ${27 + y} 16 ${24 + y} Z`}
        fill={LEAF}
      />
      <path
        d={`M16 ${25 + y} C13 ${20 + y} 7 ${20 + y} 5 ${23 + y} C8 ${27 + y} 12 ${28 + y} 16 ${25 + y} Z`}
        fill={LEAF_LIGHT}
      />
    </g>
  );
}

/** Petals around a centre: `count` ellipses of the given size and colours. */
function Ring({
  count,
  rx,
  ry,
  distance,
  fill,
  stroke,
}: {
  count: number;
  rx: number;
  ry: number;
  distance: number;
  fill: string;
  stroke: string;
}) {
  return (
    <g fill={fill} stroke={stroke} strokeWidth="0.7">
      {Array.from({ length: count }, (_, i) => (
        <ellipse
          key={i}
          cx="16"
          cy={10 - distance}
          rx={rx}
          ry={ry}
          transform={`rotate(${(360 / count) * i} 16 10)`}
        />
      ))}
    </g>
  );
}

/** The head of a flower of each kind, centred around (16, 10). */
function Flower({ variety }: { variety: VarietyId }) {
  switch (variety) {
    case 'daisy':
      return (
        <g>
          <Ring count={9} rx={1.7} ry={3.6} distance={3.8} fill="#ffffff" stroke="#c9d3c4" />
          <circle cx="16" cy="10" r="2.8" fill="#ffc83d" stroke="#d99a12" strokeWidth="0.7" />
        </g>
      );
    case 'tulip':
      return (
        <path
          d="M10.5 6 L13 9 L16 4.5 L19 9 L21.5 6 C22.5 12 20 15.5 16 15.5 C12 15.5 9.5 12 10.5 6 Z"
          fill="#f0566a"
          stroke="#c23a4e"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      );
    case 'bellflower':
      return (
        <g fill="#7d8cf0" stroke="#4f5cc4" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M16 5 C12 5 11 10 10 13.5 L12 12.6 L14 14 L16 12.8 L18 14 L20 12.6 L22 13.5 C21 10 20 5 16 5 Z" />
        </g>
      );
    case 'poppy':
      return (
        <g>
          <Ring count={4} rx={4.2} ry={4} distance={3.2} fill="#ff6b3d" stroke="#d1461e" />
          <circle cx="16" cy="10" r="2.4" fill="#2a1d1a" />
        </g>
      );
    case 'lavender':
      return (
        <g fill="#a678e3" stroke="#7d4fbf" strokeWidth="0.5">
          {[3, 5.6, 8.2, 10.8, 13.4].map((y, i) => (
            <g key={y}>
              <ellipse cx={14.6} cy={y} rx="1.6" ry="1.9" />
              <ellipse cx={17.4} cy={y + (i % 2 ? 0.6 : 0)} rx="1.6" ry="1.9" />
            </g>
          ))}
        </g>
      );
    case 'cornflower':
      return (
        <g>
          <path
            d="M16 3 L17.4 7 L21.5 5.2 L19.4 9 L23.5 10.6 L19.2 11.6 L21 15.6 L16.9 13.4 L16 17.5 L15.1 13.4 L11 15.6 L12.8 11.6 L8.5 10.6 L12.6 9 L10.5 5.2 L14.6 7 Z"
            fill="#3d7bf0"
            stroke="#2856b8"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="10.3" r="2" fill="#26338a" />
        </g>
      );
    case 'sunflower':
      return (
        <g>
          <Ring count={14} rx={1.6} ry={3.6} distance={5.4} fill="#ffcf2e" stroke="#e09a00" />
          <circle cx="16" cy="10" r="4.2" fill="#7a4a1c" stroke="#5a3410" strokeWidth="0.7" />
          <circle cx="15" cy="9" r="0.6" fill="#a8743a" />
          <circle cx="17.2" cy="10.6" r="0.6" fill="#a8743a" />
        </g>
      );
    case 'rose':
      return (
        <g stroke="#a8243a" strokeWidth="0.8">
          <circle cx="16" cy="10" r="5.8" fill="#e8384f" />
          <path
            d="M12 10 C12 6 20 6 20 10 C20 13 15 13.5 14.5 10.5 C14.2 8.6 17.6 8.2 17.6 10"
            fill="none"
          />
          <path d="M10.6 12 C12 15.4 20 15.4 21.4 12" fill="none" />
        </g>
      );
    case 'golden':
      return (
        <g>
          <circle cx="16" cy="10" r="9" fill="#ffe27a" opacity="0.45" />
          <Ring count={6} rx={2.6} ry={4.2} distance={4} fill="#ffd23f" stroke="#c99400" />
          <circle cx="16" cy="10" r="2.8" fill="#fff4c2" stroke="#c99400" strokeWidth="0.7" />
          <path
            className="plant__sparkle"
            d="M26 2 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 z"
            fill="#ffffff"
          />
        </g>
      );
  }
}

/** The drawing of a stage in a 32×32 box, standing on the bottom edge. A bloom shows its kind. */
export function PlantArt({
  stage,
  variety = 'daisy',
}: {
  stage: GrowthStage;
  variety?: VarietyId;
}) {
  if (stage === 'seed') {
    return (
      <g>
        <Soil />
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
        <Soil />
        <path d="M16 28 V16" stroke={STEM} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M16 18 C18 12 24 11 27 13 C25 18 20 20 16 18 Z" fill={LEAF} />
        <path d="M16 20 C14 15 9 14 6 16 C8 20 12 22 16 20 Z" fill={LEAF_LIGHT} />
      </g>
    );
  }
  if (stage === 'leaf') {
    return (
      <g>
        <Soil />
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
      <Soil />
      <path d="M16 28 V12" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
      <Leaves />
      <Flower variety={variety} />
    </g>
  );
}

/** One plant as an icon. Decoration unless given a `label`. */
export function Plant({
  stage,
  variety,
  size = 32,
  label,
}: {
  stage: GrowthStage;
  variety?: VarietyId;
  size?: number;
  label?: string;
}) {
  return (
    <svg
      className="plant"
      data-stage={stage}
      data-variety={stage === 'bloom' ? (variety ?? 'daisy') : undefined}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <PlantArt stage={stage} variety={variety} />
    </svg>
  );
}
