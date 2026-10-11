"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { projectUV, surfaceMaterial, useSurfaces } from "./surfaces";
import { wallUp, type WallId } from "./wallState";

/*
 * The room can be viewed from any side. Like a dolls' house, a wall between the
 * camera and the room drops to a low rim so it never hides the floor, and
 * anything fixed to that wall is put away until the wall comes back up.
 */

/** Height of a lowered wall. */
const RIM = 0.3;

export function Wall({ wall, x, z, size, color }: { wall: WallId; x: number; z: number; size: [number, number, number]; color: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  const h = size[1];
  const start = wallUp[wall] ? 1 : RIM / h;
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const want = wallUp[wall] ? 1 : RIM / h;
    m.scale.y += (want - m.scale.y) * Math.min(1, dt * 9);
    m.position.y = (h * m.scale.y) / 2;
  });
  // At HD detail the walls are painted plaster in the same colour.
  const surfaces = useSurfaces();
  const [w, , d] = size;
  const plaster = useMemo(() => {
    if (!surfaces) return null;
    const s = surfaces.plaster;
    return { geometry: projectUV(new THREE.BoxGeometry(w, h, d), s.size, [x, 0, z]), material: surfaceMaterial(s, color) };
  }, [surfaces, w, h, d, x, z, color]);
  useEffect(
    () => () => {
      plaster?.geometry.dispose();
      plaster?.material.dispose();
    },
    [plaster],
  );
  if (plaster) return <mesh key="hd" ref={mesh} receiveShadow position={[x, (h * start) / 2, z]} scale={[1, start, 1]} geometry={plaster.geometry} material={plaster.material} />;
  return (
    <mesh key="basic" ref={mesh} receiveShadow position={[x, (h * start) / 2, z]} scale={[1, start, 1]}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

/** Windows, signs and screens on a wall disappear while it is lowered. */
export function OnWall({ wall, children }: { wall: WallId; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.visible = wallUp[wall];
  });
  return (
    <group ref={group} visible={wallUp[wall]}>
      {children}
    </group>
  );
}
