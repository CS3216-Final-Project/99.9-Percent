"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { ROOM } from "./layout";
import { hazardStripes, logoSign, skyline, whiteboard, woodFloor } from "./textures";
import { OnWall } from "./walls";

/*
 * The people and the furniture that make the facility read as a small company
 * rather than a rack farm: engineers at their desks, a kitchen and a lounge
 * where free engineers drift to, windows onto the city, a whiteboard with the
 * current architecture and a neon logo. Everything is built from boxes so it
 * matches the chunky pixel interface.
 */

type Vec3 = [number, number, number];

/** A plain box. Nearly everything in the office is one of these. */
function B({ p, s, c, r, cast = false, emissive, glow = 0 }: { p: Vec3; s: Vec3; c: string; r?: Vec3; cast?: boolean; emissive?: string; glow?: number }) {
  return (
    <mesh position={p} rotation={r} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.85} metalness={0} emissive={emissive ?? "#000000"} emissiveIntensity={glow} />
    </mesh>
  );
}

function Cyl({ p, r, h, c, seg = 10, cast = false }: { p: Vec3; r: number; h: number; c: string; seg?: number; cast?: boolean }) {
  return (
    <mesh position={p} castShadow={cast}>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export interface Look {
  shirt: string;
  skin: string;
  hair: string;
  pants: string;
  style: 0 | 1 | 2;
}

const SHIRTS = ["#4cb8ff", "#ff7ad9", "#3ddc84", "#ffc53d", "#a985ff", "#ff9f43", "#2dd4bf", "#ff6b6b", "#e8e2ff"];
const SKINS = ["#f3cba5", "#d9a07a", "#a86b4a", "#6e4630", "#e8b48f", "#c68863"];
const HAIRS = ["#1d1834", "#4a2c1d", "#7a4a2a", "#d9a441", "#1d1834", "#8a3b2a", "#2b2b3a"];
const PANTS = ["#2a2450", "#34305c", "#1f3b5c", "#3b2f2a"];

/** A stable, varied look for the nth person in the office. */
export function look(n: number): Look {
  return {
    shirt: SHIRTS[(n * 5 + 1) % SHIRTS.length],
    skin: SKINS[(n * 7 + 2) % SKINS.length],
    hair: HAIRS[(n * 3 + 1) % HAIRS.length],
    pants: PANTS[n % PANTS.length],
    style: (n % 3) as Look["style"],
  };
}

export type Activity = "type" | "relax" | "mug" | "laptop" | "idle" | "chat" | "walk";

const ARM = 0.42;

/** Resting angles for the torso lean and each arm (radians about X; negative points the arm forward and down). */
function restPose(pose: "sit" | "stand", activity: Activity): { lean: number; left: number; right: number } {
  if (pose === "sit") {
    if (activity === "type") return { lean: 0, left: -0.62, right: -0.62 };
    if (activity === "laptop") return { lean: 0.08, left: -0.95, right: -0.95 };
    if (activity === "mug") return { lean: 0.16, left: -1.15, right: -0.2 };
    return { lean: 0.18, left: -1.15, right: -1.15 };
  }
  if (activity === "type") return { lean: -0.06, left: -0.72, right: -0.72 };
  if (activity === "mug") return { lean: 0, left: -1.5, right: -0.3 };
  if (activity === "chat") return { lean: 0, left: -1.5, right: -1.1 };
  if (activity === "walk") return { lean: -0.04, left: -1.45, right: -1.45 };
  return { lean: 0, left: -1.5, right: -1.5 };
}

export function Person({
  pose,
  activity,
  look: l,
  position,
  rotation = 0,
  phase = 0,
}: {
  pose: "sit" | "stand";
  activity: Activity;
  look: Look;
  position: Vec3;
  rotation?: number;
  phase?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const rest = restPose(pose, activity);
  const sit = pose === "sit";
  const hipY = sit ? 0.56 : 0.78;
  const torsoZ = sit ? 0.06 : 0;
  const torsoH = 0.52;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (!left.current || !right.current || !head.current || !upper.current || !root.current) return;
    if (activity === "walk") {
      const s = Math.sin(t * 7);
      if (legL.current) legL.current.rotation.x = s * 0.45;
      if (legR.current) legR.current.rotation.x = -s * 0.45;
      left.current.rotation.x = rest.left - s * 0.35;
      right.current.rotation.x = rest.right + s * 0.35;
      upper.current.position.y = hipY + Math.abs(Math.cos(t * 7)) * 0.025;
    } else if (activity === "type" || activity === "laptop") {
      const k = activity === "type" ? 0.07 : 0.04;
      left.current.rotation.x = rest.left + Math.sin(t * 15) * k;
      right.current.rotation.x = rest.right + Math.sin(t * 15 + Math.PI) * k;
      head.current.rotation.x = Math.sin(t * 1.1) * 0.05;
      head.current.rotation.y = Math.sin(t * 0.37) * 0.12;
    } else if (activity === "mug") {
      // Look around, and every few seconds take a sip.
      head.current.rotation.y = Math.sin(t * 0.45) * 0.45;
      const sip = Math.max(0, Math.sin(t * 0.6) - 0.85) * 6;
      right.current.rotation.x = rest.right + sip * 0.5;
      head.current.rotation.x = -sip * 0.15;
    } else if (activity === "chat") {
      head.current.rotation.y = Math.sin(t * 0.8) * 0.3;
      right.current.rotation.x = rest.right + Math.sin(t * 2.4) * 0.25;
      right.current.rotation.z = -0.2 + Math.sin(t * 1.7) * 0.1;
      root.current.position.y = position[1] + Math.abs(Math.sin(t * 2.4)) * 0.01;
    } else {
      head.current.rotation.y = Math.sin(t * 0.35) * 0.5;
      upper.current.rotation.x = rest.lean + Math.sin(t * 0.5) * 0.02;
    }
  });

  const arm = (side: 1 | -1, ref: RefObject<THREE.Group | null>, angle: number, mug: boolean) => (
    <group ref={ref} position={[side * 0.27, torsoH - 0.07, 0]} rotation={[angle, 0, 0]}>
      <B p={[0, 0, -ARM / 2]} s={[0.11, 0.11, ARM]} c={l.shirt} />
      <B p={[0, 0, -ARM - 0.03]} s={[0.1, 0.09, 0.1]} c={l.skin} />
      {mug && <Cyl p={[0, 0.05, -ARM - 0.05]} r={0.05} h={0.11} c="#fff7e8" />}
    </group>
  );

  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      {sit ? (
        <>
          <B p={[0, 0.56, -0.13]} s={[0.38, 0.14, 0.44]} c={l.pants} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <B p={[side * 0.1, 0.27, -0.33]} s={[0.13, 0.5, 0.13]} c={l.pants} />
              <B p={[side * 0.1, 0.04, -0.37]} s={[0.14, 0.08, 0.22]} c="#1d1834" />
            </group>
          ))}
        </>
      ) : (
        [-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.1, 0.78, 0]}>
            <B p={[0, -0.37, 0]} s={[0.15, 0.74, 0.17]} c={l.pants} cast />
            <B p={[0, -0.74, -0.03]} s={[0.15, 0.08, 0.24]} c="#1d1834" />
          </group>
        ))
      )}
      <group ref={upper} position={[0, hipY, torsoZ]} rotation={[rest.lean, 0, 0]}>
        <B p={[0, torsoH / 2, 0]} s={[0.42, torsoH, 0.24]} c={l.shirt} cast />
        <B p={[0, torsoH - 0.02, -0.005]} s={[0.24, 0.05, 0.25]} c={l.skin} />
        <group ref={head} position={[0, torsoH + 0.18, 0]}>
          <B p={[0, 0, 0]} s={[0.3, 0.3, 0.28]} c={l.skin} cast />
          <B p={[0, 0.17, 0.01]} s={[0.33, 0.1, 0.31]} c={l.hair} />
          <B p={[0, l.style === 1 ? -0.05 : 0.03, 0.13]} s={[0.33, l.style === 1 ? 0.4 : 0.26, 0.08]} c={l.hair} />
          {l.style === 2 && <B p={[0, 0.26, 0.06]} s={[0.14, 0.1, 0.14]} c={l.hair} />}
          {[-1, 1].map((side) => (
            <B key={side} p={[side * 0.07, 0.01, -0.145]} s={[0.045, 0.06, 0.02]} c="#1d1834" />
          ))}
        </group>
        {arm(-1, left, rest.left, false)}
        {arm(1, right, rest.right, activity === "mug")}
      </group>
      {activity === "laptop" && (
        <group position={[0, 0.64, -0.24]}>
          <B p={[0, 0, 0]} s={[0.36, 0.025, 0.25]} c="#d9d4f0" />
          <group position={[0, 0.01, 0.12]} rotation={[0.35, 0, 0]}>
            <B p={[0, 0.12, 0]} s={[0.36, 0.24, 0.02]} c="#d9d4f0" />
          </group>
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Furniture and fittings                                              */
/* ------------------------------------------------------------------ */

function Plant({ x, z, tall = false, y = 0, scale }: { x: number; z: number; tall?: boolean; y?: number; scale?: number }) {
  const k = scale ?? (tall ? 1 : 0.55);
  return (
    <group position={[x, y, z]} scale={k}>
      <Cyl p={[0, 0.2, 0]} r={0.24} h={0.4} c="#c96b4a" cast />
      <Cyl p={[0, 0.41, 0]} r={0.22} h={0.03} c="#3b2a1e" />
      <mesh position={[0, 0.85, 0]} castShadow>
        <coneGeometry args={[0.42, 0.95, 5]} />
        <meshStandardMaterial color="#2f9e5f" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.12, 1.3, -0.05]} castShadow>
        <coneGeometry args={[0.28, 0.7, 5]} />
        <meshStandardMaterial color="#3ddc84" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[-0.16, 1.05, 0.1]}>
        <coneGeometry args={[0.22, 0.55, 5]} />
        <meshStandardMaterial color="#26834e" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/** A window onto the city at night, set into a wall. */
function CityWindow({ position, rotation = 0, w, h }: { position: Vec3; rotation?: number; w: number; h: number }) {
  const tex = useMemo(() => skyline(), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <B p={[0, 0, 0]} s={[w + 0.16, h + 0.16, 0.06]} c="#2a2450" />
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <B p={[0, 0, 0.05]} s={[0.06, h, 0.03]} c="#2a2450" />
      <B p={[0, -h / 2 - 0.08, 0.1]} s={[w + 0.3, 0.06, 0.2]} c="#e8e2ff" />
    </group>
  );
}

function NeonLogo({ position, rotation }: { position: Vec3; rotation: number }) {
  const tex = useMemo(() => logoSign(), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <B p={[0, 0, 0]} s={[3.1, 1.05, 0.05]} c="#1d1834" />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[3, 0.95]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Whiteboard({ position, rotation }: { position: Vec3; rotation: number }) {
  const tex = useMemo(() => whiteboard(), []);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <B p={[0, 0, 0]} s={[2.3, 1.32, 0.05]} c="#b9b2d9" />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[2.2, 1.22]} />
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      <B p={[0, -0.7, 0.07]} s={[1.6, 0.04, 0.1]} c="#b9b2d9" />
      <B p={[-0.3, -0.67, 0.08]} s={[0.12, 0.03, 0.03]} c="#4cb8ff" />
      <B p={[-0.1, -0.67, 0.08]} s={[0.12, 0.03, 0.03]} c="#ff4d5e" />
    </group>
  );
}

function Kitchen() {
  return (
    <group>
      {/* Counter along the back wall, fridge at the end, water cooler by the door. */}
      <B p={[12.4, 0.45, -9.18]} s={[2.0, 0.9, 0.6]} c="#c98b55" cast />
      <B p={[12.4, 0.93, -9.18]} s={[2.04, 0.06, 0.64]} c="#2a2450" />
      {[11.75, 12.4, 13.05].map((x) => (
        <B key={x} p={[x, 0.55, -8.875]} s={[0.04, 0.3, 0.02]} c="#2a2450" />
      ))}
      <B p={[11.75, 1.17, -9.25]} s={[0.32, 0.42, 0.32]} c="#1d1834" cast />
      <B p={[11.75, 1.1, -9.08]} s={[0.2, 0.14, 0.04]} c="#30295a" />
      <B p={[11.84, 1.3, -9.08]} s={[0.05, 0.05, 0.02]} c="#ff4d5e" emissive="#ff4d5e" glow={1.5} />
      <Cyl p={[11.98, 1.01, -9.05]} r={0.045} h={0.09} c="#ffc53d" />
      <Cyl p={[12.1, 1.01, -9.12]} r={0.045} h={0.09} c="#4cb8ff" />
      <B p={[12.75, 1.1, -9.24]} s={[0.55, 0.3, 0.38]} c="#d9d4f0" />
      <B p={[12.68, 1.1, -9.04]} s={[0.32, 0.2, 0.01]} c="#1d1834" />
      <B p={[11.0, 0.95, -9.12]} s={[0.7, 1.9, 0.66]} c="#e8e4ff" cast />
      <B p={[11.0, 1.3, -8.78]} s={[0.66, 0.02, 0.02]} c="#b9b2d9" />
      <B p={[11.28, 1.0, -8.77]} s={[0.04, 0.4, 0.04]} c="#8f87c9" />
      <B p={[11.28, 1.55, -8.77]} s={[0.04, 0.2, 0.04]} c="#8f87c9" />
      <group position={[13.15, 0, -7.6]}>
        <B p={[0, 0.5, 0]} s={[0.38, 1.0, 0.38]} c="#e8e4ff" cast />
        <mesh position={[0, 1.22, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.42, 10]} />
          <meshStandardMaterial color="#4cb8ff" transparent opacity={0.75} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function Lounge() {
  return (
    <group>
      <mesh position={[11.45, 0.007, -2.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.6, 2.8]} />
        <meshStandardMaterial color="#6b4aa0" roughness={1} />
      </mesh>
      <mesh position={[11.45, 0.008, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial color="#7d5bb8" roughness={1} />
      </mesh>
      {/* Sofa facing into the room */}
      <B p={[11.45, 0.2, -3.55]} s={[2.3, 0.36, 0.86]} c="#2a9d8f" cast />
      <B p={[10.95, 0.44, -3.45]} s={[1.05, 0.12, 0.7]} c="#34b3a4" />
      <B p={[11.95, 0.44, -3.45]} s={[1.05, 0.12, 0.7]} c="#34b3a4" />
      <B p={[11.45, 0.66, -3.94]} s={[2.3, 0.56, 0.22]} c="#2a9d8f" cast />
      <B p={[10.25, 0.38, -3.55]} s={[0.2, 0.5, 0.86]} c="#23877b" />
      <B p={[12.65, 0.38, -3.55]} s={[0.2, 0.5, 0.86]} c="#23877b" />
      <B p={[12.3, 0.58, -3.6]} s={[0.4, 0.3, 0.14]} c="#ffc53d" r={[-0.2, 0.2, 0]} />
      {/* Coffee table with late-night pizza */}
      <B p={[11.45, 0.42, -2.35]} s={[1.3, 0.07, 0.66]} c="#c98b55" cast />
      {[-0.55, 0.55].flatMap((dx) => [-0.25, 0.25].map((dz) => <B key={`${dx}${dz}`} p={[11.45 + dx, 0.2, -2.35 + dz]} s={[0.06, 0.4, 0.06]} c="#2a2450" />))}
      <B p={[11.25, 0.49, -2.35]} s={[0.46, 0.06, 0.46]} c="#e9d3a8" r={[0, 0.2, 0]} />
      <B p={[11.28, 0.55, -2.33]} s={[0.46, 0.06, 0.46]} c="#e9d3a8" r={[0, -0.15, 0]} />
      <B p={[11.28, 0.585, -2.33]} s={[0.2, 0.01, 0.2]} c="#ff4d5e" r={[0, -0.15, 0]} />
      <Cyl p={[11.82, 0.52, -2.45]} r={0.04} h={0.13} c="#ff4d5e" />
      <Cyl p={[11.92, 0.52, -2.25]} r={0.04} h={0.13} c="#3ddc84" />
      {/* Beanbags */}
      <mesh position={[10.0, 0.26, -1.55]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.48, 10, 8]} />
        <meshStandardMaterial color="#ffc53d" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[12.85, 0.26, -1.45]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.48, 10, 8]} />
        <meshStandardMaterial color="#ff7ad9" roughness={0.95} flatShading />
      </mesh>
      {/* Floor lamp */}
      <Cyl p={[13.1, 0.85, -4.1]} r={0.03} h={1.7} c="#2a2450" />
      <Cyl p={[13.1, 0.02, -4.1]} r={0.2} h={0.04} c="#2a2450" />
      <mesh position={[13.1, 1.75, -4.1]}>
        <coneGeometry args={[0.28, 0.3, 8, 1, true]} />
        <meshStandardMaterial color="#ffd9a0" emissive="#ffcf94" emissiveIntensity={1.4} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[12.6, 2.2, -3.2]} intensity={10} distance={7} color="#ffcf94" />
    </group>
  );
}

function PingPong() {
  const ball = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ball.current) return;
    // A rally that never ends: the ball crosses the net and bounces on each side.
    const t = clock.elapsedTime * 0.9;
    const f = t % 2;
    const x = f < 1 ? -1.1 + f * 2.2 : 1.1 - (f - 1) * 2.2;
    ball.current.position.set(x, 0.82 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.3, Math.sin(t * 1.3) * 0.35);
  });
  return (
    <group position={[11.45, 0, 7.3]}>
      <B p={[0, 0.76, 0]} s={[2.74, 0.06, 1.52]} c="#1f7a5c" cast />
      <B p={[0, 0.795, 0.745]} s={[2.74, 0.012, 0.03]} c="#fff7e8" />
      <B p={[0, 0.795, -0.745]} s={[2.74, 0.012, 0.03]} c="#fff7e8" />
      <B p={[1.355, 0.795, 0]} s={[0.03, 0.012, 1.52]} c="#fff7e8" />
      <B p={[-1.355, 0.795, 0]} s={[0.03, 0.012, 1.52]} c="#fff7e8" />
      <B p={[0, 0.795, 0]} s={[2.74, 0.012, 0.015]} c="#fff7e8" />
      <B p={[0, 0.87, 0]} s={[0.02, 0.15, 1.64]} c="#e8e2ff" />
      {[-1.1, 1.1].flatMap((dx) => [-0.6, 0.6].map((dz) => <B key={`${dx}${dz}`} p={[dx, 0.37, dz]} s={[0.07, 0.74, 0.07]} c="#2a2450" />))}
      <Cyl p={[-0.9, 0.8, 0.45]} r={0.09} h={0.02} c="#ff4d5e" />
      <Cyl p={[0.95, 0.8, -0.4]} r={0.09} h={0.02} c="#1d1834" />
      <mesh ref={ball}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color="#fff7e8" />
      </mesh>
    </group>
  );
}

