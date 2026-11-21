import { useId, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { DayPart } from '../../core/cheer';
import type { GrowthStage } from '../../core/garden';
import type { DecorationId, GardenHealth, VarietyId } from '../../core/gardenLife';
import { ButterflyFlight, DECOR_BOX, DecorationArt, useReducedMotion } from './Decoration';
import type { RouteStop } from './butterflyRoute';
import { HILLS, makeGardenArt } from './gardenArt';
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

/** Where each decoration stands: x of its centre, y of its foot, width (decor-demo.html). */
const DECOR_PLACES: Record<DecorationId, Plot> = {
  rainbow: [96, 150, 170],
  tree: [362, 150, 66],
  beehive: [334, 160, 30],
  birdhouse: [238, 146, 34],
  fence: [66, 152, 82],
  pond: [262, 238, 90],
  butterflies: [196, 118, 48],
};

/**
 * The butterflies' rounds through the air; `{ plot, sit }` is a stop on the flower of that plot for
 * `sit` seconds. A plot with no flower (or a wilted one) is simply flown past.
 */
type PlanStop = readonly [x: number, y: number] | { plot: number; sit: number };
const PINK_PLAN: PlanStop[] = [
  [70, 128],
  [118, 112],
  [170, 126],
  [196, 108],
  { plot: 3, sit: 3.4 },
  [262, 120],
  [318, 132],
  [340, 112],
  [286, 104],
  [236, 122],
  [180, 140],
  [120, 138],
  { plot: 0, sit: 3 },
  [96, 120],
];
const BLUE_PLAN: PlanStop[] = [
  [300, 118],
  [262, 104],
  [214, 116],
  [170, 108],
  [128, 122],
  { plot: 2, sit: 3.8 },
  [64, 130],
  [86, 108],
  [150, 118],
  [214, 140],
  [268, 146],
  { plot: 13, sit: 3.2 },
  [340, 148],
  [350, 122],
];

/** The stops of a plan in garden units: a butterfly sits a little above the flower's head. */
function routeStops(
  plan: PlanStop[],
  plots: Plot[],
  blooming: (plot: number) => boolean,
): RouteStop[] {
  return plan.flatMap((stop): RouteStop[] => {
    if (!('plot' in stop)) return [{ x: stop[0], y: stop[1] }];
    const place = plots[stop.plot];
    if (!place || !blooming(stop.plot)) return [];
    const [x, y, size] = place;
    return [{ x, y: y - size + (size * 10) / 32 - 6, sit: stop.sit }];
  });
}

/** The details of the picture: made once, the same on every visit (see gardenArt.ts). */
const ART = makeGardenArt();

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
  [56, 8],
  [240, 8],
  [140, 80],
];

/** Twelve thin rays around the sun (it turns slowly). */
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const at = (angle: number) =>
    `${(330 + Math.cos(angle) * 46).toFixed(1)} ${(50 + Math.sin(angle) * 46).toFixed(1)}`;
  const a = (i * Math.PI) / 6;
  return `M330 50 L${at(a - 0.06)} L${at(a + 0.06)}Z`;
});

/** A flock of three birds: top in px, how far into the flight each one starts (s). */
const BIRDS = [
  [34, 0],
  [52, 1.4],
  [52, 2.8],
];

/** The colours of the picture are CSS variables that change with the time of day (components.css). */
const fill = (name: string): CSSProperties => ({ fill: `var(--g-${name})` });
const stop = (name: string, opacity = 1): CSSProperties => ({
  stopColor: `var(--g-${name})`,
  stopOpacity: opacity,
});

function Cloud({ x, y, scale, second }: { x: number; y: number; scale: number; second?: boolean }) {
  return (
    <g className={second ? 'garden__cloud garden__cloud--2' : 'garden__cloud'}>
      <g transform={`translate(${x} ${y}) scale(${scale})`}>
        <path
          d="M12 26a10 10 0 0 1 2-20 14 14 0 0 1 26-2 11 11 0 0 1 16 10 8 8 0 0 1-2 12z"
          style={fill('cloud')}
        />
        <path d="M8 24 Q30 31 56 24 L54 26 Q30 33 10 26Z" style={fill('cloudB')} opacity="0.8" />
      </g>
    </g>
  );
}

