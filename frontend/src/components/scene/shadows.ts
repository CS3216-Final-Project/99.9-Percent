import type { Rect } from "./city";

/*
 * The shadows buildings cast on the ground, as outlines: each box or drum, lit by the sun or the moon from `key`,
 * darkens the ground from its foot outward, away from the light, as far as its height throws it. Kept free of
 * three.js so the outlines can be tested; exterior.tsx draws them.
 */

/** A point on the ground: x and z. */
export type Point = [number, number];

/** However low the light, a shadow falls no further than this many times the height that casts it. */
export const SHADOW_REACH = 2.5;

/** The convex hull of some points, anticlockwise seen from above (from +y, with x right and z down the screen). */
export function hull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** How far across the ground the shadow of each metre of height falls, away from a light in direction `key`. */
export function shadowStep(key: readonly [number, number, number]): Point {
  const up = Math.max(key[1], 1e-3);
  let dx = -key[0] / up;
  let dz = -key[2] / up;
  const length = Math.hypot(dx, dz);
  if (length > SHADOW_REACH) {
    dx *= SHADOW_REACH / length;
    dz *= SHADOW_REACH / length;
  }
  return [dx, dz];
}

/** The outline of a shape's shadow, from `from` to `to` metres above the ground. */
function swept(outline: Point[], from: number, to: number, step: Point): Point[] {
  const out: Point[] = [];
  for (const h of [from, to]) for (const [x, z] of outline) out.push([x + step[0] * h, z + step[1] * h]);
  return hull(out);
}

/** The shadow of a box standing on rectangle `r`, from `from` to `to` metres above the ground. */
export function boxShadow(r: Rect, from: number, to: number, step: Point): Point[] {
  return swept(
    [
      [r[0], r[1]],
      [r[2], r[1]],
      [r[2], r[3]],
      [r[0], r[3]],
    ],
    from,
    to,
    step,
  );
}

/** `sides` points round a circle of radius `radius` about (x, z). */
function circle(x: number, z: number, radius: number, sides: number): Point[] {
  return Array.from({ length: sides }, (_, k): Point => [x + radius * Math.cos((k / sides) * 2 * Math.PI), z + radius * Math.sin((k / sides) * 2 * Math.PI)]);
}

/** The shadow of a drum of radius `radius` round (x, z), from `from` to `to` metres above the ground. */
export function drumShadow(x: number, z: number, radius: number, from: number, to: number, step: Point, sides = 32): Point[] {
  return swept(circle(x, z, radius, sides), from, to, step);
}

/**
 * The sunlit part of a ring's courtyard of radius `radius` round (x, z), inside walls `height` metres tall, or nothing
 * when the walls shade all of it. A point in the courtyard sees the light while the point `height` metres up toward
 * the light from it is still over the courtyard, so the lit part is where the courtyard overlaps itself moved one
 * wall's shadow away from the light.
 */
export function courtyardLight(x: number, z: number, radius: number, height: number, step: Point, sides = 48): Point[] {
  const [ox, oz] = [x + step[0] * height, z + step[1] * height];
  if (Math.hypot(ox - x, oz - z) >= 2 * radius) return [];
  const within = (p: Point, cx: number, cz: number) => Math.hypot(p[0] - cx, p[1] - cz) <= radius + 1e-9;
  const lit = hull([...circle(x, z, radius, sides).filter((p) => within(p, ox, oz)), ...circle(ox, oz, radius, sides).filter((p) => within(p, x, z))]);
  return lit.length >= 3 ? lit : [];
}
