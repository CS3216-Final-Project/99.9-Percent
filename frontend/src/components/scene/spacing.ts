import { SPECIES, type Kind, type Species } from "./cast";
import { blocked, type World } from "./navgrid";
import { slide } from "./player";

export interface Body {
  x: number;
  z: number;
  r: number;
}

export const RADIUS: Record<Kind, number> = { blob: 0.3, big: 0.42, flyer: 0.3 };
export const GAP = 0.12;

export const radiusOf = (species: Species): number => RADIUS[SPECIES[species].kind];

export function intrudes(bodies: Body[], r: number, x: number, z: number, nx: number, nz: number): boolean {
  return bodies.some((b) => {
    const before = Math.hypot(x - b.x, z - b.z);
    const after = Math.hypot(nx - b.x, nz - b.z);
    return after < r + b.r + GAP && after < before;
  });
}

export function sweptIntrudes(bodies: Body[], r: number, x: number, z: number, nx: number, nz: number): boolean {
  const dx = nx - x;
  const dz = nz - z;
  const length = dx * dx + dz * dz;
  return bodies.some((b) => {
    const before = Math.hypot(x - b.x, z - b.z);
    const along = length ? Math.max(0, Math.min(1, ((b.x - x) * dx + (b.z - z) * dz) / length)) : 0;
    const closest = Math.hypot(x + along * dx - b.x, z + along * dz - b.z);
    return closest < r + b.r + GAP && closest < before;
  });
}

export function clearOf(bodies: Body[], r: number, x: number, z: number): boolean {
  return bodies.every((b) => Math.hypot(x - b.x, z - b.z) >= r + b.r + GAP);
}

export function sidestep(world: World, bodies: Body[], r: number, x: number, z: number, yaw: number, dist: number): [number, number] | null {
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  for (const sign of [1, -1]) {
    const nx = x + rx * dist * sign;
    const nz = z + rz * dist * sign;
    if (!blocked(world, nx, nz) && !sweptIntrudes(bodies, r, x, z, nx, nz)) return [nx, nz];
  }
  return null;
}

export function apart(world: World, bodies: Body[], r: number, x: number, z: number, dist: number): [number, number] {
  let nearest: Body | null = null;
  let distance = Infinity;
  for (const body of bodies) {
    const d = Math.hypot(x - body.x, z - body.z);
    if (d < r + body.r && d < distance) {
      nearest = body;
      distance = d;
    }
  }
  if (!nearest) return [x, z];
  const dx = x - nearest.x;
  const dz = z - nearest.z;
  const length = Math.hypot(dx, dz);
  const nx = length > 0 ? dx / length : 1;
  const nz = length > 0 ? dz / length : 0;
  return slide(world, x, z, nx * dist, nz * dist);
}
