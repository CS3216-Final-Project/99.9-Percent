"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  beacons,
  benches,
  blocks,
  BUILDING,
  buildings,
  CARRIAGEWAY,
  crossings,
  FADE,
  fadeAt,
  flowerBeds,
  flowers,
  FOUNTAIN,
  GROUND_Y,
  LANE,
  LAMP_REACH,
  LANES,
  lamps,
  PARAPET,
  parkBlock,
  parkCentre,
  parkPaths,
  pedestrians,
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
  walkerAt,
  type Building,
  type LampStyle,
  type Plant,
  type Road,
  type Tree,
  type Vehicle,
  type VehicleKind,
} from "./city";
import { useDetail } from "./detail";
import { world } from "./cityLight";
import { logoSign } from "./textures";

/*
 * Draws the city round the office (see city.ts) at whatever time of day it is (see sky.ts). Nothing out here takes
 * part in three.js's lighting: every material shades itself from its normal under the sun or the moon and the sky,
 * all set once a frame by applyDaylight, so the whole city costs the same on a phone as on a graphics card. Windows,
 * lamps and headlights are simply bright, and brighter as it gets dark. Facades are drawn by a shader that lays out
 * each building's windows, floor by floor, shows the sky in the glass by day and lights a share of the offices
 * behind them by night. Every material fades to the sky at the horizon with distance from the office, and into a
 * haze with depth below it. Things that repeat are instanced or merged; the whole city costs a few dozen draw calls.
 */

/* ------------------------------------------------------------------ */
/* Materials lit by the time of day                                    */
/* ------------------------------------------------------------------ */

const WORLD_GLSL = `
varying vec3 vFadeWorld;
varying vec3 vCityNormal;
uniform vec4 uFade;
uniform vec2 uHaze;
uniform vec3 uHorizon;
uniform vec3 uKeyDir;
uniform vec3 uKeyLight;
uniform vec3 uSkyLight;
uniform vec3 uGroundLight;
uniform float uDark;

/** Light from the sky above and the ground below, and from the sun or the moon. */
vec3 cityLight(vec3 n) {
  return mix(uGroundLight, uSkyLight, 0.5 + 0.5 * n.y) + uKeyLight * max(dot(n, uKeyDir), 0.0);
}
`;

/**
 * How a material takes the light: shaded by the sun, moon and sky; glowing, and brighter at night; seen only at
 * night, like the pools of lamplight; or shaded by its own shader, like the facades.
 */
type Lighting = "lit" | "glow" | "night" | "own";

const LIGHTING: Record<Lighting, string> = {
  lit: "diffuseColor.rgb *= cityLight(normalize(vCityNormal));",
  glow: "diffuseColor.rgb *= mix(0.6, 1.0, uDark);",
  night: "diffuseColor.rgb *= uDark;",
  own: "",
};

type Shader = THREE.WebGLProgramParametersWithUniforms;

