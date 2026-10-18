import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * The city's passers-by, built from code: a person STATURE tall, facing -z, feet on the ground, arms at their sides.
 * Every vertex says what it is (aWho): x, which part, so the material can dress each person differently; y, which
 * limb it swings with, if any, about the hip or the shoulder. The swing and the dip of the body as the legs spread
 * are worked out in the vertex shader (see exterior.tsx), so a walker costs one matrix a frame. A lite person, for
 * drawing without a graphics card, is a few boxes and coarse rounds.
 */

/** The model's height in metres; each person is scaled to their own (see stature). */
export const STATURE = 1.75;
/** Where the legs swing from, and the arms. */
export const HIP = 0.9;
export const SHOULDER = 1.42;

/** What a vertex belongs to: the shirt takes each person's own colour; skin, hair and trousers are picked per person. */
export const PART = { shirt: 0, skin: 1, hair: 2, trousers: 3, shoes: 4 } as const;
/** Which limb a vertex swings with: legs swing from the hip, arms from the shoulder, each against the other side. */
export const LIMB = { none: 0, leftLeg: 1, rightLeg: 2, leftArm: 3, rightArm: 4 } as const;

type Part = (typeof PART)[keyof typeof PART];
type Limb = (typeof LIMB)[keyof typeof LIMB];

/** A person's height in metres, from their size relative to an average passer-by (0.75 to 1.2, see city.ts). */
export const stature = (size: number): number => 1.5 + ((size - 0.75) / 0.45) * 0.4;

/** Tag a piece with its part and limb, white but for the shoes, so everything merges. */
function piece(g: THREE.BufferGeometry, part: Part, limb: Limb): THREE.BufferGeometry {
  g.deleteAttribute("uv");
  const n = g.attributes.position.count;
  const c = new THREE.Color(part === PART.shoes ? "#2a2a30" : "#ffffff");
  const cols = new Float32Array(n * 3);
  const who = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    cols.set([c.r, c.g, c.b], i * 3);
    who.set([part, limb], i * 2);
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.setAttribute("aWho", new THREE.BufferAttribute(who, 2));
  return g;
}

const round = (radius: number, w: number, h: number) => new THREE.SphereGeometry(radius, w, h);

/** A person, facing -z: shirt, skin and hair above, trousers and shoes below. */
export function walkerModel(lite = false): THREE.BufferGeometry {
  const sides = lite ? 4 : 10;
  const parts: THREE.BufferGeometry[] = [
    // A torso narrower at the waist than the shoulders, and shallower front to back than across.
    piece(new THREE.CylinderGeometry(0.2, 0.165, 0.58, lite ? 5 : 12).scale(1, 1, 0.6).translate(0, 1.17, 0), PART.shirt, LIMB.none),
    piece(round(0.105, lite ? 6 : 12, lite ? 4 : 8).scale(0.92, 1.12, 1).translate(0, 1.6245, 0), PART.skin, LIMB.none),
    piece(new THREE.SphereGeometry(0.112, lite ? 6 : 12, lite ? 3 : 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.93, 1.12, 1.02).translate(0, 1.6245, 0.01), PART.hair, LIMB.none),
  ];
  if (!lite) parts.push(piece(new THREE.CylinderGeometry(0.05, 0.055, 0.1, sides, 1, true).translate(0, 1.5, 0), PART.skin, LIMB.none));
  for (const [side, leg, arm] of [
    [-1, LIMB.leftLeg, LIMB.leftArm],
    [1, LIMB.rightLeg, LIMB.rightArm],
  ] as const) {
    const lx = side * 0.09;
    const ax = side * 0.235;
    if (lite) {
      parts.push(piece(new THREE.BoxGeometry(0.13, HIP, 0.14).translate(lx, HIP / 2, 0), PART.trousers, leg));
      parts.push(piece(new THREE.BoxGeometry(0.09, 0.6, 0.09).translate(ax, SHOULDER - 0.3, 0), PART.shirt, arm));
      continue;
    }
    parts.push(
      piece(new THREE.CylinderGeometry(0.075, 0.06, HIP - 0.08, sides).translate(lx, 0.08 + (HIP - 0.08) / 2, 0), PART.trousers, leg),
      piece(new THREE.BoxGeometry(0.11, 0.08, 0.27).translate(lx, 0.04, -0.04), PART.shoes, leg),
      // A short sleeve, the forearm and the hand.
      piece(new THREE.CylinderGeometry(0.05, 0.045, 0.3, sides).translate(ax, SHOULDER - 0.15, 0), PART.shirt, arm),
      piece(new THREE.CylinderGeometry(0.042, 0.036, 0.28, sides, 1, true).translate(ax, SHOULDER - 0.44, 0), PART.skin, arm),
      piece(round(0.045, 8, 6).translate(ax, SHOULDER - 0.61, 0), PART.skin, arm),
    );
  }
  const g = mergeGeometries(parts);
  if (!g) throw new Error("walker parts could not be merged");
  return g;
}

/** Skin, hair and trousers to pick from, a person's own the same every visit. */
export const SKIN = ["#f1c9a5", "#e0ac83", "#c68e63", "#a26a42", "#7b4a2c", "#5a3520"];
export const HAIR = ["#1f1a17", "#3b2a20", "#6a4a2e", "#a8875a", "#8c8c8c"];
export const TROUSERS = ["#2c3e5c", "#1f2228", "#c2b28f", "#5b5f66", "#253049", "#7a6a55"];
