import { describe, expect, it } from 'vitest';
import { boxShadow, courtyardLight, drumShadow, hull, SHADOW_REACH, shadowStep, type Point } from './shadows';
import { daylight } from './sky';
import type { Rect } from './city';

/** Whether p is inside or on a convex outline, whichever way round it runs. */
function inside(p: Point, outline: Point[]): boolean {
  let sign = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}
const centre = (outline: Point[]): Point => [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length];
const area = (outline: Point[]) => Math.abs(outline.reduce((s, p, i) => s + p[0] * outline[(i + 1) % outline.length][1] - outline[(i + 1) % outline.length][0] * p[1], 0)) / 2;

describe('the outline of a set of points', () => {
  it('wraps every point, and keeps only the corners', () => {
    const square: Point[] = [[0, 0], [2, 0], [2, 2], [0, 2], [1, 1], [1, 0], [0.5, 1.5]];
    const h = hull(square);
    expect(h).toHaveLength(4);
    for (const p of square) expect(inside(p, h)).toBe(true);
    expect(area(h)).toBeCloseTo(4, 9);
  });
});

describe('building shadows', () => {
  const r: Rect = [0, 0, 10, 20];
  const corners: Point[] = [[0, 0], [10, 0], [10, 20], [0, 20]];

  it('lie under the building when the light is straight overhead', () => {
    const s = boxShadow(r, 0, 30, shadowStep([0, 1, 0]));
    expect(area(s)).toBeCloseTo(200, 6);
  });

  it('always cover the footprint and fall away from the light, further the taller the building', () => {
    const low = shadowStep([0.6, 0.6, 0.53]);
    const short = boxShadow(r, 0, 8, low);
    const tall = boxShadow(r, 0, 24, low);
    for (const c of corners) {
      expect(inside(c, short)).toBe(true);
      expect(inside(c, tall)).toBe(true);
    }
    // The light is toward +x and +z, so the shadow lies toward -x and -z.
    expect(centre(tall)[0]).toBeLessThan(5);
    expect(centre(tall)[1]).toBeLessThan(10);
    expect(area(tall)).toBeGreaterThan(area(short));
  });

  it('never fall further than SHADOW_REACH times the height, however low the light', () => {
    const step = shadowStep([0.99, 0.01, 0]);
    expect(Math.hypot(...step)).toBeCloseTo(SHADOW_REACH, 9);
    const s = boxShadow(r, 0, 10, step);
    expect(Math.min(...s.map((p) => p[0]))).toBeCloseTo(-SHADOW_REACH * 10, 6);
  });

  it('start where a raised part begins, so a setback casts from its own height', () => {
    const step = shadowStep([0, 0.5, 0.866]);
    const raised = boxShadow(r, 12, 20, step);
    // Lifted 12 m, the shadow starts 12 m of shadow away from the footprint's near side.
    expect(Math.max(...raised.map((p) => p[1]))).toBeCloseTo(20 + step[1] * 12, 6);
  });

  it('cast a drum shadow round its foot, and fall away from the sun of the day', () => {
    const noon = daylight(0.5);
    const evening = daylight(0.7);
    const atNoon = drumShadow(0, 0, 20, 0, 16, shadowStep(noon.key));
    const late = drumShadow(0, 0, 20, 0, 16, shadowStep(evening.key));
    expect(inside([19.9, 0], atNoon)).toBe(true);
    expect(inside([-19.9, 0], late)).toBe(true);
    // Late in the day the sun is in the west (-x), so the shadow reaches east.
    expect(centre(late)[0]).toBeGreaterThan(0);
    expect(area(late)).toBeGreaterThan(area(atNoon));
  });

  it("light a ring's courtyard away from the wall toward the sun, and none of it once the sun is low", () => {
    const radius = 20;
    const overhead = courtyardLight(0, 0, radius, 16, shadowStep([0, 1, 0]));
    expect(area(overhead)).toBeCloseTo(Math.PI * radius * radius, -1);
    // The light is toward +x, so the wall on that side shades the courtyard's +x edge and the -x edge is lit.
    const step = shadowStep([0.6, 0.8, 0]);
    const lit = courtyardLight(0, 0, radius, 16, step);
    expect(area(lit)).toBeGreaterThan(0);
    expect(area(lit)).toBeLessThan(area(overhead));
    expect(inside([-radius + 0.5, 0], lit)).toBe(true);
    expect(inside([radius - 0.5, 0], lit)).toBe(false);
    expect(courtyardLight(0, 0, radius, 18, shadowStep([0.99, 0.05, 0]))).toEqual([]);
  });
});
