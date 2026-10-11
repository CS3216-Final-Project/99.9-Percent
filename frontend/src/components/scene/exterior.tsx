"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  beacons,
  blocks,
  BUILDING,
  buildings,
  CARRIAGEWAY,
  crossings,
  FADE,
  fadeAt,
  GROUND_Y,
  HAZE,
  LANE,
  LANES,
  lamps,
  NIGHT,
  PARAPET,
  parkBlock,
  parkPaths,
  PODIUM,
  REACH,
  roadRect,
  ROADS,
  roofPlant,
  SLAB,
  STOREY,
  STREET,
  TOWER,
  traffic,
  trees,
  vehicleAt,
  type Building,
  type Plant,
  type Road,
  type Vehicle,
} from "./city";
import { useDetail } from "./detail";
import { logoSign } from "./textures";

/*
 * Draws downtown round the office tower (see city.ts) at night. Everything
 * outside is unlit: shading is baked into vertex colours under a moon from
 * the north-west, and windows, lamps and headlights are simply bright, so the
 * office's own lights do not turn the night into day. Facades are drawn by a
 * shader that lays out each building's windows, floor by floor, and lights a
 * share of the offices behind them. Every material fades to the night sky with
 * distance from the office, and into a haze with depth below it. Things that
 * repeat are instanced or merged; the whole city costs a few dozen draw calls.
 */

/* ------------------------------------------------------------------ */
/* Materials that fade into the night                                  */
/* ------------------------------------------------------------------ */

const fade = {
  uFade: { value: new THREE.Vector4(FADE.x, FADE.z, FADE.from, FADE.to) },
  uHaze: { value: new THREE.Vector2(HAZE.depth, HAZE.most) },
  uNight: { value: new THREE.Color(NIGHT) },
};

/** The night colour as the shader needs it: linear when effects render off-screen first, display colour otherwise. */
function setNight(linear: boolean): void {
  fade.uNight.value.set(NIGHT);
  if (!linear) fade.uNight.value.convertLinearToSRGB();
}

type Shader = THREE.WebGLProgramParametersWithUniforms;

/** Fade a material into the night with distance and depth; `more` adds to its shader first. */
function faded<P extends THREE.MeshBasicMaterialParameters>(params: P, key = "city-fade", more?: (shader: Shader) => void): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial(params);
  m.onBeforeCompile = (shader) => {
    more?.(shader);
    shader.uniforms.uFade = fade.uFade;
    shader.uniforms.uHaze = fade.uHaze;
    shader.uniforms.uNight = fade.uNight;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vFadeWorld;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 fadeWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fadeWorld = instanceMatrix * fadeWorld;
      #endif
      vFadeWorld = (modelMatrix * fadeWorld).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFadeWorld;\nuniform vec4 uFade;\nuniform vec2 uHaze;\nuniform vec3 uNight;")
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
      float far = smoothstep(uFade.z, uFade.w, distance(vFadeWorld.xz, uFade.xy));
      float deep = uHaze.y * smoothstep(0.0, uHaze.x, -vFadeWorld.y);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uNight, 1.0 - (1.0 - far) * (1.0 - deep));`,
      );
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** Shared materials: plain vertex colours, tinted per instance where needed, and the bright ones that glow. */
const M = {
  shaded: faded({ vertexColors: true }),
  glow: faded({ vertexColors: true, toneMapped: false }),
  white: faded({ color: "#a9a6a0" }),
  yellow: faded({ color: "#a8892e" }),
};

/* ------------------------------------------------------------------ */
/* Facades                                                             */
/* ------------------------------------------------------------------ */

const STYLE = { glass: 0, ribbon: 1, stone: 2 } as const;

/** Office lights: warm, cool and the shops at street level. */
const LIGHTS = { warm: new THREE.Color("#ffd49a"), cool: new THREE.Color("#d6e6ff"), shop: new THREE.Color("#fff0cf") };

/**
 * Each facade knows, per vertex, its wall colour (frames, spandrels or stone), its glass, where it is on the wall in
 * metres, and the building's seed, style, share of lit offices and whether it reaches the street. The shader cuts the
 * wall into bays and storeys, opens a window in each, and lights runs of windows as offices with the lights on.
 */
const FACADE_GLSL = `
varying vec2 vWall;
varying vec4 vLook;
varying vec3 vGlass;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform vec3 uShop;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float band(float f, float a, float b, float e) {
  return smoothstep(a - e, a + e, f) - smoothstep(b - e, b + e, f);
}

