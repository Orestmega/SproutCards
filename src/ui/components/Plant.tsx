import type { CSSProperties } from 'react';
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
    case 'marigold':
      return (
        <g>
          <Ring count={12} rx={1.9} ry={3.2} distance={4.2} fill="#ff9d2e" stroke="#d96f00" />
          <Ring count={8} rx={1.6} ry={2.4} distance={2.2} fill="#ffc04d" stroke="#d96f00" />
          <circle cx="16" cy="10" r="1.6" fill="#b85a00" />
        </g>
      );
    case 'violet':
      return (
        <g>
          <Ring count={5} rx={3} ry={3.6} distance={3.2} fill="#8b5cf6" stroke="#5b34c4" />
          <circle cx="16" cy="10" r="1.8" fill="#ffd23f" stroke="#c99400" strokeWidth="0.6" />
        </g>
      );
    case 'daffodil':
      return (
        <g>
          <Ring count={6} rx={2.6} ry={4.2} distance={4} fill="#fff2a8" stroke="#d9b93a" />
          <circle cx="16" cy="10" r="3.2" fill="#ff9d2e" stroke="#d96f00" strokeWidth="0.8" />
          <circle cx="16" cy="10" r="1.4" fill="#ffc04d" />
        </g>
      );
    case 'forgetmenot':
      return (
        <g>
          <Ring count={5} rx={2.8} ry={2.8} distance={3.4} fill="#8fd0ff" stroke="#4a94d6" />
          <circle cx="16" cy="10" r="1.9" fill="#fff4c2" stroke="#e0a800" strokeWidth="0.8" />
        </g>
      );
    case 'orchid':
      return (
        <g>
          <Ring count={3} rx={2.4} ry={5.2} distance={4.4} fill="#fbd3ee" stroke="#d06bb0" />
          <ellipse
            cx="10.6"
            cy="11"
            rx="4.4"
            ry="3.2"
            fill="#f4a6dc"
            stroke="#d06bb0"
            strokeWidth="0.7"
          />
          <ellipse
            cx="21.4"
            cy="11"
            rx="4.4"
            ry="3.2"
            fill="#f4a6dc"
            stroke="#d06bb0"
            strokeWidth="0.7"
          />
          <ellipse cx="16" cy="12" rx="2.4" ry="3.2" fill="#c0268f" />
          <circle cx="16" cy="10" r="1.2" fill="#ffd23f" />
        </g>
      );
    case 'lily':
      return (
        <g>
          <Ring count={6} rx={2.2} ry={5.4} distance={4.6} fill="#fff0f5" stroke="#e68fb0" />
          <g stroke="#e0a800" strokeWidth="0.8" strokeLinecap="round">
            <path d="M16 10 L14 6.5 M16 10 L18 6.5 M16 10 L16 6" />
          </g>
          <circle cx="14" cy="6.3" r="0.9" fill="#c2571a" />
          <circle cx="18" cy="6.3" r="0.9" fill="#c2571a" />
          <circle cx="16" cy="5.8" r="0.9" fill="#c2571a" />
        </g>
      );
    case 'peony':
      return (
        <g>
          <circle cx="16" cy="10" r="6.6" fill="#ffb3c8" stroke="#e07a9a" strokeWidth="0.8" />
          <Ring count={7} rx={2.6} ry={3.4} distance={2.6} fill="#ff8fb0" stroke="#e07a9a" />
          <circle cx="16" cy="10" r="2.4" fill="#ff6f96" />
        </g>
      );
    case 'iris':
      return (
        <g stroke="#4c2f9e" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M16 3 C19 6 18.5 10 16 11 C13.5 10 13 6 16 3 Z" fill="#9a7cf2" />
          <path d="M16 11 C11 9 8 11 8.5 15 C12 15 14.5 13.5 16 11 Z" fill="#7b5ae0" />
          <path d="M16 11 C21 9 24 11 23.5 15 C20 15 17.5 13.5 16 11 Z" fill="#7b5ae0" />
          <path d="M14.5 11.5 L16 14 L17.5 11.5" fill="#ffd23f" stroke="#c99400" />
        </g>
      );
    case 'hyacinth':
      return (
        <g fill="#f08ac4" stroke="#c4548f" strokeWidth="0.5">
          {[
            [16, 2.6],
            [14, 5],
            [18, 5],
            [13.4, 8],
            [16, 7.6],
            [18.6, 8],
            [13.6, 11],
            [16, 10.6],
            [18.4, 11],
            [16, 13.4],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.9" />
          ))}
        </g>
      );
    case 'crocus':
      return (
        <g stroke="#7e3fb8" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M11 14 C10 8 12.5 4.5 14.5 4 C15 8 14 12 11 14 Z" fill="#c69cf0" />
          <path d="M21 14 C22 8 19.5 4.5 17.5 4 C17 8 18 12 21 14 Z" fill="#c69cf0" />
          <path d="M16 2.6 C19 6 19 11 16 14.5 C13 11 13 6 16 2.6 Z" fill="#a974e8" />
          <path d="M16 6 V12" stroke="#ff9d2e" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );
    case 'carnation':
      return (
        <g stroke="#b8243f" strokeWidth="0.7" strokeLinejoin="round">
          <path
            d="M9 12 L10 7 L12 9 L13 4.5 L15 8 L16 3.5 L17 8 L19 4.5 L20 9 L22 7 L23 12 C20 15 12 15 9 12 Z"
            fill="#f2506a"
          />
          <path
            d="M11.5 12.5 L13 9.5 L14.5 12 L16 8.5 L17.5 12 L19 9.5 L20.5 12.5"
            fill="#ff8fa0"
          />
        </g>
      );
    case 'cosmos':
      return (
        <g>
          <Ring count={8} rx={2.2} ry={4} distance={4.2} fill="#ff9ccf" stroke="#d46aa4" />
          <circle cx="16" cy="10" r="2.6" fill="#ffc83d" stroke="#d99a12" strokeWidth="0.7" />
        </g>
      );
    case 'lotus':
      return (
        <g stroke="#d0618c" strokeWidth="0.8" strokeLinejoin="round">
          <path d="M16 14 C9 14 6 10 6.5 7 C10 7.5 13 10 16 14 Z" fill="#ffc6da" />
          <path d="M16 14 C23 14 26 10 25.5 7 C22 7.5 19 10 16 14 Z" fill="#ffc6da" />
          <path d="M16 14 C11 12 10 7 11.5 4 C14.5 6 16 10 16 14 Z" fill="#ffa8c8" />
          <path d="M16 14 C21 12 22 7 20.5 4 C17.5 6 16 10 16 14 Z" fill="#ffa8c8" />
          <path d="M16 14 C13.5 10 14 5 16 2.5 C18 5 18.5 10 16 14 Z" fill="#ff8ab4" />
        </g>
      );
    case 'sakura':
      return (
        <g>
          <g fill="#ffd1e0" stroke="#e89ab6" strokeWidth="0.7">
            {[0, 72, 144, 216, 288].map((angle) => (
              <path
                key={angle}
                d="M16 10 C13.5 7.5 13.5 4.5 15 3.6 L16 4.6 L17 3.6 C18.5 4.5 18.5 7.5 16 10 Z"
                transform={`rotate(${angle} 16 10)`}
              />
            ))}
          </g>
          <circle cx="16" cy="10" r="1.8" fill="#e8627f" />
        </g>
      );
    case 'golden':
      return (
        <g>
          <circle className="plant__glow" cx="16" cy="10" r="9" fill="#ffe27a" opacity="0.45" />
          <Ring count={6} rx={2.6} ry={4.2} distance={4} fill="#ffd23f" stroke="#c99400" />
          <circle cx="16" cy="10" r="2.8" fill="#fff4c2" stroke="#c99400" strokeWidth="0.7" />
          <path
            className="plant__sparkle"
            d="M26 2 l0.8 2 2 0.8 -2 0.8 -0.8 2 -0.8 -2 -2 -0.8 2 -0.8 z"
            fill="#ffffff"
          />
        </g>
      );
    // flowers of the week (the weekly chest): a soft violet glow marks them
    case 'edelweiss':
      return (
        <g>
          <WeeklyGlow />
          <g fill="#ffffff" stroke="#9aa79a" strokeWidth="0.6" strokeLinejoin="round">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <path
                key={angle}
                d="M16 10 L14.2 5.5 L16 2 L17.8 5.5 Z"
                transform={`rotate(${angle} 16 10)`}
              />
            ))}
          </g>
          <g fill="#d8d36a">
            {[
              [16, 10],
              [14.6, 9.2],
              [17.4, 9.2],
              [15, 11.2],
              [17, 11.2],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" />
            ))}
          </g>
        </g>
      );
    case 'gerbera':
      return (
        <g>
          <WeeklyGlow />
          <Ring count={16} rx={1.1} ry={3.6} distance={4.6} fill="#ff7a59" stroke="#d4512f" />
          <Ring count={12} rx={0.9} ry={2.2} distance={2.6} fill="#ffb24a" stroke="#d98a1c" />
          <circle cx="16" cy="10" r="2.1" fill="#5a3a22" />
        </g>
      );
    case 'magnolia':
      return (
        <g>
          <WeeklyGlow />
          <g stroke="#c77a9c" strokeWidth="0.7" strokeLinejoin="round">
            <path d="M16 14 C10 13 7.5 8 9 4.5 C12 5.5 14.5 9 16 14 Z" fill="#ffe1ec" />
            <path d="M16 14 C22 13 24.5 8 23 4.5 C20 5.5 17.5 9 16 14 Z" fill="#ffe1ec" />
            <path d="M16 14 C12.5 11 12.5 5 16 1.8 C19.5 5 19.5 11 16 14 Z" fill="#ffc2d8" />
          </g>
          <path d="M16 13.5 V8" stroke="#e79ab8" strokeWidth="0.8" strokeLinecap="round" />
        </g>
      );
    case 'snowdrop':
      return (
        <g>
          <WeeklyGlow />
          {/* the stem bends over and the white bell hangs from it */}
          <path
            d="M16 16 C16 8 19 5 21.5 6.5"
            stroke={STEM}
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          />
          <path d="M21.5 6.5 c1.5 0 2.2 1 2 2" stroke={STEM} strokeWidth="1.2" fill="none" />
          <g stroke="#a9b8c6" strokeWidth="0.6" strokeLinejoin="round">
            <path
              d="M23.5 8.5 C20.5 9 19.5 12.5 20.5 15 C22 14 23.5 12 23.5 8.5 Z"
              fill="#ffffff"
            />
            <path
              d="M23.5 8.5 C26.5 9 27.5 12.5 26.5 15 C25 14 23.5 12 23.5 8.5 Z"
              fill="#ffffff"
            />
            <path
              d="M23.5 8.5 C22.3 10.5 22.4 13.5 23.5 15.5 C24.6 13.5 24.7 10.5 23.5 8.5 Z"
              fill="#eef7ff"
            />
          </g>
          <circle cx="23.5" cy="8.4" r="0.9" fill="#7cc25b" />
        </g>
      );
  }
}

