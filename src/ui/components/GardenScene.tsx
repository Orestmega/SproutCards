import type { ReactNode } from 'react';
import type { DayPart } from '../../core/cheer';
import type { GrowthStage } from '../../core/garden';
import type { DecorationId, GardenHealth, VarietyId } from '../../core/gardenLife';
import { DecorationArt } from './Decoration';
import { PlantArt } from './Plant';

type Plot = [x: number, y: number, size: number];

/** Where plants stand in the picture: x, y of the plant's foot, size; back row first. */
const PLOTS: Plot[] = [
  [132, 176, 30],
  [176, 170, 28],
  [92, 186, 32],
  [216, 178, 32],
  [46, 198, 38],
  [150, 206, 38],
  [254, 192, 34],
  [100, 222, 44],
  [204, 216, 42],
];

/** The bigger garden screen has room for more. */
const PLOTS_BIG: Plot[] = [
  ...PLOTS,
  [292, 172, 28],
  [60, 166, 26],
  [330, 186, 32],
  [24, 222, 40],
  [302, 214, 40],
  [354, 226, 44],
];

/** Where each decoration stands: x of its centre, y of its foot, size. `back`: behind the hills. */
const DECOR_PLACES: Record<DecorationId, Plot> = {
  rainbow: [96, 152, 170],
  tree: [40, 168, 64],
  beehive: [372, 152, 40],
  birdhouse: [300, 160, 46],
  butterflies: [196, 118, 48],
  pond: [256, 240, 84],
  fence: [36, 242, 64],
};

const STARS = [
  [30, 26],
  [78, 62],
  [120, 18],
  [168, 48],
  [214, 22],
  [262, 56],
  [306, 16],
  [352, 44],
  [384, 22],
];

function Cloud({ x, y, scale, second }: { x: number; y: number; scale: number; second?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        className={second ? 'garden__cloud garden__cloud--2' : 'garden__cloud'}
        d="M12 26a10 10 0 0 1 2-20 14 14 0 0 1 26-2 11 11 0 0 1 16 10 8 8 0 0 1-2 12z"
      />
    </g>
  );
}

function Decor({ id }: { id: DecorationId }) {
  const [x, y, size] = DECOR_PLACES[id];
  return (
    <svg
      x={x - size / 2}
      y={y - size}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="garden__decor"
    >
      <DecorationArt id={id} />
    </svg>
  );
}

export interface ScenePlant {
  stage: GrowthStage;
  variety: VarietyId;
}

