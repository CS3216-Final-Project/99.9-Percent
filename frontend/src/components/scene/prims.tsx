"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useDetail, type Detail } from "./detail";
import type { Prim, Shape } from "./shapes";

/*
 * Static furniture is described as data, a list of boxes, cylinders, balls and
 * cones, and drawn with one instanced mesh per shape. A whole office of desks,
 * shelves and plants then costs a handful of draw calls, which keeps the scene
 * smooth on modest laptops and in software rendering.
 */

const GEOMETRY: Record<Shape, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  ball: new THREE.SphereGeometry(0.5, 14, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
};

// Basic detail uses matte Lambert shading: it suits the flat toy look and costs far less per pixel than
// physically based shading. HD uses satin physically based materials that pick up the room's reflections.
const MATERIAL: Record<Detail, Record<Shape, THREE.Material>> = {
  basic: {
    box: new THREE.MeshLambertMaterial(),
    cyl: new THREE.MeshLambertMaterial(),
    ball: new THREE.MeshLambertMaterial(),
    cone: new THREE.MeshLambertMaterial({ flatShading: true }),
  },
  hd: {
    box: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    cyl: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
    ball: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    cone: new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }),
  },
};

function Instances({ shape, items, shadows }: { shape: Shape; items: Prim[]; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = MATERIAL[useDetail()][shape];
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
  // The material is a prop rather than a constructor argument, so changing detail swaps it without rebuilding the instances.
  return <instancedMesh key={items.length} ref={ref} args={[GEOMETRY[shape], undefined, items.length]} material={material} castShadow={shadows} receiveShadow />;
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
