"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { otherFloor, type Floor } from "@/game/floors";
import { useGame } from "@/game/store";
import { useDetail } from "./detail";
import { ELEVATOR_SPOT } from "./floorplan";
import { GLASS_MATERIAL, ignoreRay } from "./furniture";
import { ROOM } from "./layout";
import { FLOOR_NUMBER, FLOOR_Y } from "./levels";
import {
  CABIN,
  CABIN_CX,
  CABIN_CZ,
  cableLoop,
  CAR_DOOR,
  carTop,
  clipSpan,
  COUNTERWEIGHT,
  counterweightFoot,
  PIT,
  RAILS,
  ROPE_LINES,
  SHEAVE,
  SLAB,
  TRAVELLING,
  visibleBand,
} from "./lift";
import { FURNITURE } from "./palette";
import { PrimBatch } from "./prims";
import { shownFloor } from "./ride";
import { bx, cy, type Prim } from "./shapes";
import { brushedSteel, liftDisplay, liftFloor, liftPanel, shaftBand } from "./textures";
import { carBound, carDoors, carIndicator, carMoving, carY } from "./trips";
import { bothFloors, clipShaft, SHAFT_CLIP, viewNow } from "./viewState";

/*
 * The elevator between the floors, in the east corridor beside the monitoring room's door. Each floor has a glass
 * shaft with steel doors facing the corridor, a floor indicator over them and a call button beside them. One car
 * rides between the floors with the view (see ride.ts), so it always stands at the floor on screen. Clicking the
 * shaft rides to the other floor, as the floor menu does.
 *
 * Seen through the glass, the shaft works like a real one (lift.ts has the numbers): the car runs on guide rails
 * either side, hanging from ropes over a drive sheave at the top, and a counterweight of stacked plates goes down
 * as the car goes up. A travelling cable hangs in a loop under the car, buffers wait in the pit, and the slab
 * between the floors is lined with concrete with the floor's number painted on it. The car is a little room of its
 * own: brushed steel and glass, a granite floor, handrails, a lit ceiling, an operating panel and doors of its own.
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
const RAIL = "#5d6168";
const MACHINE = "#2f5f7a";
const CONCRETE = "#7c7e80";
const SAFETY = "#d4a72c";

/** The heights of the shaft that can be seen now. */
const bandNow = () => visibleBand(bothFloors() ? "both" : shownFloor());

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
  // The steel front either side of the doorway and over it, with dark trim round the opening.
  out.push(bx([X1, FRONT / 2, Z0 + SIDE / 2], [0.1, FRONT, SIDE], STEEL), bx([X1, FRONT / 2, Z1 - SIDE / 2], [0.1, FRONT, SIDE], STEEL));
  out.push(bx([X1, (DOOR.h + FRONT) / 2, CZ], [0.1, FRONT - DOOR.h, DOOR.w], STEEL));
  out.push(bx([X1 + 0.055, DOOR.h + 0.02, CZ], [0.02, 0.04, DOOR.w + 0.08], DARK));
  for (const s of [-1, 1]) out.push(bx([X1 + 0.055, DOOR.h / 2, CZ + s * (DOOR.w / 2 + 0.02)], [0.02, DOOR.h, 0.04], DARK));
  // The landing's sill: grooved aluminium.
  out.push(bx([X1 + 0.1, 0.008, CZ], [0.2, 0.016, DOOR.w], FRAME));
  for (let i = 0; i < 5; i++) out.push(bx([X1 + 0.03 + i * 0.035, 0.017, CZ], [0.008, 0.004, DOOR.w], DARK));
  // The indicator's housing and the call button's plate.
  out.push(bx([X1 + 0.06, 2.3, CZ], [0.03, 0.2, 0.42], DARK), bx([CALL[0] - 0.015, CALL[1], CALL[2]], [0.02, 0.28, 0.14], DARK));
  return out;
}