vec3 facade(vec3 wall) {
  float seed = vLook.x;
  float style = vLook.y;
  float share = vLook.z;
  float bay = style < 0.5 ? 1.5 : (style < 1.5 ? 3.0 : 2.2);
  vec2 g = vec2(vWall.x / bay, vWall.y / ${STOREY.toFixed(1)});
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 e = fwidth(g) * 0.75 + 1e-4;
  bool street = cell.y < 0.5 && vLook.w > 0.5;
  // The opening in each bay: left, right, sill and head, as fractions of the bay and the storey.
  vec4 frame = style < 0.5 ? vec4(0.05, 0.95, 0.21, 0.97) : (style < 1.5 ? vec4(0.02, 0.98, 0.34, 0.9) : vec4(0.24, 0.76, 0.26, 0.8));
  if (street) frame = vec4(0.04, 0.96, 0.04, 0.82);
  float open = band(f.x, frame.x, frame.y, e.x) * band(f.y, frame.z, frame.w, e.y);
  // An office is a run of bays on one floor sharing its lights. Some floors have gone home, some are working late.
  float run = 2.0 + floor(hash12(vec2(cell.y, seed)) * 5.0);
  float office = floor(cell.x / run);
  float busy = share * (0.25 + 1.5 * hash12(vec2(cell.y * 0.71, seed + 3.0)));
  float on = step(hash12(vec2(office * 1.37 + seed, cell.y * 2.11 + seed * 0.7)), street ? 0.75 : busy);
  float tone = hash12(vec2(office + 19.0, cell.y + seed));
  vec3 light = street ? uShop : (tone > 0.72 ? uCool : uWarm);
  light *= 0.5 + 0.5 * hash12(vec2(office + 7.0, cell.y * 3.0 + seed));
  // Brightest under the ceiling lights; here and there a blind is drawn part way down.
  light *= mix(0.72, 1.0, smoothstep(frame.z, frame.w, f.y));
  float blind = step(0.72, hash12(vec2(cell.x + seed, cell.y + 5.0)));
  float drop = mix(frame.z + 0.25, frame.w, hash12(vec2(cell.x, cell.y + seed)));
  light *= mix(1.0, 0.35, blind * step(drop, f.y));
  // Dark glass catches a little of the city's glow, more toward the top of each pane.
  vec3 dark = vGlass * (0.75 + 0.5 * hash12(cell + seed * 0.37)) * (0.8 + 0.4 * f.y);
  vec3 colour = mix(wall, mix(dark, light, on), open);
  // Far off, the windows are finer than a pixel: show their average instead of a shimmer.
  float coverage = (frame.y - frame.x) * (frame.w - frame.z);
  vec3 average = mix(wall, mix(vGlass, uWarm * 0.6, share), coverage);
  return mix(colour, average, smoothstep(0.3, 0.7, max(fwidth(g.x), fwidth(g.y))));
}
`;

function facadeMaterial(): THREE.MeshBasicMaterial {
  return faded({ vertexColors: true }, "city-facade", (shader) => {
    shader.uniforms.uWarm = { value: LIGHTS.warm };
    shader.uniforms.uCool = { value: LIGHTS.cool };
    shader.uniforms.uShop = { value: LIGHTS.shop };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aWall;\nattribute vec4 aLook;\nattribute vec3 aGlass;\nvarying vec2 vWall;\nvarying vec4 vLook;\nvarying vec3 vGlass;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWall = aWall;\nvLook = aLook;\nvGlass = aGlass;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FACADE_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = facade(diffuseColor.rgb);");
  });
}

const MOON = new THREE.Vector3(-0.45, 1, -0.3).normalize();

/** Moonlight on a wall facing (nx, nz). */
const moonlit = (nx: number, nz: number, ambient = 0.55) => ambient + (1 - ambient) * Math.max(0, nx * MOON.x + nz * MOON.z);

/** The walls of every box of every building, as one mesh for the facade shader. */
function facades(list: Building[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const wall: number[] = [];
  const glass: number[] = [];
  const at: number[] = [];
  const look: number[] = [];
  const index: number[] = [];
  const w = new THREE.Color();
  const g = new THREE.Color();
  for (const b of list) {
    w.set(b.wall);
    g.set(b.glass);
    for (const m of b.masses) {
      const [x0, z0, x1, z1] = m.rect;
      // Each wall from its left end to its right as seen from outside, and the way it faces.
      const sides: [number, number, number, number, number, number][] = [
        [x0, z1, x1, z1, 0, 1],
        [x1, z0, x0, z0, 0, -1],
        [x1, z1, x1, z0, 1, 0],
        [x0, z0, x0, z1, -1, 0],
      ];
      for (const [ax, az, bx, bz, nx, nz] of sides) {
        const len = Math.hypot(bx - ax, bz - az);
        const k = moonlit(nx, nz);
        const first = pos.length / 3;
        for (const [x, y, z, u] of [
          [ax, m.y0, az, 0],
          [bx, m.y0, bz, len],
          [bx, m.y1, bz, len],
          [ax, m.y1, az, 0],
        ]) {
          pos.push(x, y, z);
          wall.push(w.r * k, w.g * k, w.b * k);
          glass.push(g.r * k, g.g * k, g.b * k);
          at.push(u, y - GROUND_Y);
          look.push(b.seed % 997, STYLE[b.facade], b.lit, m.y0 === GROUND_Y ? 1 : 0);
        }
        index.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(wall, 3));
  geo.setAttribute("aGlass", new THREE.Float32BufferAttribute(glass, 3));
  geo.setAttribute("aWall", new THREE.Float32BufferAttribute(at, 2));
  geo.setAttribute("aLook", new THREE.Float32BufferAttribute(look, 4));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

/** Paint a geometry one colour, darker on the sides away from the moon. */
function tint(g: THREE.BufferGeometry, colour: string, ambient = 0.5): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.computeVertexNormals();
  const n = geo.attributes.normal;
  const c = new THREE.Color(colour);
  const cols = new Float32Array(n.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    const k = ambient + (1 - ambient) * Math.max(0, v.dot(MOON));
    cols.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  geo.deleteAttribute("uv");
  return geo;
}

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const merge = (parts: THREE.BufferGeometry[]) => mergeGeometries(parts) as THREE.BufferGeometry;

/** A flat quad lying on the ground, centred at the origin. */
const flat = (w: number, d: number) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);

/** A car facing -z, its wheels on the ground. A lite car, for drawing without a GPU, leaves the wheels to the imagination. */
function carBody(lite = false): THREE.BufferGeometry {
  const wheel = (x: number, z: number) => new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10).rotateZ(Math.PI / 2).translate(x, 0.34, z);
  return merge([
    tint(box(1.8, 0.7, 4.4, 0, 0.62, 0), "#ffffff", 0.55),
    tint(box(1.6, 0.55, 2.3, 0, 1.24, 0.3), "#8d93a3", 0.6),
    ...(lite ? [] : [-0.82, 0.82].flatMap((x) => [-1.35, 1.4].map((z) => tint(wheel(x, z), "#18171c")))),
  ]);
}

/** Headlights at the front, tail lights at the back. */
function carLights(length = 4.4, height = 0.72, width = 1.8): THREE.BufferGeometry {
  const lamp = (x: number, z: number, colour: string) => tint(box(0.36, 0.14, 0.06, x, height, z), colour, 1);
  return merge([lamp(-width / 2 + 0.3, -length / 2 - 0.02, "#fff4d6"), lamp(width / 2 - 0.3, -length / 2 - 0.02, "#fff4d6"), lamp(-width / 2 + 0.3, length / 2 + 0.02, "#ff2a3a"), lamp(width / 2 - 0.3, length / 2 + 0.02, "#ff2a3a")]);
}

/** A box truck facing -z. */
function truckBody(): THREE.BufferGeometry {
  const wheel = (x: number, z: number) => new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10).rotateZ(Math.PI / 2).translate(x, 0.45, z);
  return merge([
    tint(box(2.4, 2.6, 6.2, 0, 2.05, 1.2), "#ffffff", 0.55),
    tint(box(2.3, 1.9, 2.2, 0, 1.4, -3.1), "#c9ccd6", 0.55),
    tint(box(2.1, 0.7, 0.1, 0, 1.85, -4.2), "#2b3140", 0.7),
    ...[-1.05, 1.05].flatMap((x) => [-3.0, 0.4, 3.4].map((z) => tint(wheel(x, z), "#18171c"))),
  ]);
}

function treeTrunk(): THREE.BufferGeometry {
  return tint(new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0), "#4a3a2e", 0.55);
}

/** A unit-scale canopy: a few lumps of leaves, coarser when lite. */
function treeCanopy(lite = false): THREE.BufferGeometry {
  const detail = lite ? 0 : 1;
  return merge([
    tint(new THREE.IcosahedronGeometry(1.0, detail), "#26432f", 0.45),
    tint(new THREE.IcosahedronGeometry(0.75, detail).translate(0.7, 0.25, 0.3), "#2b4a33", 0.45),
    tint(new THREE.IcosahedronGeometry(0.7, detail).translate(-0.6, 0.15, -0.4), "#223d2b", 0.45),
  ]);
}

/** A street lamp's pole and arm, the head reaching out along -z. */
function lampPost(): THREE.BufferGeometry {
  return merge([tint(new THREE.CylinderGeometry(0.07, 0.11, 7, 6).translate(0, 3.5, 0), "#4e4c5c"), tint(box(0.08, 0.08, 1.6, 0, 6.95, -0.8), "#4e4c5c")]);
}

function lampHead(): THREE.BufferGeometry {
  return tint(box(0.32, 0.12, 0.62, 0, 6.88, -1.45), "#ffe2a8", 1);
}

/* ------------------------------------------------------------------ */
/* Instancing                                                          */
/* ------------------------------------------------------------------ */

const compose = (x: number, y: number, z: number, yaw = 0, s: THREE.Vector3Tuple = [1, 1, 1]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(...s));

function Instances({ geometry, material, matrices }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, material, matrices.length]} frustumCulled={false} />;
}

/** A mesh of merged geometry, disposed of with the component. */
function Merged({ geometry, material }: { geometry: THREE.BufferGeometry; material: THREE.Material }) {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

/** A soft pool of lamplight on the ground. */
function poolTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,214,150,0.5)");
  grad.addColorStop(0.5, "rgba(255,200,130,0.16)");
  grad.addColorStop(1, "rgba(255,200,130,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* The ground: pavements, roads, the plaza and the park                */
/* ------------------------------------------------------------------ */

const LAYER = { ground: GROUND_Y, block: GROUND_Y + 0.005, tarmac: GROUND_Y + 0.01, paint: GROUND_Y + 0.02, glow: GROUND_Y + 0.03 };

/** A strip on a road: `along` it, `across` from its centre line, so long and so wide. */
function onRoad(r: Road, along: number, across: number, length: number, width: number, y: number): THREE.BufferGeometry {
  return r.axis === "x" ? flat(length, width).translate(along, y, r.at + across) : flat(width, length).translate(r.at + across, y, along);
}

/** Where a road meets the next crossing: the stretches of it between junctions, kerb to kerb. */
function between(r: Road): [number, number][] {
  const c = crossings(r);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < c.length; k++) out.push([c[k] + CARRIAGEWAY / 2, c[k + 1] - CARRIAGEWAY / 2]);
  return out;
}

const roadPoint = (r: Road, along: number): [number, number] => (r.axis === "x" ? [along, r.at] : [r.at, along]);

function Ground() {
  const geometry = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, colour: string) => out.push(tint(g, colour, 1));
    const span = 2 * REACH + 80;
    add(flat(span, span).translate(FADE.x, LAYER.ground, FADE.z), "#33313b");
    for (const b of blocks()) {
      const [x0, z0, x1, z1] = b.rect;
      const tower = b.i === 0 && b.j === 0;
      add(flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, LAYER.block, (z0 + z1) / 2), tower ? "#45424f" : "#2b2a32");
    }
    // The park: lawn and paths.
    const [px0, pz0, px1, pz1] = parkBlock().rect;
    add(flat(px1 - px0, pz1 - pz0).translate((px0 + px1) / 2, LAYER.tarmac, (pz0 + pz1) / 2), "#1d2d22");
    for (const [x0, z0, x1, z1] of parkPaths()) add(flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, LAYER.paint, (z0 + z1) / 2), "#4b4755");
    // Carriageways, and the kerbs either side of them.
    for (const r of ROADS) {
      const [x0, z0, x1, z1] = roadRect(r);
      add(flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, LAYER.tarmac, (z0 + z1) / 2), "#1e1d24");
      for (const [a, b] of between(r)) {
        if (Math.min(fadeAt(...roadPoint(r, a)), fadeAt(...roadPoint(r, b))) >= 1) continue;
        for (const side of [-1, 1]) add(onRoad(r, (a + b) / 2, side * (CARRIAGEWAY / 2 + 0.15), b - a, 0.3, LAYER.paint), "#5a5763");
      }
    }
    return merge(out);
  }, []);
  return <Merged geometry={geometry} material={M.shaded} />;
}

/** Lane lines, the median, zebra crossings and stop lines, as two batches of painted strips. */
function Markings() {
  const [white, yellow] = useMemo(() => {
    const w: THREE.BufferGeometry[] = [];
    const y: THREE.BufferGeometry[] = [];
    const lane = STREET.median / 2 + LANE;
    for (const r of ROADS) {
      for (const [a, b] of between(r)) {
        if (Math.min(fadeAt(...roadPoint(r, a)), fadeAt(...roadPoint(r, b))) >= 1) continue;
        // Zebras in line with the crossing road's pavements, and stop lines behind them.
        const zebra = STREET.pavement - 0.6;
        for (const [end, dir] of [
          [a, 1],
          [b, -1],
        ] as const) {
          const mid = end + dir * (0.3 + zebra / 2);
          for (let s = -CARRIAGEWAY / 2 + 0.6; s < CARRIAGEWAY / 2 - 0.4; s += 1.1) w.push(onRoad(r, mid, s + 0.25, zebra, 0.5, LAYER.paint));
          // Traffic keeps to the right, so the stop line spans the lanes arriving at this end.
          const arriving = (r.axis === "x" ? -dir : dir) as number;
          w.push(onRoad(r, end + dir * (zebra + 1.1), (arriving * CARRIAGEWAY) / 4, 0.4, CARRIAGEWAY / 2 - 0.4, LAYER.paint));
        }
        const from = a + zebra + 2;
        const to = b - zebra - 2;
        for (const side of [-1, 1]) y.push(onRoad(r, (from + to) / 2, side * 0.18, to - from, 0.12, LAYER.paint));
        for (let s = from + 2; s + 3 < to; s += 9) for (const side of [-1, 1]) w.push(onRoad(r, s + 1.5, side * lane, 3, 0.13, LAYER.paint));
      }
    }
    return [merge(w), merge(y)];
  }, []);
  useEffect(
    () => () => {
      white.dispose();
      yellow.dispose();
    },
    [white, yellow],
  );
  return (
    <group>
      <mesh geometry={white} material={M.white} frustumCulled={false} />
      <mesh geometry={yellow} material={M.yellow} frustumCulled={false} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

function plantGeometry(p: Plant): THREE.BufferGeometry[] {
  const h = p.y1 - p.y0;
  if (p.kind === "tank") {
    return [
      tint(new THREE.CylinderGeometry(p.w / 2, p.w / 2, h * 0.8, 12).translate(p.x, p.y0 + h * 0.4, p.z), "#6b5f55", 0.5),
      tint(new THREE.ConeGeometry(p.w / 2 + 0.1, h * 0.2, 12).translate(p.x, p.y0 + h * 0.9, p.z), "#4f4640", 0.5),
    ];
  }
  if (p.kind === "fan") {
    return [
      tint(box(p.w, h - 0.1, p.d, p.x, p.y0 + (h - 0.1) / 2, p.z), "#6a6c75", 0.5),
      tint(new THREE.CylinderGeometry(p.w * 0.4, p.w * 0.4, 0.1, 14).translate(p.x, p.y1 - 0.05, p.z), "#1c1d22", 0.8),
    ];
  }
  return [tint(box(p.w, h, p.d, p.x, p.y0 + h / 2, p.z), "#5d5f68", 0.5)];
}

/** Roofs and the terraces on setbacks, their parapets, and the plant on top. */
function roofs(list: Building[], lite: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const b of list) {
    for (const m of b.masses) {
      const [x0, z0, x1, z1] = m.rect;
      const w = x1 - x0;
      const d = z1 - z0;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const t = 0.35;
      parts.push(
        tint(flat(w, d).translate(cx, m.y1, cz), b.roof, 0.6),
        tint(box(w, PARAPET, t, cx, m.y1 + PARAPET / 2, z0 + t / 2), b.wall, 0.55),
        tint(box(w, PARAPET, t, cx, m.y1 + PARAPET / 2, z1 - t / 2), b.wall, 0.55),
        tint(box(t, PARAPET, d - 2 * t, x0 + t / 2, m.y1 + PARAPET / 2, cz), b.wall, 0.55),
        tint(box(t, PARAPET, d - 2 * t, x1 - t / 2, m.y1 + PARAPET / 2, cz), b.wall, 0.55),
      );
    }
    if (!lite) for (const p of roofPlant(b)) parts.push(...plantGeometry(p));
  }
  return merge(parts);
}

/** Strips of light round the tops of some towers. */
function crowns(list: Building[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const b of list) {
    if (!b.crown) continue;
    const [x0, z0, x1, z1] = b.masses[b.masses.length - 1].rect;
    const y = b.masses[b.masses.length - 1].y1 - 0.5;
    const o = 0.06;
    parts.push(
      tint(box(x1 - x0 + 2 * o, 0.35, 0.05, (x0 + x1) / 2, y, z0 - o), b.crown, 1),
      tint(box(x1 - x0 + 2 * o, 0.35, 0.05, (x0 + x1) / 2, y, z1 + o), b.crown, 1),
      tint(box(0.05, 0.35, z1 - z0, x0 - o, y, (z0 + z1) / 2), b.crown, 1),
      tint(box(0.05, 0.35, z1 - z0, x1 + o, y, (z0 + z1) / 2), b.crown, 1),
    );
  }
  return parts.length ? merge(parts) : null;
}

/** The red lights on the tallest towers blink together, a second apart. */
function Beacons({ list }: { list: Building[] }) {
  const geometry = useMemo(() => {
    const parts = list.flatMap((b) => beacons(b)).map((p) => tint(box(0.5, 0.5, 0.5, p.x, p.y, p.z), "#ff3030", 1));
    return parts.length ? merge(parts) : null;
  }, [list]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.visible = clock.elapsedTime % 1.6 < 0.55;
  });
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry ? <mesh ref={ref} geometry={geometry} material={M.glow} frustumCulled={false} /> : null;
}

function Buildings({ lite }: { lite: boolean }) {
  const list = useMemo(() => buildings(), []);
  const material = useMemo(() => facadeMaterial(), []);
  const walls = useMemo(() => facades([...list, TOWER]), [list]);
  const tops = useMemo(() => roofs(list, lite), [list, lite]);
  const bands = useMemo(() => crowns(list), [list]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <Merged geometry={walls} material={material} />
      <Merged geometry={tops} material={M.shaded} />
      {bands && <Merged geometry={bands} material={M.glow} />}
      <Beacons list={list} />
    </group>
  );
}

/** The podium's roof garden round the foot of the shaft, and the company's sign on the tower's top storey. */
function Tower() {
  const terrace = useMemo(() => {
    const top = TOWER.masses[0].y1;
    const [x0, z0, x1, z1] = PODIUM;
    const [bx0, bz0, bx1, bz1] = BUILDING;
    const planter = (x: number, z: number, w: number, d: number) => tint(box(w, 0.6, d, x, top + 0.3, z), "#2f4a33", 0.55);
    return merge([
      tint(flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, top, (z0 + z1) / 2), TOWER.roof, 0.6),
      tint(box(x1 - x0, PARAPET, 0.35, (x0 + x1) / 2, top + PARAPET / 2, z0 + 0.17), TOWER.wall, 0.55),
      tint(box(x1 - x0, PARAPET, 0.35, (x0 + x1) / 2, top + PARAPET / 2, z1 - 0.17), TOWER.wall, 0.55),
      tint(box(0.35, PARAPET, z1 - z0, x0 + 0.17, top + PARAPET / 2, (z0 + z1) / 2), TOWER.wall, 0.55),
      tint(box(0.35, PARAPET, z1 - z0, x1 - 0.17, top + PARAPET / 2, (z0 + z1) / 2), TOWER.wall, 0.55),
      // Planters along the terrace either side of the shaft.
      planter((x0 + bx0) / 2, (z0 + z1) / 2, 2, z1 - z0 - 6),
      planter((x1 + bx1) / 2, (z0 + z1) / 2, 2, z1 - z0 - 6),
      planter((bx0 + bx1) / 2, (z0 + bz0) / 2, bx1 - bx0 - 4, 1.6),
      planter((bx0 + bx1) / 2, (z1 + bz1) / 2, bx1 - bx0 - 4, 1.6),
    ]);
  }, []);
  const sign = useMemo(() => logoSign(), []);
  const letters = useMemo(() => faded({ map: sign, transparent: true, depthWrite: false, toneMapped: false }, "city-sign"), [sign]);
  useEffect(
    () => () => {
      letters.dispose();
      sign.dispose();
    },
    [letters, sign],
  );
  const [x0, z0, x1, z1] = BUILDING;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const y = SLAB - STOREY / 2 - 0.1;
  const faces: [number, number, number][] = [
    [cx, z1 + 0.08, 0],
    [cx, z0 - 0.08, Math.PI],
    [x1 + 0.08, cz, Math.PI / 2],
    [x0 - 0.08, cz, -Math.PI / 2],
  ];
  return (
    <group>
      <Merged geometry={terrace} material={M.shaded} />
      {faces.map(([x, z, rot], i) => (
        <mesh key={i} material={letters} position={[x, y, z]} rotation={[0, rot, 0]}>
          <planeGeometry args={[12, 12 / 3.2]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Trees and lamps                                                     */
/* ------------------------------------------------------------------ */

function Trees({ basic }: { basic: boolean }) {
  const { trunks, canopies } = useMemo(() => {
    const list = trees().filter((_, i) => !basic || i % 2 === 0);
    return {
      trunks: list.map((t) => compose(t.x, GROUND_Y, t.z, t.turn, [1, t.h * 0.45, 1])),
      canopies: list.map((t) => compose(t.x, GROUND_Y + t.h * 0.62, t.z, t.turn, [t.h * 0.36, t.h * 0.32, t.h * 0.36])),
    };
  }, [basic]);
  const geo = useMemo(() => ({ trunk: treeTrunk(), canopy: treeCanopy(basic) }), [basic]);
  return (
    <group>
      <Instances geometry={geo.trunk} material={M.shaded} matrices={trunks} />
      <Instances geometry={geo.canopy} material={M.shaded} matrices={canopies} />
    </group>
  );
}

function Lamps({ pools }: { pools: boolean }) {
  const spots = useMemo(() => lamps(), []);
  const matrices = useMemo(() => spots.map((l) => compose(l.x, GROUND_Y, l.z, l.rot)), [spots]);
  const poolMatrices = useMemo(
    () =>
      spots.map((l) => {
        const reach = new THREE.Vector3(0, 0, -1.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), l.rot);
        return compose(l.x + reach.x, LAYER.glow, l.z + reach.z);
      }),
    [spots],
  );
  const geo = useMemo(() => ({ post: lampPost(), head: lampHead(), pool: flat(11, 11) }), []);
  const pool = useMemo(() => faded({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }, "city-pool"), []);
  useEffect(
    () => () => {
      pool.map?.dispose();
      pool.dispose();
    },
    [pool],
  );
  return (
    <group>
      <Instances geometry={geo.post} material={M.shaded} matrices={matrices} />
      <Instances geometry={geo.head} material={M.glow} matrices={matrices} />
      {pools && <Instances geometry={geo.pool} material={pool} matrices={poolMatrices} />}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Traffic                                                             */
/* ------------------------------------------------------------------ */

const turned = new THREE.Matrix4();
const place = new THREE.Vector3();
const spin = new THREE.Quaternion();
const unit = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Which way a vehicle on a lane faces; at 0 it faces -z. */
const heading = (axis: "x" | "z", dir: 1 | -1) => (axis === "x" ? -dir * (Math.PI / 2) : dir === 1 ? Math.PI : 0);

/** One kind of vehicle on the move: bodies and their lights. */
function Fleet({ vehicles, body, lights }: { vehicles: Vehicle[]; body: THREE.BufferGeometry; lights: THREE.BufferGeometry }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bodies.current;
    if (!mesh) return;
    const c = new THREE.Color();
    vehicles.forEach((v, i) => mesh.setColorAt(i, c.set(v.colour)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [vehicles]);
  useFrame(({ clock }) => {
    const b = bodies.current;
    const l = lamps.current;
    if (!b || !l) return;
    for (let k = 0; k < vehicles.length; k++) {
      const lane = LANES[vehicles[k].lane];
      const at = vehicleAt(lane, vehicles[k].slot, clock.elapsedTime);
      place.set(at.x, GROUND_Y + 0.01, at.z);
      spin.setFromAxisAngle(UP, heading(lane.axis, lane.dir));
      turned.compose(place, spin, unit);
      b.setMatrixAt(k, turned);
      l.setMatrixAt(k, turned);
    }
    b.instanceMatrix.needsUpdate = true;
    l.instanceMatrix.needsUpdate = true;
  });
  useEffect(
    () => () => {
      body.dispose();
      lights.dispose();
    },
    [body, lights],
  );
  if (vehicles.length === 0) return null;
  return (
    <group>
      <instancedMesh key={`b${vehicles.length}`} ref={bodies} args={[body, M.shaded, vehicles.length]} frustumCulled={false} />
      <instancedMesh key={`l${vehicles.length}`} ref={lamps} args={[lights, M.glow, vehicles.length]} frustumCulled={false} />
    </group>
  );
}

/** Cars and trucks on every road. `share` thins the traffic for a computer without a GPU. */
function Traffic({ share, lite }: { share: number; lite: boolean }) {
  const { cars, trucks } = useMemo(() => {
    const all = traffic().filter((_, i) => (i * share) % 1 < share);
    return { cars: all.filter((v) => !v.truck), trucks: all.filter((v) => v.truck) };
  }, [share]);
  const geo = useMemo(() => ({ car: carBody(lite), carLights: carLights(), truck: truckBody(), truckLights: carLights(8.6, 1.0, 2.3) }), [lite]);
  return (
    <group>
      <Fleet vehicles={cars} body={geo.car} lights={geo.carLights} />
      <Fleet vehicles={trucks} body={geo.truck} lights={geo.truckLights} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Downtown                                                            */
/* ------------------------------------------------------------------ */

/**
 * The world outside. `linear` says whether the scene renders through the
 * effects chain, which needs the night colour in linear light.
 */
export function Exterior({ linear }: { linear: boolean }) {
  const basic = useDetail() === "basic";
  setNight(linear);
  return (
    <group>
      <Ground />
      <Markings />
      <Buildings lite={basic} />
      <Tower />
      <Trees basic={basic} />
      <Lamps pools={!basic} />
      <Traffic share={basic ? 0.4 : 1} lite={basic} />
    </group>
  );
}
