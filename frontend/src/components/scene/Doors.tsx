"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Floor } from "@/game/floors";
import { useGame } from "@/game/store";
import { GLASS_H, OFFICE_DOORS, SERVER_DOORS, type Door } from "./floorplan";
import { GLASS_MATERIAL, ignoreRay } from "./furniture";
import { FURNITURE } from "./palette";
import { shownFloor } from "./ride";
import { sceneSound } from "./sceneSounds";
import { avatar, others } from "./walk";

/*
 * The glass doors in the partitions' doorways, two panes that slide apart as someone comes near and close behind
 * them, with a short hiss: the player's avatar, or the engineers called down to the racks in an incident.
 */

/** How near someone must come for a door to open, and how fast its panes slide, in widths a second. */
const NEAR = 1.4;
const SPEED = 3;
/** How loud a door's hiss is, as a share of the effects volume. */
const HISS = 0.5;

const FRAME = new THREE.MeshStandardMaterial({ color: FURNITURE.alu, roughness: 0.4, metalness: 0.4 });
const EDGE = new THREE.BoxGeometry(0.04, GLASS_H - 0.08, 0.04);

function someoneNear(floor: Floor, d: Door): boolean {
  const close = (x: number, z: number) => Math.hypot(x - d.x, z - d.z) < NEAR;
  if (useGame.getState().walking && avatar.floor === floor && close(avatar.x, avatar.z)) return true;
  for (const o of others.values()) if (o.floor === floor && close(o.x, o.z)) return true;
  return false;
}

/** One pane of glass, framed along the edge where the two meet. */
function Pane({ half, edge }: { half: number; edge: 1 | -1 }) {
  return (
    <>
      <mesh material={GLASS_MATERIAL} raycast={ignoreRay}>
        <planeGeometry args={[half - 0.02, GLASS_H - 0.08]} />
      </mesh>
      <mesh geometry={EDGE} material={FRAME} position={[edge * (half / 2 - 0.02), 0, 0]} raycast={ignoreRay} />
    </>
  );
}

function DoorPanes({ floor, door }: { floor: Floor; door: Door }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const open = useRef(0);
  const opening = useRef(false);
  const half = door.w / 2;
  // Each pane's middle along the doorway when shut, and the way it slides to open.
  const axis = useMemo(() => (door.along === "x" ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)), [door.along]);
  const turn = door.along === "x" ? 0 : Math.PI / 2;
  useFrame((_, dt) => {
    const want = someoneNear(floor, door);
    if (want !== opening.current) {
      opening.current = want;
      if (shownFloor() === floor) sceneSound("hiss", HISS);
    }
    open.current = THREE.MathUtils.clamp(open.current + (want ? 1 : -1) * SPEED * Math.min(dt, 0.1), 0, 1);
    const slide = half / 2 + open.current * half * 0.92;
    left.current?.position.copy(axis).multiplyScalar(-slide);
    right.current?.position.copy(axis).multiplyScalar(slide);
  });
  return (
    <group position={[door.x, GLASS_H / 2, door.z]}>
      <group ref={left} rotation={[0, turn, 0]}>
        <Pane half={half} edge={1} />
      </group>
      <group ref={right} rotation={[0, turn, 0]}>
        <Pane half={half} edge={-1} />
      </group>
    </group>
  );
}

/** A floor's glass doors. */
export function GlassDoors({ floor }: { floor: Floor }) {
  const doors = floor === "office" ? OFFICE_DOORS : SERVER_DOORS;
  return (
    <group>
      {doors.map((d) => (
        <DoorPanes key={d.name} floor={floor} door={d} />
      ))}
    </group>
  );
}
