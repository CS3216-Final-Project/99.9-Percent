import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { randRange, type RngHolder } from "@/sim/rng";

/*
 * The city's trees, built from code: a palm with a curved, ringed trunk and drooping feathered fronds over a skirt of
 * dead ones; an oak-like broadleaf whose crown is a cluster of irregular clumps on branches; a rain tree's wide
 * umbrella on spreading limbs; and a narrow flame of a cypress. Each is one unit tall, to be scaled by the tree's
 * height, and comes as two meshes: the bark, in its own colours, and the leaves, in pale greys shaded darker
 * underneath and toward the middle, for each tree's own colour to tint. Every part keeps its index, so smooth
 * normals run across each clump and frond. Each vertex of a palm's live fronds also says where on the frond it lies
 * (aFrond: how far along it, and how far across the midrib), so the city's HD shader can cut it into leaflets. A lite
 * model, for drawing without a graphics card, has fewer parts.
 */

export type TreeShape = "round" | "cone" | "umbrella" | "palm";

/** How many different models each shape has; trees take them in turn. */
export const TREE_VARIANTS: Record<TreeShape, number> = { round: 2, cone: 1, umbrella: 1, palm: 2 };

export interface TreeModel {
  bark: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
}

type V = THREE.Vector3;
const vec = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A geometry with only its positions and an index, so its parts can be merged and smoothed together. */
function bare(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  return mergeVertices(g);
}

/** Give every vertex a colour. */
function paint(g: THREE.BufferGeometry, colour: (p: V, i: number) => [number, number, number]): THREE.BufferGeometry {
  const p = g.attributes.position;
  const out = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) out.set(colour(v.fromBufferAttribute(p, i), i), i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(out, 3));
  return g;
}

const hex = (h: string): [number, number, number] => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};

function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error("tree parts could not be merged");
  g.computeVertexNormals();
  return g;
}

/** A lumpy ball of leaves: an icosahedron whose every vertex is pushed in or out a little. */
function clump(rng: RngHolder, r: number, at: V, detail: number, squash = 1): THREE.BufferGeometry {
  const g = bare(new THREE.IcosahedronGeometry(r, detail));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = randRange(rng, 0.8, 1.15);
    p.setXYZ(i, p.getX(i) * k + at.x, p.getY(i) * k * squash + at.y, p.getZ(i) * k + at.z);
  }
  return g;
}