/** The soft violet glow and the little star of a flower of the week. */
function WeeklyGlow() {
  return (
    <g>
      <circle className="plant__glow" cx="16" cy="10" r="9.5" fill="#c9b4ff" opacity="0.4" />
      <path
        className="plant__sparkle"
        d="M4 3 l0.7 1.8 1.8 0.7 -1.8 0.7 -0.7 1.8 -0.7 -1.8 -1.8 -0.7 1.8 -0.7 z"
        fill="#ffffff"
      />
    </g>
  );
}

/** The drawing of a stage in a 32×32 box, standing on the bottom edge. A bloom shows its kind. */
export function PlantArt({
  stage,
  variety,
  seed,
}: {
  stage: GrowthStage;
  /** A kind of flower (rewards, the collection). Without it a bloom is a green bush: words have no flowers. */
  variety?: VarietyId;
  /** The plot's number in the garden picture: each flower wilts in its own way. */
  seed?: number;
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
  if (!variety) return <Bush />;
  // The owner's design (design/feedback/wilt-demo.html): the parts are separate so a thirsty garden bends
  // them in order (head, then stem, then leaves; see "Wilting" in components.css). `seed` (the plot's
  // number) gives each flower its own side to lean to, its own strength and its own delay.
  const n = seed ?? 0;
  const style = {
    '--dir': n % 3 === 1 ? -1 : 1,
    '--k': (0.85 + ((n * 37) % 30) / 100).toFixed(2),
    '--d': `${((n * 173) % 700) / 1000}s`,
    '--d2': `${((((n * 173) % 700) / 1000) * 0.4).toFixed(2)}s`,
  } as CSSProperties;
  const dir = n % 3 === 1 ? -1 : 1;
  return (
    <g className="plant" style={style}>
      <Soil />
      <g className="plant__sway" style={{ '--sd': `-${(n * 0.9) % 3.4}s` } as CSSProperties}>
        <g className="plant__lower">
          <path d="M16 28 V20" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
          <g className="plant__leaves">
            <g className="plant__leaf-r">
              <path d="M16 24 C19 19 25 19 27 22 C24 26 20 27 16 24 Z" fill={LEAF} />
            </g>
            <g className="plant__leaf-l">
              <path d="M16 25 C13 20 7 20 5 23 C8 27 12 28 16 25 Z" fill={LEAF_LIGHT} />
            </g>
          </g>
          <g className="plant__upper">
            <path d="M16 20 V12" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
            <g className="plant__head">
              <Flower variety={variety} />
            </g>
            {/* a petal of the flower's own colour, that falls off when it wilts */}
            <ellipse
              className="plant__petal"
              style={
                { '--pd': `${(0.3 + ((n * 113) % 1500) / 1000).toFixed(2)}s` } as CSSProperties
              }
              cx={16 + dir * 4}
              cy="9"
              rx="1.5"
              ry="2.6"
              fill={PETAL[variety] ?? '#ffffff'}
            />
          </g>
        </g>
      </g>
    </g>
  );
}

/** The colour of a fallen petal, per kind. */
const PETAL: Partial<Record<VarietyId, string>> = {
  daisy: '#ffffff',
  tulip: '#f0566a',
  bellflower: '#7d8cf0',
  poppy: '#ff6b3d',
  lavender: '#a678e3',
  cornflower: '#3d7bf0',
  marigold: '#ff9f1c',
  violet: '#8e5bd6',
  daffodil: '#ffd84a',
  forgetmenot: '#7fb8ff',
  peony: '#ff9fc0',
  iris: '#7a5cd6',
  hyacinth: '#c58cf0',
  crocus: '#b48cff',
  carnation: '#ff6f91',
  cosmos: '#ff9ccf',
  sunflower: '#ffcf2e',
  rose: '#e8384f',
  orchid: '#e59ff0',
  lily: '#ffd1e0',
  lotus: '#ffa8c8',
  sakura: '#ffd1e0',
  golden: '#ffd23f',
  edelweiss: '#ffffff',
  gerbera: '#ff7a59',
  magnolia: '#ffc2d8',
  snowdrop: '#ffffff',
};

/** A word known well: a full, round green bush (no flower: flowers are only rewards). */
function Bush() {
  return (
    <g>
      <Soil />
      <path d="M16 28 V18" stroke={STEM} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="10.5" cy="17" r="6" fill={LEAF} />
      <circle cx="21.5" cy="17" r="6" fill={LEAF} />
      <circle cx="16" cy="11" r="7" fill={LEAF_LIGHT} />
      <circle cx="16" cy="19" r="5.5" fill={LEAF} />
      <path
        d="M12.5 9.5 Q14.5 7.5 17 8"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
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