/** Light a material by the time of day and fade it into the sky with distance and depth; `more` adds to its shader first. */
function faded<P extends THREE.MeshBasicMaterialParameters>(params: P, key: string, lighting: Lighting, more?: (shader: Shader) => void): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial(params);
  m.onBeforeCompile = (shader) => {
    more?.(shader);
    Object.assign(shader.uniforms, world);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vFadeWorld;\nvarying vec3 vCityNormal;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 fadeWorld = vec4(transformed, 1.0);
      vec3 cityNormal = normal;
      #ifdef USE_INSTANCING
        fadeWorld = instanceMatrix * fadeWorld;
        cityNormal = mat3(instanceMatrix) * cityNormal;
      #endif
      vFadeWorld = (modelMatrix * fadeWorld).xyz;
      vCityNormal = normalize(mat3(modelMatrix) * cityNormal);`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${WORLD_GLSL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${LIGHTING[lighting]}`)
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
      float far = smoothstep(uFade.z, uFade.w, distance(vFadeWorld.xz, uFade.xy));
      // The haze below is thickest at night; by day the air is clear enough to see the street.
      float deep = uHaze.y * mix(0.25, 1.0, uDark) * smoothstep(0.0, uHaze.x, -vFadeWorld.y);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizon, 1.0 - (1.0 - far) * (1.0 - deep));`,
      );
  };
  // Each way of taking the light compiles its own program.
  m.customProgramCacheKey = () => key;
  return m;
}

/** Shared materials: plain vertex colours, tinted per instance where needed, and the bright ones that glow. */
const M = {
  shaded: faded({ vertexColors: true }, "city-lit", "lit"),
  glow: faded({ vertexColors: true, toneMapped: false }, "city-glow", "glow"),
  white: faded({ color: "#a9a6a0" }, "city-lit", "lit"),
  yellow: faded({ color: "#a8892e" }, "city-lit", "lit"),
};

/* ------------------------------------------------------------------ */
/* Facades                                                             */
/* ------------------------------------------------------------------ */

const STYLE = { glass: 0, ribbon: 1, stone: 2, fins: 3, grid: 4 } as const;

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

vec3 facade(vec3 paint, vec3 n) {
  vec3 lit = cityLight(n);
  vec3 wall = paint * lit;
  float seed = vLook.x;
  float style = vLook.y;
  float share = vLook.z;
  float bay = style < 0.5 ? 1.5 : style < 1.5 ? 3.0 : style < 2.5 ? 2.2 : style < 3.5 ? 1.2 : 2.4;
  vec2 g = vec2(vWall.x / bay, vWall.y / ${STOREY.toFixed(1)});
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 e = fwidth(g) * 0.75 + 1e-4;
  bool street = cell.y < 0.5 && vLook.w > 0.5;
  // The opening in each bay: left, right, sill and head, as fractions of the bay and the storey. Fins leave a slot
  // nearly floor to ceiling; the grid punches a small square.
  vec4 frame = style < 0.5 ? vec4(0.05, 0.95, 0.21, 0.97)
    : style < 1.5 ? vec4(0.02, 0.98, 0.34, 0.9)
    : style < 2.5 ? vec4(0.24, 0.76, 0.26, 0.8)
    : style < 3.5 ? vec4(0.3, 0.7, 0.04, 0.98)
    : vec4(0.3, 0.7, 0.32, 0.72);
  if (street) frame = vec4(0.04, 0.96, 0.04, 0.82);
  float open = band(f.x, frame.x, frame.y, e.x) * band(f.y, frame.z, frame.w, e.y);
  // An office is a run of bays on one floor sharing its lights. Some floors have gone home, some are working late.
  float run = 2.0 + floor(hash12(vec2(cell.y, seed)) * 5.0);
  float office = floor(cell.x / run);
  float busy = share * (0.25 + 1.5 * hash12(vec2(cell.y * 0.71, seed + 3.0)));
  // Offices switch their lights on one by one as it gets dark, and the shops along the street with them.
  float evening = smoothstep(0.15, 0.85, uDark);
  float on = step(hash12(vec2(office * 1.37 + seed, cell.y * 2.11 + seed * 0.7)), (street ? 0.75 : busy) * evening);
  float tone = hash12(vec2(office + 19.0, cell.y + seed));
  vec3 light = street ? uShop : (tone > 0.72 ? uCool : uWarm);
  light *= 0.5 + 0.5 * hash12(vec2(office + 7.0, cell.y * 3.0 + seed));
  // Brightest under the ceiling lights; here and there a blind is drawn part way down.
  light *= mix(0.72, 1.0, smoothstep(frame.z, frame.w, f.y));
  float blind = step(0.72, hash12(vec2(cell.x + seed, cell.y + 5.0)));
  float drop = mix(frame.z + 0.25, frame.w, hash12(vec2(cell.x, cell.y + seed)));
  light *= mix(1.0, 0.35, blind * step(drop, f.y));
  // The glass is tinted and lit like the wall; by day it also shows the sky, more toward the top of each pane and a
  // little differently in each, and at night it catches a little of the city's glow.
  float pane = 0.75 + 0.5 * hash12(cell + seed * 0.37);
  vec3 sky = uSkyLight * mix(vec3(1.0), normalize(vGlass + 0.02) * 1.7, 0.5) * (0.12 + 0.14 * f.y) * (0.7 + 0.6 * hash12(cell * 0.7 + seed)) * (1.0 - uDark);
  vec3 dark = vGlass * lit * pane * (0.8 + 0.4 * f.y) + sky;
  vec3 colour = mix(wall, mix(dark, light, on), open);
  // Far off, the windows are finer than a pixel: show their average instead of a shimmer.
  float coverage = (frame.y - frame.x) * (frame.w - frame.z);
  vec3 average = mix(wall, mix(vGlass * lit + uSkyLight * 0.19 * (1.0 - uDark), uWarm * 0.6, share * evening), coverage);
  return mix(colour, average, smoothstep(0.3, 0.7, max(fwidth(g.x), fwidth(g.y))));
}
`;

function facadeMaterial(): THREE.MeshBasicMaterial {
  return faded({ vertexColors: true }, "city-facade", "own", (shader) => {
    shader.uniforms.uWarm = { value: LIGHTS.warm };
    shader.uniforms.uCool = { value: LIGHTS.cool };
    shader.uniforms.uShop = { value: LIGHTS.shop };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aWall;\nattribute vec4 aLook;\nattribute vec3 aGlass;\nvarying vec2 vWall;\nvarying vec4 vLook;\nvarying vec3 vGlass;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWall = aWall;\nvLook = aLook;\nvGlass = aGlass;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FACADE_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = facade(diffuseColor.rgb, normalize(vCityNormal));");
  });
}