/** Red beacon above the monitoring wall that spins up during an incident. */
function Beacon({ on }: { on: boolean }) {
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const pulse = on ? 0.5 + 0.5 * Math.sin(clock.elapsedTime * 8) : 0;
    if (lamp.current) lamp.current.emissiveIntensity = on ? 0.6 + pulse * 2.4 : 0.15;
    if (light.current) light.current.intensity = pulse * 30;
  });
  return (
    <group position={[5.9, 2.9, -9.3]}>
      <B p={[0, -0.1, 0]} s={[0.3, 0.08, 0.3]} c="#2a2450" />
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={lamp} color="#ff4d5e" emissive="#ff4d5e" emissiveIntensity={0.15} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 0, 0.6]} intensity={0} distance={10} color="#ff4d5e" />
    </group>
  );
}

/** Rectangles of floor, as [centre x, centre z, width, depth]. */
const OFFICE_FLOOR: [number, number, number, number][] = [
  [0, 7.25, ROOM.w, 4.5],
  [11.25, -1.1, 4.5, 12.2],
  [12.2, -8.35, 2.6, 2.3],
];
const STRIPES: [number, number, number, number][] = [
  [-2.25, 5.0, 22.5, 0.14],
  [9.0, -1.1, 0.14, 12.2],
  [9.95, -7.2, 1.9, 0.14],
  [10.9, -8.35, 0.14, 2.3],
];

