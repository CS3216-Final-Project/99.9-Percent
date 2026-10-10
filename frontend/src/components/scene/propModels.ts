import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { V3 } from "./prims";

/*
 * Detailed machines for the office, modelled piece by piece: Mac all-in-ones
 * with their keyboards and mice, vending machines stocked with cans, bottles
 * and snacks, a water cooler, arcade cabinets, server-room cooling units, a
 * French-door fridge and an espresso machine. No free photo-scanned versions of
 * these exist, so each is built from many small parts with the materials real
 * ones are made of: painted and brushed metal, chrome, glass and lit panels.
 *
 * Each model is baked into one geometry per surface type, coloured through
 * vertex colours; props.tsx draws them instanced. Each faces +z with its
 * origin at the bottom centre.
 */

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/** How a part is shaded: painted, glossy, brushed metal, chrome, glass, or lit from within. */
export type Surface = "matte" | "gloss" | "metal" | "chrome" | "glass" | "glow";

interface Piece {
  g: THREE.BufferGeometry;
  c: string;
  surface: Surface;
  p: V3;
  r?: V3;
  s?: V3;
}

export interface Sign {
  text: string;
  /** Background and text colours. */
  bg: string;
  fg: string;
  p: V3;
  w: number;
  h: number;
  /** Tilt about x. */
  tilt?: number;
}

/** A model under construction: parts in its own frame, plus any lit signs with lettering. */
class Kit {
  readonly pieces: Piece[] = [];
  readonly signs: Sign[] = [];
  add(g: THREE.BufferGeometry, c: string, surface: Surface, p: V3, r?: V3, s?: V3): this {
    this.pieces.push({ g, c, surface, p, r, s });
    return this;
  }
  box(size: V3, c: string, surface: Surface, p: V3, r?: V3): this {
    return this.add(new THREE.BoxGeometry(...size), c, surface, p, r);
  }
  /** A box with rounded edges; the radius must be under half the smallest side. */
  round(size: V3, radius: number, c: string, surface: Surface, p: V3, r?: V3, segments = 3): this {
    return this.add(new RoundedBoxGeometry(size[0], size[1], size[2], segments, radius), c, surface, p, r);
  }
  cyl(radius: number, h: number, c: string, surface: Surface, p: V3, r?: V3, segments = 18, radiusBottom = radius): this {
    return this.add(new THREE.CylinderGeometry(radius, radiusBottom, h, segments), c, surface, p, r);
  }
  ball(radius: number, c: string, surface: Surface, p: V3, s?: V3): this {
    return this.add(new THREE.SphereGeometry(radius, 16, 12), c, surface, p, undefined, s);
  }
  ring(radius: number, tube: number, c: string, surface: Surface, p: V3, r?: V3, tubular = 20, radial = 6): this {
    return this.add(new THREE.TorusGeometry(radius, tube, radial, tubular), c, surface, p, r);
  }
  sign(sign: Sign): this {
    this.signs.push(sign);
    return this;
  }
}

const m4 = new THREE.Matrix4();
const qt = new THREE.Quaternion();
const eu = new THREE.Euler();