/** The walls of every box of every building, as one mesh for the facade shader. */
function facades(list: Building[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const normal: number[] = [];
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
        const first = pos.length / 3;
        for (const [x, y, z, u] of [
          [ax, m.y0, az, 0],
          [bx, m.y0, bz, len],
          [bx, m.y1, bz, len],
          [ax, m.y1, az, 0],
        ]) {
          pos.push(x, y, z);
          normal.push(nx, 0, nz);
          wall.push(w.r, w.g, w.b);
          glass.push(g.r, g.g, g.b);
          at.push(u, y - GROUND_Y);
          look.push(b.seed % 997, STYLE[b.facade], b.lit, m.y0 === GROUND_Y ? 1 : 0);
        }
        index.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
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

/** Paint a geometry one colour, with normals for the sun, moon and sky to shade it by (see faded). */
function tint(g: THREE.BufferGeometry, colour: string): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.computeVertexNormals();
  const c = new THREE.Color(colour);
  const n = geo.attributes.position.count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
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
    tint(box(1.8, 0.7, 4.4, 0, 0.62, 0), "#ffffff"),
    tint(box(1.6, 0.55, 2.3, 0, 1.24, 0.3), "#8d93a3"),
    ...(lite ? [] : [-0.82, 0.82].flatMap((x) => [-1.35, 1.4].map((z) => tint(wheel(x, z), "#18171c")))),
  ]);
}

/** Headlights at the front, tail lights at the back. */
function carLights(length = 4.4, height = 0.72, width = 1.8): THREE.BufferGeometry {
  const lamp = (x: number, z: number, colour: string) => tint(box(0.36, 0.14, 0.06, x, height, z), colour);
  return merge([lamp(-width / 2 + 0.3, -length / 2 - 0.02, "#fff4d6"), lamp(width / 2 - 0.3, -length / 2 - 0.02, "#fff4d6"), lamp(-width / 2 + 0.3, length / 2 + 0.02, "#ff2a3a"), lamp(width / 2 - 0.3, length / 2 + 0.02, "#ff2a3a")]);
}

/** A box truck facing -z. */
function truckBody(): THREE.BufferGeometry {
  const wheel = (x: number, z: number) => new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10).rotateZ(Math.PI / 2).translate(x, 0.45, z);
  return merge([
    tint(box(2.4, 2.6, 6.2, 0, 2.05, 1.2), "#ffffff"),
    tint(box(2.3, 1.9, 2.2, 0, 1.4, -3.1), "#c9ccd6"),
    tint(box(2.1, 0.7, 0.1, 0, 1.85, -4.2), "#2b3140"),
    ...[-1.05, 1.05].flatMap((x) => [-3.0, 0.4, 3.4].map((z) => tint(wheel(x, z), "#18171c"))),
  ]);
}

/** Wheels either side, `x` out from the middle, at each of `zs` along. */
const wheels = (x: number, zs: number[], r = 0.34, w = 0.24) =>
  [-x, x].flatMap((side) => zs.map((z) => tint(new THREE.CylinderGeometry(r, r, w, 10).rotateZ(Math.PI / 2).translate(side, r, z), "#18171c")));

/**
 * Each kind of vehicle facing -z, its wheels on the ground: a white body that the vehicle's own colour tints, and
 * dark glass. A lite one leaves the wheels to the imagination. Taxis share the saloon's body.
 */
function vehicleBody(kind: VehicleKind, lite = false): THREE.BufferGeometry {
  const glass = "#8d93a3";
  const dark = "#2b3140";
  if (kind === "hatch") return merge([tint(box(1.75, 0.68, 3.9, 0, 0.62, 0), "#ffffff"), tint(box(1.55, 0.58, 2.1, 0, 1.25, 0.45), glass), ...(lite ? [] : wheels(0.8, [-1.2, 1.25]))]);
  if (kind === "suv") return merge([tint(box(1.85, 0.95, 4.4, 0, 0.8, 0), "#ffffff"), tint(box(1.7, 0.6, 2.7, 0, 1.57, 0.35), glass), ...(lite ? [] : wheels(0.84, [-1.4, 1.4], 0.4))]);
  if (kind === "van") return merge([tint(box(1.8, 1.75, 4.4, 0, 1.2, 0), "#ffffff"), tint(box(1.6, 0.55, 0.06, 0, 1.6, -2.21), dark), ...(lite ? [] : wheels(0.82, [-1.4, 1.45], 0.36))]);
  if (kind === "truck") return truckBody();
  if (kind === "bus") return merge([tint(box(2.4, 2.6, 8.8, 0, 1.7, 0), "#ffffff"), tint(box(2.2, 0.9, 0.06, 0, 2.0, -4.41), dark), ...(lite ? [] : wheels(1.05, [-3.0, 2.8], 0.45, 0.3))]);
  return carBody(lite);
}

