import { useId, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { DecorationId } from '../../core/gardenLife';
import { butterflyRoute } from './butterflyRoute';
import type { RouteStop } from './butterflyRoute';

/*
 * The garden decorations (the owner's design, design/feedback/decor-demo.html and decos.js). Each one is
 * drawn in its own box (w × h) and stands on the box's bottom edge. Only small, cheap motion: the apple
 * tree sways, a bird hops on the birdhouse, bees fly round the hive, the pond shines, the reeds bend.
 */

/** The size of each drawing's box. */
export const DECOR_BOX: Record<DecorationId, { w: number; h: number }> = {
  tree: { w: 64, h: 64 },
  birdhouse: { w: 40, h: 64 },
  fence: { w: 96, h: 40 },
  pond: { w: 96, h: 30 },
  beehive: { w: 40, h: 48 },
  rainbow: { w: 96, h: 52 },
  butterflies: { w: 48, h: 32 },
};

/** What the decoration cards show of each drawing (with some air round it). */
const CARD_VIEW: Record<DecorationId, string> = {
  tree: '-14 -2 92 68',
  birdhouse: '-14 -2 68 68',
  fence: '-2 -6 100 50',
  pond: '-4 -14 104 52',
  beehive: '-14 -2 68 52',
  rainbow: '-2 -4 100 58',
  butterflies: '-6 -6 60 42',
};

const reducedMotion = {
  subscribe(change: () => void) {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    query?.addEventListener?.('change', change);
    return () => query?.removeEventListener?.('change', change);
  },
  read: () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
};

/**
 * Whether the device asks for less motion. CSS stops the CSS animations by itself; the SVG animation
 * elements (bees, flying butterflies) are not drawn at all then.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(reducedMotion.subscribe, reducedMotion.read, () => false);
}

function Grad({
  id,
  from,
  to,
  vertical,
}: {
  id: string;
  from: string;
  to: string;
  vertical?: boolean;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  );
}

const APPLES = [
  [20, 26],
  [30, 17],
  [42, 27],
  [36, 33],
  [25, 35],
  [47, 20],
  [14, 32],
];

function circles(list: number[][]): ReactNode {
  return list.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />);
}

function Tree({ u }: { u: string }) {
  return (
    <>
      <defs>
        <Grad id={`${u}trunk`} from="#a5744a" to="#6e4626" />
      </defs>
      <ellipse cx="33" cy="61.5" rx="22" ry="2.6" fill="#1e3a12" opacity="0.2" />
      <path
        d="M28.5 62 C29.5 52 29.5 44 27.5 36 L37 36 C35 44 35 52 36 62 Z"
        fill={`url(#${u}trunk)`}
        stroke="#5a3a1c"
        strokeWidth="0.9"
      />
      <path
        d="M28.6 62 q-3 .2 -5 -1.4 M36 62 q3 .2 5 -1.4"
        stroke="#6e4626"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M31 45 Q25 40 21 33 M34 42 Q39 37 42 31"
        stroke="#6e4626"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <g className="decor__sway">
        <g fill="#3f8a2a">
          {circles([
            [32, 24, 15],
            [17, 29, 10.5],
            [47, 29, 10.5],
            [23, 16, 10],
            [41, 15, 10],
            [32, 35, 10],
          ])}
        </g>
        <g fill="#58a83c">
          {circles([
            [28, 19, 11],
            [15, 26, 7],
            [43, 24, 8],
            [21, 13, 7],
            [37, 11, 7],
          ])}
        </g>
        <g fill="#8fd068" opacity="0.85">
          {circles([
            [24, 14, 5],
            [35, 8.5, 3.6],
            [13, 23, 3.4],
            [40, 20, 3.6],
          ])}
        </g>
        {APPLES.map(([x = 0, y = 0]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="2.5" fill="#e8384f" stroke="#a8243a" strokeWidth="0.5" />
            <circle cx={x - 0.8} cy={y - 0.9} r="0.7" fill="#fff" opacity="0.8" />
            <path d={`M${x} ${y - 2.4} v-1.2`} stroke="#5a3a1c" strokeWidth="0.6" />
          </g>
        ))}
      </g>
      <circle cx="45" cy="60.6" r="2" fill="#e8384f" stroke="#a8243a" strokeWidth="0.5" />
      <circle cx="20" cy="61" r="1.8" fill="#d8344a" />
    </>
  );
}

function Birdhouse({ u }: { u: string }) {
  return (
    <>
      <defs>
        <Grad id={`${u}wall`} from="#f6cf8e" to="#d99a58" vertical />
        <Grad id={`${u}roof`} from="#ec6a5a" to="#c13e31" vertical />
        <Grad id={`${u}pole`} from="#a5744a" to="#6e4626" />
      </defs>
      <ellipse cx="20" cy="62" rx="9" ry="1.8" fill="#1e3a12" opacity="0.2" />
      <rect x="18" y="36" width="4.4" height="26" rx="1" fill={`url(#${u}pole)`} />
      <path d="M12 38 h16 l-2 3 h-12z" fill="#8a5a2f" />
      <rect
        x="8"
        y="19"
        width="24"
        height="20"
        rx="2"
        fill={`url(#${u}wall)`}
        stroke="#9c6430"
        strokeWidth="1"
      />
      <path d="M9 25.5 h22 M9 32 h22" stroke="#b9783a" strokeWidth="0.6" opacity="0.6" />
      <circle cx="20" cy="27" r="3.8" fill="#4a2e1a" />
      <path d="M17 26 a3.8 3.8 0 0 1 6 0" stroke="#2e1c0f" strokeWidth="1.2" fill="none" />
      <path d="M17 34 h6" stroke="#6e4626" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M3 22 L20 7 L37 22 L34.5 24 L20 11.4 L5.5 24Z"
        fill={`url(#${u}roof)`}
        stroke="#8c2a22"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path
        d="M9 18.6 L20 9 M14 22 L23 14 M26 12 L31 16.5"
        stroke="#fff"
        strokeWidth="0.7"
        opacity="0.3"
      />
      <g className="decor__bird">
        <g transform="translate(27 10.6)">
          <ellipse cx="0" cy="0" rx="3.4" ry="2.8" fill="#5b8ff0" />
          <ellipse cx="0.6" cy="0.9" rx="2" ry="1.6" fill="#cfe0ff" />
          <circle cx="1.6" cy="-1" r="0.55" fill="#1d2b3a" />
          <path d="M3.2 -.6 l1.6 .5 -1.6 .5z" fill="#f2a03d" />
          <path d="M-3 .2 l-2.4 -1.2 .4 2z" fill="#3f6fd0" />
        </g>
      </g>
    </>
  );
}

function Fence({ u }: { u: string }) {
  return (
    <>
      <defs>
        <Grad id={`${u}plank`} from="#fff6e6" to="#e6cfa4" vertical />
      </defs>
      <ellipse cx="48" cy="38.6" rx="46" ry="1.8" fill="#1e3a12" opacity="0.18" />
      {[17, 28].map((y) => (
        <rect
          key={y}
          x="2"
          y={y}
          width="92"
          height="3.6"
          rx="1"
          fill={`url(#${u}plank)`}
          stroke="#b9925a"
          strokeWidth="0.8"
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const x = 4 + i * 11.4;
        return (
          <g key={i}>
            <path
              d={`M${x} 38 V12.5 L${x + 4} 7.5 L${x + 8} 12.5 V38Z`}
              fill={`url(#${u}plank)`}
              stroke="#b9925a"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            <path d={`M${x + 1.6} 13 V36`} stroke="#fff" strokeWidth="0.8" opacity="0.55" />
            <circle cx={x + 4} cy="18.8" r="0.55" fill="#8a6a40" />
            <circle cx={x + 4} cy="29.8" r="0.55" fill="#8a6a40" />
          </g>
        );
      })}
      <path
        d="M58 38 C56 32 62 28 60 22 C58 17 63 14 63 10"
        stroke="#4f9a38"
        strokeWidth="1.1"
        fill="none"
      />
      {[
        [59.5, 30],
        [61.6, 21.5],
        [62.8, 12],
      ].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="1.6" fill="#ff8fa8" />
          <circle cx={x} cy={y} r="0.6" fill="#ffe27a" />
        </g>
      ))}
      <path
        fill="#5fa543"
        d={[6, 20, 33, 47, 70, 84]
          .map((x) => `M${x} 38.4 l1 -4 1 4z M${x + 2} 38.4 l1.2 -3 1 3z`)
          .join(' ')}
      />
    </>
  );
}

const POND_STONES = [
  [9, 16, 3.6],
  [14, 24, 3.2],
  [26, 27.4, 3.6],
  [44, 28.4, 3.2],
  [62, 27.6, 3.6],
  [78, 24.6, 3.2],
  [87, 17, 3.4],
  [80, 9.4, 3],
  [60, 6.4, 3],
  [36, 6.2, 3.2],
  [18, 8.6, 3],
];

const POND_WATER =
  'M12 17.6 C11 10.6 28 8 48 8.4 C69 8.8 86 11 84.6 17.8 C83 24 63 26.2 46 26 C27 25.8 13 24 12 17.6Z';

function Pond({ u }: { u: string }) {
  return (
    <>
      <defs>
        {/* the water mirrors the sky of the garden (plain blue outside it) */}
        <linearGradient id={`${u}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--g-s2, #bfe6ff)' }} />
          <stop offset="1" style={{ stopColor: 'var(--g-s1, #7fc8ff)' }} />
        </linearGradient>
      </defs>
      <path
        d="M8 18 C6 9 26 5 48 5.5 C72 6 92 9 89 18 C87 26 64 29 46 28.6 C24 28.4 10 26 8 18Z"
        fill="#8f938b"
      />
      <path d={POND_WATER} fill="#3f8fc4" />
      <path d={POND_WATER} fill={`url(#${u}water)`} opacity="0.6" />
      <path
        d="M16 13 C26 9.6 50 9 70 10.4"
        stroke="#fff"
        strokeWidth="1"
        opacity="0.35"
        fill="none"
      />
      {POND_STONES.map(([x = 0, y = 0, r = 0]) => (
        <g key={`${x}-${y}`}>
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.62} fill="#a9ada4" />
          <ellipse cx={x - 0.6} cy={y - 0.6} rx={r * 0.55} ry={r * 0.3} fill="#cdd1c8" />
        </g>
      ))}
      <g className="decor__shine">
        <path
          d="M30 15 h9 M52 20 h7"
          stroke="#fff"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.7"
        />
      </g>
      <path d="M60 16.5 a4 2.2 0 1 0 4 -1.6 l-3 1.4z" fill="#58a83c" />
      <path d="M68 20.5 a3.2 1.8 0 1 0 3 -1.3 l-2.4 1.1z" fill="#4f9a38" />
      <circle cx="63.4" cy="15.6" r="1.4" fill="#ff8fa8" />
      <circle cx="63.4" cy="15.6" r="0.5" fill="#ffe27a" />
      <g className="decor__reed">
        {[
          [86, 0],
          [89, -1.5],
          [91.5, 0.8],
        ].map(([x = 0, o = 0]) => (
          <g key={x}>
            <path d={`M${x} 20 V${4 + o}`} stroke="#4f7a32" strokeWidth="0.9" />
            <rect x={x - 0.9} y={5 + o} width="1.8" height="5" rx="0.9" fill="#7a4f24" />
          </g>
        ))}
      </g>
    </>
  );
}

