"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * Stylised people with human proportions: a rounded head with a face, hair,
 * a tapered torso, and arms and legs that bend at the elbow and knee. Each
 * rigid part is merged into one vertex-coloured mesh, so a person costs about
 * eleven draw calls whatever their outfit, and all people share one material.
 *
 * Everyone faces -z in their own frame. Shoulders and hips rotate about X:
 * positive swings a limb forward; elbows bend forward with positive angles and
 * knees bend backward with negative ones.
 */

type V3 = [number, number, number];

export type HairStyle = "short" | "long" | "bun" | "curly" | "buzz" | "pony" | "bald";
export type TopStyle = "tee" | "hoodie" | "shirt" | "jacket";

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  topStyle: TopStyle;
  accent: string;
  pants: string;
  shoes: string;
  glasses: boolean;
  headphones: boolean;
  beard: boolean;
  badge: boolean;
  /** Overall size, about 0.88 to 1. */
  height: number;
  /** Shoulder width, about 0.92 to 1.08. */
  build: number;
}

const SKINS = ["#f3cba5", "#d9a07a", "#a86b4a", "#6e4630", "#e8b48f", "#c68863", "#f6d5b8", "#8d5a3b"];
const HAIRS = ["#1d1834", "#4a2c1d", "#7a4a2a", "#d9a441", "#2b2b3a", "#8a3b2a", "#b8b2c8", "#5a3a22"];
const STYLES: HairStyle[] = ["short", "long", "bun", "curly", "buzz", "pony", "short", "long", "bald", "short", "curly"];
const TOPS = ["#4cb8ff", "#ff7ad9", "#3ddc84", "#ffc53d", "#a985ff", "#ff9f43", "#2dd4bf", "#ff6b6b", "#e8e2ff", "#30295a", "#f4f1ea"];
const TOP_STYLES: TopStyle[] = ["tee", "hoodie", "shirt", "jacket", "tee", "hoodie"];
const ACCENTS = ["#fff7e8", "#1d1834", "#ffd84a", "#4cb8ff", "#ff4d5e"];
const PANTS = ["#2b3150", "#3b4a7a", "#24242c", "#7a6a55", "#3e3570", "#4a5568"];
const SHOES = ["#fff7e8", "#1d1834", "#e8e2ff", "#c0392b", "#7a5a3a"];

