import * as THREE from "three";

/* Furniture as data: boxes, cylinders, balls and cones that `PrimBatch` draws. */

export type V3 = [number, number, number];
export type Shape = "box" | "cyl" | "ball" | "cone";

export interface Prim {
  k: Shape;
  /** Centre position. */
  p: V3;
  /** Size: width, height and depth (diameters for round shapes). */
  s: V3;
  c: string;
  /** Rotation, applied after any rotation from `place`. */
  q?: THREE.Quaternion;
}

const euler = new THREE.Euler();
const toQuat = (r?: V3) => (r ? new THREE.Quaternion().setFromEuler(euler.set(r[0], r[1], r[2])) : undefined);

export const bx = (p: V3, s: V3, c: string, r?: V3): Prim => ({ k: "box", p, s, c, q: toQuat(r) });
/** Upright cylinder of diameter `d` and height `h`. */
export const cy = (p: V3, d: number, h: number, c: string, r?: V3): Prim => ({ k: "cyl", p, s: [d, h, d], c, q: toQuat(r) });
export const ball = (p: V3, s: V3, c: string): Prim => ({ k: "ball", p, s, c });
export const cone = (p: V3, d: number, h: number, c: string): Prim => ({ k: "cone", p, s: [d, h, d], c });

const UP = new THREE.Vector3(0, 1, 0);

/** Move a group of prims built around the origin to (x, y, z), turned by `rot` about the vertical. */
export function place(prims: Prim[], x: number, z: number, rot = 0, y = 0): Prim[] {
  const turn = new THREE.Quaternion().setFromAxisAngle(UP, rot);
  const v = new THREE.Vector3();
  return prims.map((m) => {
    v.set(m.p[0], m.p[1], m.p[2]).applyQuaternion(turn);
    return { ...m, p: [v.x + x, v.y + y, v.z + z], q: m.q ? turn.clone().multiply(m.q) : rot ? turn.clone() : undefined };
  });
}
