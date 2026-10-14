"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { otherFloor, type Floor } from "@/game/floors";
import { useGame } from "@/game/store";
import { ELEVATOR_SPOT } from "./floorplan";
import { ROOM } from "./layout";
import { FLOOR_NUMBER, FLOOR_Y, rideAt } from "./levels";
import { GLASS_MATERIAL, ignoreRay } from "./furniture";
import { FURNITURE } from "./palette";
import { PrimBatch } from "./prims";
import { doorsNow, ride, rideClock, riding } from "./ride";
import { bx, cy, type Prim } from "./shapes";
import { liftDisplay } from "./textures";

/*
 * The elevator between the floors, in the east corridor below the monitoring room and the huddle room. Each floor has a glass
 * shaft with steel doors facing the corridor, a floor indicator over them and a call button beside them; one car
 * rides between the floors with the view (see ride.ts), so it always stands at the floor on screen. Clicking the
 * shaft rides to the other floor, as the floor menu does.
 */

const [X0, Z0, X1, Z1] = ELEVATOR_SPOT;
const CX = (X0 + X1) / 2;
const CZ = (Z0 + Z1) / 2;
const H = ROOM.wallH;
/** The doorway, of two panels that part to either side, and how high the steel front rises before the glass above it. */
const DOOR = { w: 1.1, h: 2.15 };
const FRONT = 2.45;
/** The side panels left and right of the doorway; the call button is on the one to the right as seen from the corridor. */
const SIDE = (Z1 - Z0 - DOOR.w) / 2;
const CALL: [number, number, number] = [X1 + 0.07, 1.1, Z0 + SIDE / 2];
const STEEL = "#c3c8cf";
const FRAME = FURNITURE.alu;
const DARK = FURNITURE.ink;

function shaft(): Prim[] {
  const out: Prim[] = [];
  // Corner posts, and rails round the foot and the top.
  for (const [x, z] of [
    [X0, Z0],
    [X1, Z0],
    [X0, Z1],
    [X1, Z1],
  ]) {
    out.push(bx([x, H / 2, z], [0.1, H, 0.1], FRAME));
  }
  for (const y of [0.04, H - 0.04]) out.push(bx([CX, y, Z0], [X1 - X0, 0.08, 0.08], FRAME), bx([CX, y, Z1], [X1 - X0, 0.08, 0.08], FRAME), bx([X0, y, CZ], [0.08, 0.08, Z1 - Z0], FRAME));
  out.push(bx([X1, H - 0.04, CZ], [0.08, 0.08, Z1 - Z0], FRAME));
  // The steel front either side of the doorway and over it, with dark trim round the opening and a sill.
  out.push(bx([X1, FRONT / 2, Z0 + SIDE / 2], [0.1, FRONT, SIDE], STEEL), bx([X1, FRONT / 2, Z1 - SIDE / 2], [0.1, FRONT, SIDE], STEEL));
  out.push(bx([X1, (DOOR.h + FRONT) / 2, CZ], [0.1, FRONT - DOOR.h, DOOR.w], STEEL));
  out.push(bx([X1 + 0.055, DOOR.h + 0.02, CZ], [0.02, 0.04, DOOR.w + 0.08], DARK));
  for (const s of [-1, 1]) out.push(bx([X1 + 0.055, DOOR.h / 2, CZ + s * (DOOR.w / 2 + 0.02)], [0.02, DOOR.h, 0.04], DARK));
  out.push(bx([X1 + 0.15, 0.01, CZ], [0.3, 0.02, DOOR.w], DARK));
  // The indicator's housing and the call button's plate.
  out.push(bx([X1 + 0.06, 2.3, CZ], [0.03, 0.2, 0.42], DARK), bx([CALL[0] - 0.015, CALL[1], CALL[2]], [0.02, 0.28, 0.14], DARK));
  return out;
}

/** The glass of the shaft's three other sides, and over the doors. */
const PANES: { p: [number, number, number]; r: number; w: number; h: number }[] = [
  { p: [X0, H / 2, CZ], r: Math.PI / 2, w: Z1 - Z0, h: H - 0.16 },
  { p: [CX, H / 2, Z0], r: 0, w: X1 - X0, h: H - 0.16 },
  { p: [CX, H / 2, Z1], r: 0, w: X1 - X0, h: H - 0.16 },
  { p: [X1, (FRONT + H) / 2, CZ], r: Math.PI / 2, w: Z1 - Z0, h: H - FRONT - 0.08 },
];

const noRay = ignoreRay;
/** A door panel, and the brushed steel of both floors' doors. */
const DOOR_PANEL = new THREE.BoxGeometry(0.04, DOOR.h, DOOR.w / 2 - 0.01);
const DOOR_STEEL = new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.55, roughness: 0.32 });

