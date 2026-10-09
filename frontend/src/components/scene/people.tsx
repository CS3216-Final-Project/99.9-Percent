"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { bodyFor, ELBOW, HIP_X, KNEE, NECK_TOP, SHOULDER, STAND_HIP, type V3 } from "./body";
import type { Look } from "./cast";
import { useDetail, type Detail } from "./detail";

/*
 * Stylised people with human proportions, dressed by role (see cast.ts) and
 * built from merged, vertex-coloured parts (see body.ts). This file poses and
 * animates them: arms and legs bend at the elbow and knee, everyone breathes,
 * and each activity has its own idle motion.
 *
 * Everyone faces -z in their own frame. Shoulders and hips rotate about X:
 * positive swings a limb forward; elbows bend forward with positive angles and
 * knees bend backward with negative ones.
 */

/** One material for every person: colours come from the geometry. Matte at basic detail, satin at HD. */
const BODY_MATERIAL: Record<Detail, THREE.Material> = {
  basic: new THREE.MeshLambertMaterial({ vertexColors: true }),
  hd: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0 }),
};

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

export type Activity = "type" | "relax" | "mug" | "laptop" | "idle" | "chat" | "walk" | "listen" | "present";

interface Pose {
  /** Torso lean: negative leans forward. */
  lean: number;
  /** Shoulder swing, inward turn and elbow bend, left then right. */
  armL: [number, number, number];
  armR: [number, number, number];
}

function poseFor(sit: boolean, a: Activity): Pose {
  if (sit) {
    switch (a) {
      case "type":
        return { lean: -0.08, armL: [0.38, -0.32, 1.22], armR: [0.38, 0.32, 1.22] };
      case "laptop":
        return { lean: 0.05, armL: [0.2, -0.38, 1.05], armR: [0.2, 0.38, 1.05] };
      case "mug":
        return { lean: 0.12, armL: [0.12, -0.45, 0.85], armR: [0.35, 0.4, 1.95] };
      case "listen":
        return { lean: -0.02, armL: [0.42, -0.35, 1.0], armR: [0.42, 0.35, 1.0] };
      default:
        return { lean: 0.14, armL: [0.12, -0.45, 0.85], armR: [0.12, 0.45, 0.85] };
    }
  }
  switch (a) {
    case "type":
      return { lean: -0.1, armL: [0.5, -0.3, 0.95], armR: [0.5, 0.3, 0.95] };
    case "mug":
      return { lean: 0, armL: [0.04, 0, 0.15], armR: [0.3, 0.35, 1.75] };
    case "chat":
      return { lean: 0, armL: [0.06, 0, 0.2], armR: [0.4, 0.3, 1.2] };
    case "present":
      return { lean: 0, armL: [0.06, 0, 0.2], armR: [1.25, 0.25, 0.25] };
    case "walk":
      return { lean: -0.04, armL: [0, 0, 0.25], armR: [0, 0, 0.25] };
    default:
      return { lean: 0, armL: [0.04, 0, 0.15], armR: [0.04, 0, 0.15] };
  }
}

/* ------------------------------------------------------------------ */
/* Person                                                              */
/* ------------------------------------------------------------------ */

/** Height of a chair seat; seated people put their hips here. */
export const SEAT = 0.57;