/** Head and tail lights for each kind, the lit sign on a taxi's roof, and a bus's lit windows and route sign. */
function vehicleLights(kind: VehicleKind): THREE.BufferGeometry {
  if (kind === "hatch") return carLights(3.9, 0.7, 1.75);
  if (kind === "suv") return carLights(4.4, 0.95, 1.85);
  if (kind === "van") return carLights(4.4, 0.75, 1.8);
  if (kind === "truck") return carLights(8.6, 1.0, 2.3);
  if (kind === "bus") return merge([carLights(8.8, 0.8, 2.4), ...[-1, 1].map((s) => tint(box(0.04, 0.75, 7.0, s * 1.215, 2.25, 0.3), "#ffd99a")), tint(box(1.4, 0.3, 0.05, 0, 2.75, -4.43), "#ffb347")]);
  if (kind === "taxi") return merge([carLights(), tint(box(0.62, 0.2, 0.28, 0, 1.63, 0.2), "#fff1b0")]);
  return carLights();
}

function treeTrunk(): THREE.BufferGeometry {
  return tint(new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0), "#4a3a2e");
}

/**
 * Unit-scale canopies, coarser when lite, in pale greys: each tree's own colour tints them. A rounded crown of a few
 * lumps, a conifer of two stacked cones, and a rain tree's flat, spreading umbrella.
 */
function treeCanopy(kind: "round" | "cone" | "umbrella", lite = false): THREE.BufferGeometry {
  const detail = lite ? 0 : 1;
  const lump = (r: number, x: number, y: number, z: number, shade: string) => tint(new THREE.IcosahedronGeometry(r, detail).translate(x, y, z), shade);
  if (kind === "cone") {
    return merge([
      tint(new THREE.ConeGeometry(1, 1.25, lite ? 6 : 9).translate(0, -0.2, 0), "#ffffff"),
      tint(new THREE.ConeGeometry(0.72, 1.0, lite ? 6 : 9).translate(0, 0.45, 0), "#e8e8e8"),
    ]);
  }
  if (kind === "umbrella") {
    return merge([lump(1.0, 0, 0, 0, "#ffffff"), lump(0.8, 0.95, -0.05, 0.3, "#e4e4e4"), lump(0.8, -0.85, 0.05, -0.35, "#d6d6d6"), lump(0.7, 0.15, 0.1, -0.95, "#ececec"), lump(0.7, -0.2, -0.05, 0.95, "#dcdcdc")].map((g) => g.scale(1, 0.42, 1)));
  }
  return merge([lump(1.0, 0, 0, 0, "#ffffff"), lump(0.75, 0.7, 0.25, 0.3, "#e6e6e6"), lump(0.7, -0.6, 0.15, -0.4, "#d2d2d2")]);
}

/** A park bench facing -z: slats on two legs, and a back. */
function benchBody(): THREE.BufferGeometry {
  return merge([
    tint(box(1.7, 0.08, 0.5, 0, 0.45, 0), "#6b5038"),
    tint(box(1.7, 0.42, 0.07, 0, 0.72, 0.24), "#6b5038"),
    ...[-0.7, 0.7].map((x) => tint(box(0.08, 0.45, 0.5, x, 0.225, 0.02), "#2e2d33")),
  ]);
}

/** Each style of street lamp's pole and arm, the head reaching out along -z (see LAMP_REACH). */
function lampPost(style: LampStyle): THREE.BufferGeometry {
  const metal = "#4e4c5c";
  if (style === "blade") return merge([tint(new THREE.CylinderGeometry(0.06, 0.09, 8, 6).translate(0, 4, 0), "#5b5e6a"), tint(box(0.06, 0.06, 1.6, 0, 7.97, -0.8), "#5b5e6a")]);
  if (style === "lantern") {
    return merge([
      tint(box(0.3, 0.5, 0.3, 0, 0.25, 0), "#2f2d36"),
      tint(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 6).translate(0, 2.35, 0), "#2f2d36"),
      tint(new THREE.ConeGeometry(0.32, 0.3, 4).rotateY(Math.PI / 4).translate(0, 4.95, 0), "#2f2d36"),
    ]);
  }
  return merge([tint(new THREE.CylinderGeometry(0.07, 0.11, 7, 6).translate(0, 3.5, 0), metal), tint(box(0.08, 0.08, 1.6, 0, 6.95, -0.8), metal)]);
}

/** The glowing head of each style, in white for the lamp's own colour of light to tint. */
function lampHead(style: LampStyle): THREE.BufferGeometry {
  if (style === "blade") return tint(box(0.24, 0.07, 1.0, 0, 7.92, -LAMP_REACH.blade), "#ffffff");
  if (style === "lantern") return tint(box(0.34, 0.48, 0.34, 0, 4.55, 0), "#ffffff");
  return tint(box(0.32, 0.12, 0.62, 0, 6.88, -LAMP_REACH.arm), "#ffffff");
}

/** Colours of lamplight, and how wide a pool each style casts. */
const LAMPLIGHT = { warm: "#ffe2a8", cool: "#dbe8ff" };
const POOL: Record<LampStyle, number> = { arm: 11, blade: 13, lantern: 9 };