/** Bake a kit into one geometry per surface, each part coloured through a vertex colour attribute. */
export function bake(kit: Kit): Map<Surface, THREE.BufferGeometry> {
  const bySurface = new Map<Surface, THREE.BufferGeometry[]>();
  for (const { g, c, surface, p, r = [0, 0, 0], s = [1, 1, 1] } of kit.pieces) {
    // Some shapes come indexed and some not; merged geometries must agree, so all are made non-indexed.
    const out = g.index ? g.toNonIndexed() : g.clone();
    for (const name of Object.keys(out.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") out.deleteAttribute(name);
    out.clearGroups();
    m4.compose(new THREE.Vector3(...p), qt.setFromEuler(eu.set(r[0], r[1], r[2])), new THREE.Vector3(...s));
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
    bySurface.set(surface, [...(bySurface.get(surface) ?? []), out]);
    g.dispose();
  }
  const baked = new Map<Surface, THREE.BufferGeometry>();
  for (const [surface, list] of bySurface) {
    const merged = mergeGeometries(list, false);
    if (!merged) throw new Error(`Could not merge the ${surface} parts of a prop: they have different attributes.`);
    for (const g of list) g.dispose();
    merged.computeBoundingSphere();
    baked.set(surface, merged);
  }
  return baked;
}

/** Deterministic pseudo-random, so the stock in the machines is the same on every load. */
function rand(i: number): number {
  const x = Math.sin(i * 91.7 + 13.3) * 43758.5453;
  return x - Math.floor(x);
}

export function shade(c: string, k: number): string {
  return `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;
}

/* ------------------------------------------------------------------ */
/* Macs                                                                */
/* ------------------------------------------------------------------ */

/**
 * The all-in-one's display, in its own frame: the picture's size, the height
 * of its centre above the foot, and how far in front of the glass the picture
 * is drawn. The office draws the picture itself, so it lines up from these.
 */
export const MAC = { screenW: 0.6, screenH: 0.36, displayY: 0.28, gap: 0.002 } as const;

/** Back and front colours of the all-in-ones, after the 24-inch colours. */
export const MAC_COLOURS: Record<string, [string, string]> = {
  blue: ["#4f7cc7", "#c4d7f2"],
  green: ["#4b9e72", "#c9e8d4"],
  pink: ["#e48ca0", "#f7d3db"],
  silver: ["#c8cbd3", "#e6e8ed"],
  yellow: ["#e9c04f", "#f7e6b4"],
  orange: ["#ee8a4a", "#f9d5bd"],
  purple: ["#8e76cf", "#ddd4f4"],
};

export const MAC_COLOUR_NAMES = Object.keys(MAC_COLOURS);

function imac(variant: string): Kit {
  const [back, front] = MAC_COLOURS[variant] ?? MAC_COLOURS.silver;
  const k = new Kit();
  const bezel = 0.018;
  const chin = 0.062;
  const w = 0.636;
  const t = 0.012;
  const top = MAC.displayY + MAC.screenH / 2 + bezel;
  const bottom = MAC.displayY - MAC.screenH / 2 - bezel - chin;
  // A thin coloured body, its front face at z = 0.
  k.round([w, top - bottom, t], 0.0055, back, "metal", [0, (top + bottom) / 2, -t / 2]);
  // White glass bezel, a black border round the picture, and the coloured chin.
  k.box([w - 0.004, MAC.screenH + 2 * bezel - 0.002, 0.0012], "#f4f4f6", "gloss", [0, MAC.displayY, 0.0004]);
  k.box([MAC.screenW + 0.01, MAC.screenH + 0.01, 0.0012], "#0d0d12", "gloss", [0, MAC.displayY, 0.0008]);
  k.box([w - 0.004, chin - 0.003, 0.0012], front, "metal", [0, bottom + chin / 2, 0.0004]);
  // The camera sits flush behind the glass, a dark dot above the picture.
  k.cyl(0.0028, 0.0008, "#25252b", "gloss", [0, top - bezel / 2, 0.0012], [Math.PI / 2, 0, 0], 12);
  // A slim plate stand leaning back to a flat foot.
  k.box([0.15, 0.185, 0.007], back, "metal", [0, 0.092, -0.048], [0.31, 0, 0]);
  k.round([0.15, 0.005, 0.13], 0.0022, back, "metal", [0, 0.0025, -0.062]);
  // The power cable out of the back, down to the desk.
  k.cyl(0.003, 0.11, front, "matte", [0, 0.06, -0.016], [0.2, 0, 0], 6);
  return k;
}

function keyboard(variant: string): Kit {
  const [, front] = MAC_COLOURS[variant] ?? MAC_COLOURS.silver;
  const k = new Kit();
  k.round([0.278, 0.007, 0.114], 0.003, front, "metal", [0, 0.0035, 0], [0.035, 0, 0]);
  const key = "#fbfbfd";
  // Five rows of keys and a space bar row, slightly lower at the front.
  for (let r = 0; r < 5; r++) {
    const z = -0.043 + r * 0.0195;
    const y = 0.0085 - r * 0.0007;
    // The top row's last key is Touch ID, added below.
    for (let c = 0; c < (r === 0 ? 12 : 13); c++) k.box([0.0162, 0.0026, 0.0162], key, "matte", [-0.114 + c * 0.019, y, z]);
  }
  const z = -0.043 + 5 * 0.0195;
  k.box([0.105, 0.0026, 0.0162], key, "matte", [-0.004, 0.0048, z]);
  for (const x of [-0.114, -0.095, -0.076, 0.07, 0.089, 0.108]) k.box([0.0162, 0.0026, 0.0162], key, "matte", [x, 0.0048, z]);
  // Touch ID key, a dark glass square in the corner.
  k.box([0.0162, 0.0027, 0.0162], "#2a2a30", "gloss", [0.114, 0.0086, -0.043]);
  return k;
}

function mouse(variant: string): Kit {
  const [, front] = MAC_COLOURS[variant] ?? MAC_COLOURS.silver;
  const k = new Kit();
  k.add(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), "#f8f8fa", "gloss", [0, 0.003, 0], undefined, [0.028, 0.017, 0.055]);
  k.add(new THREE.CylinderGeometry(1, 1, 0.003, 24), front, "metal", [0, 0.0015, 0], undefined, [0.027, 1, 0.054]);
  return k;
}

/* ------------------------------------------------------------------ */
/* Vending machine                                                     */
/* ------------------------------------------------------------------ */

const STOCK = ["#ff4d5e", "#4cb8ff", "#3ddc84", "#ffc53d", "#ff9f43", "#a985ff", "#f4f1ea", "#2b2b3a", "#ff7ad9", "#2dd4bf"];

function vending(variant: string): Kit {
  const blue = variant === "blue";
  const body = blue ? "#2a86d1" : "#d93838";
  const trim = blue ? "#9fd6ff" : "#ffb0a8";
  const k = new Kit();
  const fz = 0.4;
  const door = 0.09;
  const face = fz + door;
  const winX = -0.11;
  const winW = 0.6;
  const winY = 1.12;
  const winH = 1.28;

  // Cabinet on a dark plinth, with a big decal panel down each side.
  k.box([0.84, 0.05, 0.76], "#1c1c22", "matte", [0, 0.025, 0]);
  k.round([0.9, 1.85, 0.8], 0.024, body, "metal", [0, 0.05 + 1.85 / 2, 0]);
  for (const side of [-1, 1]) {
    k.box([0.004, 1.3, 0.56], trim, "gloss", [side * 0.452, 1.05, -0.02]);
    k.box([0.005, 0.08, 0.56], "#ffffff", "gloss", [side * 0.452, 1.55, -0.02]);
  }
  // The door frame stands proud of the cabinet and frames the window.
  const bar = (size: V3, p: V3) => k.box(size, body, "metal", p);
  bar([0.025, winH + 0.02, door], [winX - winW / 2 - 0.0125, winY, fz + door / 2]);
  bar([0.025, winH + 0.02, door], [winX + winW / 2 + 0.0125, winY, fz + door / 2]);
  bar([0.65, 0.1, door], [winX, winY + winH / 2 + 0.05, fz + door / 2]);
  bar([0.65, 0.04, door], [winX, winY - winH / 2 - 0.02, fz + door / 2]);
  bar([0.22, 1.42, door], [0.325, 1.15, fz + door / 2]);
  bar([0.87, 0.39, door], [0, 0.245, fz + door / 2]);

  // Inside: a pale lit back wall, light strips, and five shelves of stock behind glass.
  k.box([winW, winH, 0.01], "#dfe4ee", "matte", [winX, winY, fz + 0.006]);
  k.box([winW - 0.02, 0.014, 0.02], "#ffffff", "glow", [winX, winY + winH / 2 - 0.012, face - 0.02]);
  for (const side of [-1, 1]) k.box([0.008, winH - 0.06, 0.01], "#eef5ff", "glow", [winX + side * (winW / 2 - 0.006), winY, face - 0.012]);
  for (let shelf = 0; shelf < 5; shelf++) {
    const y = 0.55 + shelf * 0.24;
    k.box([winW, 0.008, 0.066], "#c9ced8", "chrome", [winX, y, fz + 0.05]);
    k.box([winW, 0.022, 0.006], "#1e2230", "matte", [winX, y - 0.012, face - 0.011]);
    for (let slot = 0; slot < 6; slot++) {
      const x = winX - 0.25 + slot * 0.1;
      const z = fz + 0.05;
      const colour = STOCK[Math.floor(rand(shelf * 13 + slot * 7 + (blue ? 3 : 0)) * STOCK.length)];
      k.box([0.03, 0.01, 0.002], "#ffe680", "glow", [x, y - 0.012, face - 0.007]);
      // A spiral coil holds each item.
      k.ring(0.036, 0.0022, "#d9dde5", "chrome", [x, y + 0.04, face - 0.016], undefined, 12, 3);
      if (shelf >= 3) {
        // Snack bags with a stripe across.
        k.round([0.075, 0.13, 0.03], 0.01, colour, "gloss", [x, y + 0.072, z], undefined, 1);
        k.box([0.076, 0.022, 0.031], "#ffffff", "gloss", [x, y + 0.09, z]);
      } else if (shelf >= 1) {
        // Cans with a silver top.
        k.cyl(0.03, 0.115, colour, "gloss", [x, y + 0.062, z], undefined, 12);
        k.cyl(0.026, 0.006, "#d5d9e0", "chrome", [x, y + 0.122, z], undefined, 12);
        k.cyl(0.0305, 0.03, "#ffffff", "gloss", [x, y + 0.07, z], undefined, 12);
      } else {
        // Bottles: body, label, shoulder, neck and cap.
        k.cyl(0.028, 0.13, shade(colour, 1.1), "gloss", [x, y + 0.069, z], undefined, 12);
        k.cyl(0.0285, 0.045, "#ffffff", "gloss", [x, y + 0.07, z], undefined, 12);
        k.cyl(0.011, 0.04, shade(colour, 1.1), "gloss", [x, y + 0.154, z], undefined, 12, 0.028);
        k.cyl(0.013, 0.018, colour, "matte", [x, y + 0.183, z], undefined, 10);
      }
    }
  }
  k.box([winW, winH, 0.005], "#cfe8ff", "glass", [winX, winY, face - 0.004]);
  k.sign({ text: blue ? "COLD DRINKS" : "SNACK BAR", bg: blue ? "#0b3e73" : "#7a1010", fg: "#ffffff", p: [winX, winY + winH / 2 + 0.05, face + 0.002], w: 0.6, h: 0.085 });

  // The control column: display, keypad, card reader, coin slot, note acceptor and coin return.
  k.box([0.18, 0.86, 0.006], "#1b1d27", "gloss", [0.325, 1.32, face + 0.003]);
  k.box([0.156, 0.06, 0.003], "#0b0c10", "gloss", [0.325, 1.66, face + 0.007]);
  k.box([0.14, 0.044, 0.003], "#62ffb1", "glow", [0.325, 1.66, face + 0.009]);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) k.box([0.034, 0.026, 0.008], "#e9ecf2", "gloss", [0.325 + (c - 1) * 0.045, 1.55 - r * 0.036, face + 0.008]);
  k.box([0.1, 0.07, 0.02], "#2a2d38", "matte", [0.325, 1.37, face + 0.013]);
  k.box([0.02, 0.006, 0.002], "#3ddc84", "glow", [0.325, 1.39, face + 0.024]);
  k.box([0.05, 0.05, 0.012], "#cfd3db", "chrome", [0.325, 1.27, face + 0.009]);
  k.box([0.006, 0.03, 0.002], "#08080b", "matte", [0.325, 1.27, face + 0.016]);
  k.box([0.12, 0.05, 0.02], "#2a2d38", "matte", [0.325, 1.17, face + 0.013]);
  k.box([0.08, 0.006, 0.002], "#7cc7ff", "glow", [0.325, 1.17, face + 0.024]);
  k.cyl(0.014, 0.01, "#cfd3db", "chrome", [0.325, 1.07, face + 0.008], [Math.PI / 2, 0, 0]);
  k.box([0.18, 0.3, 0.004], trim, "gloss", [0.325, 0.71, face + 0.002]);

  // The pickup bay with its push flap, the coin return cup and a kick plate.
  k.box([0.56, 0.16, 0.006], "#0b0b10", "matte", [winX, 0.24, face + 0.003]);
  k.box([0.54, 0.14, 0.008], "#3a3d48", "metal", [winX, 0.25, face + 0.008], [0.12, 0, 0]);
  k.box([0.1, 0.07, 0.01], "#0b0b10", "matte", [0.325, 0.26, face + 0.005]);
  k.box([0.87, 0.04, 0.006], "#cfd3db", "chrome", [0, 0.09, face + 0.003]);
  return k;
}

/* ------------------------------------------------------------------ */
/* Water cooler                                                        */
/* ------------------------------------------------------------------ */

function cooler(): Kit {
  const k = new Kit();
  const flat: V3 = [Math.PI / 2, 0, 0];
  k.round([0.32, 0.92, 0.32], 0.02, "#f1f1f4", "gloss", [0, 0.46, 0]);
  k.round([0.33, 0.05, 0.33], 0.02, "#e9e9ee", "gloss", [0, 0.945, 0]);
  // The dispensing niche: dark back, hot and cold taps, and a chrome drip tray.
  k.box([0.2, 0.22, 0.01], "#2b2e3a", "gloss", [0, 0.73, 0.162]);
  for (const [x, c] of [
    [-0.05, "#e84a4a"],
    [0.05, "#3b82f6"],
  ] as const) {
    k.box([0.034, 0.04, 0.03], c, "gloss", [x, 0.8, 0.178]);
    k.cyl(0.006, 0.022, "#d5d9e0", "chrome", [x, 0.772, 0.185]);
    k.box([0.012, 0.03, 0.01], "#f6f6f8", "gloss", [x, 0.832, 0.19]);
  }
  k.box([0.21, 0.025, 0.08], "#cfd3dc", "metal", [0, 0.625, 0.195]);
  for (let i = 0; i < 6; i++) k.box([0.19, 0.003, 0.004], "#2b2e3a", "matte", [0, 0.639, 0.165 + i * 0.012]);
  k.box([0.02, 0.006, 0.002], "#4cb8ff", "glow", [0, 0.87, 0.162]);
  // A tinted five-gallon bottle, upside down, two-thirds full of water.
  k.cyl(0.035, 0.06, "#bfe3ff", "glass", [0, 0.99, 0]);
  k.cyl(0.13, 0.08, "#bfe3ff", "glass", [0, 1.06, 0], undefined, 24, 0.04);
  k.cyl(0.13, 0.3, "#bfe3ff", "glass", [0, 1.25, 0], undefined, 24);
  k.cyl(0.125, 0.02, "#bfe3ff", "glass", [0, 1.41, 0], undefined, 24);
  for (const y of [1.17, 1.25, 1.33]) k.ring(0.131, 0.004, "#cdeaff", "glass", [0, y, 0], flat);
  k.cyl(0.122, 0.2, "#5aaef5", "glass", [0, 1.19, 0], undefined, 24);
  k.cyl(0.122, 0.07, "#5aaef5", "glass", [0, 1.065, 0], undefined, 24, 0.045);
  // A cup dispenser on the side.
  k.cyl(0.04, 0.22, "#d8dbe2", "metal", [0.2, 0.76, 0.05]);
  k.cyl(0.037, 0.05, "#ffffff", "matte", [0.2, 0.625, 0.05], undefined, 18, 0.03);
  return k;
}

/* ------------------------------------------------------------------ */
/* Arcade cabinet                                                      */
/* ------------------------------------------------------------------ */

/** Where the arcade screen sits in the cabinet's frame: its centre, its tilt back, and its size. */
export const ARCADE_SCREEN = { y: 1.25, z: 0.42, tilt: -0.2, w: 0.54, h: 0.44 } as const;

function arcade(variant: string): Kit {
  const purple = variant === "purple";
  const body = purple ? "#7d5bd6" : "#d93a4a";
  const art = purple ? "#ffd84a" : "#4cb8ff";
  const k = new Kit();
  // Side panels with the classic profile: kick plate, control panel lip, screen and marquee.
  const profile = new THREE.Shape();
  const outline: [number, number][] = [
    [-0.375, 0],
    [0.36, 0],
    [0.36, 0.78],
    [0.5, 0.86],
    [0.5, 0.95],
    [0.49, 1.0],
    [0.4, 1.5],
    [0.45, 1.52],
    [0.45, 1.74],
    [0.36, 1.8],
    [-0.375, 1.8],
  ];
  outline.forEach(([z, y], i) => (i === 0 ? profile.moveTo(z, y) : profile.lineTo(z, y)));
  profile.closePath();
  for (const side of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(profile, { depth: 0.02, bevelEnabled: false });
    // The shape is drawn in (z, y); turn it so it extrudes across x.
    // After the turn the extrusion runs toward -x, so each panel is placed by its outer face.
    k.add(g, body, "metal", [side * 0.35 + 0.01, 0, 0], [0, -Math.PI / 2, 0]);
    // A bold diagonal stripe of side art.
    k.box([0.004, 0.12, 0.9], art, "gloss", [side * 0.362, 0.9, 0], [0.5, 0, 0]);
  }
  // Body between the sides, the coin door and the kick plate.
  k.box([0.68, 1.8, 0.6], body, "metal", [0, 0.9, -0.075]);
  k.box([0.68, 0.78, 0.135], body, "metal", [0, 0.39, 0.2925]);
  k.box([0.3, 0.3, 0.01], "#22232b", "metal", [0, 0.45, 0.365]);
  for (const [x, c] of [
    [-0.07, "#ff4d5e"],
    [0.07, "#ff9f43"],
  ] as const) k.box([0.03, 0.05, 0.004], c, "glow", [x, 0.5, 0.372]);
  k.box([0.68, 0.08, 0.01], "#cfd3db", "chrome", [0, 0.05, 0.365]);
  // The control panel slopes toward the player, with two joysticks, six buttons each and start buttons.
  const tilt = 0.25;
  const panel = { y: 0.91, z: 0.43 };
  k.box([0.68, 0.05, 0.22], "#1d1e26", "matte", [0, panel.y, panel.z], [tilt, 0, 0]);
  const on = (x: number, dz: number, lift: number): V3 => [x, panel.y + 0.025 * Math.cos(tilt) - dz * Math.sin(tilt) + lift * Math.cos(tilt), panel.z + 0.025 * Math.sin(tilt) + dz * Math.cos(tilt) + lift * Math.sin(tilt)];
  for (const side of [-1, 1]) {
    const x0 = side * 0.17;
    k.cyl(0.006, 0.05, "#111", "matte", on(x0 - 0.06, 0, 0.025), [tilt, 0, 0], 8);
    k.ball(0.02, "#ff3b3b", "gloss", on(x0 - 0.06, 0, 0.055));
    ["#ffd84a", "#4cb8ff", "#3ddc84", "#ff7ad9", "#ff9f43", "#f4f1ea"].forEach((c, i) => {
      k.cyl(0.013, 0.012, c, "gloss", on(x0 + 0.02 + (i % 3) * 0.035, i < 3 ? -0.02 : 0.025, 0.006), [tilt, 0, 0], 14);
    });
  }
  for (const x of [-0.03, 0.03]) k.cyl(0.009, 0.008, "#ffffff", "glow", on(x, -0.07, 0.004), [tilt, 0, 0], 12);
  // The screen sits deep in a glossy black bezel; the office draws the picture.
  const s = ARCADE_SCREEN;
  const normal = new THREE.Vector3(0, -Math.sin(s.tilt), Math.cos(s.tilt));
  const along = (d: number): V3 => [0, s.y + normal.y * d, s.z + normal.z * d];
  k.box([0.62, 0.52, 0.02], "#0b0b10", "gloss", along(-0.012), [s.tilt, 0, 0]);
  // Speaker grille and the lit marquee.
  k.box([0.6, 0.05, 0.01], "#1a1a22", "matte", [0, 1.505, 0.41]);
  for (let i = 0; i < 9; i++) k.cyl(0.006, 0.004, "#444", "matte", [-0.2 + i * 0.05, 1.505, 0.416], [Math.PI / 2, 0, 0], 8);
  k.box([0.64, 0.2, 0.04], "#ffffff", "glow", [0, 1.63, 0.43]);
  k.sign({ text: purple ? "PIXEL RUSH" : "BYTE BLASTER", bg: purple ? "#2a145c" : "#5c0f1a", fg: "#ffe680", p: [0, 1.63, 0.452], w: 0.6, h: 0.17 });
  for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) k.cyl(0.025, 0.02, "#111", "matte", [x, 0.01, z], undefined, 10);
  return k;
}

/* ------------------------------------------------------------------ */
/* Server-room cooling unit                                            */
/* ------------------------------------------------------------------ */

function crac(): Kit {
  const k = new Kit();
  const shell = "#d6d3e8";
  const door = "#cbc7e2";
  k.box([1.36, 0.04, 0.86], "#2a2840", "matte", [0, 0.02, 0]);
  k.round([1.4, 1.96, 0.9], 0.015, shell, "metal", [0, 1.0, 0]);
  for (const side of [-1, 1]) {
    // Two doors, louvred across the lower two thirds, with chrome handles by the seam.
    k.box([0.68, 1.9, 0.012], door, "metal", [side * 0.348, 1.0, 0.456]);
    for (let i = 0; i < 19; i++) k.box([0.6, 0.012, 0.03], "#8a86b5", "metal", [side * 0.348, 0.14 + i * 0.058, 0.468], [0.6, 0, 0]);
    k.box([0.02, 0.18, 0.02], "#e2e5ec", "chrome", [side * 0.05, 1.3, 0.472]);
  }
  // The controller: a lit display, status lights and buttons.
  k.box([0.3, 0.2, 0.01], "#1c1b2e", "gloss", [-0.35, 1.62, 0.467]);
  k.box([0.22, 0.09, 0.004], "#5ee7ff", "glow", [-0.35, 1.65, 0.473]);
  ["#3ddc84", "#3ddc84", "#ffc53d"].forEach((c, i) => k.box([0.014, 0.014, 0.004], c, "glow", [-0.44 + i * 0.03, 1.56, 0.473]));
  for (let i = 0; i < 4; i++) k.box([0.03, 0.02, 0.008], "#9a97b8", "gloss", [-0.3 + i * 0.04, 1.555, 0.474]);
  k.box([0.3, 0.06, 0.004], "#5d5399", "gloss", [0.35, 1.7, 0.464]);
  k.box([1.3, 0.01, 0.8], "#3a3854", "matte", [0, 1.985, 0]);
  return k;
}

/* ------------------------------------------------------------------ */
/* Kitchen appliances                                                  */
/* ------------------------------------------------------------------ */

function fridge(): Kit {
  const k = new Kit();
  const steel = "#d4d7de";
  k.round([0.9, 1.85, 0.7], 0.02, "#c4c7cf", "metal", [0, 0.925, -0.025]);
  // French doors over a freezer drawer, in brushed steel.
  for (const side of [-1, 1]) k.round([0.445, 1.14, 0.05], 0.012, steel, "metal", [side * 0.2275, 1.255, 0.35]);
  k.round([0.9, 0.6, 0.05], 0.012, steel, "metal", [0, 0.37, 0.35]);
  // Long bar handles on standoffs.
  for (const side of [-1, 1]) {
    k.round([0.018, 0.8, 0.024], 0.008, "#e8eaef", "chrome", [side * 0.04, 1.25, 0.405]);
    for (const y of [0.88, 1.62]) k.box([0.012, 0.012, 0.03], "#e8eaef", "chrome", [side * 0.04, y, 0.383]);
  }
  k.round([0.7, 0.018, 0.024], 0.008, "#e8eaef", "chrome", [0, 0.62, 0.405]);
  for (const x of [-0.33, 0.33]) k.box([0.012, 0.012, 0.03], "#e8eaef", "chrome", [x, 0.62, 0.383]);
  // Water and ice dispenser on the left door.
  k.box([0.2, 0.32, 0.008], "#20222a", "gloss", [-0.2275, 1.18, 0.3765]);
  k.box([0.12, 0.03, 0.003], "#bfe6ff", "glow", [-0.2275, 1.31, 0.381]);
  k.box([0.06, 0.12, 0.012], "#3a3d47", "metal", [-0.2275, 1.15, 0.385]);
  k.box([0.16, 0.01, 0.04], "#cfd3db", "chrome", [-0.2275, 1.035, 0.39]);
  k.box([0.86, 0.06, 0.02], "#2a2c33", "matte", [0, 0.035, 0.31]);
  k.box([0.08, 0.015, 0.003], "#e8eaef", "chrome", [0, 1.79, 0.3765]);
  return k;
}

function espresso(): Kit {
  const k = new Kit();
  const steel = "#c7cad1";
  for (const x of [-0.15, 0.15]) for (const z of [-0.15, 0.15]) k.cyl(0.015, 0.02, "#1d1d22", "matte", [x, 0.01, z], undefined, 10);
  k.round([0.38, 0.36, 0.38], 0.02, steel, "metal", [0, 0.2, 0]);
  // Cup warmer rail and cups on top.
  for (const z of [-0.17, 0.17]) k.box([0.36, 0.015, 0.012], "#e2e5ec", "chrome", [0, 0.395, z]);
  for (const x of [-0.17, 0.17]) k.box([0.012, 0.015, 0.36], "#e2e5ec", "chrome", [x, 0.395, 0]);
  for (const x of [-0.06, 0.06]) k.cyl(0.03, 0.05, "#fafafa", "gloss", [x, 0.405, 0.02], undefined, 14, 0.024);
  // Front: dark panel, gauge, buttons, two group heads with portafilters, a steam wand and a drip tray.
  k.box([0.3, 0.14, 0.01], "#2b2d36", "gloss", [0, 0.28, 0.195]);
  k.cyl(0.026, 0.008, "#e2e5ec", "chrome", [0, 0.31, 0.2], [Math.PI / 2, 0, 0]);
  k.cyl(0.021, 0.004, "#fdfdfd", "gloss", [0, 0.31, 0.205], [Math.PI / 2, 0, 0]);
  for (const x of [-0.1, -0.075, 0.075, 0.1]) k.cyl(0.008, 0.006, "#9fe7ff", "glow", [x, 0.31, 0.202], [Math.PI / 2, 0, 0], 10);
  for (const x of [-0.08, 0.08]) {
    k.cyl(0.035, 0.04, "#e2e5ec", "chrome", [x, 0.205, 0.22]);
    k.cyl(0.031, 0.024, "#e2e5ec", "chrome", [x, 0.175, 0.22]);
    k.box([0.022, 0.022, 0.12], "#15151a", "matte", [x, 0.172, 0.3], [-0.12, 0, 0]);
  }
  k.cyl(0.005, 0.16, "#e2e5ec", "chrome", [0.17, 0.2, 0.21], [0.3, 0, 0.2], 8);
  k.box([0.34, 0.025, 0.12], "#d5d8df", "chrome", [0, 0.035, 0.24]);
  for (let i = 0; i < 5; i++) k.box([0.32, 0.003, 0.004], "#2b2d36", "matte", [0, 0.049, 0.195 + i * 0.022]);
  // A mug catching a shot.
  k.cyl(0.035, 0.07, "#fafafa", "gloss", [0.08, 0.087, 0.24], undefined, 16);
  k.ring(0.018, 0.005, "#fafafa", "gloss", [0.118, 0.09, 0.24], [0, 0, Math.PI / 2]);
  return k;
}

/* ------------------------------------------------------------------ */
/* Kinds                                                               */
/* ------------------------------------------------------------------ */

export type PropKind = "imac" | "keyboard" | "mouse" | "vending" | "cooler" | "arcade" | "crac" | "fridge" | "espresso";

const BUILDERS: Record<PropKind, (variant: string) => Kit> = { imac, keyboard, mouse, vending, cooler: () => cooler(), arcade, crac: () => crac(), fridge: () => fridge(), espresso: () => espresso() };

export interface PropItem {
  kind: PropKind;
  /** A colour or style, where the kind has several. */
  variant?: string;
  /** Bottom centre. */
  p: V3;
  /** Turn about the vertical. */
  rot?: number;
  s?: number;
}

export interface Built {
  geometries: Map<Surface, THREE.BufferGeometry>;
  signs: Sign[];
}

const built = new Map<string, Built>();

/** Build a kind of prop once and keep it. */
export function buildProp(kind: PropKind, variant = ""): Built {
  const key = `${kind}:${variant}`;
  let b = built.get(key);
  if (!b) {
    const kit = BUILDERS[kind](variant);
    b = { geometries: bake(kit), signs: kit.signs };
    built.set(key, b);
  }
  return b;
}