export function Person({
  pose,
  activity,
  look: l,
  position,
  rotation = 0,
  phase = 0,
  seat = SEAT,
}: {
  pose: "sit" | "stand";
  activity: Activity;
  look: Look;
  position: V3;
  rotation?: number;
  phase?: number;
  /** Seat height for seated people. */
  seat?: number;
}) {
  const sit = pose === "sit";
  const body = useMemo(() => bodyFor(l, sit), [l, sit]);
  const BODY = BODY_MATERIAL[useDetail()];
  const p = poseFor(sit, activity);
  const hipY = sit ? seat / l.height : STAND_HIP;

  const pelvis = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const sL = useRef<THREE.Group>(null);
  const sR = useRef<THREE.Group>(null);
  const eL = useRef<THREE.Group>(null);
  const eR = useRef<THREE.Group>(null);
  const hL = useRef<THREE.Group>(null);
  const hR = useRef<THREE.Group>(null);
  const kL = useRef<THREE.Group>(null);
  const kR = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (!torso.current || !head.current || !sL.current || !sR.current || !eL.current || !eR.current || !pelvis.current) return;
    // Breathing, for everyone.
    torso.current.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
    torso.current.rotation.x = p.lean;
    if (activity === "walk") {
      const w = t * 6.5;
      const s = Math.sin(w);
      if (hL.current && hR.current && kL.current && kR.current) {
        hL.current.rotation.x = s * 0.5;
        hR.current.rotation.x = -s * 0.5;
        kL.current.rotation.x = -0.12 - 0.65 * Math.max(0, -Math.sin(w + 0.7));
        kR.current.rotation.x = -0.12 - 0.65 * Math.max(0, Math.sin(w + 0.7));
      }
      sL.current.rotation.x = -s * 0.45;
      sR.current.rotation.x = s * 0.45;
      pelvis.current.position.y = hipY + Math.abs(Math.cos(w)) * 0.025;
      torso.current.rotation.y = s * 0.06;
      head.current.rotation.y = -s * 0.04;
    } else if (activity === "type" || activity === "laptop") {
      const k = activity === "type" ? 0.06 : 0.04;
      eL.current.rotation.x = p.armL[2] + Math.sin(t * 14) * k;
      eR.current.rotation.x = p.armR[2] + Math.sin(t * 14 + 2.1) * k;
      head.current.rotation.x = 0.08 + Math.sin(t * 0.9) * 0.04;
      head.current.rotation.y = Math.sin(t * 0.33) * 0.15;
    } else if (activity === "mug") {
      // Look around, and every few seconds take a sip.
      const sip = Math.max(0, Math.sin(t * 0.6) - 0.82) * 5.5;
      eR.current.rotation.x = p.armR[2] + sip * 0.35;
      sR.current.rotation.x = p.armR[0] + sip * 0.25;
      head.current.rotation.x = -sip * 0.2;
      head.current.rotation.y = (1 - sip) * Math.sin(t * 0.45) * 0.5;
    } else if (activity === "chat" || activity === "present") {
      head.current.rotation.y = Math.sin(t * 0.7) * 0.35;
      sR.current.rotation.x = p.armR[0] + Math.sin(t * 2.2) * 0.2;
      eR.current.rotation.x = p.armR[2] + Math.sin(t * 1.7) * 0.25;
      pelvis.current.position.y = hipY + Math.abs(Math.sin(t * 2.2)) * 0.006;
    } else if (activity === "listen") {
      head.current.rotation.x = Math.sin(t * 1.3) * 0.08;
      head.current.rotation.y = Math.sin(t * 0.25) * 0.4;
    } else {
      head.current.rotation.y = Math.sin(t * 0.35) * 0.5;
      torso.current.rotation.x = p.lean + Math.sin(t * 0.5) * 0.02;
    }
  });

  const arm = (side: -1 | 1, shoulder: RefObject<THREE.Group | null>, elbow: RefObject<THREE.Group | null>, a: [number, number, number], mug: boolean) => (
    <group ref={shoulder} position={[side * SHOULDER[0] * l.build, SHOULDER[1], SHOULDER[2]]} rotation={new THREE.Euler(a[0], a[1], side * 0.06, "YXZ")}>
      <mesh geometry={body.upperArm} material={BODY} />
      <group ref={elbow} position={[0, ELBOW, 0]} rotation={[a[2], 0, 0]}>
        <mesh geometry={side === -1 ? body.forearmL : body.forearmR} material={BODY} />
        {mug && (
          <group position={[0, -0.3, -0.06]}>
            <mesh>
              <cylinderGeometry args={[0.042, 0.038, 0.1, 10]} />
              <meshStandardMaterial color="#fff7e8" roughness={0.6} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );

  const leg = (side: -1 | 1, hip: RefObject<THREE.Group | null>, knee: RefObject<THREE.Group | null>) => (
    <group ref={hip} position={[side * HIP_X, 0, 0]} rotation={[sit ? 1.48 : 0, 0, sit ? side * 0.05 : 0]}>
      <mesh geometry={body.thigh} material={BODY} />
      <group ref={knee} position={[0, KNEE, 0]} rotation={[sit ? -1.48 : 0, 0, 0]}>
        <mesh geometry={body.shin} material={BODY} />
      </group>
    </group>
  );

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={l.height}>
      <group ref={pelvis} position={[0, hipY, 0]}>
        <mesh geometry={body.pelvis} material={BODY} />
        {leg(-1, hL, kL)}
        {leg(1, hR, kR)}
        <group ref={torso} rotation={[p.lean, 0, 0]}>
          <mesh geometry={body.torso} material={BODY} castShadow />
          <group ref={head} position={[0, NECK_TOP, 0]}>
            <mesh geometry={body.head} material={BODY} castShadow />
          </group>
          {arm(-1, sL, eL, p.armL, false)}
          {arm(1, sR, eR, p.armR, activity === "mug")}
        </group>
        {activity === "laptop" && (
          <group position={[0, 0.1, -0.3]}>
            <mesh>
              <boxGeometry args={[0.34, 0.022, 0.24]} />
              <meshStandardMaterial color="#d9d4f0" roughness={0.5} />
            </mesh>
            <group position={[0, 0.01, 0.11]} rotation={[0.3, 0, 0]}>
              <mesh position={[0, 0.11, 0]}>
                <boxGeometry args={[0.34, 0.22, 0.015]} />
                <meshStandardMaterial color="#d9d4f0" roughness={0.5} />
              </mesh>
            </group>
          </group>
        )}
      </group>
    </group>
  );
}

/** Someone pacing back and forth between two points. */
export function Walker({ from, to, speed, look: l, phase = 0 }: { from: [number, number]; to: [number, number]; speed: number; look: Look; phase?: number }) {
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