/* ------------------------------------------------------------------ */
/* Instancing                                                          */
/* ------------------------------------------------------------------ */

const compose = (x: number, y: number, z: number, yaw = 0, s: THREE.Vector3Tuple = [1, 1, 1]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(...s));

/** Copies of one geometry; `colours`, one per copy, tint each copy's vertex colours. */
function Instances({ geometry, material, matrices, colours }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; colours?: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    if (colours) {
      const c = new THREE.Color();
      colours.forEach((hex, i) => mesh.setColorAt(i, c.set(hex)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [matrices, colours]);
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
  // White, for each lamp's own colour of light to tint.
  grad.addColorStop(0, "rgba(255,255,255,0.5)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.16)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
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
    const add = (g: THREE.BufferGeometry, colour: string) => out.push(tint(g, colour));
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
      tint(new THREE.CylinderGeometry(p.w / 2, p.w / 2, h * 0.8, 12).translate(p.x, p.y0 + h * 0.4, p.z), "#6b5f55"),
      tint(new THREE.ConeGeometry(p.w / 2 + 0.1, h * 0.2, 12).translate(p.x, p.y0 + h * 0.9, p.z), "#4f4640"),
    ];
  }
  if (p.kind === "fan") {
    return [
      tint(box(p.w, h - 0.1, p.d, p.x, p.y0 + (h - 0.1) / 2, p.z), "#6a6c75"),
      tint(new THREE.CylinderGeometry(p.w * 0.4, p.w * 0.4, 0.1, 14).translate(p.x, p.y1 - 0.05, p.z), "#1c1d22"),
    ];
  }
  if (p.kind === "panel") {
    // Tilted up toward +z on a low frame.
    return [tint(box(p.w, 0.08, p.d, 0, 0, 0).rotateX(0.32).translate(p.x, p.y0 + 0.55, p.z), "#2a4377"), tint(box(p.w - 0.4, 0.4, 0.12, p.x, p.y0 + 0.2, p.z), "#4a4b52")];
  }
  if (p.kind === "pool") {
    // The coping round the water; the water itself glows (see roofLights).
    const c = 0.5;
    return [
      tint(box(p.w + 2 * c, h, c, p.x, p.y0 + h / 2, p.z - p.d / 2 - c / 2), "#9d978c"),
      tint(box(p.w + 2 * c, h, c, p.x, p.y0 + h / 2, p.z + p.d / 2 + c / 2), "#9d978c"),
      tint(box(c, h, p.d, p.x - p.w / 2 - c / 2, p.y0 + h / 2, p.z), "#9d978c"),
      tint(box(c, h, p.d, p.x + p.w / 2 + c / 2, p.y0 + h / 2, p.z), "#9d978c"),
    ];
  }
  if (p.kind === "helipad") {
    // A dark pad, a yellow ring and a white H across it.
    const r = p.w / 2;
    const y = p.y0 + 0.02;
    const paint = (g: THREE.BufferGeometry, colour: string, lift: number) => tint(g.rotateX(-Math.PI / 2).translate(p.x, y + lift, p.z), colour);
    return [
      tint(new THREE.CylinderGeometry(r, r, h, 32).translate(p.x, p.y0 + h / 2, p.z), "#2a2a31"),
      paint(new THREE.RingGeometry(r * 0.72, r * 0.8, 40), "#c9a630", h),
      paint(new THREE.PlaneGeometry(r * 0.16, r * 0.8).translate(-r * 0.24, 0, 0), "#d8d3c8", h + 0.01),
      paint(new THREE.PlaneGeometry(r * 0.16, r * 0.8).translate(r * 0.24, 0, 0), "#d8d3c8", h + 0.01),
      paint(new THREE.PlaneGeometry(r * 0.4, r * 0.14), "#d8d3c8", h + 0.01),
    ];
  }
  if (p.kind === "shrub") {
    return [tint(new THREE.IcosahedronGeometry(0.5, 0).scale(p.w, h * 1.6, p.d).translate(p.x, p.y0 + h * 0.45, p.z), "#2f5a36")];
  }
  return [tint(box(p.w, h, p.d, p.x, p.y0 + h / 2, p.z), "#5d5f68")];
}

/** Water in the rooftop pools and the lights round the helipads, which glow. */
function roofLights(list: Building[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const b of list) {
    for (const p of roofPlant(b)) {
      if (p.kind === "pool") parts.push(tint(flat(p.w, p.d).translate(p.x, p.y1 - 0.08, p.z), "#2fb4cc"));
      if (p.kind !== "helipad") continue;
      const r = p.w / 2 - 0.25;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        parts.push(tint(box(0.3, 0.2, 0.3, p.x + r * Math.cos(a), p.y1 + 0.1, p.z + r * Math.sin(a)), "#9dffb4"));
      }
    }
  }
  return parts.length ? merge(parts) : null;
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
        tint(flat(w, d).translate(cx, m.y1, cz), b.roof),
        tint(box(w, PARAPET, t, cx, m.y1 + PARAPET / 2, z0 + t / 2), b.wall),
        tint(box(w, PARAPET, t, cx, m.y1 + PARAPET / 2, z1 - t / 2), b.wall),
        tint(box(t, PARAPET, d - 2 * t, x0 + t / 2, m.y1 + PARAPET / 2, cz), b.wall),
        tint(box(t, PARAPET, d - 2 * t, x1 - t / 2, m.y1 + PARAPET / 2, cz), b.wall),
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
      tint(box(x1 - x0 + 2 * o, 0.35, 0.05, (x0 + x1) / 2, y, z0 - o), b.crown),
      tint(box(x1 - x0 + 2 * o, 0.35, 0.05, (x0 + x1) / 2, y, z1 + o), b.crown),
      tint(box(0.05, 0.35, z1 - z0, x0 - o, y, (z0 + z1) / 2), b.crown),
      tint(box(0.05, 0.35, z1 - z0, x1 + o, y, (z0 + z1) / 2), b.crown),
    );
  }
  return parts.length ? merge(parts) : null;
}