/** An empty plot: dug soil with a little "+" (only when plots can be tapped). */
function EmptyPlot() {
  return (
    <g>
      <ellipse cx="16" cy="28.4" rx="11.5" ry="3.8" fill="#8a6041" opacity="0.75" />
      <circle cx="16" cy="19" r="6" fill="#ffffff" opacity="0.55" />
      <path
        d="M16 15.5 V22.5 M12.5 19 H19.5"
        stroke="#3f8a2a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * The garden picture: the sky follows the time of day, the plants are the user's own words, the
 * decorations are earned with achievements, and a garden left alone for a while droops (`health`).
 * `children` are drawn on top (Sprout and its words). The picture itself is decoration.
 */
export function GardenScene({
  part,
  plants,
  decorations = [],
  health = 'fresh',
  raining = false,
  big = false,
  onPlot,
  plotLabel,
  label,
  children,
}: {
  part: DayPart;
  /** In drawing order, one per plot; `null` is an empty plot. Extra plants are not drawn. */
  plants: readonly (ScenePlant | null)[];
  /** Makes every plot a button (the garden screen); the picture is then a labelled group. */
  onPlot?: (index: number) => void;
  plotLabel?: (index: number) => string;
  label?: string;
  decorations?: readonly DecorationId[];
  health?: GardenHealth;
  raining?: boolean;
  big?: boolean;
  children?: ReactNode;
}) {
  const plots = big ? PLOTS_BIG : PLOTS;
  const dark = part === 'night';
  const has = (id: DecorationId) => decorations.includes(id);
  const classes = ['garden', `garden--${part}`, `garden--${health}`, big && 'garden--big'];
  return (
    <div className={classes.filter(Boolean).join(' ')} data-part={part} data-health={health}>
      {/* the sky has its own layer: on a wide screen the hills are cropped, the sun must not be */}
      <svg
        className="garden__sky"
        viewBox="0 0 400 110"
        preserveAspectRatio="xMaxYMin meet"
        aria-hidden="true"
        focusable="false"
      >
        {dark && (
          <g>
            {STARS.map(([x, y], i) => (
              <circle key={i} className="garden__star" cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} />
            ))}
          </g>
        )}
        {dark ? (
          <g className="garden__sun">
            <circle cx="330" cy="50" r="24" fill="#f4f1d0" />
            <circle cx="340" cy="44" r="20" fill="#16264f" />
          </g>
        ) : (
          <g className="garden__sun">
            <circle
              className="garden__glow"
              cx="330"
              cy="54"
              r="38"
              fill="#fff6c9"
              opacity="0.65"
            />
            <circle className="garden__sunball" cx="330" cy="54" r="24" fill="#ffc83d" />
          </g>
        )}
        <Cloud x={40} y={30} scale={0.9} />
        <Cloud x={190} y={58} scale={0.6} second />
      </svg>
      <svg
        className="garden__scene"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMax slice"
        role={onPlot ? 'group' : undefined}
        aria-label={onPlot ? label : undefined}
        aria-hidden={onPlot ? undefined : true}
        focusable="false"
      >
        {has('rainbow') && <Decor id="rainbow" />}
        <path className="garden__hill--1" d="M0 150 Q80 104 180 138 T400 118 V240 H0 Z" />
        {has('tree') && <Decor id="tree" />}
        {has('beehive') && <Decor id="beehive" />}
        {has('birdhouse') && <Decor id="birdhouse" />}
        <path className="garden__hill--2" d="M0 182 Q120 134 240 168 T400 152 V240 H0 Z" />
        <path className="garden__hill--3" d="M0 214 Q140 168 280 196 T400 186 V240 H0 Z" />
        {has('pond') && <Decor id="pond" />}

        {plots.map(([x, y, size], i) => {
          const plant = plants[i] ?? null;
          if (!plant && !onPlot) return null;
          const art = (
            <svg
              x={x - size / 2}
              y={y - size}
              width={size}
              height={size}
              viewBox="0 0 32 32"
              overflow="visible"
            >
              {/* a bigger invisible target makes small plants easy to tap */}
              {onPlot && <rect x="-4" y="-4" width="40" height="40" fill="transparent" />}
              {onPlot && (
                <ellipse className="garden__plot-ring" cx="16" cy="28.4" rx="13.5" ry="4.6" />
              )}
              {/* a new key (another flower planted) plays the growing animation */}
              <g className="garden__grow" key={plant ? plant.variety : 'empty'}>
                <g className="garden__plant">
                  {plant ? <PlantArt stage={plant.stage} variety={plant.variety} /> : <EmptyPlot />}
                </g>
              </g>
            </svg>
          );
          if (!onPlot) return <g key={i}>{art}</g>;
          return (
            <g
              key={i}
              className={plant ? 'garden__plot' : 'garden__plot garden__plot--empty'}
              role="button"
              tabIndex={0}
              aria-label={plotLabel?.(i)}
              onClick={() => onPlot(i)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onPlot(i);
                }
              }}
            >
              {art}
            </g>
          );
        })}
        {has('fence') && <Decor id="fence" />}
        {has('butterflies') && (
          // they fly across the garden and back, so the greeting on Home never hides them for long
          <g className="garden__flight">
            <Decor id="butterflies" />
          </g>
        )}
      </svg>
      {raining && (
        <div className="garden__rain" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <span
              key={i}
              style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.12}s` }}
            />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
