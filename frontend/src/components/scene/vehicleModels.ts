import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { VehicleKind } from "./city";

/*
 * The city's vehicles, built from code. Each faces -z with its wheels on the ground, within the ground its lane keeps
 * for it (vehicleSize in city.ts), and comes as two meshes: its body, and its lamps, which glow. A body is lofted
 * through cross-sections along its length, so its bonnet, cabin and boot are rounded, the cabin narrows toward the
 * roof, and the sides rise in arches over the wheels. Every vertex says what it is finished in (aFinish): paint, pale
 * for each vehicle's own colour to tint; glass; or trim and tyres, which keep their own colours. A lite vehicle, for
 * drawing without a graphics card, has a few plain cross-sections and no wheels.
 */

/** What a surface is finished in, for the city's vehicle material (see exterior.tsx). */
export const FINISH = { trim: 0, paint: 1, glass: 2 } as const;
type Finish = (typeof FINISH)[keyof typeof FINISH];

const PAINT = "#ffffff";
const GLASS = "#1d242d";
const TRIM = "#1c1d22";
const TYRE = "#17171b";
const HUB = "#a3a6ad";

/** Give a part one colour and finish everywhere, with no texture coordinates, so all parts merge. */
function part(g: THREE.BufferGeometry, colour: string, finish: Finish): THREE.BufferGeometry {
  g.deleteAttribute("uv");
  const n = g.attributes.position.count;
  const c = new THREE.Color(colour);
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.setAttribute("aFinish", new THREE.BufferAttribute(new Float32Array(n).fill(finish), 1));
  return g;
}

function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts);
  if (!g) throw new Error("vehicle parts could not be merged");
  return g;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number, colour: string, finish: Finish) => part(new THREE.BoxGeometry(w, h, d).translate(x, y, z), colour, finish);

/* ------------------------------------------------------------------ */
/* Lofted bodies                                                       */
/* ------------------------------------------------------------------ */

/** A value that changes along the vehicle: [z, value] pairs from front to back, joined by straight lines. */
type Profile = [number, number][];

function along(p: Profile, z: number): number {
  if (z <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [z1, v1] = p[i];
    if (z <= z1) {
      const [z0, v0] = p[i - 1];
      return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
    }
  }
  return p[p.length - 1][1];
}

/** A body's shape from its nose (`from`) to its tail (`to`), front at -z. */
interface Shell {
  from: number;
  to: number;
  /** Half the width. */
  half: Profile;
  /** The underside. */
  bottom: Profile;
  /** The top of the doors, or the edge of the bonnet and boot where there is no cabin. */
  belt: Profile;
  /** The top of the side windows, where a band of paint runs above them to the roof, as on a bus. */
  head?: Profile;
  /** The roof, or the bonnet and boot. */
  top: Profile;
  /** How far the top of the cabin stands in from the sides. */
  inset: Profile;
  /** Where the windscreen and rear window are, glass right across, and where the side windows run. */
  screens: [number, number][];
  windows: [number, number][];
  /** Wheels the sides arch over. */
  arches: Wheel[];
  /** The colour of the paint, before the vehicle's own colour tints it. */
  paint?: string;
}

interface Wheel {
  z: number;
  r: number;
}

/** How much room an arch leaves round its wheel. */
const ARCH = 0.05;

function bottomAt(s: Shell, z: number, lite: boolean): number {
  let y = along(s.bottom, z);
  if (lite) return y;
  for (const { z: wz, r } of s.arches) {
    const reach = r + ARCH;
    const dz = Math.abs(z - wz);
    if (dz <= reach + 1e-6) y = Math.max(y, r + Math.sqrt(Math.max(reach * reach - dz * dz, 0)));
  }
  return y;
}

