"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Floor } from "@/game/floors";
import { CEILING_LIGHTS, CEILING_VENTS, ELEVATOR_SPOT } from "./floorplan";
import { ignoreRay } from "./furniture";
import { ROOM } from "./layout";
import { CEILING } from "./palette";
import { ceilingTiles } from "./textures";
import { viewNow } from "./viewState";

/*
 * A suspended ceiling over a floor: tiles, light panels and air vents, open over the elevator's shaft. The overview
 * looks down through where it would be, so it is drawn only while the view is from the avatar.
 */

/** Just under the walls' tops, so the walls meet it. */
const HEIGHT = ROOM.wallH - 0.02;
/** Each tile texture spans two tiles of 0.6 m. */
const TEXTURE_SPAN = 1.2;
const LIGHT = { w: 1.2, d: 0.6, drop: 0.015 };
const VENT = { w: 0.6, d: 0.6, drop: 0.01 };

const plane = new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2);
const flat = new THREE.Matrix4();

/** Place one flat panel per point, facing down just below the ceiling. */
function layOut(mesh: THREE.InstancedMesh | null, at: [number, number][], size: { w: number; d: number; drop: number }): void {
  if (!mesh) return;
  at.forEach(([x, z], i) => {
    flat.makeScale(size.w, 1, size.d).setPosition(x, HEIGHT - size.drop, z);
    mesh.setMatrixAt(i, flat);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export function Ceiling({ floor }: { floor: Floor }) {
  const group = useRef<THREE.Group>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const vents = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    if (group.current) group.current.visible = viewNow.perspective;
  });
  const tiles = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(ROOM.x0, ROOM.z0).lineTo(ROOM.x1, ROOM.z0).lineTo(ROOM.x1, ROOM.z1).lineTo(ROOM.x0, ROOM.z1).closePath();
    const [x0, z0, x1, z1] = ELEVATOR_SPOT;
    shape.holes.push(new THREE.Path().moveTo(x0, z0).lineTo(x0, z1).lineTo(x1, z1).lineTo(x1, z0).closePath());
    // The shape is drawn in x and y; turned to lie flat, its y runs along z and it faces down.
    const geometry = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    const map = ceilingTiles().clone();
    map.repeat.set(1 / TEXTURE_SPAN, 1 / TEXTURE_SPAN);
    map.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ map, color: CEILING[floor].tint, side: THREE.FrontSide });
    return { geometry, material };
  }, [floor]);
  const looks = useMemo(
    () => ({
      light: new THREE.MeshBasicMaterial({ color: CEILING[floor].light, toneMapped: false }),
      vent: new THREE.MeshBasicMaterial({ color: CEILING.vent }),
    }),
    [floor],
  );
  useEffect(
    () => () => {
      tiles.geometry.dispose();
      tiles.material.map?.dispose();
      tiles.material.dispose();
      looks.light.dispose();
      looks.vent.dispose();
    },
    [tiles, looks],
  );
  useLayoutEffect(() => {
    layOut(lights.current, CEILING_LIGHTS, LIGHT);
    layOut(vents.current, CEILING_VENTS, VENT);
  }, [looks]);
  return (
    <group ref={group} visible={false}>
      <mesh geometry={tiles.geometry} material={tiles.material} position={[0, HEIGHT, 0]} raycast={ignoreRay} />
      <instancedMesh ref={lights} args={[plane, looks.light, CEILING_LIGHTS.length]} raycast={ignoreRay} frustumCulled={false} />
      <instancedMesh ref={vents} args={[plane, looks.vent, CEILING_VENTS.length]} raycast={ignoreRay} frustumCulled={false} />
    </group>
  );
}
