/**
 * The flight of a garden butterfly (the owner's design, design/feedback/decor-demo.html). It wanders along
 * one smooth closed curve through points in the air (Catmull-Rom, so the direction never jumps). Now and
 * then the curve dips onto a flower: the butterfly slows down, sits sipping with slow wing beats, and
 * lifts off again. The motion, the wing beat and the bob share one timeline, so they always agree.
 *
 * The result feeds SVG animation elements (animateMotion, animateTransform). Pure: no DOM.
 */

/** A point in the air, or a flower to sit on for `sit` seconds. */
export type RouteStop = { x: number; y: number; sit?: number };

export interface ButterflyRoute {
  /** The closed path (SVG path data). */
  path: string;
  /** Seconds for one round. */
  dur: number;
  keyPoints: string;
  keyTimes: string;
  keySplines: string;
  /** Wing scale over the round: quick beats in the air, slow ones while sitting. */
  wing: { values: string; keyTimes: string; keySplines: string };
  /** A soft rise and fall in the air, still on a flower. */
  bob: { values: string; keyTimes: string; keySplines: string };
}

type P = { x: number; y: number; sit?: number };

function cubicLength(a: P, b: P, c: P, d: P): number {
  const STEPS = 32;
  let length = 0;
  let prev = a;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const u = 1 - t;
    const point = {
      x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
    };
    length += Math.hypot(point.x - prev.x, point.y - prev.y);
    prev = point;
  }
  return length;
}

const f1 = (n: number) => Number(n.toFixed(1));

/** `speed`: user units per second in free flight. */
export function butterflyRoute(stops: readonly RouteStop[], speed: number): ButterflyRoute {
  // a flower gets an approach point above it, so the butterfly comes down and leaves upward
  const points: P[] = [];
  for (const stop of stops) {
    if (stop.sit) {
      points.push({ x: stop.x - 9, y: stop.y - 15 });
      points.push({ x: stop.x, y: stop.y, sit: stop.sit });
      points.push({ x: stop.x + 9, y: stop.y - 16 });
    } else {
      points.push({ x: stop.x, y: stop.y });
    }
  }
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n] as P;

  let path = `M${f1(at(0).x)} ${f1(at(0).y)}`;
  const segments: { length: number; into: boolean; from: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: f1(p1.x + (p2.x - p0.x) / 6), y: f1(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: f1(p2.x - (p3.x - p1.x) / 6), y: f1(p2.y - (p3.y - p1.y) / 6) };
    path += ` C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${f1(p2.x)} ${f1(p2.y)}`;
    segments.push({ length: cubicLength(p1, c1, c2, p2), into: !!p2.sit, from: !!p1.sit });
  }
  const total = segments.reduce((sum, s) => sum + s.length, 0);

  const positions = [0];
  const times = [0];
  const splines: string[] = [];
  const phases: ['fly' | 'sit', number, number][] = [];
  let t = 0;
  let done = 0;
  for (let i = 0; i < n; i++) {
    const sit = at(i).sit;
    if (sit) {
      phases.push(['sit', t, t + sit]);
      t += sit;
      positions.push(done);
      times.push(t);
      splines.push('0 0 1 1');
    }
    const segment = segments[i] as (typeof segments)[number];
    const slow = segment.into || segment.from;
    const flight = segment.length / (slow ? speed * 0.6 : speed);
    phases.push(['fly', t, t + flight]);
    t += flight;
    done += segment.length / total;
    positions.push(Math.min(1, done));
    times.push(t);
    splines.push(segment.into ? '0 0 .5 1' : segment.from ? '.5 0 1 1' : '0 0 1 1');
  }
  const dur = t;
  const fractions = (list: number[]) => list.map((x) => Math.min(1, x / dur).toFixed(4)).join(';');

  // wing beat and bob, step by step through the phases
  const wingValues: string[] = [];
  const wingTimes: number[] = [];
  const bobValues: string[] = [];
  const bobTimes: number[] = [];
  for (const [kind, from, to] of phases) {
    const step = kind === 'fly' ? 0.2 : 0.9;
    let open = true;
    for (let x = from; x < to - 1e-6; x += step) {
      wingValues.push(kind === 'fly' ? (open ? '1 1' : '.5 1') : open ? '1 1' : '.7 1');
      wingTimes.push(x);
      open = !open;
    }
    const bobStep = kind === 'fly' ? 0.42 : to - from;
    let high = true;
    for (let x = from; x < to - 1e-6; x += bobStep) {
      bobValues.push(kind === 'fly' ? (high ? '0 -1.6' : '0 1') : '0 0');
      bobTimes.push(x);
      high = !high;
    }
  }
  wingValues.push('1 1');
  wingTimes.push(dur);
  bobValues.push('0 0');
  bobTimes.push(dur);
  const smooth = (count: number) =>
    Array(count - 1)
      .fill('.45 0 .55 1')
      .join(';');

  return {
    path,
    dur: Number(dur.toFixed(2)),
    keyPoints: positions.map((x) => x.toFixed(4)).join(';'),
    keyTimes: fractions(times),
    keySplines: splines.join(';'),
    wing: {
      values: wingValues.join(';'),
      keyTimes: fractions(wingTimes),
      keySplines: smooth(wingValues.length),
    },
    bob: {
      values: bobValues.join(';'),
      keyTimes: fractions(bobTimes),
      keySplines: smooth(bobValues.length),
    },
  };
}