/** Where the cross-sections stand: wherever any profile turns, round each arch, and at the ends. */
function stationsOf(s: Shell, lite: boolean): number[] {
  const at = [s.from, s.to, ...s.screens.flat(), ...s.windows.flat()];
  if (lite) at.push(s.from + 0.15, s.to - 0.15);
  else {
    for (const p of [s.half, s.bottom, s.belt, s.top, s.inset, ...(s.head ? [s.head] : [])]) for (const [z] of p) at.push(z);
    for (const { z, r } of s.arches) {
      const reach = r + ARCH;
      for (let k = 0; k <= 4; k++) at.push(z - reach * Math.cos((k / 4) * Math.PI));
      at.push(z - reach - 0.02, z + reach + 0.02);
    }
  }
  const sorted = at.filter((z) => z >= s.from && z <= s.to).sort((a, b) => a - b);
  const out: number[] = [];
  for (const z of sorted) if (out.length === 0 || z - out[out.length - 1] > 0.015) out.push(z);
  out[out.length - 1] = s.to;
  return out;
}

/**
 * Half a cross-section, from the middle of the underside round the right-hand side to the middle of the roof, and
 * which part of the body each stretch of it is: 0 and 1 underneath, 2 and 3 the side, 4 the side windows, 5 a band
 * above them, 6 and 7 the roof. A lite section has only the corners.
 */
function section(s: Shell, z: number, lite: boolean): { points: [number, number][]; parts: number[] } {
  const w = along(s.half, z);
  const bottom = bottomAt(s, z, lite);
  const round = Math.min(0.07, w * 0.1);
  const shoulder = 0.07;
  const y2 = bottom + round;
  const y3 = Math.max(along(s.belt, z) - shoulder, y2 + 0.005);
  const y4 = Math.max(along(s.belt, z), y3 + 0.005);
  const top = along(s.top, z);
  const eave = Math.min(0.08, Math.max(0.004, (top - y4) * 0.3));
  const y6 = Math.max(top - eave, y4 + 0.004);
  const y5 = Math.min(Math.max(s.head ? along(s.head, z) : y6, y4 + 0.002), y6 - 0.001);
  const y7 = Math.max(top, y6 + 0.002);
  const x4 = w - shoulder * 0.5;
  const x6 = w - along(s.inset, z);
  const x5 = x4 + ((x6 - x4) * (y5 - y4)) / (y6 - y4);
  const all: [number, number][] = [
    [0, bottom],
    [w - round, bottom],
    [w, y2],
    [w, y3],
    [x4, y4],
    [x5, y5],
    [x6, y6],
    [x6 - eave, y7],
    [0, y7],
  ];
  if (!lite) return { points: all, parts: [0, 1, 2, 3, 4, 5, 6, 7] };
  return { points: [all[0], all[2], all[4], all[6], all[8]], parts: [1, 2, 4, 7] };
}

const within = (spans: [number, number][], z: number) => spans.some(([a, b]) => z > a && z < b);

/** What a stretch of the body between two sections is made of. */
function finishOf(s: Shell, z: number, part: number): Finish {
  if (part <= 1) return FINISH.trim;
  if (part <= 3) return FINISH.paint;
  if (part === 4) return within(s.screens, z) || within(s.windows, z) ? FINISH.glass : FINISH.paint;
  return within(s.screens, z) ? FINISH.glass : FINISH.paint;
}

/**
 * A body lofted through its sections. Normals are worked out over the whole skin, so it shades smoothly round its
 * curves; where paint meets glass or trim the vertices are doubled, so each keeps its own colour. The ends are closed.
 */