/** A T-section guide rail from `lo` to `hi`, its blade pointing along +z or -z, with a bracket to the wall now and then. */
function guideRail(x: number, z: number, lo: number, hi: number, blade: 1 | -1, size = 1): Prim[] {
  const mid = (lo + hi) / 2;
  const len = hi - lo;
  const out: Prim[] = [bx([x, mid, z - blade * 0.02 * size], [0.09 * size, len, 0.012], RAIL), bx([x, mid, z], [0.014, len, 0.05 * size], RAIL)];
  for (let y = lo + 0.4; y < hi - 0.1; y += 1.4) out.push(bx([x, y, z - blade * 0.045 * size], [0.12 * size, 0.06, 0.04], DARK));
  return out;
}

/**
 * The fixed working parts in one floor's stretch of the shaft, in that floor's own heights: the rails, and either
 * the drive at the top over the office, or the pit with its buffers under the servers.
 */
function shaftWorks(floor: Floor): Prim[] {
  const lo = floor === "office" ? -SLAB : -PIT.depth;
  const out: Prim[] = [];
  for (const [x, z] of RAILS.car) out.push(...guideRail(x, z, lo, H, z < CZ ? 1 : -1));
  for (const [x, z] of RAILS.counterweight) out.push(...guideRail(x, z, lo, H, z < CZ ? 1 : -1, 0.7));
  if (floor === "office") {
    // The drive: a beam across the shaft's top, the sheave on it with its grooved rim, the motor and its brake.
    const sy = SHEAVE.y - FLOOR_Y.office;
    const motor = SHEAVE.z + SHEAVE.spread / 2;
    out.push(bx([SHEAVE.x, sy - SHEAVE.r - 0.09, CZ], [0.22, 0.14, Z1 - Z0 - 0.1], DARK));
    out.push(cy([SHEAVE.x, sy, SHEAVE.z], SHEAVE.r * 2, SHEAVE.spread + 0.08, "#4a4f57", [Math.PI / 2, 0, 0]));
    for (const s of [-1, 1]) out.push(cy([SHEAVE.x, sy, SHEAVE.z + s * (SHEAVE.spread / 2 + 0.05)], SHEAVE.r * 2 + 0.06, 0.02, DARK, [Math.PI / 2, 0, 0]));
    out.push(cy([SHEAVE.x, sy, motor + 0.3], 0.46, 0.38, MACHINE, [Math.PI / 2, 0, 0]));
    out.push(cy([SHEAVE.x, sy, motor + 0.52], 0.3, 0.08, "#c94a3c", [Math.PI / 2, 0, 0]));
    out.push(bx([SHEAVE.x, sy - SHEAVE.r - 0.17, motor + 0.3], [0.4, 0.04, 0.46], DARK));
  } else {
    // The pit: buffers on their stands under the car and under the counterweight.
    const foot = -PIT.depth;
    for (const z of [CABIN_CZ - 0.5, CABIN_CZ + 0.5]) {
      out.push(cy([CABIN_CX, foot + 0.04, z], 0.22, 0.08, DARK), cy([CABIN_CX, foot + 0.2, z], 0.12, 0.24, SAFETY), cy([CABIN_CX, foot + 0.34, z], 0.13, 0.05, "#1b1d22"));
    }
    out.push(cy([COUNTERWEIGHT.x, foot + 0.04, COUNTERWEIGHT.z], 0.18, 0.08, DARK), cy([COUNTERWEIGHT.x, foot + 0.17, COUNTERWEIGHT.z], 0.1, 0.18, SAFETY));
  }
  return out;
}

/** The glass of the shaft's three other sides, and over the doors. */
const PANES: { p: [number, number, number]; r: number; w: number; h: number }[] = [
  { p: [X0, H / 2, CZ], r: Math.PI / 2, w: Z1 - Z0, h: H - 0.16 },
  { p: [CX, H / 2, Z0], r: 0, w: X1 - X0, h: H - 0.16 },
  { p: [CX, H / 2, Z1], r: 0, w: X1 - X0, h: H - 0.16 },
  { p: [X1, (FRONT + H) / 2, CZ], r: Math.PI / 2, w: Z1 - Z0, h: H - FRONT - 0.08 },
];

