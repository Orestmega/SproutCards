import { butterflyRoute } from './butterflyRoute';

const list = (text: string) => text.split(';').map(Number);

describe('butterflyRoute', () => {
  const air = [
    { x: 70, y: 128 },
    { x: 196, y: 108 },
    { x: 262, y: 120 },
  ];

  it('makes a closed smooth path whose timing starts at 0, ends at 1 and never goes back', () => {
    const route = butterflyRoute(air, 19);
    expect(route.path.startsWith('M70 128 C')).toBe(true);
    expect(route.path.match(/C/g)).toHaveLength(3); // one curve per point, back to the start
    for (const times of [route.keyTimes, route.wing.keyTimes, route.bob.keyTimes]) {
      const t = list(times);
      expect(t[0]).toBe(0);
      expect(t[t.length - 1]).toBe(1);
      expect(t.every((x, i) => i === 0 || x >= (t[i - 1] as number))).toBe(true);
    }
    const points = list(route.keyPoints);
    expect(points).toHaveLength(list(route.keyTimes).length);
    expect(points[points.length - 1]).toBe(1);
    // one spline per interval, as SVG animation requires
    expect(route.keySplines.split(';')).toHaveLength(points.length - 1);
    expect(route.wing.keySplines.split(';')).toHaveLength(route.wing.values.split(';').length - 1);
  });

  it('a stop on a flower adds the sitting time, slows the approach and keeps the place while sitting', () => {
    const flying = butterflyRoute(air, 19);
    const sitting = butterflyRoute([...air, { x: 216, y: 150, sit: 3 }], 19);
    expect(sitting.dur).toBeGreaterThan(flying.dur + 3);
    // while it sits, the position along the path stays the same for one interval
    const points = list(sitting.keyPoints);
    expect(points.some((p, i) => i > 0 && p === points[i - 1])).toBe(true);
    // slow wing beats on the flower
    expect(sitting.wing.values).toContain('.7 1');
    expect(flying.wing.values).not.toContain('.7 1');
  });

  it('is the same every time', () => {
    expect(butterflyRoute(air, 17)).toEqual(butterflyRoute(air, 17));
  });
});
