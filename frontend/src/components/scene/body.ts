import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Look, TopStyle } from "./cast";

/*
 * A person's rigid parts as geometry. Every part (pelvis, torso, head, and each
 * upper arm, forearm, thigh and shin) is merged into one vertex-coloured mesh,
 * so a person costs eleven draw calls however detailed their outfit, and all
 * people share one material.
 *
 * Everyone faces -z in their own frame. The pelvis frame has its origin at the
 * hips, and the torso hangs off the same origin; the head frame starts at the
 * top of the neck; each limb hangs down from its joint.
 */

export type V3 = [number, number, number];

interface Piece {
  g: THREE.BufferGeometry;
  c: string;
  p?: V3;
  r?: V3;
  s?: V3;
  /** A rotation that replaces `r`. */
  q?: THREE.Quaternion;
}

const m4 = new THREE.Matrix4();
const qt = new THREE.Quaternion();
const eu = new THREE.Euler();

/** Merge pieces into one geometry, colouring each piece through a vertex colour attribute. */
export function merge(pieces: Piece[]): THREE.BufferGeometry {
  const parts = pieces.map(({ g, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], q }) => {
    const out = g.clone();
    m4.compose(new THREE.Vector3(...p), q ?? qt.setFromEuler(eu.set(r[0], r[1], r[2])), new THREE.Vector3(...s));
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
const torus = (r: number, tube: number, radial = 6, tubular = 14, arc = Math.PI * 2) => new THREE.TorusGeometry(r, tube, radial, tubular, arc);
/** An open tube around the body, leaving a gap of `gap` radians at the front for open jackets. */
const shell = (rt: number, rb: number, h: number, gap = 0) => new THREE.CylinderGeometry(rt, rb, h, 18, 1, true, Math.PI + gap / 2, Math.PI * 2 - gap);

/** Darken or lighten a colour a little, for shading details in the same material. */
function shade(c: string, k: number): string {
  return `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;
}

function mix(a: string, b: string, t: number): string {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A thin rod from a to b, for straps, mic booms and the like. */
function rod(a: V3, b: V3, r: number, c: string): Piece {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  return { g: cylinder(r, r, len, 6), c, p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], q: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()) };
}

/** Rods through a run of points, so a strap can bend around the body. */
function strap(points: V3[], r: number, c: string): Piece[] {
  return points.slice(1).map((b, i) => rod(points[i], b, r, c));
}

/* ------------------------------------------------------------------ */
/* Joints and the shapes the clothes are fitted to                     */
/* ------------------------------------------------------------------ */

/** Shoulder and hip joints, in the torso and pelvis frames. */
export const SHOULDER: V3 = [0.205, 0.5, 0];
export const NECK_TOP = 0.66;
export const ELBOW = -0.28;
export const HIP_X = 0.088;
export const KNEE = -0.43;
/** Hip height of a standing person at height 1. */
export const STAND_HIP = 0.935;

const TORSO_Y = 0.3;
const TORSO_H = 0.48;
const TORSO_TOP_R = 0.19;
const TORSO_BOTTOM_R = 0.155;
/** Front-to-back depth of the torso relative to its width. */
const TORSO_DEPTH = 0.64;

interface Fit {
  build: number;
  girth: number;
}

/** Radius of the torso at height y, before scaling for build and girth. */
function torsoR(y: number, f: Fit): number {
  const bottom = TORSO_BOTTOM_R * f.girth;
  const t = (y - (TORSO_Y - TORSO_H / 2)) / TORSO_H;
  return bottom + (TORSO_TOP_R - bottom) * Math.min(1, Math.max(0, t));
}

/** How far forward the chest is at (x, y), plus `out` metres for layers worn over it. */
function chestZ(x: number, y: number, f: Fit, out = 0): number {
  const r = torsoR(y, f);
  const a = r * f.build + out;
  const b = r * TORSO_DEPTH * f.girth + out;
  return -b * Math.sqrt(Math.max(0, 1 - (x / a) ** 2));
}

/** How far back the shoulder blades are at height y. */
function backZ(y: number, f: Fit): number {
  return torsoR(y, f) * TORSO_DEPTH * f.girth;
}

/** The torso's three pieces, a tapered body, round shoulders and a sloping top, in one colour and grown by `out`. */
function torsoShape(c: string, f: Fit, out = 0): Piece[] {
  return [
    { g: cylinder(TORSO_TOP_R + out, TORSO_BOTTOM_R * f.girth + out, TORSO_H, 16), c, p: [0, TORSO_Y, 0], s: [f.build, 1, TORSO_DEPTH * f.girth] },
    { g: sphere(0.088 + out, 12, 8), c, p: [-0.175 * f.build, 0.49, 0] },
    { g: sphere(0.088 + out, 12, 8), c, p: [0.175 * f.build, 0.49, 0] },
    { g: cylinder(0.15 + out, TORSO_TOP_R + out, 0.06, 16), c, p: [0, 0.545, 0], s: [f.build, 1, 0.62 * f.girth] },
  ];
}

/** A tube worn over the torso: a jacket's body, with an optional gap at the front. */
function coat(c: string, f: Fit, out: number, gap: number, top = 0.535, bottom = 0.06): Piece {
  const h = top - bottom;
  const y = (top + bottom) / 2;
  return { g: shell(torsoR(top, f) + out, torsoR(bottom, f) + out, h, gap), c, p: [0, y, 0], s: [f.build, 1, TORSO_DEPTH * f.girth] };
}

/** A band around the body at height y, such as a hem or a reflective stripe. */
function band(c: string, f: Fit, y: number, h: number, out: number, gap = 0): Piece {
  const r = torsoR(y, f) + out;
  return { g: shell(r, r, h, gap), c, p: [0, y, 0], s: [f.build, 1, TORSO_DEPTH * f.girth] };
}

/* ------------------------------------------------------------------ */
/* Face                                                                */
/* ------------------------------------------------------------------ */

/**
 * The head is one smooth surface of revolution: a round skull over fuller
 * cheeks and a chin. Its radius at each height is the larger of a skull
 * ellipse and a jaw ellipse, so there is no seam between the two.
 */
const HEAD_BOTTOM = -0.002;
const HEAD_TOP = 0.258;
/** The head is a little narrower than it is deep. */
const HEAD_WIDTH = 0.94;

/** Front-to-back radius of the head at height y. */
function headR(y: number): number {
  const ellipse = (cy: number, ry: number, r: number) => {
    const k = 1 - ((y - cy) / ry) ** 2;
    return k > 0 ? r * Math.sqrt(k) : 0;
  };
  const skull = ellipse(0.135, 0.1232, 0.112);
  // The jaw sits a little forward of the skull; that shows here as extra radius that fades at the chin.
  const jaw = ellipse(0.07, 0.07225, 0.085) * (1 + 0.02 / 0.085);
  return Math.max(skull, jaw);
}

let headShape: THREE.BufferGeometry | null = null;
function headGeometry(): THREE.BufferGeometry {
  if (!headShape) {
    const n = 28;
    const points = Array.from({ length: n + 1 }, (_, i) => {
      // Closer together at the chin and crown, where the profile turns fastest.
      const y = HEAD_BOTTOM + ((HEAD_TOP - HEAD_BOTTOM) * (1 - Math.cos((Math.PI * i) / n))) / 2;
      return new THREE.Vector2(headR(y), y);
    });
    headShape = new THREE.LatheGeometry(points, 28);
  }
  return headShape;
}

/** How far forward the face is at (x, y). */
export function faceZ(x: number, y: number): number {
  const r = headR(y);
  const k = 1 - (x / (r * HEAD_WIDTH)) ** 2;
  return k > 0 ? -r * Math.sqrt(k) : 0;
}

/** How far a full beard stands off the face. */
const BEARD_OUT = 0.009;

let beardShape: THREE.BufferGeometry | null = null;
/** A full beard: the lower front of the head, grown outward, from ear to ear and up to the cheeks. */
function beardGeometry(): THREE.BufferGeometry {
  if (!beardShape) {
    const n = 14;
    const top = 0.112;
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const y = HEAD_BOTTOM - 0.006 + ((top - HEAD_BOTTOM + 0.006) * i) / n;
      return new THREE.Vector2(Math.max(0.004, headR(Math.max(y, HEAD_BOTTOM + 0.002)) + BEARD_OUT), y);
    });
    // The front half only: from one ear round the chin to the other.
    beardShape = new THREE.LatheGeometry(points, 20, Math.PI / 2, Math.PI);
  }
  return beardShape;
}

const INK = "#1d1834";
const EYE_X = 0.042;
const EYE_Y = 0.145;

function facePieces(l: Look): Piece[] {
  const skin = l.skin;
  const out: Piece[] = [
    { g: headGeometry(), c: skin, s: [HEAD_WIDTH, 1, 1] },
    { g: sphere(0.03, 8, 6), c: shade(skin, 0.92), p: [-0.105, 0.13, 0.01], s: [0.5, 1, 0.8] },
    { g: sphere(0.03, 8, 6), c: shade(skin, 0.92), p: [0.105, 0.13, 0.01], s: [0.5, 1, 0.8] },
    { g: sphere(0.018, 10, 8), c: shade(skin, 0.9), p: [0, 0.11, faceZ(0, 0.11) + 0.003], s: [0.85, 1, 1.15] },
  ];

  // Eyes: white, a coloured iris, a pupil and a catch-light, each a little further forward.
  for (const side of [-1, 1]) {
    const x = side * EYE_X;
    const z = faceZ(x, EYE_Y);
    out.push(
      { g: sphere(0.02, 10, 8), c: "#fff7e8", p: [x, EYE_Y, z + 0.008], s: [1, 1.08, 0.7] },
      { g: sphere(0.013, 8, 6), c: l.eyes, p: [x, EYE_Y - 0.001, z - 0.002], s: [1, 1, 0.6] },
      { g: sphere(0.0075, 6, 5), c: INK, p: [x, EYE_Y - 0.001, z - 0.008], s: [1, 1, 0.6] },
      { g: sphere(0.0038, 5, 4), c: "#ffffff", p: [x + 0.005, EYE_Y + 0.005, z - 0.011] },
    );
  }

  // Brows set the expression.
  const tilt = l.brows === "focused" ? -0.24 : l.brows === "raised" ? 0.2 : 0.08;
  const lift = l.brows === "raised" ? 0.008 : l.brows === "focused" ? -0.004 : 0;
  for (const side of [-1, 1]) {
    const x = side * 0.044;
    const y = 0.18 + lift;
    out.push({ g: box(0.044, 0.012, 0.012), c: mix(l.hair, INK, 0.35), p: [x, y, faceZ(x, y) - 0.002], r: [0, 0, -side * tilt] });
  }

  // Mouth.
  const lip = shade(mix(skin, "#9a2f42", 0.55), 0.85);
  const my = 0.082;
  // A full beard covers the jaw, so the mouth sits on top of it.
  const mz = faceZ(0, my) - (l.facial === "beard" ? BEARD_OUT : 0);
  if (l.mouth === "smile") {
    out.push({ g: torus(0.022, 0.0055, 4, 10, Math.PI), c: lip, p: [0, my + 0.008, mz - 0.001], r: [0, 0, Math.PI], s: [1, 0.62, 1] });
  } else if (l.mouth === "grin") {
    out.push(
      { g: sphere(0.026, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), c: "#fff7e8", p: [0, my + 0.008, mz + 0.004], s: [1, 0.72, 0.35] },
      { g: box(0.052, 0.006, 0.008), c: lip, p: [0, my + 0.009, mz - 0.003] },
    );
  } else if (l.mouth === "o") {
    out.push({ g: torus(0.011, 0.005, 4, 10), c: lip, p: [0, my - 0.004, mz - 0.001] });
  } else {
    out.push({ g: box(0.04, 0.008, 0.01), c: lip, p: [0, my, mz - 0.002] });
  }

  if (l.blush) {
    const blush = mix(skin, "#e8506e", 0.22);
    for (const side of [-1, 1]) {
      const x = side * 0.064;
      out.push({ g: sphere(0.02, 8, 6), c: blush, p: [x, 0.105, faceZ(x, 0.105) + 0.006], s: [1.2, 0.7, 0.4] });
    }
  }
  if (l.freckles) {
    const dot = mix(skin, "#8a4a2a", 0.45);
    for (const [x, y] of [
      [0.032, 0.122],
      [0.05, 0.116],
      [0.064, 0.125],
    ]) {
      for (const side of [-1, 1]) out.push({ g: sphere(0.0036, 5, 4), c: dot, p: [side * x, y, faceZ(side * x, y) - 0.0005] });
    }
  }
  if (l.earrings) {
    for (const side of [-1, 1]) out.push({ g: sphere(0.011, 6, 5), c: "#ffd84a", p: [side * 0.108, 0.088, 0.012] });
  }
  return out;
}

function facialHair(l: Look): Piece[] {
  const c = l.hair;
  switch (l.facial) {
    case "beard":
      return [{ g: beardGeometry(), c, s: [HEAD_WIDTH, 1, 1] }];
    case "goatee":
      return [
        { g: sphere(0.026, 8, 6), c, p: [0, 0.035, faceZ(0, 0.045) + 0.012], s: [1, 1.2, 0.8] },
        { g: torus(0.028, 0.006, 4, 10, Math.PI), c, p: [0, 0.088, faceZ(0, 0.088) - 0.001], r: [0, 0, Math.PI], s: [1, 0.9, 1] },
      ];
    case "moustache":
      return [-1, 1].map((side) => ({ g: capsule(0.009, 0.022), c, p: [side * 0.017, 0.096, faceZ(side * 0.017, 0.096) - 0.003] as V3, r: [0, 0, side * 1.25] as V3 }));
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ */
/* Hair and hats                                                       */
/* ------------------------------------------------------------------ */

function hairPieces(l: Look): Piece[] {
  const h = l.hair;
  // Under a hat only the hair below the brim shows.
  const hatted = l.hat !== null;
  const top: Piece = { g: sphere(0.126, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.36), c: h, p: [0, 0.14, 0.008], s: [0.98, 1.1, 1.04] };
  const back: Piece = { g: sphere(0.126, 14, 8, 0, Math.PI, 0, Math.PI * 0.64), c: h, p: [0, 0.135, 0.012], s: [0.98, 1.08, 1.02] };
  const crown = hatted ? [back] : [top, back];
  switch (l.hairStyle) {
    case "bald":
      return [];
    case "buzz":
      return [{ g: sphere(0.122, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), c: shade(h, 1.15), p: [0, 0.133, 0.008], s: [0.98, 1.1, 1.03] }];
    case "short":
      return crown;
    case "long":
      return [
        ...crown,
        { g: capsule(0.07, 0.2), c: h, p: [0, 0.0, 0.075], s: [1.55, 1, 0.55] },
        { g: capsule(0.03, 0.14), c: h, p: [-0.105, 0.06, -0.01] },
        { g: capsule(0.03, 0.14), c: h, p: [0.105, 0.06, -0.01] },
      ];
    case "bun":
      if (hatted) return crown;
      return [...crown, { g: sphere(0.055), c: h, p: [0, 0.27, 0.07] }, rod([0.02, 0.24, 0.04], [-0.04, 0.33, 0.1], 0.006, "#ffd84a")];
    case "spacebuns":
      if (hatted) return crown;
      return [...crown, ...[-1, 1].map((side) => ({ g: sphere(0.048), c: h, p: [side * 0.085, 0.25, 0.03] as V3 }))];
    case "pony":
      return [...crown, { g: capsule(0.032, 0.16), c: h, p: [0, 0.1, 0.16], r: [0.45, 0, 0] }];
    case "curly":
      // Under a hat, only the curls at the back show.
      return [
        ...(hatted
          ? [back]
          : [
              { g: sphere(0.14, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), c: h, p: [0, 0.135, 0.015] as V3, s: [1, 1.05, 1.02] as V3 },
              ...[-1, 0, 1].map((i) => ({ g: sphere(0.052, 8, 6), c: h, p: [i * 0.075, 0.24, 0.02 + Math.abs(i) * 0.03] as V3 })),
            ]),
        ...[-1, 0, 1].map((i) => ({ g: sphere(0.05, 8, 6), c: h, p: [i * 0.09, 0.14, 0.09] as V3 })),
      ];
    case "afro": {
      if (hatted) return [back, { g: sphere(0.16, 14, 8, 0, Math.PI, Math.PI * 0.35, Math.PI * 0.65), c: h, p: [0, 0.16, 0.05], s: [1, 0.9, 0.85] }];
      // A round cloud of puffs that stops at the hairline, so the outline is soft and bumpy.
      const puffs: Piece[] = [];
      for (let i = 0; i < 11; i++) {
        const a = -2.3 + (i * 4.6) / 10;
        puffs.push({ g: sphere(0.072, 10, 8), c: h, p: [Math.sin(a) * 0.148, 0.2 + Math.cos(a * 2) * 0.012, 0.04 + Math.cos(a) * 0.13] });
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        puffs.push({ g: sphere(0.078, 10, 8), c: h, p: [Math.sin(a) * 0.085, 0.3, 0.035 + Math.cos(a) * 0.085] });
      }
      return [
        { g: sphere(0.165, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), c: h, p: [0, 0.21, 0.035] },
        { g: sphere(0.155, 16, 8, 0, Math.PI, 0, Math.PI), c: h, p: [0, 0.16, 0.05], s: [1, 0.9, 0.85] },
        ...puffs,
      ];
    }
    case "mohawk":
      return [
        { g: sphere(0.122, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), c: shade(h, 0.45), p: [0, 0.133, 0.008], s: [0.98, 1.1, 1.03] },
        ...[-0.07, -0.025, 0.02, 0.065, 0.105].map((z, i) => ({
          g: sphere(0.05, 8, 6),
          c: h,
          p: [0, 0.27 - Math.abs(z - 0.02) * 0.45, z] as V3,
          s: [0.32, 1.1 - Math.abs(i - 2) * 0.12, 0.9] as V3,
        })),
      ];
    case "locs":
      return [
        ...crown,
        ...Array.from({ length: 9 }, (_, i) => {
          const a = -1.9 + (i * 3.8) / 8;
          return { g: capsule(0.017, 0.2), c: h, p: [Math.sin(a) * 0.115, 0.05, Math.cos(a) * 0.1 + 0.02] as V3, r: [Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18] as V3 };
        }),
      ];
    case "bob":
      return [
        ...crown,
        { g: sphere(0.13, 14, 8, 0, Math.PI, 0, Math.PI * 0.78), c: h, p: [0, 0.135, 0.015], s: [1.02, 1.08, 1.04] },
        ...[-1, 1].map((side) => ({ g: capsule(0.034, 0.1), c: h, p: [side * 0.112, 0.085, -0.02] as V3, s: [0.8, 1, 1.25] as V3 })),
        ...(hatted ? [] : [{ g: capsule(0.03, 0.12), c: h, p: [0, 0.21, -0.085] as V3, r: [0, 0, Math.PI / 2] as V3, s: [1, 1, 0.7] as V3 }]),
      ];
    case "sidepart":
      return [...crown, ...(hatted ? [] : [{ g: sphere(0.07, 10, 8), c: h, p: [0.045, 0.245, -0.045] as V3, s: [1.4, 0.55, 1] as V3, r: [0, 0, -0.2] as V3 }])];
    case "spiky":
      return [
        ...crown,
        ...(hatted
          ? []
          : [-0.06, -0.02, 0.02, 0.06].flatMap((x, i) => [
              { g: new THREE.ConeGeometry(0.03, 0.09, 5), c: h, p: [x, 0.27, -0.03 + (i % 2) * 0.03] as V3, r: [-0.35, 0, -x * 4] as V3 },
              { g: new THREE.ConeGeometry(0.028, 0.08, 5), c: h, p: [x * 1.1, 0.24, 0.06] as V3, r: [0.6, 0, -x * 4] as V3 },
            ])),
      ];
  }
}

function hatPieces(l: Look): Piece[] {
  const c = l.hatColor;
  const dome = (r: number, y: number, extent = 0.5): Piece => ({ g: sphere(r, 14, 7, 0, Math.PI * 2, 0, Math.PI * extent), c, p: [0, y, 0.005], s: [0.98, 1.05, 1.04] });
  switch (l.hat) {
    case "beanie":
      return [
        dome(0.126, 0.17, 0.5),
        { g: cylinder(0.133, 0.135, 0.045, 24), c: shade(c, 0.82), p: [0, 0.186, 0.005], s: [0.98, 1, 1.04] },
        { g: sphere(0.03, 8, 6), c: l.accent === c ? "#fff7e8" : l.accent, p: [0, 0.31, 0.005] },
      ];
    case "cap":
    case "capBack": {
      const dir = l.hat === "cap" ? -1 : 1;
      return [
        dome(0.127, 0.16, 0.46),
        { g: cylinder(0.075, 0.075, 0.012, 14), c: shade(c, 0.85), p: [0, 0.19, dir * 0.15], s: [1.15, 1, 1.3], r: [dir * -0.12, 0, 0] },
        { g: sphere(0.012, 6, 5), c: shade(c, 0.8), p: [0, 0.295, 0.005] },
      ];
    }
    case "bucket":
      return [
        { g: cylinder(0.112, 0.128, 0.1, 16), c, p: [0, 0.235, 0.005] },
        { g: sphere(0.112, 14, 5, 0, Math.PI * 2, 0, Math.PI * 0.3), c, p: [0, 0.255, 0.005], s: [1, 0.5, 1] },
        { g: cylinder(0.165, 0.185, 0.02, 18), c: shade(c, 0.9), p: [0, 0.185, 0.005], r: [0.06, 0, 0] },
      ];
    case "beret":
      return [
        { g: sphere(0.135, 14, 8), c, p: [0.02, 0.245, 0.01], s: [1.08, 0.34, 1.04], r: [0, 0, -0.22] },
        { g: cylinder(0.008, 0.008, 0.03, 6), c, p: [0.03, 0.295, 0.01] },
      ];
    default:
      return [];
  }
}

function eyewear(l: Look): Piece[] {
  if (!l.glasses) return [];
  const frame = l.glasses === "shades" ? "#14112a" : INK;
  const out: Piece[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.043;
    const z = faceZ(x, EYE_Y) - 0.017;
    if (l.glasses === "square") out.push({ g: torus(0.03, 0.0048, 4, 4), c: frame, p: [x, EYE_Y, z], r: [0, 0, Math.PI / 4], s: [1.15, 0.85, 1] });
    else out.push({ g: torus(0.027, 0.0048, 6, 14), c: frame, p: [x, EYE_Y, z] });
    if (l.glasses === "shades") out.push({ g: cylinder(0.026, 0.026, 0.004, 14), c: "#2a2547", p: [x, EYE_Y, z], r: [Math.PI / 2, 0, 0] });
    out.push({ g: box(0.006, 0.006, 0.11), c: frame, p: [side * 0.077, EYE_Y + 0.005, z + 0.055] });
  }
  out.push({ g: box(0.024, 0.006, 0.006), c: frame, p: [0, EYE_Y + 0.006, faceZ(0, EYE_Y) - 0.018] });
  return out;
}

/** Height of the top of the head, including hair or a hat, so a headset band can sit on it. */
function crownTop(l: Look): number {
  if (l.hat === "beanie") return 0.305;
  if (l.hat) return 0.3;
  switch (l.hairStyle) {
    case "afro":
      return 0.385;
    case "curly":
    case "spiky":
      return 0.3;
    case "bald":
    case "buzz":
      return 0.265;
    default:
      return 0.285;
  }
}

function headset(l: Look): Piece[] {
  if (!l.headset) return [];
  const cup = l.accent === INK || l.accent === "#1d1834" ? "#ff4d5e" : l.accent;
  const R = 0.128;
  const out: Piece[] = [
    { g: torus(R, 0.012, 6, 20, Math.PI), c: INK, p: [0, 0.135, 0.005], s: [1, (crownTop(l) + 0.006 - 0.135) / R, 1] },
    { g: cylinder(0.04, 0.04, 0.035, 12), c: cup, p: [-0.122, 0.13, 0.005], r: [0, 0, Math.PI / 2] },
  ];
  if (l.headset === "phones") out.push({ g: cylinder(0.04, 0.04, 0.035, 12), c: cup, p: [0.122, 0.13, 0.005], r: [0, 0, Math.PI / 2] });
  else out.push(rod([-0.13, 0.11, -0.01], [-0.045, 0.082, faceZ(-0.04, 0.082) - 0.012], 0.0045, INK), { g: sphere(0.011, 6, 5), c: INK, p: [-0.04, 0.082, faceZ(-0.04, 0.082) - 0.012] });
  return out;
}

/* ------------------------------------------------------------------ */
/* Torso                                                               */
/* ------------------------------------------------------------------ */

const OPEN_FRONT: Partial<Record<TopStyle, number>> = { blazer: 0.75, cardigan: 0.55, overshirt: 0.6, puffer: 0.4 };

function torsoPieces(l: Look): Piece[] {
  const f: Fit = { build: l.build, girth: l.girth };
  const top = l.top;
  const gap = OPEN_FRONT[l.topStyle];
  const sleeveless = l.topStyle === "puffer" || l.topStyle === "hivis";
  // Open and sleeveless tops are worn over a shirt in the `under` colour.
  const out: Piece[] = torsoShape(gap !== undefined || sleeveless ? l.under : top, f);
  out.push({ g: cylinder(0.05, 0.054, 0.12), c: l.skin, p: [0, 0.6, 0] });

  // A print on the chest of a tee or hoodie.
  const print = (y: number) => ({ g: cylinder(0.034, 0.034, 0.004, 14), c: l.accent, p: [0, y, chestZ(0, y, f) - 0.002] as V3, r: [Math.PI / 2, 0, 0] as V3 });

  switch (l.topStyle) {
    case "tee":
      out.push({ g: cylinder(0.062, 0.07, 0.025), c: shade(top, 0.8), p: [0, 0.565, -0.005] }, print(0.4));
      break;
    case "hoodie":
      out.push(
        { g: sphere(0.13, 12, 8, 0, Math.PI, 0, Math.PI * 0.7), c: shade(top, 0.82), p: [0, 0.53, 0.06], s: [1.05, 0.8, 0.9] },
        { g: box(0.012, 0.13, 0.012), c: l.accent, p: [-0.035, 0.46, chestZ(-0.035, 0.46, f) - 0.004] },
        { g: box(0.012, 0.13, 0.012), c: l.accent, p: [0.035, 0.46, chestZ(0.035, 0.46, f) - 0.004] },
        { g: box(0.2, 0.09, 0.02), c: shade(top, 0.85), p: [0, 0.2, chestZ(0, 0.2, f) - 0.004] },
        band(shade(top, 0.8), f, 0.08, 0.04, 0.004),
      );
      break;
    case "shirt":
      out.push(
        { g: box(0.07, 0.04, 0.03), c: shade(top, 1.1), p: [-0.045, 0.565, -0.075], r: [0, 0, 0.5] },
        { g: box(0.07, 0.04, 0.03), c: shade(top, 1.1), p: [0.045, 0.565, -0.075], r: [0, 0, -0.5] },
        ...[0.48, 0.38, 0.28, 0.18].map((y) => ({ g: box(0.018, 0.018, 0.01), c: shade(top, 0.6), p: [0, y, chestZ(0, y, f) - 0.003] as V3 })),
      );
      break;
    case "turtleneck":
      out.push({ g: cylinder(0.062, 0.068, 0.11, 14), c: top, p: [0, 0.6, 0] }, { g: cylinder(0.064, 0.064, 0.02, 14), c: shade(top, 0.85), p: [0, 0.65, 0] });
      break;
    case "bomber":
      out.push(
        { g: box(0.012, 0.44, 0.01), c: shade(top, 0.6), p: [0, 0.3, chestZ(0, 0.3, f) - 0.003] },
        band(l.accent, f, 0.08, 0.05, 0.006),
        { g: cylinder(0.066, 0.075, 0.035, 14), c: l.accent, p: [0, 0.57, 0] },
        { g: cylinder(0.03, 0.03, 0.004, 12), c: l.accent, p: [-0.09, 0.42, chestZ(-0.09, 0.42, f) - 0.003], r: [Math.PI / 2, 0, 0.2] },
      );
      break;
    case "blazer":
      out.push(
        coat(top, f, 0.008, gap!),
        { g: sphere(0.095, 12, 8), c: top, p: [-0.178 * l.build, 0.495, 0] },
        { g: sphere(0.095, 12, 8), c: top, p: [0.178 * l.build, 0.495, 0] },
        ...[-1, 1].map((side) => {
          const x = side * 0.07;
          return { g: box(0.05, 0.2, 0.012), c: shade(top, 0.82), p: [x, 0.44, chestZ(x, 0.44, f, 0.012)] as V3, r: [0, 0, side * 0.3] as V3 };
        }),
        { g: sphere(0.011, 6, 5), c: shade(top, 0.55), p: [0.075, 0.24, chestZ(0.075, 0.24, f, 0.012)] },
      );
      break;
    case "cardigan":
      out.push(
        coat(top, f, 0.007, gap!),
        { g: sphere(0.094, 12, 8), c: top, p: [-0.177 * l.build, 0.493, 0] },
        { g: sphere(0.094, 12, 8), c: top, p: [0.177 * l.build, 0.493, 0] },
        band(shade(top, 0.82), f, 0.08, 0.04, 0.011, gap!),
        ...[0.42, 0.32, 0.22].map((y) => ({ g: sphere(0.01, 6, 5), c: shade(top, 0.55), p: [0.065, y, chestZ(0.065, y, f, 0.012)] as V3 })),
      );
      break;
    case "overshirt":
      out.push(
        coat(top, f, 0.007, gap!),
        { g: sphere(0.094, 12, 8), c: top, p: [-0.177 * l.build, 0.493, 0] },
        { g: sphere(0.094, 12, 8), c: top, p: [0.177 * l.build, 0.493, 0] },
        // Flannel checks: a few darker bands across the body and down the front.
        ...[0.16, 0.3, 0.44].map((y) => band(shade(top, 0.72), f, y, 0.025, 0.009, gap)),
        ...[-1, 1].map((side) => {
          const x = side * 0.12;
          return { g: box(0.022, 0.44, 0.006), c: shade(top, 0.72), p: [x, 0.3, chestZ(x, 0.3, f, 0.01)] as V3 };
        }),
        ...[-1, 1].map((side) => ({ g: box(0.06, 0.035, 0.03), c: shade(top, 1.1), p: [side * 0.05, 0.565, -0.07] as V3, r: [0, 0, -side * 0.5] as V3 })),
      );
      break;
    case "puffer":
      out.push(coat(top, f, 0.022, gap!, 0.53, 0.07), ...[0.16, 0.26, 0.36, 0.46].map((y) => band(shade(top, 0.7), f, y, 0.008, 0.024, gap)), {
        g: new THREE.CylinderGeometry(0.07, 0.085, 0.05, 14, 1, true, Math.PI + 0.3, Math.PI * 2 - 0.6),
        c: top,
        p: [0, 0.57, 0],
      });
      break;
    case "hivis": {
      const stripe = "#e4e4f2";
      out.push(
        coat(top, f, 0.01, 0, 0.53, 0.1),
        band(stripe, f, 0.2, 0.035, 0.012),
        band(stripe, f, 0.33, 0.035, 0.012),
        ...[-1, 1].map((side) => {
          const x = side * 0.075;
          return { g: box(0.035, 0.16, 0.008), c: stripe, p: [x, 0.45, chestZ(x, 0.45, f, 0.012)] as V3 };
        }),
      );
      break;
    }
  }

  if (l.badge) {
    const z = chestZ(0, 0.35, f, gap !== undefined ? 0 : 0.002);
    out.push(
      rod([-0.06, 0.56, chestZ(-0.06, 0.52, f) - 0.004], [-0.004, 0.38, z - 0.006], 0.004, "#4cb8ff"),
      rod([0.06, 0.56, chestZ(0.06, 0.52, f) - 0.004], [0.004, 0.38, z - 0.006], 0.004, "#4cb8ff"),
      { g: box(0.055, 0.075, 0.01), c: "#fff7e8", p: [0, 0.35, z - 0.01] },
      { g: box(0.035, 0.012, 0.012), c: INK, p: [0, 0.365, z - 0.014] },
    );
  }

  if (l.bag === "backpack") {
    const bz = backZ(0.33, f);
    const c = l.bagColor;
    out.push(
      { g: box(0.26 * l.build, 0.34, 0.13), c, p: [0, 0.33, bz + 0.065] },
      { g: box(0.2 * l.build, 0.13, 0.05), c: shade(c, 0.82), p: [0, 0.24, bz + 0.15] },
      { g: torus(0.025, 0.007, 4, 8, Math.PI), c: shade(c, 0.7), p: [0, 0.5, bz + 0.06] },
      // Straps come over each shoulder and down the chest.
      ...[-1, 1].flatMap((side) => {
        const x = side * 0.09 * l.build;
        const front = (y: number, k = 1): V3 => [x * k, y, chestZ(x * k, y, f) - 0.008];
        return strap([[x, 0.5, bz + 0.01], [x, 0.59, 0], front(0.5), front(0.35, 1.05), front(0.2, 1.1)], 0.012, shade(c, 0.6));
      }),
    );
  } else if (l.bag === "sling") {
    const c = l.bagColor;
    const across = (x: number, y: number): V3 => [x, y, chestZ(x, y, f) - 0.009];
    out.push(...strap([[-0.15 * l.build, 0.59, 0], across(-0.15 * l.build, 0.5), across(-0.02, 0.33), across(0.12, 0.15)], 0.009, shade(c, 0.75)), {
      g: box(0.15, 0.09, 0.05),
      c,
      p: [0.1, 0.14, chestZ(0.1, 0.14, f) - 0.03],
      r: [0, 0, 0.2],
    });
  }
  return out;
}

function pelvisPieces(l: Look): Piece[] {
  const out: Piece[] = [
    { g: cylinder(0.15, 0.158, 0.2), c: l.pants, p: [0, 0.02, 0], s: [1, 1, 0.72] },
    { g: cylinder(0.153, 0.153, 0.03), c: shade(l.pants, 0.7), p: [0, 0.115, 0], s: [1, 1, 0.73] },
  ];
  if (l.bottom === "skirt") out.push({ g: cylinder(0.158, 0.19, 0.16, 16), c: l.pants, p: [0, -0.07, 0], s: [1, 1, 0.78] });
  if (l.bag === "toolbelt") {
    const c = l.bagColor;
    out.push(
      { g: cylinder(0.162, 0.162, 0.045, 16), c, p: [0, 0.09, 0], s: [1, 1, 0.76] },
      { g: box(0.07, 0.11, 0.08), c: shade(c, 0.85), p: [-0.15, 0.03, -0.03] },
      { g: box(0.07, 0.09, 0.07), c: shade(c, 0.85), p: [0.15, 0.04, 0.0] },
      { g: cylinder(0.008, 0.008, 0.08, 6), c: "#b9b2d9", p: [-0.165, 0.11, -0.05] },
    );
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Limbs                                                               */
/* ------------------------------------------------------------------ */

const SLEEVES_OF: Partial<Record<TopStyle, "under">> = { puffer: "under", hivis: "under" };

function upperArmPieces(l: Look): Piece[] {
  const sleeve = SLEEVES_OF[l.topStyle] ? l.under : l.top;
  if (l.sleeves === "short")
    return [
      { g: capsule(0.054, 0.06), c: sleeve, p: [0, -0.06, 0] },
      { g: capsule(0.043, 0.18), c: l.skin, p: [0, -0.15, 0] },
    ];
  return [{ g: capsule(0.048, 0.2), c: sleeve, p: [0, -0.14, 0] }];
}

function forearmPieces(l: Look, side: -1 | 1): Piece[] {
  const sleeve = SLEEVES_OF[l.topStyle] ? l.under : l.top;
  const hand = l.gloves ?? l.skin;
  const out: Piece[] = [];
  if (l.sleeves === "long") {
    out.push({ g: capsule(0.041, 0.18), c: sleeve, p: [0, -0.12, 0] }, { g: cylinder(0.044, 0.044, 0.03), c: shade(sleeve, 0.8), p: [0, -0.235, 0] });
  } else if (l.sleeves === "rolled") {
    out.push({ g: capsule(0.04, 0.18), c: l.skin, p: [0, -0.12, 0] }, { g: cylinder(0.05, 0.047, 0.06), c: shade(sleeve, 0.85), p: [0, -0.015, 0] });
  } else {
    out.push({ g: capsule(0.041, 0.18), c: l.skin, p: [0, -0.12, 0] });
  }
  out.push({ g: sphere(0.046, 10, 8), c: hand, p: [0, -0.29, -0.005], s: [0.85, 1.15, 0.62] }, { g: sphere(0.018, 6, 5), c: hand, p: [0, -0.27, -0.035] });
  // A watch on the left wrist.
  if (l.watch && side === -1) {
    out.push({ g: cylinder(0.045, 0.045, 0.022, 12), c: INK, p: [0, -0.222, 0] }, { g: cylinder(0.016, 0.016, 0.008, 10), c: "#e8e2ff", p: [-0.045, -0.222, 0], r: [0, 0, Math.PI / 2] });
  }
  return out;
}

function thighPieces(l: Look): Piece[] {
  if (l.bottom === "shorts")
    return [
      { g: capsule(0.073, 0.14), c: l.pants, p: [0, -0.1, 0] },
      { g: capsule(0.062, 0.26), c: l.legs, p: [0, -0.24, 0] },
    ];
  if (l.bottom === "skirt")
    return [
      { g: capsule(0.072, 0.2), c: l.pants, p: [0, -0.13, 0] },
      { g: capsule(0.062, 0.24), c: l.legs, p: [0, -0.25, 0] },
    ];
  return [{ g: capsule(0.068, 0.3), c: l.pants, p: [0, -0.215, 0] }];
}

function shinPieces(l: Look): Piece[] {
  const bare = l.bottom !== "trousers";
  const out: Piece[] = [{ g: capsule(bare ? 0.052 : 0.056, 0.32), c: bare ? l.legs : l.pants, p: [0, -0.21, 0] }];
  if (bare && l.legs === l.skin) out.push({ g: cylinder(0.054, 0.054, 0.08, 10), c: l.socks, p: [0, -0.37, 0] });
  if (l.boots) out.push({ g: cylinder(0.06, 0.058, 0.1, 10), c: l.shoes, p: [0, -0.39, 0] });
  out.push(
    { g: capsule(0.05, 0.13), c: l.shoes, p: [0, -0.445, -0.045], r: [Math.PI / 2, 0, 0], s: [1.05, 1, 0.75] },
    { g: box(0.1, 0.02, 0.24), c: l.soles, p: [0, -0.485, -0.045] },
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* A whole body                                                        */
/* ------------------------------------------------------------------ */

export interface Body {
  pelvis: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  upperArm: THREE.BufferGeometry;
  forearmL: THREE.BufferGeometry;
  forearmR: THREE.BufferGeometry;
  thigh: THREE.BufferGeometry;
  shin: THREE.BufferGeometry;
}

/** Build a body. Seated people hang their backpack on the chair, so it does not cut through the backrest. */
export function buildBody(look: Look, seated = false): Body {
  const l = seated && look.bag === "backpack" ? { ...look, bag: null } : look;
  return {
    pelvis: merge(pelvisPieces(l)),
    torso: merge(torsoPieces(l)),
    head: merge([...facePieces(l), ...facialHair(l), ...hairPieces(l), ...hatPieces(l), ...eyewear(l), ...headset(l)]),
    upperArm: merge(upperArmPieces(l)),
    forearmL: merge(forearmPieces(l, -1)),
    forearmR: merge(forearmPieces(l, 1)),
    thigh: merge(thighPieces(l)),
    shin: merge(shinPieces(l)),
  };
}

const bodies = new Map<string, Body>();

/** The body for a look, built once and shared by everyone who looks the same. */
export function bodyFor(l: Look, seated = false): Body {
  const key = `${seated ? "sit" : "stand"}:${JSON.stringify(l)}`;
  let b = bodies.get(key);
  if (!b) {
    b = buildBody(l, seated);
    bodies.set(key, b);
  }
  return b;
}