/** The concrete lining the shaft through the slab and round the pit, its four sides facing in, as [centre, turn, width]. */
const LINING: { p: [number, number]; r: number; w: number }[] = [
  { p: [X0 + 0.01, CZ], r: Math.PI / 2, w: Z1 - Z0 },
  { p: [X1 - 0.01, CZ], r: -Math.PI / 2, w: Z1 - Z0 },
  { p: [CX, Z0 + 0.01], r: 0, w: X1 - X0 },
  { p: [CX, Z1 - 0.01], r: Math.PI, w: X1 - X0 },
];

const noRay = ignoreRay;
/** A door panel, and the brushed steel of both floors' doors. */
const DOOR_PANEL = new THREE.BoxGeometry(0.04, DOOR.h, DOOR.w / 2 - 0.01);
const DOOR_STEEL = new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.55, roughness: 0.32 });
/** What closes the shaft off where the floor in view ends, so nothing is seen beyond it. */
const SHAFT_END = new THREE.MeshBasicMaterial({ color: "#16171b" });

/** One floor's landing: the shaft, its doors, the indicator and the call button. `interactive` lets a click ride. */
export function Landing({ floor, interactive }: { floor: Floor; interactive: boolean }) {
  const prims = useMemo(() => shaft(), []);
  const works = useMemo(() => shaftWorks(floor), [floor]);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const display = useRef<THREE.MeshBasicMaterial>(null);
  const button = useRef<THREE.MeshStandardMaterial>(null);
  const end = useRef<THREE.Mesh>(null);
  const shown = useRef("");
  useFrame(() => {
    // The doors open only where the car stands, once it has arrived, for the player or anyone else.
    const open = carDoors(floor);
    const slide = DOOR.w / 4 + open * (DOOR.w / 2) * 0.96;
    if (left.current) left.current.position.z = CZ - slide;
    if (right.current) right.current.position.z = CZ + slide;
    // The indicator counts towards the floor the car is going to, with an arrow while it moves.
    const { floor: at, arrow } = carIndicator();
    const key = `${at}|${arrow}`;
    if (display.current && key !== shown.current) {
      shown.current = key;
      display.current.map = liftDisplay(FLOOR_NUMBER[at], arrow);
      display.current.needsUpdate = true;
    }
    if (button.current) button.current.emissiveIntensity = carMoving() ? 2.2 : 0.25;
    // Seen alone, a floor's stretch of shaft is closed off where it ends: under the office's slab, and over the
    // servers' ceiling when looking up from the avatar. Riding between, the whole shaft is open.
    if (end.current) end.current.visible = !bothFloors() && (floor === "office" || viewNow.perspective);
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
  const office = floor === "office";
  return (
    <group>
      <PrimBatch prims={prims} />
      <PrimBatch prims={works} shadows={false} />
      {PANES.map((p, i) => (
        <mesh key={i} position={p.p} rotation={[0, p.r, 0]} material={GLASS_MATERIAL} raycast={noRay}>
          <planeGeometry args={[p.w, p.h]} />
        </mesh>
      ))}
      {office
        ? LINING.map((l, i) => (
            <mesh key={i} position={[l.p[0], -SLAB / 2, l.p[1]]} rotation={[0, l.r, 0]} raycast={noRay}>
              <planeGeometry args={[l.w, SLAB]} />
              <meshLambertMaterial map={shaftBand(FLOOR_NUMBER.office)} />
            </mesh>
          ))
        : LINING.map((l, i) => (
            <mesh key={i} position={[l.p[0], -PIT.depth / 2, l.p[1]]} rotation={[0, l.r, 0]} raycast={noRay}>
              <planeGeometry args={[l.w, PIT.depth]} />
              <meshLambertMaterial color={CONCRETE} />
            </mesh>
          ))}
      {!office && (
        <mesh position={[CX, -PIT.depth + 0.002, CZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRay}>
          <planeGeometry args={[X1 - X0, Z1 - Z0]} />
          <meshLambertMaterial color={CONCRETE} />
        </mesh>
      )}
      <mesh ref={end} position={[CX, office ? -SLAB : H, CZ]} rotation={[office ? -Math.PI / 2 : Math.PI / 2, 0, 0]} material={SHAFT_END} raycast={noRay}>
        <planeGeometry args={[X1 - X0, Z1 - Z0]} />
      </mesh>
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

const { x0: KX0, x1: KX1, z0: KZ0, z1: KZ1, h: KH, floor: KF, roof: KR, crosshead: KC } = CABIN;
const KW = KX1 - KX0;
const KD = KZ1 - KZ0;
/** Where the side and back walls change from steel panels to glass, and the handrails' height. */
const DADO = 0.55;
const HANDRAIL = 0.82;
/** The front wall's returns either side of the car's doorway: their middles, and how wide each is. */
const RETURN = { lo: (KZ0 + CAR_DOOR.z - CAR_DOOR.w / 2) / 2, hi: (KZ1 + CAR_DOOR.z + CAR_DOOR.w / 2) / 2, w: CAR_DOOR.z - CAR_DOOR.w / 2 - KZ0 };

/**
 * The car's frame and fittings: the platform it stands on and the sling round it (a stile up each side to the
 * rails, with guide shoes, a plank under and a crosshead over with the ropes' hitch), a railing round its roof for
 * the engineers, corner posts, kick plates, handrails and the frame round its light.
 */
function carFrame(): Prim[] {
  const top = KH + KR;
  const out: Prim[] = [
    bx([CABIN_CX, -KF / 2, CABIN_CZ], [KW + 0.04, KF, KD + 0.04], DARK),
    bx([KX1 + 0.02, -0.3, CAR_DOOR.z], [0.02, 0.45, CAR_DOOR.w + 0.2], STEEL),
    bx([CABIN_CX, top - KR / 2, CABIN_CZ], [KW + 0.04, KR, KD + 0.04], "#8d939b"),
    // The plank under the platform and the crosshead over the roof, across between the stiles.
    bx([CABIN_CX, -KF - 0.06, CABIN_CZ], [0.16, 0.12, KD + 0.24], DARK),
    bx([CABIN_CX, top + KC / 2, CABIN_CZ], [0.16, KC, KD + 0.24], DARK),
    // The ropes' hitch plate, with a spring under each rope.
    bx([ROPE_LINES.car, top + KC + 0.03, CABIN_CZ], [0.14, 0.04, SHEAVE.spread + 0.1], RAIL),
    ...ROPE_LINES.z.map((z) => cy([ROPE_LINES.car, top + KC + 0.1, z], 0.035, 0.1, SAFETY)),
    // Kick plates round the foot of the walls inside, and the car's sill at its doorway.
    bx([KX0 + 0.015, 0.06, CABIN_CZ], [0.01, 0.12, KD - 0.04], "#8d939b"),
    ...[KZ0 + 0.015, KZ1 - 0.015].map((z) => bx([CABIN_CX, 0.06, z], [KW - 0.04, 0.12, 0.01], "#8d939b")),
    bx([KX1 - 0.05, 0.006, CAR_DOOR.z], [0.1, 0.012, CAR_DOOR.w], FRAME),
  ];
  // The stiles up either side, with guide shoes top and bottom reaching to the rails.
  for (const z of [KZ0 - 0.06, KZ1 + 0.06]) {
    out.push(bx([CABIN_CX, (top + KC - KF - 0.12) / 2, z], [0.12, top + KC + KF + 0.12, 0.05], DARK));
    const railZ = z < CABIN_CZ ? RAILS.car[0][1] : RAILS.car[1][1];
    for (const y of [-KF - 0.05, top + KC - 0.05]) out.push(bx([CABIN_CX, y, (z + railZ) / 2], [0.14, 0.1, Math.abs(railZ - z) + 0.02], "#2b2e33"));
  }
  // The roof's railing: posts at the corners and a rail round the back and sides.
  const railTop = top + 0.7;
  for (const [x, z] of [
    [KX0 + 0.04, KZ0 + 0.04],
    [KX0 + 0.04, KZ1 - 0.04],
    [KX1 - 0.3, KZ0 + 0.04],
    [KX1 - 0.3, KZ1 - 0.04],
  ])
    out.push(bx([x, top + 0.35, z], [0.035, 0.7, 0.035], SAFETY));
  out.push(bx([KX0 + 0.04, railTop, CABIN_CZ], [0.035, 0.035, KD - 0.08], SAFETY));
  for (const z of [KZ0 + 0.04, KZ1 - 0.04]) out.push(bx([(KX0 + KX1 - 0.26) / 2, railTop, z], [KW - 0.34, 0.035, 0.035], SAFETY));
  // Corner posts, and the frames along the top of the steel panels and under the ceiling.
  for (const [x, z] of [
    [KX0 + 0.02, KZ0 + 0.02],
    [KX0 + 0.02, KZ1 - 0.02],
    [KX1 - 0.03, KZ0 + 0.02],
    [KX1 - 0.03, KZ1 - 0.02],
  ])
    out.push(bx([x, KH / 2, z], [0.05, KH, 0.05], FRAME));
  out.push(bx([KX0 + 0.02, DADO, CABIN_CZ], [0.05, 0.04, KD], FRAME));
  for (const z of [KZ0 + 0.02, KZ1 - 0.02]) out.push(bx([CABIN_CX, DADO, z], [KW, 0.04, 0.05], FRAME));
  out.push(bx([KX0 + 0.02, KH - 0.02, CABIN_CZ], [0.05, 0.04, KD], FRAME));
  for (const z of [KZ0 + 0.02, KZ1 - 0.02]) out.push(bx([CABIN_CX, KH - 0.02, z], [KW, 0.04, 0.05], FRAME));
  // Handrails along the back and the sides, on brackets.
  out.push(cy([KX0 + 0.1, HANDRAIL, CABIN_CZ], 0.04, KD - 0.4, FRAME, [Math.PI / 2, 0, 0]));
  for (const z of [CABIN_CZ - (KD - 0.6) / 2, CABIN_CZ + (KD - 0.6) / 2]) out.push(bx([KX0 + 0.06, HANDRAIL, z], [0.08, 0.03, 0.03], FRAME));
  for (const z of [KZ0 + 0.1, KZ1 - 0.1]) {
    out.push(cy([(KX0 + KX1 - 0.4) / 2, HANDRAIL, z], 0.04, KW - 0.6, FRAME, [0, 0, Math.PI / 2]));
    for (const x of [KX0 + 0.3, KX1 - 0.5]) out.push(bx([x, HANDRAIL, z + (z < CABIN_CZ ? -0.04 : 0.04)], [0.03, 0.03, 0.08], FRAME));
  }
  // The ceiling: a frame round the light and two vent slots.
  out.push(bx([CABIN_CX, KH - 0.03, CABIN_CZ], [KW - 0.18, 0.02, KD - 0.18], "#9aa0a8"));
  for (const z of [KZ0 + 0.18, KZ1 - 0.18]) out.push(bx([CABIN_CX, KH - 0.035, z], [KW - 0.5, 0.012, 0.05], "#2b2e33"));
  return out;
}

/** The car's light, and one of its door panels. */
const CAR_LIGHT = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.46, 1.36), toneMapped: false, clippingPlanes: SHAFT_CLIP });
/** The car's glass: the room's own, cut to the part of the shaft in view like the rest of the car. */
const CAR_GLASS = (() => {
  const m = GLASS_MATERIAL.clone();
  m.clippingPlanes = SHAFT_CLIP;
  return m;
})();
const CAR_DOOR_PANEL = new THREE.BoxGeometry(0.035, CAR_DOOR.h, CAR_DOOR.w / 2 - 0.01);

/** The number lit on the car's panel: the floor it is going to, or none while it stands. */
function litFloor(): number | null {
  const bound = carBound();
  return bound === null ? null : FLOOR_NUMBER[bound];
}

/** The steel the car's walls and doors are panelled in and its granite floor: shaded simply in basic detail, polished in HD. */
function useCarFinish(): { wall: THREE.Material; door: THREE.Material; floor: THREE.Material } {
  const hd = useDetail() === "hd";
  return useMemo(() => {
    const steel = brushedSteel();
    const floor = liftFloor();
    const clippingPlanes = SHAFT_CLIP;
    return hd
      ? {
          wall: new THREE.MeshStandardMaterial({ map: steel, color: "#e7eaee", metalness: 0.6, roughness: 0.38, clippingPlanes }),
          door: new THREE.MeshStandardMaterial({ map: steel, color: "#f0f2f5", metalness: 0.65, roughness: 0.3, clippingPlanes }),
          floor: new THREE.MeshStandardMaterial({ map: floor, metalness: 0.05, roughness: 0.28, clippingPlanes }),
        }
      : {
          wall: new THREE.MeshLambertMaterial({ map: steel, color: "#e7eaee", clippingPlanes }),
          door: new THREE.MeshLambertMaterial({ map: steel, color: "#f4f6f8", clippingPlanes }),
          floor: new THREE.MeshLambertMaterial({ map: floor, clippingPlanes }),
        };
  }, [hd]);
}

export function ElevatorCar() {
  const group = useRef<THREE.Group>(null);
  const prims = useMemo(() => carFrame(), []);
  const finish = useCarFinish();
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  const panel = useRef<THREE.MeshBasicMaterial>(null);
  const display = useRef<THREE.MeshBasicMaterial>(null);
  const small = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef({ lit: "", at: "" });
  useFrame(() => {
    if (group.current) group.current.position.y = carY();
    // The car's doors move with the landing's, wherever it stands.
    const open = Math.max(carDoors("office"), carDoors("servers"));
    const slide = CAR_DOOR.w / 4 + open * (CAR_DOOR.w / 2) * 0.95;
    if (left.current) left.current.position.z = CAR_DOOR.z - slide;
    if (right.current) right.current.position.z = CAR_DOOR.z + slide;
    // The floor it is going to lights up on the panel while it moves; the displays count as the landings' do.
    const target = litFloor();
    const lit = target === null ? "" : String(target);
    if (panel.current && lit !== shown.current.lit) {
      shown.current.lit = lit;
      panel.current.map = liftPanel([FLOOR_NUMBER.office, FLOOR_NUMBER.servers], target);
      panel.current.needsUpdate = true;
    }
    const { floor: at, arrow } = carIndicator();
    const key = `${at}|${arrow}`;
    if (key !== shown.current.at) {
      shown.current.at = key;
      for (const m of [display.current, small.current]) {
        if (!m) continue;
        m.map = liftDisplay(FLOOR_NUMBER[at], arrow);
        m.needsUpdate = true;
      }
    }
  });
  const inward = -Math.PI / 2;
  return (
    <group ref={group}>
      <PrimBatch prims={prims} clip={SHAFT_CLIP} />
      {/* The floor, and the steel up to the handrails, the doorway's returns and the panel over the doors. */}
      <mesh position={[CABIN_CX, 0.002, CABIN_CZ]} rotation={[-Math.PI / 2, 0, 0]} material={finish.floor} receiveShadow raycast={noRay}>
        <planeGeometry args={[KW, KD]} />
      </mesh>
      <mesh position={[KX0 + 0.005, DADO / 2, CABIN_CZ]} rotation={[0, Math.PI / 2, 0]} material={finish.wall} raycast={noRay}>
        <planeGeometry args={[KD, DADO]} />
      </mesh>
      {[KZ0 + 0.005, KZ1 - 0.005].map((z) => (
        <mesh key={z} position={[CABIN_CX, DADO / 2, z]} rotation={[0, z < CABIN_CZ ? 0 : Math.PI, 0]} material={finish.wall} raycast={noRay}>
          <planeGeometry args={[KW, DADO]} />
        </mesh>
      ))}
      {[RETURN.lo, RETURN.hi].map((z) => (
        <mesh key={z} position={[KX1 - 0.04, KH / 2, z]} material={finish.wall} raycast={noRay}>
          <boxGeometry args={[0.04, KH, RETURN.w]} />
        </mesh>
      ))}
      <mesh position={[KX1 - 0.04, (CAR_DOOR.h + KH) / 2, CAR_DOOR.z]} material={finish.wall} raycast={noRay}>
        <boxGeometry args={[0.04, KH - CAR_DOOR.h, CAR_DOOR.w]} />
      </mesh>
      {/* Glass above the steel, so the shaft and the floors can be seen going by. */}
      <mesh position={[KX0 + 0.01, (DADO + KH) / 2, CABIN_CZ]} rotation={[0, Math.PI / 2, 0]} material={CAR_GLASS} raycast={noRay}>
        <planeGeometry args={[KD, KH - DADO]} />
      </mesh>
      {[KZ0 + 0.01, KZ1 - 0.01].map((z) => (
        <mesh key={z} position={[CABIN_CX, (DADO + KH) / 2, z]} material={CAR_GLASS} raycast={noRay}>
          <planeGeometry args={[KW, KH - DADO]} />
        </mesh>
      ))}
      {/* The ceiling: the roof's underside, and its light. */}
      <mesh position={[CABIN_CX, KH, CABIN_CZ]} rotation={[Math.PI / 2, 0, 0]} raycast={noRay}>
        <planeGeometry args={[KW, KD]} />
        <meshLambertMaterial color="#c9cdd3" clippingPlanes={SHAFT_CLIP} />
      </mesh>
      <mesh position={[CABIN_CX, KH - 0.04, CABIN_CZ]} rotation={[Math.PI / 2, 0, 0]} material={CAR_LIGHT} raycast={noRay}>
        <planeGeometry args={[KW - 0.3, KD - 0.5]} />
      </mesh>
      {/* Its own doors, and the operating panel to their right seen from inside, with a display over each. */}
      <mesh ref={left} position={[KX1 - 0.075, CAR_DOOR.h / 2, CAR_DOOR.z - CAR_DOOR.w / 4]} geometry={CAR_DOOR_PANEL} material={finish.door} raycast={noRay} />
      <mesh ref={right} position={[KX1 - 0.075, CAR_DOOR.h / 2, CAR_DOOR.z + CAR_DOOR.w / 4]} geometry={CAR_DOOR_PANEL} material={finish.door} raycast={noRay} />
      <mesh position={[KX1 - 0.064, 1.12, RETURN.hi]} rotation={[0, inward, 0]} raycast={noRay}>
        <planeGeometry args={[Math.min(0.22, RETURN.w - 0.08), 0.66]} />
        <meshBasicMaterial ref={panel} map={liftPanel([FLOOR_NUMBER.office, FLOOR_NUMBER.servers], null)} toneMapped={false} clippingPlanes={SHAFT_CLIP} />
      </mesh>
      <mesh position={[KX1 - 0.064, 1.52, RETURN.hi]} rotation={[0, inward, 0]} raycast={noRay}>
        <planeGeometry args={[0.16, 0.08]} />
        <meshBasicMaterial ref={small} map={liftDisplay(FLOOR_NUMBER.servers, null)} toneMapped={false} clippingPlanes={SHAFT_CLIP} />
      </mesh>
      <mesh position={[KX1 - 0.064, CAR_DOOR.h + 0.13, CAR_DOOR.z]} rotation={[0, inward, 0]} raycast={noRay}>
        <planeGeometry args={[0.32, 0.15]} />
        <meshBasicMaterial ref={display} map={liftDisplay(FLOOR_NUMBER.servers, null)} toneMapped={false} clippingPlanes={SHAFT_CLIP} />
      </mesh>
    </group>
  );
}

/** One rope, plate or run of cable: a unit mesh stretched each frame. */
const UNIT_ROPE = new THREE.CylinderGeometry(0.011, 0.011, 1, 6);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const ROPE_STEEL = new THREE.MeshLambertMaterial({ color: "#3a3e45" });
const WEIGHT = new THREE.MeshLambertMaterial({ color: "#4b5059" });
const WEIGHT_FRAME = new THREE.MeshLambertMaterial({ color: "#2b2e33" });
const CABLE = new THREE.MeshLambertMaterial({ color: "#1d1f24" });
const LOOP = new THREE.TorusGeometry(TRAVELLING.r, 0.025, 6, 18, Math.PI);
const CABLE_RUN = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);

/** Stand a unit mesh from `lo` to `hi` up the shaft at (x, z), or hide it when none of it can be seen. */
function span(mesh: THREE.Object3D | null, x: number, z: number, lo: number, hi: number, band: [number, number]) {
  if (!mesh) return;
  const seen = clipSpan(lo, hi, band[0], band[1]);
  mesh.visible = !!seen;
  if (!seen) return;
  mesh.position.set(x, (seen[0] + seen[1]) / 2, z);
  mesh.scale.y = seen[1] - seen[0];
}

/**
 * The shaft's moving parts, in the building's own heights: the ropes from the car's crosshead over the sheave and
 * down to the counterweight, the counterweight's frame and plates, and the travelling cable under the car. Each
 * frame they follow the car, and only the part of the shaft in view is drawn, so none of it shows above or below
 * the floor on screen.
 */
export function ShaftRun() {
  const ropes = useRef<(THREE.Mesh | null)[]>([]);
  const plates = useRef<(THREE.Mesh | null)[]>([]);
  const stiles = useRef<(THREE.Mesh | null)[]>([]);
  const legs = useRef<(THREE.Mesh | null)[]>([]);
  const loop = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const band = bandNow();
    // The car and its riders are cut to the same heights.
    clipShaft(band[0], band[1]);
    const car = carY();
    const foot = counterweightFoot(car);
    const head = foot + COUNTERWEIGHT.h;
    ROPE_LINES.z.forEach((z, i) => {
      span(ropes.current[i], ROPE_LINES.car, z, carTop(car) + 0.15, SHEAVE.y, band);
      span(ropes.current[i + ROPE_LINES.z.length], ROPE_LINES.counterweight, z, head, SHEAVE.y, band);
    });
    const plate = COUNTERWEIGHT.h / COUNTERWEIGHT.plates;
    plates.current.forEach((m, i) => {
      if (!m) return;
      const y = foot + (i + 0.5) * plate;
      m.visible = y > band[0] && y < band[1];
      m.position.y = y;
    });
    [-1, 1].forEach((s, i) => span(stiles.current[i], COUNTERWEIGHT.x, COUNTERWEIGHT.z + s * (COUNTERWEIGHT.d / 2 + 0.02), foot - 0.05, head + 0.1, band));
    const low = cableLoop(car);
    span(legs.current[0], TRAVELLING.x.car, TRAVELLING.z, low, car - CABIN.floor, band);
    span(legs.current[1], TRAVELLING.x.wall, TRAVELLING.z, low, TRAVELLING.anchor, band);
    if (loop.current) {
      loop.current.visible = low - TRAVELLING.r > band[0] && low < band[1];
      loop.current.position.set((TRAVELLING.x.car + TRAVELLING.x.wall) / 2, low, TRAVELLING.z);
    }
  });
  return (
    <group>
      {Array.from({ length: ROPE_LINES.z.length * 2 }, (_, i) => (
        <mesh key={`r${i}`} ref={(m) => void (ropes.current[i] = m)} geometry={UNIT_ROPE} material={ROPE_STEEL} raycast={noRay} />
      ))}
      {Array.from({ length: COUNTERWEIGHT.plates }, (_, i) => (
        <mesh
          key={`p${i}`}
          ref={(m) => void (plates.current[i] = m)}
          position={[COUNTERWEIGHT.x, 0, COUNTERWEIGHT.z]}
          scale={[COUNTERWEIGHT.w, (COUNTERWEIGHT.h / COUNTERWEIGHT.plates) * 0.86, COUNTERWEIGHT.d]}
          geometry={UNIT_BOX}
          material={WEIGHT}
          raycast={noRay}
        />
      ))}
      {[0, 1].map((i) => (
        <mesh key={`s${i}`} ref={(m) => void (stiles.current[i] = m)} scale={[COUNTERWEIGHT.w + 0.04, 1, 0.04]} geometry={UNIT_BOX} material={WEIGHT_FRAME} raycast={noRay} />
      ))}
      {[0, 1].map((i) => (
        <mesh key={`l${i}`} ref={(m) => void (legs.current[i] = m)} geometry={CABLE_RUN} material={CABLE} raycast={noRay} />
      ))}
      <mesh ref={loop} rotation={[0, 0, Math.PI]} geometry={LOOP} material={CABLE} raycast={noRay} />
    </group>
  );
}