/** Two bees fly loops round the hive (SVG animation along a path; not drawn when motion is reduced). */
const BEE_PATHS = [
  ['M20 37 C27 34 40 31 44 23 C48 15 37 10 31 16 C25 22 35 30 25 35 C23 36 21.5 37 20 37', 7, 0],
  ['M20 37 C13 33 1 31 -3 22 C-6 14 4 9 9 15 C14 21 6 30 15 35 C17.5 36 19 37 20 37', 8.6, 3.4],
] as const;

function Beehive({ u, still }: { u: string; still: boolean }) {
  return (
    <>
      <defs>
        <linearGradient id={`${u}hive`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#e0a526" />
        </linearGradient>
        <Grad id={`${u}stand`} from="#a5744a" to="#6e4626" />
      </defs>
      <ellipse cx="20" cy="46.6" rx="13" ry="1.6" fill="#1e3a12" opacity="0.2" />
      <path d="M8.5 46.6 V38.4 H31.5 V46.6Z" fill={`url(#${u}stand)`} />
      <ellipse
        cx="20"
        cy="38.4"
        rx="11.5"
        ry="2.2"
        fill="#c49a63"
        stroke="#8a5a2f"
        strokeWidth="0.7"
      />
      <ellipse cx="20" cy="38.4" rx="6" ry="1.1" fill="none" stroke="#9c6430" strokeWidth="0.5" />
      <path
        d="M9 38 Q8.4 13 20 9 Q31.6 13 31 38Z"
        fill={`url(#${u}hive)`}
        stroke="#b8860b"
        strokeWidth="1"
      />
      <path
        d="M9.4 32 Q20 35 30.6 32 M9.8 25.6 Q20 28.6 30.2 25.6 M11.6 19.2 Q20 22 28.4 19.2 M14.6 13.6 Q20 15.6 25.4 13.6"
        stroke="#c58f12"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M13.6 30 Q13 20 17 14"
        stroke="#fff6d0"
        strokeWidth="1.6"
        opacity="0.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M16.6 38 a3.4 3 0 0 1 6.8 0z" fill="#4a2e1a" />
      {!still &&
        BEE_PATHS.map(([path, dur, begin]) => (
          <g key={path} className="decor__bee">
            <g opacity="0">
              <animate
                attributeName="opacity"
                dur={`${dur}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
                values="0;1;1;0"
                keyTimes="0;.06;.9;1"
              />
              <animateMotion
                dur={`${dur}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
                path={path}
                rotate="auto"
                calcMode="spline"
                keyTimes="0;1"
                keySplines=".3 0 .7 1"
              />
              <g className="decor__buzz">
                <ellipse rx="2.4" ry="1.6" fill="#ffc83d" stroke="#6b4a10" strokeWidth="0.35" />
                <path d="M-.7 -1.5 v3 M.8 -1.5 v3" stroke="#2a1d1a" strokeWidth="0.6" />
                <circle cx="2.1" cy="-0.2" r="0.55" fill="#2a1d1a" />
                <g className="decor__bee-wing">
                  <ellipse cx="-0.3" cy="-1.9" rx="1.5" ry="0.9" fill="#fff" />
                  <ellipse cx="0.9" cy="-1.7" rx="1.1" ry="0.7" fill="#fff" opacity="0.8" />
                </g>
              </g>
            </g>
          </g>
        ))}
    </>
  );
}

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffe24d', '#6fd45a', '#4fa6ff', '#a678e3'];

function Rainbow({ u }: { u: string }) {
  return (
    <>
      {/* the bands fade out towards the clouds at their feet */}
      <defs>
        <linearGradient id={`${u}fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.72" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${u}mask`}>
          <rect width="96" height="52" fill={`url(#${u}fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${u}mask)`} fill="none" opacity="0.8">
        <path d="M5 52 A43 43 0 0 1 91 52" stroke="#fff" strokeWidth="22" opacity="0.18" />
        {RAINBOW.map((color, i) => {
          const r = 42 - i * 3.4;
          return (
            <path
              key={color}
              d={`M${6 + i * 3.4} 52 A${r} ${r} 0 0 1 ${90 - i * 3.4} 52`}
              stroke={color}
              strokeWidth="3.6"
            />
          );
        })}
      </g>
      {[
        [10, 48],
        [86, 48],
      ].map(([x = 0, y = 0]) => (
        <g key={x} fill="#fff" opacity="0.92">
          <circle cx={x - 5} cy={y} r="4" />
          <circle cx={x} cy={y - 3} r="5" />
          <circle cx={x + 5} cy={y} r="4" />
          <rect x={x - 9} y={y} width="18" height="4" rx="2" />
        </g>
      ))}
    </>
  );
}

/** One wing (the other is its mirror). */
function Wing({ c1, c2, spots = true }: { c1: string; c2: string; spots?: boolean }) {
  return (
    <>
      <path
        d="M0 0 C-5 -9 -12 -8 -11 -2 C-10 1.4 -4 1 0 0Z"
        fill={c1}
        stroke="#5c3a52"
        strokeWidth="0.55"
      />
      <path
        d="M0 .4 C-4 2 -8 7 -4.6 7.6 C-2 8 -.6 4 0 .4Z"
        fill={c2}
        stroke="#5c3a52"
        strokeWidth="0.55"
      />
      <circle cx="-7" cy="-3.4" r="1.2" fill="#fff" opacity="0.8" />
      {spots && <circle cx="-3.6" cy="4.4" r="0.8" fill="#fff" opacity="0.7" />}
    </>
  );
}

function Body() {
  return (
    <>
      <ellipse rx="0.95" ry="4.5" cy="1" fill="#3a2a2a" />
      <path
        d="M-.3 -3 q-1.4 -3 -2.8 -3.6 M.3 -3 q1.4 -3 2.8 -3.6"
        stroke="#3a2a2a"
        strokeWidth="0.5"
        fill="none"
      />
    </>
  );
}

/** Two butterflies resting in the air, slowly opening and closing their wings (cards, still garden). */
function RestingButterflies() {
  return (
    <>
      {(
        [
          [14, 18, '#ff9db4', '#ffc2d1', 1, 0.1],
          [35, 11, '#8fb4ff', '#c3d6ff', 0.8, 0],
        ] as const
      ).map(([x, y, c1, c2, scale, delay]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${scale})`}>
          <g className="decor__flap" style={{ animationDelay: `-${delay}s` }}>
            <Wing c1={c1} c2={c2} />
          </g>
          <g transform="scale(-1 1)">
            <g className="decor__flap" style={{ animationDelay: `-${delay}s` }}>
              <Wing c1={c1} c2={c2} />
            </g>
          </g>
          <Body />
        </g>
      ))}
    </>
  );
}

/**
 * A decoration drawn in its own box (DECOR_BOX). `still`: no SVG animation elements (motion reduced).
 * Gradient ids are made unique, since the same decoration can be on the page twice (garden and card).
 */
export function DecorationArt({ id, still = false }: { id: DecorationId; still?: boolean }) {
  const u = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  switch (id) {
    case 'tree':
      return <Tree u={u} />;
    case 'birdhouse':
      return <Birdhouse u={u} />;
    case 'fence':
      return <Fence u={u} />;
    case 'pond':
      return <Pond u={u} />;
    case 'beehive':
      return <Beehive u={u} still={still} />;
    case 'rainbow':
      return <Rainbow u={u} />;
    case 'butterflies':
      return <RestingButterflies />;
  }
}

/** A decoration as an icon for its card. */
export function DecorationIcon({ id, size = 48 }: { id: DecorationId; size?: number }) {
  const still = useReducedMotion();
  return (
    <svg
      className="decor"
      width={Math.round(size * 1.55)}
      height={size}
      viewBox={CARD_VIEW[id]}
      preserveAspectRatio="xMidYMax meet"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      <DecorationArt id={id} still={still} />
    </svg>
  );
}

/** One butterfly following its route: a flight path, a wing beat and a bob on the same timeline. */
function FlyingButterfly({
  c1,
  c2,
  scale,
  stops,
  speed,
}: {
  c1: string;
  c2: string;
  scale: number;
  stops: readonly RouteStop[];
  speed: number;
}) {
  const route = butterflyRoute(stops, speed);
  const timing = { dur: `${route.dur}s`, repeatCount: 'indefinite', calcMode: 'spline' } as const;
  const wing = (
    <animateTransform
      attributeName="transform"
      type="scale"
      values={route.wing.values}
      keyTimes={route.wing.keyTimes}
      keySplines={route.wing.keySplines}
      {...timing}
    />
  );
  return (
    <g className="decor__butterfly">
      <g>
        <animateMotion
          path={route.path}
          keyPoints={route.keyPoints}
          keyTimes={route.keyTimes}
          keySplines={route.keySplines}
          {...timing}
        />
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values={route.bob.values}
            keyTimes={route.bob.keyTimes}
            keySplines={route.bob.keySplines}
            {...timing}
          />
          <g transform={`scale(${scale})`}>
            <g>
              {wing}
              <Wing c1={c1} c2={c2} spots={false} />
            </g>
            <g transform="scale(-1 1)">
              <g>
                {wing}
                <Wing c1={c1} c2={c2} spots={false} />
              </g>
            </g>
            <Body />
          </g>
        </g>
      </g>
    </g>
  );
}

export interface ButterflyPlans {
  pink: readonly RouteStop[];
  blue: readonly RouteStop[];
}

/** The two garden butterflies, flying across the whole picture (garden units, 400 × 240). */
export function ButterflyFlight({ plans }: { plans: ButterflyPlans }) {
  return (
    <>
      <FlyingButterfly c1="#ff9db4" c2="#ffc2d1" scale={0.5} stops={plans.pink} speed={19} />
      <FlyingButterfly c1="#8fb4ff" c2="#c3d6ff" scale={0.42} stops={plans.blue} speed={17} />
    </>
  );
}