/** The red lights on the tallest towers blink together, a second apart. */
function Beacons({ list }: { list: Building[] }) {
  const geometry = useMemo(() => {
    const parts = list.flatMap((b) => beacons(b)).map((p) => tint(box(0.5, 0.5, 0.5, p.x, p.y, p.z), "#ff3030"));
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
  const lights = useMemo(() => (lite ? null : roofLights(list)), [list, lite]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <Merged geometry={walls} material={material} />
      <Merged geometry={tops} material={M.shaded} />
      {bands && <Merged geometry={bands} material={M.glow} />}
      {lights && <Merged geometry={lights} material={M.glow} />}
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
    const planter = (x: number, z: number, w: number, d: number) => tint(box(w, 0.6, d, x, top + 0.3, z), "#2f4a33");
    return merge([
      tint(flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, top, (z0 + z1) / 2), TOWER.roof),
      tint(box(x1 - x0, PARAPET, 0.35, (x0 + x1) / 2, top + PARAPET / 2, z0 + 0.17), TOWER.wall),
      tint(box(x1 - x0, PARAPET, 0.35, (x0 + x1) / 2, top + PARAPET / 2, z1 - 0.17), TOWER.wall),
      tint(box(0.35, PARAPET, z1 - z0, x0 + 0.17, top + PARAPET / 2, (z0 + z1) / 2), TOWER.wall),
      tint(box(0.35, PARAPET, z1 - z0, x1 - 0.17, top + PARAPET / 2, (z0 + z1) / 2), TOWER.wall),
      // Planters along the terrace either side of the shaft.
      planter((x0 + bx0) / 2, (z0 + z1) / 2, 2, z1 - z0 - 6),
      planter((x1 + bx1) / 2, (z0 + z1) / 2, 2, z1 - z0 - 6),
      planter((bx0 + bx1) / 2, (z0 + bz0) / 2, bx1 - bx0 - 4, 1.6),
      planter((bx0 + bx1) / 2, (z1 + bz1) / 2, bx1 - bx0 - 4, 1.6),
    ]);
  }, []);
  const sign = useMemo(() => logoSign(), []);
  const letters = useMemo(() => faded({ map: sign, transparent: true, depthWrite: false, toneMapped: false }, "city-sign", "glow"), [sign]);
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

/** Where each kind of crown sits on its trunk, as shares of the tree's height, and how big it is. */
const CROWN = {
  round: { trunk: 0.45, at: 0.62, size: [0.36, 0.32, 0.36] },
  blossom: { trunk: 0.45, at: 0.62, size: [0.36, 0.32, 0.36] },
  cone: { trunk: 0.28, at: 0.56, size: [0.2, 0.42, 0.2] },
  umbrella: { trunk: 0.72, at: 0.8, size: [0.44, 0.44, 0.44] },
} as const;

function Trees({ basic }: { basic: boolean }) {
  const { trunks, crowns } = useMemo(() => {
    const list = trees().filter((_, i) => !basic || i % 2 === 0);
    const crown = (t: Tree) => {
      const c = CROWN[t.kind];
      return compose(t.x, GROUND_Y + t.h * c.at, t.z, t.turn, [t.h * c.size[0], t.h * c.size[1], t.h * c.size[2]]);
    };
    const shape = (s: "round" | "cone" | "umbrella") => list.filter((t) => (t.kind === "blossom" ? "round" : t.kind) === s);
    return {
      trunks: list.map((t) => compose(t.x, GROUND_Y, t.z, t.turn, [1, t.h * CROWN[t.kind].trunk, 1])),
      crowns: (["round", "cone", "umbrella"] as const).map((s) => ({ s, matrices: shape(s).map(crown), colours: shape(s).map((t) => t.leaf) })),
    };
  }, [basic]);
  const geo = useMemo(() => ({ trunk: treeTrunk(), round: treeCanopy("round", basic), cone: treeCanopy("cone", basic), umbrella: treeCanopy("umbrella", basic) }), [basic]);
  return (
    <group>
      <Instances geometry={geo.trunk} material={M.shaded} matrices={trunks} />
      {crowns.map(({ s, matrices, colours }) => (
        <Instances key={s} geometry={geo[s]} material={M.shaded} matrices={matrices} colours={colours} />
      ))}
    </group>
  );
}

/** The park's fountain and its square, the flower beds along the paths, and the benches round the loop. */
function Park({ basic }: { basic: boolean }) {
  const { stone, water } = useMemo(() => {
    const [cx, cz] = parkCentre();
    const r = FOUNTAIN.r;
    const at = (g: THREE.BufferGeometry, y: number) => g.translate(cx, GROUND_Y + y, cz);
    const disc = (radius: number, y: number, colour: string) => tint(at(new THREE.CircleGeometry(radius, 40).rotateX(-Math.PI / 2), y), colour);
    const solid: THREE.BufferGeometry[] = [
      disc(FOUNTAIN.square, 0.025, "#4b4755"),
      tint(at(new THREE.CylinderGeometry(r, r + 0.15, 0.6, 40), 0.3), "#8b8578"),
      tint(at(new THREE.RingGeometry(r - 0.35, r, 40).rotateX(-Math.PI / 2), 0.63), "#a29b8d"),
      tint(at(new THREE.CylinderGeometry(0.35, 0.5, 1.5, 12), 1.35), "#8b8578"),
      tint(at(new THREE.CylinderGeometry(1.3, 0.6, 0.3, 24), 2.2), "#8b8578"),
      tint(at(new THREE.CylinderGeometry(0.18, 0.25, 0.8, 10), 2.7), "#8b8578"),
    ];
    for (const [x0, z0, x1, z1] of flowerBeds()) solid.push(tint(box(x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, GROUND_Y + 0.15, (z0 + z1) / 2), "#3a2a22"));
    if (!basic) for (const f of flowers()) solid.push(tint(new THREE.IcosahedronGeometry(0.2, 0).translate(f.x, GROUND_Y + 0.42, f.z), f.colour));
    // Water in the basin and the bowl, and the jet above it, glow.
    const glow = [disc(r - 0.35, 0.61, "#2fa9c9"), disc(1.15, 2.36, "#2fa9c9"), tint(at(new THREE.CylinderGeometry(0.06, 0.12, 1.1, 8), 3.6), "#bdefff")];
    return { stone: merge(solid), water: merge(glow) };
  }, [basic]);
  const seats = useMemo(() => benches().map((b) => compose(b.x, GROUND_Y, b.z, b.rot)), []);
  const bench = useMemo(() => benchBody(), []);
  return (
    <group>
      <Merged geometry={stone} material={M.shaded} />
      <Merged geometry={water} material={M.glow} />
      <Instances geometry={bench} material={M.shaded} matrices={seats} />
    </group>
  );
}

const LAMP_STYLES: LampStyle[] = ["arm", "blade", "lantern"];

function Lamps({ pools }: { pools: boolean }) {
  const spots = useMemo(() => lamps(), []);
  const styles = useMemo(
    () =>
      LAMP_STYLES.map((style) => {
        const own = spots.filter((l) => l.style === style);
        return { style, matrices: own.map((l) => compose(l.x, GROUND_Y, l.z, l.rot)), colours: own.map((l) => (l.warm ? LAMPLIGHT.warm : LAMPLIGHT.cool)) };
      }),
    [spots],
  );
  const poolMatrices = useMemo(
    () =>
      spots.map((l) => {
        const reach = new THREE.Vector3(0, 0, -LAMP_REACH[l.style]).applyAxisAngle(new THREE.Vector3(0, 1, 0), l.rot);
        const s = POOL[l.style];
        return compose(l.x + reach.x, LAYER.glow, l.z + reach.z, 0, [s, 1, s]);
      }),
    [spots],
  );
  const poolColours = useMemo(() => spots.map((l) => (l.warm ? LAMPLIGHT.warm : LAMPLIGHT.cool)), [spots]);
  const geo = useMemo(() => ({ posts: new Map(LAMP_STYLES.map((s) => [s, lampPost(s)])), heads: new Map(LAMP_STYLES.map((s) => [s, lampHead(s)])), pool: flat(1, 1) }), []);
  const pool = useMemo(() => faded({ map: poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }, "city-pool", "night"), []);
  useEffect(
    () => () => {
      pool.map?.dispose();
      pool.dispose();
    },
    [pool],
  );
  return (
    <group>
      {styles.map(({ style, matrices, colours }) =>
        matrices.length ? (
          <group key={style}>
            <Instances geometry={geo.posts.get(style) as THREE.BufferGeometry} material={M.shaded} matrices={matrices} />
            <Instances geometry={geo.heads.get(style) as THREE.BufferGeometry} material={M.glow} matrices={matrices} colours={colours} />
          </group>
        ) : null,
      )}
      {pools && <Instances geometry={geo.pool} material={pool} matrices={poolMatrices} colours={poolColours} />}
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

const KINDS: VehicleKind[] = ["sedan", "hatch", "suv", "taxi", "van", "truck", "bus"];

/** Cars, taxis, vans, trucks and buses on every road. `share` thins the traffic for a computer without a GPU. */
function Traffic({ share, lite }: { share: number; lite: boolean }) {
  const fleets = useMemo(() => {
    const all = traffic().filter((_, i) => (i * share) % 1 < share);
    return KINDS.map((kind) => ({ kind, vehicles: all.filter((v) => v.kind === kind) }));
  }, [share]);
  const geo = useMemo(() => new Map(KINDS.map((k) => [k, { body: vehicleBody(k, lite), lights: vehicleLights(k) }])), [lite]);
  return (
    <group>
      {fleets.map(({ kind, vehicles }) => {
        const g = geo.get(kind) as { body: THREE.BufferGeometry; lights: THREE.BufferGeometry };
        return <Fleet key={kind} vehicles={vehicles} body={g.body} lights={g.lights} />;
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Pedestrians                                                         */
/* ------------------------------------------------------------------ */

/**
 * A passer-by facing -z: a round monster like the crew upstairs, on two small feet, in a white body that its own
 * colour tints. Its eyes are drawn apart, so they stay white.
 */
function walkerBody(lite: boolean): THREE.BufferGeometry {
  return merge([
    tint(new THREE.IcosahedronGeometry(0.5, lite ? 0 : 1).scale(0.72, 1.15, 0.72).translate(0, 0.78, 0), "#ffffff"),
    ...[-0.16, 0.16].map((x) => tint(box(0.17, 0.2, 0.26, x, 0.1, -0.02), "#4a4652")),
  ]);
}

function walkerEyes(): THREE.BufferGeometry {
  return merge(
    [-0.13, 0.13].flatMap((x) => [
      tint(new THREE.IcosahedronGeometry(0.085, 0).translate(x, 1.0, -0.27), "#f6f4ef"),
      tint(new THREE.IcosahedronGeometry(0.045, 0).translate(x, 1.0, -0.34), "#1b1b22"),
    ]),
  );
}

const stretch = new THREE.Vector3();

/** People walking the pavements, the park and the plaza, hopping as they go. `share` thins the crowd without a GPU. */
function Crowd({ share, lite }: { share: number; lite: boolean }) {
  const people = useMemo(() => pedestrians().filter((_, i) => (i * share) % 1 < share), [share]);
  const geo = useMemo(() => ({ body: walkerBody(lite), eyes: walkerEyes() }), [lite]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const eyes = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bodies.current;
    if (!mesh) return;
    const c = new THREE.Color();
    people.forEach((p, i) => mesh.setColorAt(i, c.set(p.colour)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [people]);
  useFrame(({ clock }) => {
    const b = bodies.current;
    const e = eyes.current;
    if (!b || !e) return;
    const t = clock.elapsedTime;
    for (let k = 0; k < people.length; k++) {
      const p = people[k];
      const at = walkerAt(p, t);
      const phase = t * p.speed * 2.8 + k * 1.7;
      const squash = 1 + 0.06 * Math.cos(2 * phase);
      place.set(at.x, GROUND_Y + 0.02 + Math.abs(Math.sin(phase)) * 0.12 * p.size, at.z);
      spin.setFromAxisAngle(UP, at.heading);
      stretch.set(p.size / Math.sqrt(squash), p.size * squash, p.size / Math.sqrt(squash));
      turned.compose(place, spin, stretch);
      b.setMatrixAt(k, turned);
      e.setMatrixAt(k, turned);
    }
    b.instanceMatrix.needsUpdate = true;
    e.instanceMatrix.needsUpdate = true;
  });
  useEffect(
    () => () => {
      geo.body.dispose();
      geo.eyes.dispose();
    },
    [geo],
  );
  if (people.length === 0) return null;
  return (
    <group>
      <instancedMesh key={`b${people.length}`} ref={bodies} args={[geo.body, M.shaded, people.length]} frustumCulled={false} />
      <instancedMesh key={`e${people.length}`} ref={eyes} args={[geo.eyes, M.shaded, people.length]} frustumCulled={false} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Downtown                                                            */
/* ------------------------------------------------------------------ */

/** The world outside the office, lit for the time of day by applyDaylight. */
export function Exterior() {
  const basic = useDetail() === "basic";
  return (
    <group>
      <Ground />
      <Markings />
      <Buildings lite={basic} />
      <Tower />
      <Trees basic={basic} />
      <Park basic={basic} />
      <Lamps pools={!basic} />
      <Traffic share={basic ? 0.4 : 1} lite={basic} />
      <Crowd share={basic ? 0.4 : 1} lite={basic} />
    </group>
  );
}