/** One floor's landing: the shaft, its doors, the indicator and the call button. `interactive` lets a click ride. */
export function Landing({ floor, interactive }: { floor: Floor; interactive: boolean }) {
  const prims = useMemo(() => shaft(), []);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const display = useRef<THREE.MeshBasicMaterial>(null);
  const button = useRef<THREE.MeshStandardMaterial>(null);
  const shown = useRef("");
  useFrame(() => {
    // The doors open only where the car stands, once it has arrived.
    const open = doorsNow(floor);
    const slide = DOOR.w / 4 + open * (DOOR.w / 2) * 0.96;
    if (left.current) left.current.position.z = CZ - slide;
    if (right.current) right.current.position.z = CZ + slide;
    // The indicator counts towards the floor the car is going to, with an arrow while it moves.
    const moving = riding();
    const at = moving && !rideAt(rideClock()).arrived ? ride.from : ride.to;
    const arrow = moving ? (FLOOR_Y[ride.to] > FLOOR_Y[ride.from] ? "up" : "down") : null;
    const key = `${at}|${arrow}`;
    if (display.current && key !== shown.current) {
      shown.current = key;
      display.current.map = liftDisplay(FLOOR_NUMBER[at], arrow);
      display.current.needsUpdate = true;
    }
    if (button.current) button.current.emissiveIntensity = moving ? 2.2 : 0.25;
  });
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    document.body.style.cursor = "";
    useGame.getState().goToFloor(otherFloor(floor), "elevator");
  };
  return (
    <group>
      <PrimBatch prims={prims} />
      {PANES.map((p, i) => (
        <mesh key={i} position={p.p} rotation={[0, p.r, 0]} material={GLASS_MATERIAL} raycast={noRay}>
          <planeGeometry args={[p.w, p.h]} />
        </mesh>
      ))}
      <mesh ref={left} castShadow position={[X1 - 0.08, DOOR.h / 2, CZ - DOOR.w / 4]} geometry={DOOR_PANEL} material={DOOR_STEEL} raycast={noRay} />
      <mesh ref={right} castShadow position={[X1 - 0.08, DOOR.h / 2, CZ + DOOR.w / 4]} geometry={DOOR_PANEL} material={DOOR_STEEL} raycast={noRay} />
      <mesh position={[X1 + 0.078, 2.3, CZ]} rotation={[0, Math.PI / 2, 0]} raycast={noRay}>
        <planeGeometry args={[0.36, 0.17]} />
        <meshBasicMaterial ref={display} map={liftDisplay(FLOOR_NUMBER[floor], null)} toneMapped={false} />
      </mesh>
      <mesh position={CALL} rotation={[0, 0, Math.PI / 2]} raycast={noRay}>
        <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
        <meshStandardMaterial ref={button} color="#fff3d6" emissive="#ffb43d" emissiveIntensity={0.25} toneMapped={false} />
      </mesh>
      {interactive && (
        <mesh position={[CX, H / 2, CZ]} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick}>
          <boxGeometry args={[X1 - X0 + 0.3, H, Z1 - Z0]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** The car: an open-topped cabin with a steel back wall, a handrail and a light along its top, riding at the height of the view. */
function cabin(): Prim[] {
  const x0 = X0 + 0.14;
  const x1 = X1 - 0.16;
  const z0 = Z0 + 0.12;
  const z1 = Z1 - 0.12;
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  return [
    bx([cx, 0.04, CZ], [w, 0.08, d], "#3a3d43"),
    bx([cx, 0.085, CZ], [w - 0.1, 0.01, d - 0.1], "#5a5f68"),
    bx([x0 + 0.03, 1.25, CZ], [0.06, 2.4, d], STEEL),
    bx([x0 + 0.12, 0.95, CZ], [0.04, 0.04, d - 0.4], DARK),
    ...[CZ - (d - 0.5) / 2, CZ + (d - 0.5) / 2].map((z) => cy([x0 + 0.09, 0.95, z], 0.03, 0.08, DARK, [0, 0, Math.PI / 2])),
    // The sides are glass: only their frames show, at the foot, at hand height and along the top.
    ...[z0 + 0.03, z1 - 0.03].flatMap((z) => [0.95, 2.4].map((y) => bx([cx, y, z], [w, 0.05, 0.04], FRAME))),
    ...[z0 + 0.03, z1 - 0.03].map((z) => bx([x1 - 0.02, 1.25, z], [0.05, 2.4, 0.05], FRAME)),
    bx([x0 + 0.03, 2.43, CZ], [0.1, 0.06, d], FRAME),
  ];
}

export function ElevatorCar() {
  const group = useRef<THREE.Group>(null);
  const prims = useMemo(() => cabin(), []);
  useFrame(() => {
    if (group.current) group.current.position.y = ride.y;
  });
  return (
    <group ref={group}>
      <PrimBatch prims={prims} />
      <mesh position={[X0 + 0.24, 2.3, CZ]} rotation={[0, Math.PI / 2, 0]} raycast={noRay}>
        <planeGeometry args={[Z1 - Z0 - 0.5, 0.1]} />
        <meshBasicMaterial color={new THREE.Color(1.4, 1.35, 1.2)} toneMapped={false} />
      </mesh>
    </group>
  );
}