/** A tube through `points`, `radii` thick at each, with `sides` round it. Open at both ends. */
function tube(points: V[], radii: number[], sides: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  points.forEach((p, i) => {
    t.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
    n.crossVectors(t, Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    b.crossVectors(t, n);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      pos.push(p.x + radii[i] * (Math.cos(a) * n.x + Math.sin(a) * b.x), p.y + radii[i] * (Math.cos(a) * n.y + Math.sin(a) * b.y), p.z + radii[i] * (Math.cos(a) * n.z + Math.sin(a) * b.z));
    }
  });
  for (let i = 0; i + 1 < points.length; i++) {
    for (let s = 0; s < sides; s++) {
      const a = i * sides + s;
      const c = i * sides + ((s + 1) % sides);
      index.push(a, a + sides, c, c, a + sides, c + sides);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

/** A branch from `a` to `b`, tapering from `r0` to `r1`, bowing a little upward on the way. */
function limb(a: V, b: V, r0: number, r1: number, sides: number): THREE.BufferGeometry {
  const steps = 4;
  const points: V[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    points.push(new THREE.Vector3().lerpVectors(a, b, k).add(vec(0, 0.04 * Math.sin(Math.PI * k) * a.distanceTo(b), 0)));
    radii.push(r0 + (r1 - r0) * k);
  }
  return tube(points, radii, sides);
}

/**
 * A palm frond from `origin`, heading out at `azimuth` and up at `elevation`, sagging under its own weight. Its
 * leaflets fan out either side of the midrib and droop, wide in the middle of the frond and narrow at each end.
 * Returns the frond and, for each vertex, how far along the frond it is. Each vertex also carries its place on the
 * frond in `aFrond` — how far along it and which side of the midrib — for the HD material's leaflet cut-out.
 */
function frond(origin: V, azimuth: number, elevation: number, length: number, sag: number, segs: number, width: number): { g: THREE.BufferGeometry; along: number[] } {
  const dir = vec(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
  const at = (s: number) => origin.clone().addScaledVector(dir, length * s).add(vec(0, -sag * s * s, 0));
  const pos: number[] = [];
  const along: number[] = [];
  const coord: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const p = at(i / segs);
    pos.push(p.x, p.y, p.z);
    along.push(i / segs);
    coord.push(i / segs, 0);
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 1; i <= segs; i++) {
    const s = i / segs;
    const p = at(s);
    const tangent = at(Math.min(1, s + 0.05)).sub(at(Math.max(0, s - 0.05))).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
    const w = width * Math.sin(Math.PI * Math.min(1, s * 1.15)) + 0.004;
    for (const sign of [-1, 1]) {
      const tip = p.clone().addScaledVector(side, sign * w).addScaledVector(tangent, w * 0.35).add(vec(0, -w * 0.45, 0));
      index.push(i - 1, i, pos.length / 3);
      pos.push(tip.x, tip.y, tip.z);
      along.push(s);
      coord.push(s, sign);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aFrond", new THREE.Float32BufferAttribute(coord, 2));
  g.setIndex(index);
  return { g, along };
}

/** Darker underneath and toward the middle of the crown, lighter on top and at the edges, a little uneven. */
function shadeCrown(g: THREE.BufferGeometry, centre: V, radius: V, rng: RngHolder): THREE.BufferGeometry {
  return paint(g, (p) => {
    const up = THREE.MathUtils.clamp((p.y - centre.y) / radius.y, -1, 1);
    const out = Math.min(1, Math.hypot((p.x - centre.x) / radius.x, (p.y - centre.y) / radius.y, (p.z - centre.z) / radius.z));
    const k = (0.62 + 0.2 * up + 0.28 * out) * randRange(rng, 0.9, 1.08);
    return [k, k, k];
  });
}

const BARK = { oak: "#5b4636", pale: "#8d7b66", palm: ["#8a7a62", "#71644f"], dead: ["#8a6d45", "#6e5636"] };

function palm(variant: number, lite: boolean): TreeModel {
  const rng: RngHolder = { rngState: 101 + variant * 17 };
  const lean = variant === 0 ? 0.05 : 0.13;
  const top = 0.88;
  const rings = lite ? 5 : 15;
  const trunkAt = (t: number) => vec(lean * t * t, top * t, 0);
  const points: V[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    points.push(trunkAt(t));
    // Flared at the foot, then a slow taper to the crown.
    radii.push(0.024 * (1 - 0.3 * t) + 0.022 * Math.max(0, 1 - t * 7));
  }
  const sides = lite ? 5 : 10;
  // Bands of old frond scars round the trunk, a ring at a time.
  const trunk = paint(tube(points, radii, sides), (_, i) => hex(BARK.palm[Math.floor(i / sides) % 2]));
  const crown = trunkAt(1);
  const knot = paint(clump(rng, 0.035, crown, lite ? 0 : 1, 1.3), () => hex("#6b5c45"));
  // A skirt of dead fronds hanging under the green ones.
  const deadCount = lite ? 2 : 6;
  const dead = Array.from({ length: deadCount }, (_, k) => {
    const f = frond(crown.clone().add(vec(0, -0.02, 0)), (k / deadCount) * Math.PI * 2 + 0.4, -1.15, 0.2, 0.02, lite ? 3 : 8, 0.04);
    // Dead fronds merge into the bark, which is drawn without the leaflet cut-out, so they drop its coordinates.
    f.g.deleteAttribute("aFrond");
    return paint(f.g, (_, i) => hex(BARK.dead[i % 2]));
  });
  const fronds = lite ? 8 : 20;
  const leaves = Array.from({ length: fronds }, (_, k) => {
    // Young fronds stand up in the middle, the oldest droop round the outside.
    const layer = (k % 3) / 2;
    const f = frond(crown, (k / fronds) * Math.PI * 2 + randRange(rng, -0.2, 0.2), 0.75 - 1.05 * layer + randRange(rng, -0.1, 0.1), randRange(rng, 0.27, 0.33), 0.12 + 0.08 * layer, lite ? 4 : 13, 0.075);
    const tone = randRange(rng, 0.85, 1.05);
    return paint(f.g, (_, i) => {
      const k2 = (0.55 + 0.45 * f.along[i]) * tone;
      return [k2, k2, k2];
    });
  });
  return { bark: join([trunk, knot, ...dead]), leaves: join(leaves) };
}

function broadleaf(variant: number, lite: boolean): TreeModel {
  const rng: RngHolder = { rngState: 211 + variant * 31 };
  const centre = vec(0, 0.64, 0);
  const radius = vec(0.32, 0.27, 0.32);
  const detail = lite ? 0 : 1;
  const parts = [clump(rng, 0.2, centre, detail)];
  const n = lite ? 5 : 14;
  const ends: V[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + randRange(rng, -0.3, 0.3);
    const up = randRange(rng, -0.45, 0.85);
    const d = randRange(rng, 0.55, 0.85);
    const at = vec(Math.cos(a) * Math.sqrt(1 - up * up) * radius.x * d, centre.y + up * radius.y * d, Math.sin(a) * Math.sqrt(1 - up * up) * radius.z * d);
    parts.push(clump(rng, randRange(rng, 0.12, 0.18), at, detail));
    if (k % 3 === 0) ends.push(at);
  }
  const fork = vec(0, 0.4, 0);
  const sides = lite ? 5 : 10;
  const bark = [tube([vec(0, 0, 0), vec(0, 0.05, 0), fork], [0.05, 0.034, 0.028], sides), ...ends.map((e) => limb(fork, e.clone().lerp(centre, 0.35), 0.02, 0.008, lite ? 4 : 8))];
  return { bark: paint(join(bark), () => hex(BARK.oak)), leaves: shadeCrown(join(parts), centre, radius, rng) };
}

function umbrella(lite: boolean): TreeModel {
  const rng: RngHolder = { rngState: 307 };
  const centre = vec(0, 0.74, 0);
  const radius = vec(0.56, 0.16, 0.56);
  const detail = lite ? 0 : 1;
  const parts: THREE.BufferGeometry[] = [];
  const n = lite ? 7 : 20;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + randRange(rng, -0.25, 0.25);
    const d = k % 4 === 0 ? randRange(rng, 0, 0.3) : randRange(rng, 0.45, 0.9);
    const at = vec(Math.cos(a) * radius.x * d, centre.y + randRange(rng, -0.05, 0.06) - 0.06 * d * d, Math.sin(a) * radius.z * d);
    parts.push(clump(rng, randRange(rng, 0.16, 0.22), at, detail, 0.6));
  }
  const fork = vec(0, 0.36, 0);
  const sides = lite ? 5 : 10;
  const limbCount = lite ? 3 : 7;
  const limbs = Array.from({ length: limbCount }, (_, k) => {
    const a = (k / limbCount) * Math.PI * 2 + 0.5;
    return limb(fork, vec(Math.cos(a) * 0.36, 0.66, Math.sin(a) * 0.36), 0.026, 0.01, lite ? 4 : 8);
  });
  const bark = [tube([vec(0, 0, 0), vec(0, 0.06, 0), fork], [0.06, 0.04, 0.034], sides), ...limbs];
  return { bark: paint(join(bark), () => hex(BARK.pale)), leaves: shadeCrown(join(parts), centre, radius, rng) };
}

function cypress(lite: boolean): TreeModel {
  const rng: RngHolder = { rngState: 401 };
  const n = lite ? 5 : 14;
  const centre = vec(0, 0.55, 0);
  const radius = vec(0.12, 0.45, 0.12);
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const y = 0.14 + 0.78 * t;
    // Widest a third of the way up, tapering to a point.
    const r = 0.11 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.3 + 0.75 * t)), 0.8) + 0.02;
    parts.push(clump(rng, r, vec(randRange(rng, -0.015, 0.015), y, randRange(rng, -0.015, 0.015)), lite ? 0 : 1, 1.7));
  }
  const bark = tube([vec(0, 0, 0), vec(0, 0.2, 0)], [0.03, 0.022], lite ? 4 : 8);
  return { bark: paint(join([bark]), () => hex(BARK.oak)), leaves: shadeCrown(join(parts), centre, radius, rng) };
}

/** Scale a model so its top is exactly one unit up. */
function unitTall(m: TreeModel): TreeModel {
  const box = new THREE.Box3().setFromBufferAttribute(m.leaves.attributes.position as THREE.BufferAttribute).union(new THREE.Box3().setFromBufferAttribute(m.bark.attributes.position as THREE.BufferAttribute));
  const k = 1 / box.max.y;
  m.bark.scale(k, k, k);
  m.leaves.scale(k, k, k);
  return m;
}

/** The model for a shape, its `variant` and the level of detail: the same every time it is made. */
export function treeModel(shape: TreeShape, variant: number, lite: boolean): TreeModel {
  return unitTall(shape === "palm" ? palm(variant, lite) : shape === "round" ? broadleaf(variant, lite) : shape === "umbrella" ? umbrella(lite) : cypress(lite));
}

/** How far a model reaches out from its trunk, as a share of its height. */
export function reach(m: TreeModel): number {
  let most = 0;
  for (const g of [m.bark, m.leaves]) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) most = Math.max(most, Math.hypot(p.getX(i), p.getZ(i)));
  }
  return most;
}