/** A stable, varied look for the nth person in the office. */
export function look(n: number): Look {
  const hairStyle = STYLES[(n * 7 + 3) % STYLES.length];
  return {
    skin: SKINS[(n * 5 + 2) % SKINS.length],
    hair: HAIRS[(n * 3 + 1) % HAIRS.length],
    hairStyle,
    top: TOPS[(n * 4 + 1) % TOPS.length],
    topStyle: TOP_STYLES[(n * 5 + 2) % TOP_STYLES.length],
    accent: ACCENTS[(n * 3 + 2) % ACCENTS.length],
    pants: PANTS[(n * 2 + 1) % PANTS.length],
    shoes: SHOES[(n * 3) % SHOES.length],
    glasses: n % 4 === 1,
    headphones: n % 5 === 2,
    beard: (hairStyle === "short" || hairStyle === "buzz" || hairStyle === "bald") && n % 3 === 0,
    badge: n % 3 !== 1,
    height: 0.88 + ((n * 37) % 13) / 100,
    build: 0.92 + ((n * 53) % 17) / 100,
  };
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

interface Piece {
  g: THREE.BufferGeometry;
  c: string;
  p?: V3;
  r?: V3;
  s?: V3;
}

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();

/** Merge pieces into one geometry, colouring each piece through a vertex colour attribute. */
function merge(pieces: Piece[]): THREE.BufferGeometry {
  const parts = pieces.map(({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) => {
    const out = g.clone();
    m4.compose(new THREE.Vector3(...p), q.setFromEuler(e.set(r[0], r[1], r[2])), new THREE.Vector3(...s));
    out.applyMatrix4(m4);
    const color = new THREE.Color(c);
    const n = out.attributes.position.count;
    const data = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      data[i * 3] = color.r;
      data[i * 3 + 1] = color.g;
      data[i * 3 + 2] = color.b;
    }
    out.setAttribute("color", new THREE.BufferAttribute(data, 3));
    return out;
  });
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error("Could not merge a person's geometry: pieces have different attributes.");
  return merged;
}

const sphere = (r: number, w = 14, h = 10, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) =>
  new THREE.SphereGeometry(r, w, h, phiStart, phiLength, thetaStart, thetaLength);
const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 10);
const cylinder = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Darken or lighten a colour a little, for shading details in the same material. */
function shade(c: string, k: number): string {
  return `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;
}

const SLEEVES_LONG: Record<TopStyle, boolean> = { tee: false, hoodie: true, shirt: true, jacket: true };

interface Body {
  pelvis: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  forearm: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry;
  shin: THREE.BufferGeometry;
}

/** Shoulder and hip joints, in the torso and pelvis frames. */
const SHOULDER: V3 = [0.205, 0.5, 0];
const NECK_TOP = 0.66;
const ELBOW = -0.28;
const HIP_X = 0.088;
const KNEE = -0.43;
/** Hip height of a standing person at height 1. */
const STAND_HIP = 0.935;

function hairPieces(l: Look): Piece[] {
  const h = l.hair;
  const top: Piece = { g: sphere(0.126, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.36), c: h, p: [0, 0.14, 0.008], s: [0.98, 1.1, 1.04] };
  const back: Piece = { g: sphere(0.126, 14, 8, 0, Math.PI, 0, Math.PI * 0.64), c: h, p: [0, 0.135, 0.012], s: [0.98, 1.08, 1.02] };
  switch (l.hairStyle) {
    case "bald":
      return [];
    case "buzz":
      return [{ g: sphere(0.12, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), c: h, p: [0, 0.13, 0.01], s: [0.98, 1.1, 1.03] }];
    case "short":
      return [top, back];
    case "long":
      return [
        top,
        back,
        { g: capsule(0.07, 0.2), c: h, p: [0, 0.0, 0.075], s: [1.55, 1, 0.55] },
        { g: capsule(0.03, 0.14), c: h, p: [-0.105, 0.06, -0.01] },
        { g: capsule(0.03, 0.14), c: h, p: [0.105, 0.06, -0.01] },
      ];
    case "bun":
      return [top, back, { g: sphere(0.055), c: h, p: [0, 0.27, 0.07] }];
    case "pony":
      return [top, back, { g: capsule(0.032, 0.16), c: h, p: [0, 0.1, 0.16], r: [0.45, 0, 0] }];
    case "curly":
      return [
        { g: sphere(0.14, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), c: h, p: [0, 0.135, 0.015], s: [1, 1.05, 1.02] },
        ...[-1, 0, 1].flatMap((i) => [
          { g: sphere(0.052, 8, 6), c: h, p: [i * 0.075, 0.24, 0.02 + Math.abs(i) * 0.03] as V3 },
          { g: sphere(0.05, 8, 6), c: h, p: [i * 0.09, 0.14, 0.09] as V3 },
        ]),
      ];
  }
}

function buildBody(l: Look): Body {
  const skin = l.skin;
  const long = SLEEVES_LONG[l.topStyle];
  const ink = "#1d1834";

  const pelvis = merge([
    { g: cylinder(0.15, 0.158, 0.2), c: l.pants, p: [0, 0.02, 0], s: [1, 1, 0.72] },
    { g: cylinder(0.153, 0.153, 0.03), c: shade(l.pants, 0.7), p: [0, 0.115, 0], s: [1, 1, 0.73] },
  ]);

  const torso: Piece[] = [
    { g: cylinder(0.19, 0.155, 0.48), c: l.top, p: [0, 0.3, 0], s: [l.build, 1, 0.64] },
    { g: sphere(0.088, 12, 8), c: l.top, p: [-0.175 * l.build, 0.49, 0] },
    { g: sphere(0.088, 12, 8), c: l.top, p: [0.175 * l.build, 0.49, 0] },
    { g: cylinder(0.15, 0.19, 0.06), c: l.top, p: [0, 0.545, 0], s: [l.build, 1, 0.62] },
    { g: cylinder(0.05, 0.054, 0.12), c: skin, p: [0, 0.6, 0] },
  ];
  if (l.topStyle === "hoodie") {
    torso.push(
      { g: sphere(0.13, 12, 8, 0, Math.PI, 0, Math.PI * 0.7), c: shade(l.top, 0.82), p: [0, 0.53, 0.06], s: [1.05, 0.8, 0.9] },
      { g: box(0.012, 0.13, 0.012), c: l.accent, p: [-0.035, 0.46, -0.122] },
      { g: box(0.012, 0.13, 0.012), c: l.accent, p: [0.035, 0.46, -0.122] },
      { g: box(0.2, 0.09, 0.02), c: shade(l.top, 0.85), p: [0, 0.2, -0.11] },
    );
  } else if (l.topStyle === "shirt") {
    torso.push(
      { g: box(0.07, 0.04, 0.03), c: shade(l.top, 1.1), p: [-0.045, 0.565, -0.075], r: [0, 0, 0.5] },
      { g: box(0.07, 0.04, 0.03), c: shade(l.top, 1.1), p: [0.045, 0.565, -0.075], r: [0, 0, -0.5] },
      ...[0.48, 0.38, 0.28, 0.18].map((y) => ({ g: box(0.018, 0.018, 0.01), c: shade(l.top, 0.6), p: [0, y, -0.117] as V3 })),
    );
  } else if (l.topStyle === "jacket") {
    torso.push(
      { g: box(0.09, 0.44, 0.02), c: l.accent, p: [0, 0.3, -0.112] },
      { g: box(0.05, 0.22, 0.02), c: shade(l.top, 0.8), p: [-0.06, 0.44, -0.114], r: [0, 0, -0.25] },
      { g: box(0.05, 0.22, 0.02), c: shade(l.top, 0.8), p: [0.06, 0.44, -0.114], r: [0, 0, 0.25] },
    );
  } else {
    torso.push({ g: cylinder(0.062, 0.07, 0.025), c: shade(l.top, 0.8), p: [0, 0.565, -0.005] });
  }
  if (l.badge) {
    torso.push(
      { g: box(0.008, 0.2, 0.008), c: "#4cb8ff", p: [-0.03, 0.47, -0.115], r: [0, 0, 0.18] },
      { g: box(0.008, 0.2, 0.008), c: "#4cb8ff", p: [0.03, 0.47, -0.115], r: [0, 0, -0.18] },
      { g: box(0.055, 0.075, 0.01), c: "#fff7e8", p: [0, 0.35, -0.118] },
      { g: box(0.035, 0.012, 0.012), c: ink, p: [0, 0.365, -0.122] },
    );
  }

  const head: Piece[] = [
    { g: sphere(0.112), c: skin, p: [0, 0.135, 0], s: [0.94, 1.1, 1] },
    { g: sphere(0.085, 12, 8), c: skin, p: [0, 0.07, -0.02], s: [1, 0.85, 1] },
    { g: sphere(0.03, 8, 6), c: shade(skin, 0.92), p: [-0.105, 0.13, 0.01], s: [0.5, 1, 0.8] },
    { g: sphere(0.03, 8, 6), c: shade(skin, 0.92), p: [0.105, 0.13, 0.01], s: [0.5, 1, 0.8] },
    { g: sphere(0.021, 8, 6), c: shade(skin, 0.9), p: [0, 0.112, -0.112], s: [0.8, 1, 1.2] },
    { g: sphere(0.019, 8, 6), c: "#fff7e8", p: [-0.042, 0.145, -0.096] },
    { g: sphere(0.019, 8, 6), c: "#fff7e8", p: [0.042, 0.145, -0.096] },
    { g: sphere(0.012, 6, 5), c: ink, p: [-0.042, 0.145, -0.112] },
    { g: sphere(0.012, 6, 5), c: ink, p: [0.042, 0.145, -0.112] },
    { g: box(0.045, 0.012, 0.012), c: l.hair, p: [-0.044, 0.179, -0.104], r: [0, 0, 0.08] },
    { g: box(0.045, 0.012, 0.012), c: l.hair, p: [0.044, 0.179, -0.104], r: [0, 0, -0.08] },
    { g: box(0.045, 0.01, 0.01), c: "#9a4a52", p: [0, 0.073, -0.103] },
    ...hairPieces(l),
  ];
  if (l.beard) {
    head.push({ g: sphere(0.098, 12, 8, Math.PI, Math.PI, Math.PI * 0.5, Math.PI * 0.42), c: l.hair, p: [0, 0.105, -0.004], s: [1, 1.05, 1.05] });
  }
  if (l.glasses) {
    head.push(
      { g: new THREE.TorusGeometry(0.027, 0.005, 6, 14), c: ink, p: [-0.043, 0.145, -0.116] },
      { g: new THREE.TorusGeometry(0.027, 0.005, 6, 14), c: ink, p: [0.043, 0.145, -0.116] },
      { g: box(0.022, 0.006, 0.006), c: ink, p: [0, 0.15, -0.118] },
      { g: box(0.006, 0.006, 0.11), c: ink, p: [-0.075, 0.15, -0.06] },
      { g: box(0.006, 0.006, 0.11), c: ink, p: [0.075, 0.15, -0.06] },
    );
  }
  if (l.headphones) {
    head.push(
      { g: new THREE.TorusGeometry(0.132, 0.014, 6, 16, Math.PI), c: ink, p: [0, 0.14, 0.005] },
      { g: cylinder(0.042, 0.042, 0.04, 12), c: l.accent === "#1d1834" ? "#ff4d5e" : l.accent, p: [-0.122, 0.13, 0.005], r: [0, 0, Math.PI / 2] },
      { g: cylinder(0.042, 0.042, 0.04, 12), c: l.accent === "#1d1834" ? "#ff4d5e" : l.accent, p: [0.122, 0.13, 0.005], r: [0, 0, Math.PI / 2] },
    );
  }

  const sleeve = l.top;
  const upperArm = merge(
    long
      ? [{ g: capsule(0.048, 0.2), c: sleeve, p: [0, -0.14, 0] }]
      : [
          { g: capsule(0.054, 0.06), c: sleeve, p: [0, -0.06, 0] },
          { g: capsule(0.043, 0.18), c: skin, p: [0, -0.15, 0] },
        ],
  );
  const forearm = merge([
    { g: capsule(0.041, 0.18), c: long ? sleeve : skin, p: [0, -0.12, 0] },
    ...(long ? [{ g: cylinder(0.044, 0.044, 0.03), c: shade(sleeve, 0.8), p: [0, -0.235, 0] as V3 }] : []),
    { g: sphere(0.046, 10, 8), c: skin, p: [0, -0.29, -0.005], s: [0.85, 1.15, 0.62] },
    { g: sphere(0.018, 6, 5), c: skin, p: [0, -0.27, -0.035] },
  ]);
  const thigh = merge([{ g: capsule(0.068, 0.3), c: l.pants, p: [0, -0.215, 0] }]);
  const shin = merge([
    { g: capsule(0.056, 0.32), c: l.pants, p: [0, -0.21, 0] },
    { g: capsule(0.05, 0.13), c: l.shoes, p: [0, -0.445, -0.045], r: [Math.PI / 2, 0, 0], s: [1.05, 1, 0.75] },
    { g: box(0.1, 0.02, 0.24), c: shade(l.shoes, 0.6), p: [0, -0.485, -0.045] },
  ]);

  return { pelvis, torso: merge(torso), head: merge(head), upperArm, forearm, thigh, shin };
}

const bodies = new Map<string, Body>();
function bodyFor(l: Look): Body {
  const key = JSON.stringify(l);
  let b = bodies.get(key);
  if (!b) {
    b = buildBody(l);
    bodies.set(key, b);
  }
  return b;
}

/** One matte material for every person: colours come from the geometry. */
const BODY_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

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
  const body = useMemo(() => bodyFor(l), [l]);
  const sit = pose === "sit";
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
      <mesh geometry={body.upperArm} material={BODY_MATERIAL} />
      <group ref={elbow} position={[0, ELBOW, 0]} rotation={[a[2], 0, 0]}>
        <mesh geometry={body.forearm} material={BODY_MATERIAL} />
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
      <mesh geometry={body.thigh} material={BODY_MATERIAL} />
      <group ref={knee} position={[0, KNEE, 0]} rotation={[sit ? -1.48 : 0, 0, 0]}>
        <mesh geometry={body.shin} material={BODY_MATERIAL} />
      </group>
    </group>
  );

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={l.height}>
      <group ref={pelvis} position={[0, hipY, 0]}>
        <mesh geometry={body.pelvis} material={BODY_MATERIAL} />
        {leg(-1, hL, kL)}
        {leg(1, hR, kR)}
        <group ref={torso} rotation={[p.lean, 0, 0]}>
          <mesh geometry={body.torso} material={BODY_MATERIAL} castShadow />
          <group ref={head} position={[0, NECK_TOP, 0]}>
            <mesh geometry={body.head} material={BODY_MATERIAL} castShadow />
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