function Floors() {
  const wood = useMemo(() => woodFloor(), []);
  const stripe = useMemo(() => hazardStripes(), []);
  const woodMaps = useMemo(
    () =>
      OFFICE_FLOOR.map(([, , w, d]) => {
        const t = wood.clone();
        t.repeat.set(w / 1.6, d / 1.6);
        t.needsUpdate = true;
        return t;
      }),
    [wood],
  );
  const stripeMaps = useMemo(
    () =>
      STRIPES.map(([, , w, d]) => {
        const t = stripe.clone();
        t.repeat.set(Math.max(w, d) / 0.5, 1);
        t.needsUpdate = true;
        return t;
      }),
    [stripe],
  );
  return (
    <group>
      {OFFICE_FLOOR.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial map={woodMaps[i]} roughness={0.9} />
        </mesh>
      ))}
      {STRIPES.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, w < d ? Math.PI / 2 : 0]}>
          <planeGeometry args={[Math.max(w, d), Math.min(w, d)]} />
          <meshBasicMaterial map={stripeMaps[i]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Someone pacing back and forth between two points. */
function Walker({ from, to, speed, look: l, phase = 0 }: { from: [number, number]; to: [number, number]; speed: number; look: Look; phase?: number }) {
  const g = useRef<THREE.Group>(null);
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const d = (clock.elapsedTime * speed + phase) % (2 * len);
    const back = d > len;
    const f = back ? 2 - d / len : d / len;
    g.current.position.set(from[0] + dx * f, 0, from[1] + dz * f);
    const dir = back ? -1 : 1;
    g.current.rotation.y = Math.atan2(-dx * dir, -dz * dir);
  });
  return (
    <group ref={g}>
      <Person pose="stand" activity="walk" look={l} position={[0, 0, 0]} phase={phase} />
    </group>
  );
}