function loft(s: Shell, lite: boolean): THREE.BufferGeometry {
  const zs = stationsOf(s, lite);
  const sections = zs.map((z) => section(s, z, lite));
  const n = sections[0].points.length;
  const around = 2 * (n - 1);
  const point = (i: number, k: number): [number, number, number] => {
    const [x, y] = sections[i].points[k < n ? k : around - k];
    return [k < n ? x : -x, y, zs[i]];
  };
  const partOf = (k: number) => sections[0].parts[k < n - 1 ? k : around - 1 - k];
  // The whole skin once, for its normals.
  const skin: number[] = [];
  for (let i = 0; i < zs.length; i++) for (let k = 0; k < around; k++) skin.push(...point(i, k));
  const quads: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < zs.length; i++) for (let k = 0; k < around; k++) quads.push([i * around + k, i * around + ((k + 1) % around), (i + 1) * around + ((k + 1) % around), (i + 1) * around + k]);
  const whole = new THREE.BufferGeometry();
  whole.setAttribute("position", new THREE.Float32BufferAttribute(skin, 3));
  whole.setIndex(quads.flatMap(([a, b, c, d]) => [a, b, c, a, c, d]));
  whole.computeVertexNormals();
  const normals = whole.attributes.normal;

  const colours: Record<Finish, THREE.Color> = { [FINISH.trim]: new THREE.Color(TRIM), [FINISH.paint]: new THREE.Color(s.paint ?? PAINT), [FINISH.glass]: new THREE.Color(GLASS) };
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const fin: number[] = [];
  const index: number[] = [];
  const made = new Map<string, number>();
  const add = (p: [number, number, number], normal: [number, number, number], finish: Finish) => {
    pos.push(...p);
    nor.push(...normal);
    const c = colours[finish];
    col.push(c.r, c.g, c.b);
    fin.push(finish);
    return pos.length / 3 - 1;
  };
  const vertex = (v: number, finish: Finish) => {
    const key = `${v}:${finish}`;
    const known = made.get(key);
    if (known !== undefined) return known;
    const at = add([skin[v * 3], skin[v * 3 + 1], skin[v * 3 + 2]], [normals.getX(v), normals.getY(v), normals.getZ(v)], finish);
    made.set(key, at);
    return at;
  };
  quads.forEach(([a, b, c, d], q) => {
    const i = Math.floor(q / around);
    const finish = finishOf(s, (zs[i] + zs[i + 1]) / 2, partOf(q % around));
    const [va, vb, vc, vd] = [a, b, c, d].map((v) => vertex(v, finish));
    index.push(va, vb, vc, va, vc, vd);
  });
  // Close the nose and the tail, each a fan round its middle.
  for (const [i, dir] of [
    [0, -1],
    [zs.length - 1, 1],
  ] as const) {
    let sum = 0;
    for (let k = 0; k < around; k++) sum += point(i, k)[1];
    const middle = add([0, sum / around, zs[i]], [0, 0, dir], FINISH.paint);
    const rim = Array.from({ length: around }, (_, k) => add(point(i, k), [0, 0, dir], FINISH.paint));
    for (let k = 0; k < around; k++) {
      const [a, b] = [rim[k], rim[(k + 1) % around]];
      index.push(...(dir < 0 ? [middle, b, a] : [middle, a, b]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aFinish", new THREE.Float32BufferAttribute(fin, 1));
  g.setIndex(index);
  return g;
}

/* ------------------------------------------------------------------ */
/* Wheels                                                              */
/* ------------------------------------------------------------------ */

/**
 * A tyre on its side at `x`, open on the inside where the body hides it, and its outer face pale at the hub and dark
 * toward the rim. It is turned so that a vertex rests on the ground.
 */
function tyre(x: number, { z, r }: Wheel, width: number, segments: number): THREE.BufferGeometry[] {
  const out = Math.sign(x);
  // A vertex at the bottom of the circle rests on the ground, whatever the segment count.
  const phase = -Math.PI / 2;
  const tread = part(new THREE.CylinderGeometry(r, r, width, segments, 1, true, phase).rotateZ(Math.PI / 2).translate(x, r, z), TYRE, FINISH.trim);
  const face = part(new THREE.CircleGeometry(r, segments, phase).rotateY((out * Math.PI) / 2).translate(x + (out * width) / 2, r, z), TYRE, FINISH.trim);
  const hub = new THREE.Color(HUB);
  face.attributes.color.setXYZ(0, hub.r, hub.g, hub.b);
  return [tread, face];
}

/** A pair of wheels on an axle, just inside the body's sides, and the axle between them to close the arches. */
function axle(w: Wheel, half: number, width: number, segments: number): THREE.BufferGeometry[] {
  const x = half - width / 2 - 0.02;
  return [...tyre(-x, w, width, segments), ...tyre(x, w, width, segments), box(2 * x - width, w.r * 0.9, w.r * 1.3, 0, w.r * 0.95, w.z, TRIM, FINISH.trim)];
}

/* ------------------------------------------------------------------ */
/* The kinds                                                           */
/* ------------------------------------------------------------------ */

/** A four-door saloon, 4.5 m long. Taxis and robotaxis share it. */
const SALOON: Shell = {
  from: -2.25,
  to: 2.25,
  half: [[-2.25, 0.7], [-2.12, 0.82], [-1.9, 0.86], [1.9, 0.86], [2.13, 0.82], [2.25, 0.72]],
  bottom: [[-2.25, 0.34], [-2.08, 0.22], [2.08, 0.22], [2.25, 0.36]],
  belt: [[-2.25, 0.6], [-2.1, 0.72], [-1.6, 0.8], [-0.75, 0.88], [1.3, 0.92], [2.1, 0.9], [2.25, 0.8]],
  top: [[-2.25, 0.62], [-2.1, 0.75], [-1.6, 0.84], [-0.75, 0.92], [-0.05, 1.4], [0.85, 1.42], [1.55, 0.97], [2.1, 0.94], [2.25, 0.83]],
  inset: [[-2.25, 0.3], [-0.75, 0.3], [-0.05, 0.16], [0.85, 0.16], [1.55, 0.3], [2.25, 0.3]],
  screens: [[-0.75, -0.05], [0.85, 1.55]],
  windows: [[-0.05, 0.85]],
  arches: [{ z: -1.38, r: 0.32 }, { z: 1.38, r: 0.32 }],
};

/** A hatchback: shorter, with a steep tailgate under a roof that runs on to the back. */
const HATCH: Shell = {
  from: -1.975,
  to: 1.975,
  half: [[-1.975, 0.7], [-1.85, 0.8], [-1.6, 0.85], [1.75, 0.85], [1.975, 0.79]],
  bottom: [[-1.975, 0.34], [-1.82, 0.22], [1.85, 0.24], [1.975, 0.38]],
  belt: [[-1.975, 0.6], [-1.8, 0.72], [-1.3, 0.8], [-0.55, 0.88], [1.6, 0.95], [1.975, 0.92]],
  top: [[-1.975, 0.62], [-1.8, 0.75], [-1.3, 0.84], [-0.55, 0.92], [0.15, 1.44], [1.5, 1.43], [1.975, 1.02]],
  inset: [[-1.975, 0.3], [-0.55, 0.3], [0.15, 0.16], [1.5, 0.17], [1.975, 0.26]],
  screens: [[-0.55, 0.15], [1.5, 1.975]],
  windows: [[0.15, 1.5]],
  arches: [{ z: -1.25, r: 0.31 }, { z: 1.27, r: 0.31 }],
};

/** An SUV: higher off the ground, taller and squarer, on bigger wheels. */
const SUV: Shell = {
  from: -2.275,
  to: 2.275,
  half: [[-2.275, 0.74], [-2.15, 0.85], [-1.9, 0.88], [1.95, 0.88], [2.275, 0.83]],
  bottom: [[-2.275, 0.44], [-2.1, 0.32], [2.1, 0.32], [2.275, 0.44]],
  belt: [[-2.275, 0.78], [-2.1, 0.9], [-1.6, 0.98], [-0.7, 1.04], [2.1, 1.08], [2.275, 1.04]],
  top: [[-2.275, 0.8], [-2.1, 0.93], [-1.6, 1.02], [-0.7, 1.08], [-0.1, 1.68], [1.95, 1.7], [2.2, 1.6], [2.275, 1.46]],
  inset: [[-2.275, 0.3], [-0.7, 0.3], [-0.1, 0.15], [1.95, 0.15], [2.275, 0.2]],
  screens: [[-0.7, -0.1], [1.95, 2.275]],
  windows: [[-0.1, 1.95]],
  arches: [{ z: -1.42, r: 0.37 }, { z: 1.42, r: 0.37 }],
};

/** A panel van: a short bonnet, a steep windscreen and a tall box with windows only beside the driver. */
const VAN: Shell = {
  from: -2.25,
  to: 2.25,
  half: [[-2.25, 0.76], [-2.1, 0.85], [-1.8, 0.88], [2.15, 0.88], [2.25, 0.85]],
  bottom: [[-2.25, 0.38], [-2.1, 0.28], [2.15, 0.28], [2.25, 0.34]],
  belt: [[-2.25, 0.7], [-2.05, 0.85], [-1.55, 0.96], [2.25, 1.0]],
  top: [[-2.25, 0.72], [-2.05, 0.88], [-1.55, 1.0], [-0.8, 1.94], [2.15, 1.96], [2.25, 1.86]],
  inset: [[-2.25, 0.3], [-1.55, 0.26], [-0.8, 0.08], [2.25, 0.08]],
  screens: [[-1.55, -0.8]],
  windows: [[-0.8, -0.15]],
  arches: [{ z: -1.45, r: 0.34 }, { z: 1.5, r: 0.34 }],
};

/** A box truck's cab, its windscreen standing up over a short nose. */
const CAB: Shell = {
  from: -4.3,
  to: -1.95,
  half: [[-4.3, 1.02], [-4.15, 1.12], [-3.95, 1.15], [-1.95, 1.15]],
  bottom: [[-4.3, 0.62], [-1.95, 0.62]],
  belt: [[-4.3, 1.15], [-4.12, 1.32], [-3.8, 1.42], [-1.95, 1.45]],
  top: [[-4.3, 1.18], [-4.12, 1.36], [-3.8, 1.47], [-3.4, 2.55], [-1.95, 2.6]],
  inset: [[-4.3, 0.35], [-3.8, 0.3], [-3.4, 0.1], [-1.95, 0.1]],
  screens: [[-3.8, -3.4]],
  windows: [[-3.4, -2.7]],
  arches: [{ z: -3.25, r: 0.45 }],
  paint: "#d4d7de",
};

/** The truck's load box behind its cab, its top edges rounded. */
const LOAD: Shell = {
  from: -1.85,
  to: 4.3,
  half: [[-1.85, 1.17], [4.3, 1.17]],
  bottom: [[-1.85, 0.98], [4.3, 0.98]],
  belt: [[-1.85, 3.2], [4.3, 3.2]],
  top: [[-1.85, 3.3], [4.3, 3.3]],
  inset: [[-1.85, 0.04], [4.3, 0.04]],
  screens: [],
  windows: [],
  arches: [],
};

/** A city bus: a long, rounded box with a band of windows and a painted band above them. */
const BUS: Shell = {
  from: -4.45,
  to: 4.45,
  half: [[-4.45, 1.1], [-4.33, 1.17], [4.33, 1.17], [4.45, 1.12]],
  bottom: [[-4.45, 0.36], [4.45, 0.4]],
  belt: [[-4.45, 1.12], [-4.33, 1.18], [4.45, 1.2]],
  head: [[-4.45, 2.45], [4.45, 2.45]],
  top: [[-4.45, 2.72], [-4.33, 2.86], [4.33, 2.88], [4.45, 2.76]],
  inset: [[-4.45, 0.08], [4.45, 0.08]],
  screens: [],
  windows: [[-4.0, 4.1]],
  arches: [{ z: -2.95, r: 0.47 }, { z: 2.8, r: 0.47 }],
};

const CARS: Partial<Record<VehicleKind, Shell>> = { sedan: SALOON, taxi: SALOON, robotaxi: SALOON, hatch: HATCH, suv: SUV, van: VAN };

/** Each kind of vehicle facing -z, its wheels on the ground. A lite one leaves the wheels to the imagination. */
export function vehicleBody(kind: VehicleKind, lite = false): THREE.BufferGeometry {
  const car = CARS[kind];
  if (car) {
    const parts = [loft(car, lite)];
    if (!lite) for (const w of car.arches) parts.push(...axle(w, along(car.half, w.z), 0.22, 16));
    if (kind === "robotaxi") {
      // A spinning sensor on the roof and a camera pod on each wing.
      parts.push(part(lite ? new THREE.BoxGeometry(0.56, 0.26, 0.56).translate(0, 1.54, 0.4) : new THREE.CylinderGeometry(0.28, 0.33, 0.26, 16).translate(0, 1.54, 0.4), "#2b2d33", FINISH.trim));
      if (!lite) for (const x of [-0.8, 0.8]) parts.push(box(0.1, 0.16, 0.24, x, 0.91, -1.15, "#2b2d33", FINISH.trim));
    }
    return join(parts);
  }
  if (kind === "truck") {
    const parts = [loft(CAB, lite), loft(LOAD, lite), box(1.7, 0.4, 6.1, 0, 0.78, 1.2, TRIM, FINISH.trim)];
    if (!lite) for (const w of [{ z: -3.25, r: 0.45 }, { z: 2.35, r: 0.45 }, { z: 3.45, r: 0.45 }]) parts.push(...axle(w, 1.15, 0.3, 16));
    return join(parts);
  }
  // The bus, with its windscreen and rear window set in its ends.
  const parts = [loft(BUS, lite), box(2.0, 1.25, 0.04, 0, 1.75, -4.46, GLASS, FINISH.glass), box(1.8, 0.8, 0.04, 0, 2.0, 4.46, GLASS, FINISH.glass)];
  if (!lite) for (const w of BUS.arches) parts.push(...axle(w, 1.17, 0.3, 16));
  return join(parts);
}

/* ------------------------------------------------------------------ */
/* Lamps                                                               */
/* ------------------------------------------------------------------ */

/** A pair of lamps either side, `x` out from the middle, set into the nose or the tail at `z`. */
const pair = (x: number, y: number, z: number, w: number, h: number, colour: string) => [-x, x].map((side) => box(w, h, 0.05, side, y, z, colour, FINISH.trim));

/** Where each kind's head and tail lamps sit: its nose and tail, how far out and how high, and their size. */
const LAMPS: Record<VehicleKind, { nose: number; tail: number; head: [number, number, number, number]; rear: [number, number, number, number] }> = {
  sedan: { nose: -2.25, tail: 2.25, head: [0.5, 0.52, 0.34, 0.09], rear: [0.52, 0.7, 0.34, 0.1] },
  taxi: { nose: -2.25, tail: 2.25, head: [0.5, 0.52, 0.34, 0.09], rear: [0.52, 0.7, 0.34, 0.1] },
  robotaxi: { nose: -2.25, tail: 2.25, head: [0.5, 0.52, 0.34, 0.09], rear: [0.52, 0.7, 0.34, 0.1] },
  hatch: { nose: -1.975, tail: 1.975, head: [0.5, 0.52, 0.34, 0.09], rear: [0.6, 0.8, 0.22, 0.22] },
  suv: { nose: -2.275, tail: 2.275, head: [0.52, 0.7, 0.34, 0.09], rear: [0.62, 0.95, 0.3, 0.14] },
  van: { nose: -2.25, tail: 2.25, head: [0.52, 0.6, 0.34, 0.1], rear: [0.7, 0.95, 0.14, 0.3] },
  truck: { nose: -4.3, tail: 4.3, head: [0.72, 0.92, 0.34, 0.14], rear: [0.95, 1.15, 0.3, 0.14] },
  bus: { nose: -4.45, tail: 4.45, head: [0.82, 0.7, 0.32, 0.14], rear: [0.9, 0.9, 0.26, 0.3] },
};

/**
 * Head and tail lamps for each kind, the lit sign on a taxi's roof, the ring round a robotaxi's sensor, and a bus's
 * route sign, all lit day and night; and a bus's windows, finished as glass, which are dark by day and lit after dark.
 */
export function vehicleLights(kind: VehicleKind): THREE.BufferGeometry {
  const { nose, tail, head, rear } = LAMPS[kind];
  // Each stands 5 mm proud of the body, so the lamps never reach past the vehicle's own length.
  const parts = [...pair(head[0], head[1], nose + 0.02, head[2], head[3], "#fff4d6"), ...pair(rear[0], rear[1], tail - 0.02, rear[2], rear[3], "#ff2a3a")];
  if (kind === "taxi") parts.push(box(0.62, 0.2, 0.28, 0, 1.51, 0.4, "#fff1b0", FINISH.trim));
  if (kind === "robotaxi") parts.push(part(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 14).translate(0, 1.695, 0.4), "#5fe3d6", FINISH.trim));
  if (kind === "bus") parts.push(...[-1, 1].map((s) => box(0.02, 1.0, 7.8, s * 1.19, 1.82, 0.05, "#ffd99a", FINISH.glass)), box(1.4, 0.3, 0.05, 0, 2.6, -4.47, "#ffb347", FINISH.trim));
  return join(parts);
}
