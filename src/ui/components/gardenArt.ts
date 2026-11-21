/**
 * The fixed details of the garden picture (after the owner's design, design/feedback/scene-demo.html):
 * bushes on the back hill, a fringe of small blades along every hill, grass clumps, tiny wildflowers,
 * light patches and fireflies. They are made once, from a seeded random sequence, so the picture is the
 * same on every visit and every device. Pure geometry: no React, no DOM. Units: the 400 × 240 scene.
 */

type Point = { x: number; y: number };

/** The tops of the three hills, back to front (the same curves as the hill shapes in GardenScene). */
export const HILLS = [
  'M0 150 Q80 104 180 138 T400 118',
  'M0 182 Q120 134 240 168 T400 152',
  'M0 214 Q140 168 280 196 T400 186',
] as const;

/** The same hills as plain numbers: start, control, middle, end (the second control mirrors the first). */
const HILL_POINTS: readonly (readonly number[])[] = [
  [0, 150, 80, 104, 180, 138, 400, 118],
  [0, 182, 120, 134, 240, 168, 400, 152],
  [0, 214, 140, 168, 280, 196, 400, 186],
];

/** A small repeatable random sequence (Park–Miller), the same one the design used. */
function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function quad(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

/** Points along a hill top, evenly spaced by length, so `at(0.5)` is half way along the curve. */
function hillCurve(hill: number): (fraction: number) => Point {
  const [x0, y0, cx, cy, x1, y1, x2, y2] = HILL_POINTS[hill] as number[] as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const start = { x: x0, y: y0 };
  const control = { x: cx, y: cy };
  const middle = { x: x1, y: y1 };
  const mirror = { x: 2 * x1 - cx, y: 2 * y1 - cy };
  const end = { x: x2, y: y2 };
  const STEPS = 200;
  const points: Point[] = [];
  for (let i = 0; i <= STEPS; i++) points.push(quad(start, control, middle, i / STEPS));
  for (let i = 1; i <= STEPS; i++) points.push(quad(middle, mirror, end, i / STEPS));
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    lengths.push((lengths[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[lengths.length - 1] as number;
  return (fraction) => {
    const target = Math.min(Math.max(fraction, 0), 1) * total;
    let i = 1;
    while (i < lengths.length - 1 && (lengths[i] as number) < target) i++;
    const before = lengths[i - 1] as number;
    const span = (lengths[i] as number) - before || 1;
    const k = (target - before) / span;
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
}

const f1 = (n: number) => n.toFixed(1);

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface Bush {
  x: number;
  y: number;
  scale: number;
  /** Dark puffs, then lighter puffs on their top left, then berries or tiny flowers (some bushes). */
  base: Circle[];
  light: Circle[];
  dots: Circle[];
  dotColor?: string;
}

export interface Clump {
  x: number;
  y: number;
  scale: number;
  /** The blades in the two greens, each colour as one path. */
  dark: string;
  light: string;
  /** Seconds: every clump sways at its own moment. */
  delay: number;
}

export interface Wildflower {
  x: number;
  y: number;
  color: string;
}

export interface Patch {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  light: boolean;
}

export interface GardenArt {
  bushes: Bush[];
  clumps: Clump[];
  wildflowers: Wildflower[];
  /** One path of small blades along the top of each hill, back to front. */
  fringe: [string, string, string];
  patches: Patch[];
  fireflies: Circle[];
}

const WILDFLOWER_COLORS = ['#fffdf2', '#ffe27a', '#ffc2d1', '#d9d2ff'];
/** Where bushes stand along the back hill, and the colour of their berries (0: none). */
const BUSHES: [number, string | 0][] = [
  [0.06, 0],
  [0.1, '#fff4f6'],
  [0.3, '#e8475a'],
  [0.5, 0],
  [0.53, 0],
  [0.74, '#fff4f6'],
  [0.9, 0],
];

function makeBush(
  R: () => number,
  x: number,
  y: number,
  scale: number,
  dotColor: string | 0,
): Bush {
  const n = 4 + Math.floor(R() * 2);
  const base: Circle[] = [];
  const light: Circle[] = [];
  const dots: Circle[] = [];
  for (let j = 0; j < n; j++) {
    const t = j / (n - 1) - 0.5;
    const px = t * 9 + (R() - 0.5) * 1.2;
    const r = 2.6 + R() * 1.4 - Math.abs(t) * 1.6;
    const py = -r * 0.75 - (0.5 - Math.abs(t)) * 4.6;
    base.push({ cx: px, cy: py, r });
    light.push({ cx: px - r * 0.28, cy: py - r * 0.32, r: r * 0.62 });
  }
  if (dotColor) {
    for (let j = 0; j < 5; j++) dots.push({ cx: (R() - 0.5) * 9, cy: -1.5 - R() * 5, r: 0.55 });
  }
  return { x, y, scale, base, light, dots, dotColor: dotColor || undefined };
}

function makeClump(R: () => number, x: number, y: number, scale: number): Clump {
  let dark = '';
  let light = '';
  for (let k = 0; k < 5; k++) {
    const bx = (k - 2) * 1.5;
    const h = 5 + R() * 4.5 - Math.abs(k - 2) * 1.2;
    const lean = (k - 2) * 1.6 + (R() - 0.5) * 1.4;
    const w = 1.3;
    const blade =
      `M${f1(bx - w / 2)} 0 Q${f1(bx + lean * 0.3)} ${f1(-h * 0.55)} ${f1(bx + lean)} ${f1(-h)} ` +
      `Q${f1(bx + lean * 0.25 + w * 0.3)} ${f1(-h * 0.5)} ${f1(bx + w / 2)} 0Z`;
    if (k % 2) light += blade;
    else dark += blade;
  }
  return { x, y, scale, dark, light, delay: -Number(f1(R() * 3)) };
}

/** Builds the details of the picture; the same result on every call. */
export function makeGardenArt(): GardenArt {
  const R = random(7);
  const hills = [hillCurve(0), hillCurve(1), hillCurve(2)] as const;

  const bushes = BUSHES.map(([fraction, dotColor]) => {
    const q = hills[0](fraction);
    return makeBush(R, q.x, q.y + 2.2, 1.25 + R() * 0.5, dotColor);
  });

  const clumps: Clump[] = [];
  const wildflowers: Wildflower[] = [];
  for (const [hill, n, dy] of [
    [hills[1], 20, 12],
    [hills[2], 24, 16],
  ] as const) {
    for (let i = 0; i < n; i++) {
      const q = hill((i + R() * 0.8) / n);
      clumps.push(makeClump(R, q.x, q.y + 4 + R() * dy, 0.7 + R() * 0.6));
    }
    for (let i = 0; i < n / 2; i++) {
      const q = hill(R());
      wildflowers.push({
        x: q.x,
        y: q.y + 5 + R() * (dy + 8),
        color: WILDFLOWER_COLORS[i % 4] as string,
      });
    }
  }

  const fringe = hills.map((hill) => {
    let d = '';
    for (let step = 0; step < 223; step++) {
      const q = hill(step * 0.0045);
      const h = 1.4 + R() * 2.2;
      const lean = (R() - 0.5) * 1.4;
      d +=
        `M${f1(q.x - 0.7)} ${f1(q.y + 0.6)} L${f1(q.x + lean)} ${f1(q.y - h)} ` +
        `L${f1(q.x + 0.7)} ${f1(q.y + 0.6)}Z`;
    }
    return d;
  }) as [string, string, string];

  const patches: Patch[] = [];
  for (let i = 0; i < 14; i++) {
    const q = (i % 2 ? hills[1] : hills[2])(R());
    patches.push({
      cx: q.x,
      cy: q.y + 8 + R() * 18,
      rx: 10 + R() * 14,
      ry: 2.4 + R() * 2,
      light: i % 3 !== 0,
    });
  }

  const fireflies = Array.from({ length: 12 }, () => ({
    cx: 20 + R() * 360,
    cy: 150 + R() * 70,
    r: 1.3,
  }));

  return { bushes, clumps, wildflowers, fringe, patches, fireflies };
}