/** A cart of tools wheeled up to the racks, and hardware waiting to be installed. */
function ServerFloorProps() {
  return (
    <group>
      <group position={[5.3, 0, -2.6]} rotation={[0, 0.4, 0]}>
        {[0.12, 0.62].map((y) => (
          <B key={y} p={[0, y + 0.15, 0]} s={[0.8, 0.04, 0.55]} c="#8f87c9" cast />
        ))}
        {[-0.37, 0.37].flatMap((dx) => [-0.24, 0.24].map((dz) => <B key={`${dx}${dz}`} p={[dx, 0.42, dz]} s={[0.04, 0.7, 0.04]} c="#5d5399" />))}
        {[-0.33, 0.33].flatMap((dx) => [-0.2, 0.2].map((dz) => <Cyl key={`w${dx}${dz}`} p={[dx, 0.06, dz]} r={0.06} h={0.05} c="#1d1834" />))}
        <B p={[0, 0.8, 0.02]} s={[0.4, 0.02, 0.28]} c="#d9d4f0" />
        <group position={[0, 0.81, -0.1]} rotation={[-0.3, 0, 0]}>
          <B p={[0, 0.12, 0]} s={[0.4, 0.24, 0.02]} c="#d9d4f0" />
          <mesh position={[0, 0.12, 0.012]}>
            <planeGeometry args={[0.34, 0.18]} />
            <meshBasicMaterial color="#3ddc84" toneMapped={false} />
          </mesh>
        </group>
        <B p={[0.2, 0.33, 0]} s={[0.3, 0.12, 0.3]} c="#ff9f43" />
      </group>
      <group position={[7.5, 0, -4.3]}>
        <B p={[0, 0.22, 0]} s={[0.7, 0.44, 0.55]} c="#c9a272" cast />
        <B p={[0.05, 0.6, 0.02]} s={[0.6, 0.32, 0.5]} c="#d4ae7e" r={[0, 0.15, 0]} cast />
        <B p={[0.75, 0.18, 0.15]} s={[0.55, 0.36, 0.45]} c="#c9a272" r={[0, -0.3, 0]} cast />
        <B p={[0, 0.445, 0]} s={[0.7, 0.005, 0.1]} c="#e8d7b5" />
      </group>
      {/* Perforated floor tiles that blow cold air up to the racks */}
      {[
        [-3.5, -4.95],
        [-0.9, -4.95],
        [4.3, -4.2],
        [6.4, -1.0],
        [0.9, 0.6],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.005, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.86, 0.86]} />
            <meshStandardMaterial color="#8f87c9" roughness={0.9} />
          </mesh>
          {Array.from({ length: 16 }, (_, i) => (
            <mesh key={i} position={[-0.3 + (i % 4) * 0.2, 0.002, -0.3 + Math.floor(i / 4) * 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.07, 0.07]} />
              <meshBasicMaterial color="#2a2450" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function WallClock({ position }: { position: Vec3 }) {
  const hand = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (hand.current) hand.current.rotation.z = -clock.elapsedTime * 0.6;
  });
  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.05, 16]} />
        <meshStandardMaterial color="#fff7e8" roughness={0.7} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.005]}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 16]} />
        <meshStandardMaterial color="#1d1834" />
      </mesh>
      <B p={[0, 0.07, 0.035]} s={[0.035, 0.16, 0.01]} c="#1d1834" />
      <mesh ref={hand} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.02, 0.5, 0.01]} />
        <meshBasicMaterial color="#ff4d5e" />
      </mesh>
    </group>
  );
}