function Decor({ id, still = false }: { id: DecorationId; still?: boolean }) {
  const [x, y, width] = DECOR_PLACES[id];
  const box = DECOR_BOX[id];
  const height = (box.h * width) / box.w;
  return (
    <svg
      x={x - width / 2}
      y={y - height}
      width={width}
      height={height}
      viewBox={`0 0 ${box.w} ${box.h}`}
      overflow="visible"
      className={`garden__decor garden__decor--${id}`}
    >
      <DecorationArt id={id} still={still} />
    </svg>
  );
}

export interface ScenePlant {
  stage: GrowthStage;
  variety: VarietyId;
}

/** An empty plot: a soft dug mound with a small "+" (only when plots can be tapped). */
function EmptyPlot() {
  return (
    <g>
      <ellipse cx="16" cy="28.6" rx="11" ry="3.6" fill="#6e4b30" opacity="0.85" />
      <ellipse cx="15" cy="27.6" rx="7" ry="1.6" fill="#9a7150" opacity="0.6" />
      <circle cx="12" cy="28.6" r="0.7" fill="#4c321e" />
      <circle cx="19" cy="29" r="0.6" fill="#4c321e" />
      <g opacity="0.8">
        <circle cx="16" cy="21" r="4.4" fill="#ffffff" opacity="0.7" />
        <path
          d="M16 18.6 V23.4 M13.6 21 H18.4"
          stroke="#3f8a2a"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

/** A seedling with two leaves; `delay` (s) so the three of them do not sway in step. */
function Seedling({ x, delay }: { x: number; delay: number }) {
  return (
    <g transform={`translate(${x} -6.5)`}>
      <g className="garden__tuft" style={{ animationDelay: `${-delay}s` }}>
        <path d="M0 0 V-6" stroke="#3f8a2a" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M0 -4.6 C1.6 -8 5 -8 6 -6.6 C4.6 -4.4 1.8 -4 0 -4.6Z" fill="#58a83c" />
        <path d="M0 -3.8 C-1.6 -7 -4.8 -7 -5.8 -5.6 C-4.4 -3.6 -1.8 -3.2 0 -3.8Z" fill="#7bc15e" />
      </g>
    </g>
  );
}

const MUSHROOM = (
  <>
    <path d="M0 0 V-4" stroke="#f3e6cf" strokeWidth="1.6" />
    <path d="M-4 -4 a4 3.4 0 0 1 8 0z" fill="#e2564b" />
  </>
);

/** Home before the first flower: a dug bed with seedlings and a watering can, a sign, stones, mushrooms. */
function StartBed() {
  return (
    <g className="garden__bed">
      <path
        d="M120 240 Q140 222 178 214 Q214 207 226 196 L238 199 Q228 214 192 222 Q156 230 146 240Z"
        style={fill('path')}
        opacity="0.55"
      />
      <g transform="translate(66 204) scale(0.92)">
        <ellipse cx="0" cy="7" rx="38" ry="4" fill="#1e3a12" opacity="0.18" />
        <path
          d="M-34 -4 H34 L31 6 H-31Z"
          fill="#b97a44"
          stroke="#7a4f24"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M-32 1 H32" stroke="#8f5a2b" strokeWidth="0.7" opacity="0.7" />
        <path d="M-34 -4 Q0 -10 34 -4Z" fill="#6e4b30" />
        <path
          d="M-26 -5.6 Q0 -9 22 -6"
          stroke="#9a7150"
          strokeWidth="1.2"
          fill="none"
          opacity="0.6"
        />
        <Seedling x={-18} delay={0} />
        <Seedling x={0} delay={0.8} />
        <Seedling x={18} delay={1.6} />
        {/* the watering can */}
        <g transform="translate(40 4)" fill="#4fa6ff" stroke="#2d6fb8" strokeWidth="1">
          <path d="M-4 -9 h9 l1.6 9 h-12.2z" />
          <path d="M5.5 -6 l6 -4 1 1.4 -6 5" />
          <path d="M-2 -9 q3.5 -5 7 0" fill="none" strokeWidth="1.3" />
        </g>
      </g>
      {/* a sign with a seedling */}
      <g transform="translate(262 206)">
        <path d="M0 0 V-22" stroke="#8a5a2f" strokeWidth="2.6" strokeLinecap="round" />
        <rect
          x="-12"
          y="-34"
          width="24"
          height="15"
          rx="3"
          fill="#d9a066"
          stroke="#8a5a2f"
          strokeWidth="1.4"
        />
        <path d="M0 -21.5 V-29" stroke="#3f8a2a" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M0 -27 C2 -31 6 -31 7 -29 C5 -26 2 -26 0 -27Z" fill="#58a83c" />
        <path d="M0 -26 C-2 -30 -6 -30 -7 -28 C-5 -25 -2 -25 0 -26Z" fill="#7bc15e" />
      </g>
      <g transform="translate(206 226)">
        <ellipse rx="7" ry="4.2" fill="#9aa3a0" />
        <ellipse cx="-2" cy="-1.4" rx="3.6" ry="1.4" fill="#c4cbc8" />
      </g>
      <ellipse cx="218" cy="230" rx="4" ry="2.6" fill="#8b9491" />
      <g transform="translate(96 230)">
        {MUSHROOM}
        <circle cx="-1.4" cy="-5.6" r="0.7" fill="#fff" />
        <g transform="translate(6 2) scale(0.7)">{MUSHROOM}</g>
      </g>
    </g>
  );
}

/**
 * The garden picture (after the owner's design, design/feedback/scene-demo.html). Its colours follow
 * the time of day; the plants are the user's earned flowers, the decorations are earned with
 * achievements, and a garden left without water droops (`health`). `children` are drawn on top
 * (Sprout and its words). The picture itself is decoration, except for the plots on the garden screen.
 *
 * Layers, back to front: the sky (sun or moon, stars, clouds), far hills, the land (each hill with its
 * rim and fringe, then what stands on it: bushes, birdhouse, fence; patches, wildflowers; almost nothing
 * in it moves, so the browser can keep it as a still picture), then the living layer (swaying grass,
 * then the tree, hive and pond in front of it, plants, butterflies, fireflies), birds, a shooting star.
 */
export function GardenScene({
  part,
  plants,
  decorations = [],
  health = 'fresh',
  raining = false,
  big = false,
  startBed = false,
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
  /** Home: while nothing grows yet, a dug bed with seedlings stands where the flowers will be. */
  startBed?: boolean;
  children?: ReactNode;
}) {
  // gradients need ids unique on the page (Home and a second picture may meet)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const plots = big ? PLOTS_BIG : PLOTS;
  const night = part === 'night';
  const dusk = part === 'evening' || night;
  const has = (id: DecorationId) => decorations.includes(id);
  const empty = plots.every((_, i) => !plants[i]);
  const still = useReducedMotion();
  // which plots a butterfly can sit on (a flower that is not wilted); the routes change only with them
  const sitOn = health === 'wilted' ? '' : plots.map((_, i) => (plants[i] ? 1 : 0)).join('');
  const butterflyPlans = useMemo(() => {
    const blooming = (plot: number) => sitOn[plot] === '1';
    return {
      pink: routeStops(PINK_PLAN, plots, blooming),
      blue: routeStops(BLUE_PLAN, plots, blooming),
    };
  }, [sitOn, plots]);
  const rim = (i: number) => (
    <>
      <path
        d={HILLS[i]}
        fill="none"
        style={{ stroke: 'var(--g-rim)' }}
        strokeWidth={1.2 - i * 0.2}
        opacity={0.35 - i * 0.08}
        strokeLinecap="round"
      />
      <path d={ART.fringe[i]} style={fill(`h${i + 1}a`)} />
    </>
  );
  const classes = [
    'garden',
    `garden--${part}`,
    `garden--${health}`,
    big && 'garden--big',
    raining && 'garden--raining',
  ];
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
        <defs>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0" style={stop('glow', 0.95)} />
            <stop offset="0.5" style={stop('glow', 0.45)} />
            <stop offset="1" style={stop('glow', 0)} />
          </radialGradient>
          <radialGradient id={`${uid}-sun`} cx="0.38" cy="0.35">
            <stop offset="0" stopColor="#fff7d6" />
            <stop offset="0.55" style={stop('sun')} />
            <stop offset="1" style={stop('sun')} />
          </radialGradient>
        </defs>
        {night && (
          <g>
            {STARS.map(([x, y], i) => (
              <circle key={i} className="garden__star" cx={x} cy={y} r={i % 3 ? 1.1 : 1.7} />
            ))}
          </g>
        )}
        {night ? (
          <g className="garden__moon">
            <circle cx="330" cy="48" r="40" fill={`url(#${uid}-glow)`} opacity="0.5" />
            <circle cx="330" cy="48" r="20" fill="#f4f1d0" />
            <circle cx="323" cy="44" r="3.4" fill="#e2dcb4" />
            <circle cx="336" cy="55" r="2.4" fill="#e2dcb4" />
            <circle cx="337" cy="41" r="1.6" fill="#e2dcb4" />
          </g>
        ) : (
          <g className="garden__sun">
            <circle className="garden__halo" cx="330" cy="50" r="52" fill={`url(#${uid}-glow)`} />
            <g className="garden__rays" opacity="0.35" style={fill('glow')}>
              {RAYS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            <circle cx="330" cy="50" r="22" fill={`url(#${uid}-sun)`} />
          </g>
        )}
        <Cloud x={40} y={30} scale={0.9} />
        <Cloud x={190} y={58} scale={0.6} second />
      </svg>

      <svg
        className="garden__far"
        viewBox="0 0 800 160"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-haze`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={stop('haze', 0)} />
            <stop offset="1" style={stop('haze', 0.55)} />
          </linearGradient>
        </defs>
        <path
          d="M0 70 Q60 30 120 58 Q190 10 260 52 Q330 26 390 50 Q470 6 540 48 Q610 24 680 46 Q740 20 800 40 V160 H0Z"
          style={fill('far1')}
          opacity="0.75"
        />
        <path
          d="M0 100 Q90 60 190 92 Q290 56 380 88 Q480 62 580 90 Q690 58 800 84 V160 H0Z"
          style={fill('far2')}
          opacity="0.85"
        />
        <rect x="0" y="80" width="800" height="80" fill={`url(#${uid}-haze)`} />
      </svg>

      {/* the land: nothing here moves */}
      <svg
        className="garden__land"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {[
            ['h1a', 'h1b'],
            ['h2a', 'h2b'],
            ['h3a', 'h3b'],
          ].map(([top, bottom], i) => (
            <linearGradient key={i} id={`${uid}-h${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={stop(top as string)} />
              <stop offset="1" style={stop(bottom as string)} />
            </linearGradient>
          ))}
        </defs>
        {has('rainbow') && <Decor id="rainbow" />}
        {/* every hill with its own rim and fringe of blades, then what stands on it */}
        <path d={`${HILLS[0]} V240 H0Z`} fill={`url(#${uid}-h0)`} />
        {rim(0)}
        {ART.bushes.map((bush, i) => (
          <g
            key={i}
            transform={`translate(${bush.x.toFixed(1)} ${bush.y.toFixed(1)}) scale(${bush.scale.toFixed(2)})`}
          >
            <ellipse cx="0.8" cy="0.6" rx="7.5" ry="1.4" fill="#1e3a12" opacity="0.2" />
            <g style={fill('tree')}>
              {bush.base.map((c, j) => (
                <circle key={j} cx={c.cx.toFixed(1)} cy={c.cy.toFixed(1)} r={c.r.toFixed(1)} />
              ))}
            </g>
            <g style={fill('treeL')} opacity="0.85">
              {bush.light.map((c, j) => (
                <circle key={j} cx={c.cx.toFixed(1)} cy={c.cy.toFixed(1)} r={c.r.toFixed(1)} />
              ))}
            </g>
            <path
              d="M-5 -.4 Q0 1 5 -.4"
              style={{ stroke: 'var(--g-treeD)' }}
              strokeWidth="1.2"
              fill="none"
              opacity="0.5"
            />
            {bush.dotColor && (
              <g fill={bush.dotColor}>
                {bush.dots.map((c, j) => (
                  <circle key={j} cx={c.cx.toFixed(1)} cy={c.cy.toFixed(1)} r={c.r} />
                ))}
              </g>
            )}
          </g>
        ))}
        {has('birdhouse') && <Decor id="birdhouse" />}
        {has('fence') && <Decor id="fence" />}
        <path d={`${HILLS[1]} V240 H0Z`} fill={`url(#${uid}-h1)`} />
        {rim(1)}
        <path d={`${HILLS[2]} V240 H0Z`} fill={`url(#${uid}-h2)`} />
        {rim(2)}
        {ART.patches.map((p, i) => (
          <ellipse
            key={i}
            cx={p.cx.toFixed(1)}
            cy={p.cy.toFixed(1)}
            rx={p.rx.toFixed(1)}
            ry={p.ry.toFixed(1)}
            style={p.light ? fill('rim') : { fill: '#1e3a12' }}
            opacity="0.06"
          />
        ))}
        <g className="garden__wild">
          {ART.wildflowers.map((f, i) => (
            <g key={i}>
              <path
                d={`M${f.x.toFixed(1)} ${(f.y + 2.4).toFixed(1)} v-2.2`}
                style={{ stroke: 'var(--g-blade1)' }}
                strokeWidth="0.5"
              />
              <circle cx={f.x.toFixed(1)} cy={f.y.toFixed(1)} r="1.05" fill={f.color} />
              <circle cx={f.x.toFixed(1)} cy={f.y.toFixed(1)} r="0.4" fill="#f2b632" />
            </g>
          ))}
        </g>
      </svg>

      {/* the living layer: grass, plants, butterflies, fireflies */}
      <svg
        className="garden__scene"
        viewBox="0 0 400 240"
        preserveAspectRatio="xMidYMax slice"
        role={onPlot ? 'group' : undefined}
        aria-label={onPlot ? label : undefined}
        aria-hidden={onPlot ? undefined : true}
        focusable="false"
      >
        {ART.clumps.map((clump, i) => (
          <g
            key={i}
            transform={`translate(${clump.x.toFixed(1)} ${clump.y.toFixed(1)}) scale(${clump.scale.toFixed(2)})`}
          >
            <g className="garden__tuft" style={{ animationDelay: `${clump.delay}s` }}>
              <path d={clump.dark} style={fill('blade1')} />
              <path d={clump.light} style={fill('blade2')} />
            </g>
          </g>
        ))}
        {/* the tree, the hive and the pond stand in front of the grass */}
        {has('tree') && <Decor id="tree" />}
        {has('beehive') && <Decor id="beehive" still={still || night} />}
        {has('pond') && <Decor id="pond" />}
        {startBed && empty && <StartBed />}

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
                  {plant ? (
                    <PlantArt stage={plant.stage} variety={plant.variety} seed={i} />
                  ) : (
                    <EmptyPlot />
                  )}
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
        {has('butterflies') && !night && (
          // they fly across the whole garden and sit on the flowers now and then
          <g className="garden__flight">
            {still ? <Decor id="butterflies" /> : <ButterflyFlight plans={butterflyPlans} />}
          </g>
        )}
        {dusk && (
          <g className="garden__flies">
            {ART.fireflies.map((c, i) => (
              <circle
                key={i}
                className="garden__fly"
                style={{ animationDelay: `-${(i * 0.6).toFixed(1)}s, -${(i * 0.37).toFixed(1)}s` }}
                cx={c.cx.toFixed(1)}
                cy={c.cy.toFixed(1)}
                r={c.r}
              />
            ))}
          </g>
        )}
      </svg>

      {!dusk && (
        <div className="garden__birds" aria-hidden="true">
          {BIRDS.map(([top, delay], i) => (
            <div
              key={i}
              className="garden__bird"
              style={{ top: `${top}px`, animationDelay: `-${delay}s` }}
            >
              <svg viewBox="0 0 16 10">
                <path
                  d="M0 4 Q4 0 8 5 Q12 0 16 4"
                  stroke="#3b4a5c"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ))}
        </div>
      )}
      {night && <div className="garden__shoot" aria-hidden="true" />}

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
