"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/*
 * Static furniture is described as data, a list of boxes, cylinders, balls and
 * cones, and drawn with one instanced mesh per shape. A whole office of desks,
 * shelves and plants then costs a handful of draw calls, which keeps the scene
 * smooth on modest laptops and in software rendering.
 */

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

const GEOMETRY: Record<Shape, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  ball: new THREE.SphereGeometry(0.5, 14, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
};

// Matte Lambert shading: it suits the flat toy look and costs far less per pixel than physically based shading.
const MATERIAL: Record<Shape, THREE.Material> = {
  box: new THREE.MeshLambertMaterial(),
  cyl: new THREE.MeshLambertMaterial(),
  ball: new THREE.MeshLambertMaterial(),
  cone: new THREE.MeshLambertMaterial({ flatShading: true }),
};

function Instances({ shape, items, shadows }: { shape: Shape; items: Prim[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const none = new THREE.Quaternion();
    const color = new THREE.Color();
    items.forEach((it, i) => {
      m.compose(pos.set(it.p[0], it.p[1], it.p[2]), it.q ?? none, scale.set(it.s[0], it.s[1], it.s[2]));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return <instancedMesh key={items.length} ref={ref} args={[GEOMETRY[shape], MATERIAL[shape], items.length]} castShadow={shadows} receiveShadow />;
}

/** Draw many static prims: one instanced mesh per shape. */
export function PrimBatch({ prims, shadows = true }: { prims: Prim[]; shadows?: boolean }) {
  const byShape = useMemo(() => {
    const out: Record<Shape, Prim[]> = { box: [], cyl: [], ball: [], cone: [] };
    for (const p of prims) out[p.k].push(p);
    return out;
  }, [prims]);
  return (
    <group>
      {(Object.keys(byShape) as Shape[]).map((k) => (
        <Instances key={k} shape={k} items={byShape[k]} shadows={shadows} />
      ))}
    </group>
  );
}