function ServerRoomFittings() {
  return (
    <group>
      {/* Cooling unit against the left wall */}
      <group position={[-12.95, 0, -1.4]}>
        <B p={[0, 1.0, 0]} s={[0.9, 2.0, 1.4]} c="#cbc4ea" cast />
        {Array.from({ length: 7 }, (_, i) => (
          <B key={i} p={[0.46, 0.45 + i * 0.18, 0]} s={[0.02, 0.06, 1.1]} c="#5d5399" />
        ))}
        <B p={[0.46, 1.75, -0.35]} s={[0.02, 0.18, 0.3]} c="#1d1834" />
        <B p={[0.47, 1.75, -0.35]} s={[0.01, 0.06, 0.1]} c="#3ddc84" emissive="#3ddc84" glow={1.2} />
      </group>
      {/* Fire extinguisher */}
      <group position={[-13.25, 0, 0.6]}>
        <Cyl p={[0, 0.3, 0]} r={0.1} h={0.55} c="#ff4d5e" cast />
        <Cyl p={[0, 0.62, 0]} r={0.04} h={0.1} c="#1d1834" />
      </group>
    </group>
  );
}

export function Office({ incident }: { incident: boolean }) {
  return (
    <group>
      <Floors />
      <ServerRoomFittings />
      <ServerFloorProps />
      <Walker from={[4.4, -0.9]} to={[8.0, -0.9]} speed={0.55} look={look(21)} />
      <Walker from={[-2.45, 5.5]} to={[-2.45, 9.0]} speed={0.45} look={look(16)} phase={2} />
      <OnWall wall="left">
        <NeonLogo position={[-13.34, 2.4, 2.6]} rotation={Math.PI / 2} />
        <Whiteboard position={[-13.34, 1.55, 6.6]} rotation={Math.PI / 2} />
        <CityWindow position={[-13.36, 1.8, 8.75]} rotation={Math.PI / 2} w={1.1} h={1.5} />
      </OnWall>
      <OnWall wall="back">
        <CityWindow position={[12.4, 2.2, -9.42]} w={1.9} h={1.2} />
        <WallClock position={[4.2, 2.35, -9.44]} />
        <Beacon on={incident} />
      </OnWall>
      <Kitchen />
      <Lounge />
      <PingPong />
      <Plant x={-12.9} z={9.05} tall />
      <Plant x={1.9} z={8.9} tall />
      <Plant x={8.65} z={9.0} tall />
      <Plant x={9.7} z={-4.45} tall />
      <Plant x={13.1} z={0.9} />
      <Plant x={9.6} z={4.4} />
      <pointLight position={[12, 2.8, -7.8]} intensity={8} distance={6} color="#ffcf94" />
    </group>
  );
}

/** Small things on a desk that make it someone's desk. */
export function DeskClutter({ index, w }: { index: number; w: number }) {
  const mug = SHIRTS[(index * 4 + 2) % SHIRTS.length];
  return (
    <group>
      <B p={[0, 0.775, 0.16]} s={[0.46, 0.02, 0.15]} c="#1d1834" />
      <B p={[0.34, 0.772, 0.18]} s={[0.07, 0.02, 0.1]} c="#1d1834" />
      <Cyl p={[w / 2 - 0.22, 0.81, 0.1]} r={0.045} h={0.09} c={mug} />
      {index % 2 === 0 && <B p={[-w / 2 + 0.3, 0.768, 0.12]} s={[0.22, 0.01, 0.3]} c="#fff7e8" r={[0, 0.25, 0]} />}
      {index % 3 === 1 && <Plant x={-w / 2 + 0.2} z={-0.2} y={0.765} scale={0.28} />}
    </group>
  );
}
