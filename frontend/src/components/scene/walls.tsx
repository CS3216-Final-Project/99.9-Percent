"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";

/*
 * The room can be viewed from any side. Like a dolls' house, a wall between the
 * camera and the room drops to a low rim so it never hides the floor, and
 * anything fixed to that wall is put away until the wall comes back up.
 */

export type WallId = "back" | "left" | "front" | "right";

/** Unit vector on the floor pointing from each wall into the room. */
const INWARD: Record<WallId, [number, number]> = { back: [0, 1], left: [1, 0], front: [0, -1], right: [-1, 0] };

/** Which walls stand at full height. Starts as the default view: looking at the back and left walls. */
export const wallUp: Record<WallId, boolean> = { back: true, left: true, front: false, right: false };

/** Height of a lowered wall. */
const RIM = 0.3;

/** Call every frame with the direction the camera looks in. */
export function updateWalls(view: THREE.Vector3): void {
  for (const id of Object.keys(INWARD) as WallId[]) {
    const [x, z] = INWARD[id];
    const facing = view.x * x + view.z * z;
    // Looking at a wall's inner face means it stands behind the room. The margin stops flicker when side-on.
    if (facing < -0.08) wallUp[id] = true;
    else if (facing > 0.08) wallUp[id] = false;
  }
}

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
  return (
    <mesh ref={mesh} receiveShadow position={[x, (h * start) / 2, z]} scale={[1, start, 1]}>
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
