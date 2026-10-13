"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rand, type RngHolder } from "@/sim/rng";
import {
  BILLBOARD_LEGS,
  BAY,
  bays,
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
  parkedCars,
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
  town,
  traffic,
  TREE_SPREAD,
  trees,
  vehicleAt,
  walkerAt,
  type Building,
  type LampStyle,
  type Pitch,
  type Ring,
  type Plant,
  type Rect,
  type Road,
  type Tree,
  type Vehicle,
  type VehicleKind,
} from "./city";
import { zoomedOut } from "./camera";
import { useDetail } from "./detail";
import { world } from "./cityLight";
import { ROOM } from "./layout";
import { boxShadow, courtyardLight, drumShadow, shadowStep } from "./shadows";
import { useCitySurfaces, type CitySurface } from "./cityTextures";
import { useSurfaces, type Surface } from "./surfaces";
import { TREE_VARIANTS, treeModel, type TreeModel, type TreeShape } from "./treeModels";
import { vehicleBody, vehicleLights } from "./vehicleModels";
import { HIP, HAIR, SHOULDER, SKIN, STATURE, stature, TROUSERS, walkerModel } from "./walkerModels";
import { adsTexture, logoSign } from "./textures";

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
uniform float uLinear;

/** Light from the sky above and the ground below, and from the sun or the moon. */
vec3 cityLight(vec3 n) {
  return mix(uGroundLight, uSkyLight, 0.5 + 0.5 * n.y) + uKeyLight * max(dot(n, uKeyDir), 0.0);
}

/** The same through leaves: the sun reaches a little round the far side of a crown. */
vec3 foliageLight(vec3 n) {
  return mix(uGroundLight, uSkyLight, 0.5 + 0.5 * n.y) + uKeyLight * 0.95 * max((dot(n, uKeyDir) + 0.45) / 1.45, 0.0);
}

/** The sky so far up from the horizon, for what glass and paint reflect: pale and sunlit low down, deeper blue overhead. */
vec3 skyAt(float up) {
  return mix(uSkyLight * 1.15 + uKeyLight * 0.12, uSkyLight * vec3(0.55, 0.72, 1.08), sqrt(clamp(up, 0.0, 1.0)));
}

/** Which way the eye looks at this fragment. */
vec3 lineOfSight() {
  return isOrthographic ? normalize(vec3(-viewMatrix[0][2], -viewMatrix[1][2], -viewMatrix[2][2])) : normalize(vFadeWorld - cameraPosition);
}
`;

/**
 * How a material takes the light: shaded by the sun, moon and sky; the same over a photo-scanned surface; glowing,
 * and brighter at night; seen only at night, like the pools of lamplight; or shaded by its own shader, like the
 * facades.
 */
type Lighting = "lit" | "textured" | "foliage" | "foliageTextured" | "shadow" | "sign" | "glow" | "night" | "own";

const LIGHTING: Record<Lighting, string> = {
  lit: "diffuseColor.rgb *= cityLight(normalize(vCityNormal));",
  textured: "diffuseColor.rgb *= cityDetail(normalize(vCityNormal)) * cityLight(cityBumped(normalize(vCityNormal)));",
  // Sunlit by day like any surface, floodlit at night.
  sign: "diffuseColor.rgb *= mix(cityLight(normalize(vCityNormal)), vec3(1.0), uDark * 0.85);",
  // Leaves and fronds are thin, so each side is lit as if it faced the viewer, and light wraps round them a little.
  foliage: "diffuseColor.rgb *= foliageLight(normalize(vCityNormal) * (gl_FrontFacing ? 1.0 : -1.0));",
  foliageTextured:
    "vec3 leafN = normalize(vCityNormal) * (gl_FrontFacing ? 1.0 : -1.0); diffuseColor.rgb *= leafDetail(leafN) * foliageLight(leafN);",
  // A soft shadow on the ground: darker by day, faint under the moon. Blended in linear light, the same alpha would
  // darken the ground much less than blended for display, so it is raised to look the same either way.
  shadow: "diffuseColor.a *= mix(0.72, 0.2, uDark); diffuseColor.a = mix(diffuseColor.a, 1.0 - pow(1.0 - diffuseColor.a, 2.2), uLinear);",
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
      // A light haze lifts the street toward the sky's colour by day, so it reads as far below the office; it is
      // thicker at night.
      float deep = uHaze.y * mix(0.45, 0.8, uDark) * smoothstep(0.0, uHaze.x, -vFadeWorld.y);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizon, 1.0 - (1.0 - far) * (1.0 - deep));`,
      );
  };
  // Each way of taking the light compiles its own program.
  m.customProgramCacheKey = () => key;
  return m;
}

/** The grey photo sets average about this much in linear light (see cityTextures.ts). */
const GREY_MEAN = 0.58;

/**
 * A photo-scanned surface laid on the ground and roofs by world position, so it needs no texture coordinates. Two
 * samples, the second larger and turned, break up the repeat. Steep faces, like a parapet's, are left plain.
 */
const DETAIL_GLSL = `
uniform sampler2D uDetail;
uniform sampler2D uDetailNormal;
uniform float uTile;
uniform float uContrast;
uniform float uMottle;

vec2 detailUvA() { return vFadeWorld.xz / uTile; }
vec2 detailUvB() { return mat2(0.8, -0.6, 0.6, 0.8) * vFadeWorld.xz / (uTile * 2.71) + 0.37; }
float detailFlat(vec3 n) { return smoothstep(0.35, 0.8, abs(n.y)); }

/** How much lighter or darker the photo is here than on average, with broad patches across the whole surface. */
float cityDetail(vec3 n) {
  float d = mix(texture2D(uDetail, detailUvA()).r, texture2D(uDetail, detailUvB()).r, 0.4) / ${GREY_MEAN.toFixed(2)};
  float broad = texture2D(uDetail, vFadeWorld.xz / (uTile * 31.0) + 0.61).r / ${GREY_MEAN.toFixed(2)};
  d = (1.0 + (d - 1.0) * uContrast) * (1.0 + (broad - 1.0) * uMottle);
  return mix(1.0, d, detailFlat(n));
}

/** A photo's light and dark laid round a crown from three sides at once, so leaves read on every face of it. */
float leafDetail(vec3 n) {
  vec3 w = abs(n);
  w /= w.x + w.y + w.z;
  float t = texture2D(uDetail, vFadeWorld.zy / uTile).r * w.x + texture2D(uDetail, vFadeWorld.xz / uTile).r * w.y + texture2D(uDetail, vFadeWorld.xy / uTile).r * w.z;
  return 1.0 + (t / ${GREY_MEAN.toFixed(2)} - 1.0) * uContrast;
}

/** The normal, tipped by the photo's bumps. */
vec3 cityBumped(vec3 n) {
  vec2 t = mix(texture2D(uDetailNormal, detailUvA()).xy, texture2D(uDetailNormal, detailUvB()).xy, 0.4) * 2.0 - 1.0;
  return normalize(n + vec3(t.x, 0.0, -t.y) * 0.8 * detailFlat(n));
}
`;

/** A plain-coloured material laid with a photo-scanned surface. */
function texturedMaterial(surface: CitySurface): THREE.MeshBasicMaterial {
  return faded({ vertexColors: true }, "city-textured", "textured", (shader) => {
    shader.uniforms.uDetail = { value: surface.map };
    shader.uniforms.uDetailNormal = { value: surface.normalMap };
    shader.uniforms.uTile = { value: surface.tile };
    shader.uniforms.uContrast = { value: surface.contrast };
    shader.uniforms.uMottle = { value: surface.mottle };
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${DETAIL_GLSL}`);
  });
}

/**
 * Leaves and bark, lit through; at HD, the leaves carry a photo of foliage laid round them from three sides. Thin
 * fronds and bark are seen from both sides; closed clumps of leaves only from outside, which halves their cost.
 */
function foliageMaterial(surface: CitySurface | null, side: THREE.Side): THREE.MeshBasicMaterial {
  if (!surface) return faded({ vertexColors: true, side }, "city-foliage", "foliage");
  return faded({ vertexColors: true, side }, "city-foliage-textured", "foliageTextured", (shader) => {
    shader.uniforms.uDetail = { value: surface.map };
    shader.uniforms.uDetailNormal = { value: surface.normalMap };
    shader.uniforms.uTile = { value: 1.3 };
    shader.uniforms.uContrast = { value: 0.9 };
    shader.uniforms.uMottle = { value: 0 };
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${DETAIL_GLSL}`);
  });
}

/** Darken what is under a shadow but leave the canvas's own alpha alone, or the page would show through it. */
const KEEP_ALPHA = { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

/** A soft round shadow, dark in the middle and gone at the edge. */
function shadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Shadows of the trees on the ground, cast away from the sun: right under each tree at noon, long and thrown far
 * when the sun is low. Each copy is scaled to its crown's width across and its tree's height up, which the shader
 * reads back to work out how far the crown's shadow falls.
 */
function treeShadowMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  return faded({ color: "#000000", map, transparent: true, depthWrite: false, ...KEEP_ALPHA }, "city-tree-shadow", "shadow", (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform vec3 uKeyDir;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float treeHeight = length(instanceMatrix[1].xyz);
        float shadowWidth = length(instanceMatrix[0].xyz);
        vec2 sunward = uKeyDir.xz / max(uKeyDir.y, 0.3);
        float lean = length(sunward);
        vec2 along = lean > 1e-3 ? sunward / lean : vec2(0.0);
        transformed.xz += along * dot(transformed.xz, along) * min(lean, 2.0) * 0.6;
        transformed.xz -= sunward * treeHeight * 0.5 / shadowWidth;
      #endif`,
    );
  });
}

/** What each part of the ground and the roofs is made of, for its photo at HD detail. */
type Fabric = "pavement" | "lawn" | "gravel" | "asphalt" | "roofTiles" | "plain";
const FABRICS: Fabric[] = ["pavement", "lawn", "gravel", "asphalt", "roofTiles", "plain"];

/** Each surface's material: photo-scanned at HD once the photos have loaded, plain colour otherwise. */
type Looks = Record<Fabric, THREE.Material>;

function useLooks(): Looks {
  const surfaces = useCitySurfaces();
  const looks = useMemo(() => {
    const plain: Looks = { pavement: M.shaded, lawn: M.shaded, gravel: M.shaded, asphalt: M.shaded, roofTiles: M.shaded, plain: M.shaded };
    if (!surfaces) return plain;
    return { ...plain, pavement: texturedMaterial(surfaces.pavement), lawn: texturedMaterial(surfaces.lawn), gravel: texturedMaterial(surfaces.gravel), asphalt: texturedMaterial(surfaces.asphalt), roofTiles: texturedMaterial(surfaces.roofTiles) };
  }, [surfaces]);
  useEffect(
    () => () => {
      for (const m of Object.values(looks)) if (m !== M.shaded) m.dispose();
    },
    [looks],
  );
  return looks;
}

/** Parts of the ground or the roofs, merged by what they are made of and drawn in their materials. */
function Surfaces({ parts, looks }: { parts: Record<Fabric, THREE.BufferGeometry[]>; looks: Looks }) {
  const merged = useMemo(() => FABRICS.filter((g) => parts[g].length > 0).map((g) => ({ g, geometry: merge(parts[g]) })), [parts]);
  return (
    <group>
      {merged.map(({ g, geometry }) => (
        <Merged key={g} geometry={geometry} material={looks[g]} />
      ))}
    </group>
  );
}

const noParts = (): Record<Fabric, THREE.BufferGeometry[]> => Object.fromEntries(FABRICS.map((g) => [g, []])) as unknown as Record<Fabric, THREE.BufferGeometry[]>;

/**
 * Vehicles at HD (see vehicleModels.ts): only their paint takes each vehicle's own colour. Paint has a clear coat that
 * mirrors the sky on the bonnet and roof and shines where it catches the sun; glass is dark, reflecting the sky more
 * the flatter it lies; trim and tyres are matte.
 */
const VEHICLE_GLSL = `
varying float vFinish;

vec3 vehicle(vec3 base, vec3 n) {
  vec3 V = lineOfSight();
  vec3 r = reflect(V, n);
  vec3 env = r.y > 0.0 ? skyAt(r.y) : mix(vec3(0.12, 0.13, 0.11) * cityLight(vec3(0.0, 1.0, 0.0)), skyAt(0.0), smoothstep(-0.35, 0.0, r.y));
  float fresnel = pow(1.0 - max(-dot(V, n), 0.0), 5.0);
  vec3 shine = uKeyLight * pow(max(dot(n, normalize(uKeyDir - V)), 0.0), 90.0) * (1.0 - uDark);
  vec3 lit = base * cityLight(n);
  vec3 paint = lit + env * mix(0.05, 1.0, fresnel) + shine * 0.9;
  vec3 glass = lit * 0.6 + env * mix(0.18, 1.0, fresnel) + shine * 1.2;
  return vFinish < 0.5 ? lit : vFinish < 1.5 ? paint : glass;
}
`;

function vehicleMaterial(): THREE.MeshBasicMaterial {
  return faded({ vertexColors: true }, "city-vehicle", "own", (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aFinish;\nvarying float vFinish;").replace(
      "#include <color_vertex>",
      `vColor = vec4(1.0);
      vColor.rgb *= color;
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, 1.0 - step(0.5, abs(aFinish - 1.0)));
      #endif
      vFinish = aFinish;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${VEHICLE_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = vehicle(diffuseColor.rgb, normalize(vCityNormal));");
  });
}

/** Vehicles' lamps glow day and night; their lit windows, finished as glass, only once it gets dark. */
function lampMaterial(): THREE.MeshBasicMaterial {
  return faded({ vertexColors: true, toneMapped: false }, "city-lamps", "own", (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aFinish;\nvarying float vFinish;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFinish = aFinish;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vFinish;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = vFinish > 1.5 ? mix(vec3(0.035, 0.045, 0.06), diffuseColor.rgb, uDark) : diffuseColor.rgb * mix(0.6, 1.0, uDark);");
  });
}

/** Shared materials: plain vertex colours, tinted per instance where needed, the bright ones that glow, and vehicles. */
const M = {
  shaded: faded({ vertexColors: true }, "city-lit", "lit"),
  glow: faded({ vertexColors: true, toneMapped: false }, "city-glow", "glow"),
  white: faded({ color: "#e3e1da" }, "city-lit", "lit"),
  yellow: faded({ color: "#e0b53a" }, "city-lit", "lit"),
  vehicle: vehicleMaterial(),
  lamps: lampMaterial(),
};

/* ------------------------------------------------------------------ */
/* Facades                                                             */
/* ------------------------------------------------------------------ */

const STYLE = { glass: 0, ribbon: 1, stone: 2, fins: 3, grid: 4, house: 5 } as const;

/** Office lights: warm, cool and the shops at street level. */
const LIGHTS = { warm: new THREE.Color("#ffd49a"), cool: new THREE.Color("#d6e6ff"), shop: new THREE.Color("#fff0cf") };

/**
 * Each facade knows, per vertex, its wall colour (frames, spandrels or stone), its glass, where it is on the wall in
 * metres, and the building's seed, style, share of lit offices and whether it reaches the street. The shader cuts the
 * wall into bays and storeys, opens a window in each, and lights runs of windows as offices with the lights on.
 *
 * At HD detail (FACADE_FINE) the glass is set back in its opening, so a sill and a jamb show round it and the sun
 * casts the head's and a jamb's shadow into it, and the glass reflects what a pane would: seen from above, the street
 * and lawns low down and the hazy distance higher up, brighter toward the sun. Sills catch the sun along their noses.
 * Once the photo sets have loaded (FACADE_WALLS), houses are stucco and offices concrete, laid by world position and
 * weathered at the foot and under the sills. Low quality keeps the flat windows.
 */
const FACADE_GLSL = `
varying vec2 vWall;
varying vec4 vLook;
varying vec3 vGlass;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform vec3 uShop;
#ifdef FACADE_WALLS
uniform sampler2D uPlaster;
uniform sampler2D uPlasterNormal;
uniform sampler2D uConcrete;
uniform sampler2D uConcreteNormal;
#endif

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float band(float f, float a, float b, float e) {
  return smoothstep(a - e, a + e, f) - smoothstep(b - e, b + e, f);
}

#ifdef FACADE_FINE
/**
 * What glass \`height\` metres up sees along \`r\`. Above the horizon, the sky: pale low down, deeper blue overhead.
 * Below it, the street and lawns across the way, until the ray would meet the ground so far off that the city has
 * faded into haze; so upper floors show more of the haze than lower ones. The haze is brighter toward the sun.
 */
vec3 reflected(vec3 r, float height) {
  float reach = height * length(r.xz) / max(-r.y, 1e-3);
  float far = r.y > 0.0 ? 1.0 : smoothstep(2.0, 32.0, reach);
  vec3 near = vec3(0.12, 0.13, 0.11) * cityLight(vec3(0.0, 1.0, 0.0));
  vec3 env = r.y > 0.0 ? skyAt(r.y) : mix(near, skyAt(0.0), far);
  vec3 toward = normalize(vec3(r.x, 0.08, r.z));
  return env + uKeyLight * 0.45 * pow(max(dot(toward, uKeyDir), 0.0), 6.0) * far;
}
#endif

vec3 facade(vec3 paint, vec3 n) {
  vec3 lit = cityLight(n);
  vec3 wall = paint * lit;
  float seed = vLook.x;
  float style = vLook.y;
  float share = vLook.z;
  float bay = style < 0.5 ? 1.5 : style < 1.5 ? 3.0 : style < 2.5 ? 2.2 : style < 3.5 ? 1.2 : style < 4.5 ? 2.4 : 3.4;
  vec2 g = vec2(vWall.x / bay, vWall.y / ${STOREY.toFixed(1)});
  vec2 cell = floor(g);
  vec2 f = fract(g);
  vec2 e = fwidth(g) * 0.75 + 1e-4;
  bool street = cell.y < 0.5 && vLook.w > 0.5;
  // The opening in each bay: left, right, sill and head, as fractions of the bay and the storey. Fins leave a slot
  // nearly floor to ceiling; the grid punches a small square, and a house has a window here and there.
  vec4 frame = style < 0.5 ? vec4(0.05, 0.95, 0.21, 0.97)
    : style < 1.5 ? vec4(0.02, 0.98, 0.34, 0.9)
    : style < 2.5 ? vec4(0.24, 0.76, 0.26, 0.8)
    : style < 3.5 ? vec4(0.3, 0.7, 0.04, 0.98)
    : style < 4.5 ? vec4(0.3, 0.7, 0.32, 0.72)
    : vec4(0.3, 0.7, 0.3, 0.7);
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
  float pane = 0.75 + 0.5 * hash12(cell + seed * 0.37);
  // Far off, the windows are finer than a pixel: show their average instead of a shimmer.
  float coverage = (frame.y - frame.x) * (frame.w - frame.z);
  float distant = smoothstep(0.3, 0.7, max(fwidth(g.x), fwidth(g.y)));
#ifndef FACADE_FINE
  // The glass is tinted and lit like the wall; by day it also shows the sky, more toward the top of each pane and a
  // little differently in each, and at night it catches a little of the city's glow.
  vec3 sky = uSkyLight * mix(vec3(1.0), normalize(vGlass + 0.02) * 1.7, 0.5) * (0.12 + 0.14 * f.y) * (0.7 + 0.6 * hash12(cell * 0.7 + seed)) * (1.0 - uDark);
  vec3 dark = vGlass * lit * pane * (0.8 + 0.4 * f.y) + sky;
  vec3 colour = mix(wall, mix(dark, light, on), open);
  vec3 average = mix(wall, mix(vGlass * lit + uSkyLight * 0.19 * (1.0 - uDark), uWarm * 0.6, share * evening), coverage);
  return mix(colour, average, distant);
#else
  // Along the wall, left to right as seen from outside, and up it, in metres within this bay and storey.
  vec3 T = vec3(n.z, 0.0, -n.x);
  vec2 size = vec2(bay, ${STOREY.toFixed(1)});
  vec2 m = f * size;
  vec2 em = e * size;
  vec4 edge = frame * size.xxyy;
  float shade = 1.0;
  vec3 wallN = n;
  float detail = 1.0;
#ifdef FACADE_WALLS
  {
    // Stucco on houses, concrete on offices; curtain walls keep their plain frames.
    vec2 uv = vec2(dot(vFadeWorld, T), vFadeWorld.y);
    float plaster = step(4.5, style);
    float rough = step(0.5, style);
    vec2 uvP = uv / 2.6;
    vec2 uvC = uv / 3.4;
    float grey = mix(texture2D(uConcrete, uvC).r, texture2D(uPlaster, uvP).r, plaster) / ${GREY_MEAN.toFixed(2)};
    vec2 bump = mix(texture2D(uConcreteNormal, uvC).xy, texture2D(uPlasterNormal, uvP).xy, plaster) * 2.0 - 1.0;
    float broad = texture2D(uConcrete, uv / 41.0 + fract(seed * 0.013)).r / ${GREY_MEAN.toFixed(2)};
    detail = mix(1.0, (1.0 + (grey - 1.0) * mix(1.8, 1.6, plaster)) * (1.0 + (broad - 1.0) * mix(0.9, 0.5, plaster)), rough);
    wallN = normalize(n + (T * bump.x + vec3(0.0, bump.y, 0.0)) * 0.6 * rough);
    // Rain darkens the foot of a wall, and runs down from under each sill in streaks.
    float below = edge.z - m.y;
    float streak = band(f.x, frame.x + 0.05, frame.y - 0.05, e.x) * step(0.0, below) * (1.0 - smoothstep(0.0, 1.2, below)) * clamp(0.6 + (grey - 1.0) * 2.5, 0.0, 1.0);
    shade = 1.0 - rough * (0.16 * (1.0 - smoothstep(0.0, 0.8, vWall.y)) + 0.12 * streak);
  }
#endif
  wall = paint * detail * shade * cityLight(wallN);
  // The line of sight, and how squarely it meets the wall.
  vec3 V = lineOfSight();
  float square = max(-dot(V, n), 0.05);
  // The glass stands back in its opening, so from above the sill shows below it and a jamb beside it: q is where
  // the line of sight meets the glass. Traced back toward the sun, a point on the glass is lit if it clears the
  // opening, so the head and a jamb cast their shadows on it.
  float depth = street ? 0.08 : style < 0.5 ? 0.1 : style < 1.5 ? 0.12 : style < 2.5 ? 0.22 : style < 3.5 ? 0.35 : style < 4.5 ? 0.2 : 0.12;
  vec2 q = m + depth * vec2(dot(V, T), V.y) / square;
  float sill = 1.0 - smoothstep(edge.z - em.y, edge.z + em.y, q.y);
  float head = smoothstep(edge.w - em.y, edge.w + em.y, q.y);
  float jambL = 1.0 - smoothstep(edge.x - em.x, edge.x + em.x, q.x);
  float jambR = smoothstep(edge.y - em.x, edge.y + em.x, q.x);
  float sunIn = dot(uKeyDir, n);
  vec2 back = q + depth * vec2(dot(uKeyDir, T), uKeyDir.y) / max(sunIn, 0.05);
  float sunlit = step(0.0, sunIn) * band(back.x, edge.x, edge.y, em.x) * band(back.y, edge.z, edge.w, em.y);
  // Through the glass, the office, with a patch of sun on it where the sun comes in; shops keep their lights on all day.
  vec3 inside = vGlass * lit * pane * 0.8 + uKeyLight * max(sunIn, 0.0) * sunlit * (vGlass * 2.5 + 0.015) + (street ? uShop * 0.09 * pane : vec3(0.0));
  // Each pane sits a little out of true, so neighbouring panes reflect a little differently; coated office glass
  // reflects more than a house's, and more still when seen edge on.
  vec2 tip = vec2(hash12(cell * 1.31 + seed), hash12(cell * 0.77 + seed * 1.9)) - 0.5;
  vec3 pn = normalize(n + T * tip.x * 0.08 + vec3(0.0, tip.y * 0.08, 0.0));
  float f0 = street ? 0.12 : style < 0.5 ? 0.3 : style < 1.5 ? 0.26 : 0.16;
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - max(-dot(V, pn), 0.0), 5.0);
  // The coating tints what the glass reflects.
  vec3 coat = mix(vec3(1.0), normalize(vGlass + 0.02) * 1.73, 0.55);
  vec3 env = reflected(reflect(V, pn), max(vWall.y, 0.3)) * coat * (0.92 + 0.16 * smoothstep(frame.z, frame.w, f.y));
  vec3 glass = mix(inside, env, fresnel);
  vec3 inner = mix(glass, light, on);
  // A house's windows have white frames and glazing bars in a cross.
  float house = step(4.5, style);
  float sash = 1.0 - band(m.x, edge.x + 0.07, edge.y - 0.07, em.x) * band(m.y, edge.z + 0.07, edge.w - 0.07, em.y);
  sash = max(sash, band(m.x, (edge.x + edge.y) * 0.5 - 0.025, (edge.x + edge.y) * 0.5 + 0.025, em.x));
  sash = max(sash, band(m.y, mix(edge.z, edge.w, 0.55) - 0.025, mix(edge.z, edge.w, 0.55) + 0.025, em.y));
  inner = mix(inner, vec3(0.86, 0.85, 0.82) * cityLight(n), house * sash);
  inner = mix(inner, paint * shade * cityLight(T), jambL);
  inner = mix(inner, paint * shade * cityLight(-T), jambR);
  inner = mix(inner, paint * shade * cityLight(vec3(0.0, -1.0, 0.0)), head);
  inner = mix(inner, paint * shade * cityLight(vec3(0.0, 1.0, 0.0)), sill);
  // The rounded nose of each sill catches the sun when the sun, the sill and the eye line up across the wall.
  vec3 H = normalize(uKeyDir - V);
  float across = dot(H, T);
  vec3 cap = normalize(H - across * T + 1e-4);
  float glint = pow(max(1.0 - across * across, 0.0), 24.0) * max(dot(uKeyDir, cap), 0.0) * step(0.0, dot(cap, n)) * (1.0 - uDark);
  float nose = band(m.y, edge.z - 0.035, edge.z, em.y) * band(f.x, frame.x, frame.y, e.x);
  vec3 colour = mix(wall, inner, open) + uKeyLight * glint * nose * 0.9;
  float fresnelFlat = f0 + (1.0 - f0) * pow(1.0 - square, 5.0);
  vec3 glassAverage = mix(vGlass * lit * 0.8, reflected(reflect(V, n), max(vWall.y, 0.3)) * coat, fresnelFlat);
  vec3 average = mix(wall, mix(glassAverage, uWarm * 0.6, share * evening), coverage);
  return mix(colour, average, distant);
#endif
}
`;

/** Photo-scanned stucco for houses and concrete for offices, from the office's own HD sets (see surfaces.ts). */
interface FacadeWalls {
  plaster: Surface;
  concrete: Surface;
}

/** The facades' material: flat windows at Low quality; set-back, reflecting glass at HD, on photo walls once loaded. */
function facadeMaterial(fine: boolean, walls: FacadeWalls | null): THREE.MeshBasicMaterial {
  const key = !fine ? "city-facade" : walls ? "city-facade-walls" : "city-facade-fine";
  return faded({ vertexColors: true }, key, "own", (shader) => {
    shader.uniforms.uWarm = { value: LIGHTS.warm };
    shader.uniforms.uCool = { value: LIGHTS.cool };
    shader.uniforms.uShop = { value: LIGHTS.shop };
    if (walls) {
      shader.uniforms.uPlaster = { value: walls.plaster.map };
      shader.uniforms.uPlasterNormal = { value: walls.plaster.normalMap };
      shader.uniforms.uConcrete = { value: walls.concrete.map };
      shader.uniforms.uConcreteNormal = { value: walls.concrete.normalMap };
    }
    const defines = `${fine ? "#define FACADE_FINE\n" : ""}${fine && walls ? "#define FACADE_WALLS\n" : ""}`;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aWall;\nattribute vec4 aLook;\nattribute vec3 aGlass;\nvarying vec2 vWall;\nvarying vec4 vLook;\nvarying vec3 vGlass;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWall = aWall;\nvLook = aLook;\nvGlass = aGlass;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${defines}${FACADE_GLSL}`)
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = facade(diffuseColor.rgb, normalize(vCityNormal));");
  });
}

/** The walls of every box of every building, and of the ring, as one mesh for the facade shader. */
function facades(list: Building[], ring: Ring | null): THREE.BufferGeometry {
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
          // Offices and shops have shop windows at street level; houses do not.
          look.push(b.seed % 997, STYLE[b.facade], b.lit, m.y0 === GROUND_Y && b.facade !== "house" ? 1 : 0);
        }
        index.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
    }
  }
  if (ring) {
    // Curved glass in narrow panels round the outside and the courtyard, each wall read from its left as seen
    // from in front of it: clockwise round the outside, the other way round the courtyard.
    w.set("#c9ccd1");
    g.set("#203a52");
    const top = GROUND_Y + ring.storeys * STOREY;
    const panels = 160;
    for (const [radius, out] of [
      [ring.outer, 1],
      [ring.inner, -1],
    ] as const) {
      for (let k = 0; k < panels; k++) {
        const a0 = (k / panels) * Math.PI * 2;
        const a1 = ((k + 1) / panels) * Math.PI * 2;
        const ends = out > 0 ? [a1, a0] : [a0, a1];
        const first = pos.length / 3;
        for (const [a, y] of [
          [ends[0], GROUND_Y],
          [ends[1], GROUND_Y],
          [ends[1], top],
          [ends[0], top],
        ]) {
          pos.push(ring.x + radius * Math.cos(a), y, ring.z + radius * Math.sin(a));
          normal.push(out * Math.cos(a), 0, out * Math.sin(a));
          wall.push(w.r, w.g, w.b);
          glass.push(g.r, g.g, g.b);
          at.push(radius * (out > 0 ? Math.PI * 2 - a : a), y - GROUND_Y);
          look.push(77, STYLE.glass, 0.5, 1);
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
    // A new geometry or material makes a new mesh, which needs its copies placed again.
  }, [matrices, colours, geometry, material]);
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

const LAYER = { ground: GROUND_Y, block: GROUND_Y + 0.005, tarmac: GROUND_Y + 0.01, paint: GROUND_Y + 0.02, shade: GROUND_Y + 0.025, glow: GROUND_Y + 0.03 };

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

/** The colours of the ground by day: concrete pavements, lawns, gravel paths, asphalt and kerbs. */
const GROUND = { pavement: "#a9a59c", lawn: "#6c9150", park: "#5f8a48", path: "#cbc2ab", road: "#3d3e44", lot: "#4a4b50", kerb: "#d2cec5", median: "#678c49" };

const rectFlat = ([x0, z0, x1, z1]: Rect, y: number) => flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, y, (z0 + z1) / 2);

function Ground({ looks }: { looks: Looks }) {
  const parts = useMemo(() => {
    const out = noParts();
    const add = (on: Fabric, g: THREE.BufferGeometry, colour: string) => out[on].push(tint(g, colour));
    const span = 2 * REACH + 80;
    add("pavement", flat(span, span).translate(FADE.x, LAYER.ground, FADE.z), GROUND.pavement);
    // Every block is lawn under whatever stands on it; the park's is greener, and the car parks are asphalt.
    for (const b of blocks()) add("lawn", rectFlat(b.rect, LAYER.block), GROUND.lawn);
    add("lawn", rectFlat(parkBlock().rect, LAYER.tarmac), GROUND.park);
    for (const p of parkPaths()) add("gravel", rectFlat(p, LAYER.paint), GROUND.path);
    for (const cp of town().carParks) if (fadeAt((cp.rect[0] + cp.rect[2]) / 2, (cp.rect[1] + cp.rect[3]) / 2) < 1) add("asphalt", rectFlat(cp.rect, LAYER.tarmac), GROUND.lot);
    // Carriageways, the kerbs either side of them, and the planted medians down the middle.
    for (const r of ROADS) {
      add("asphalt", rectFlat(roadRect(r), LAYER.tarmac), GROUND.road);
      for (const [a, b] of between(r)) {
        if (Math.min(fadeAt(...roadPoint(r, a)), fadeAt(...roadPoint(r, b))) >= 1) continue;
        for (const side of [-1, 1]) add("plain", onRoad(r, (a + b) / 2, side * (CARRIAGEWAY / 2 + 0.15), b - a, 0.3, LAYER.paint), GROUND.kerb);
        const from = a + STREET.pavement;
        const to = b - STREET.pavement;
        add("lawn", onRoad(r, (from + to) / 2, 0, to - from, STREET.median - 0.6, LAYER.paint), GROUND.median);
        for (const side of [-1, 1]) add("plain", onRoad(r, (from + to) / 2, side * (STREET.median / 2 - 0.15), to - from, 0.3, LAYER.paint), GROUND.kerb);
      }
    }
    return out;
  }, []);
  return <Surfaces parts={parts} looks={looks} />;
}

/** The cars in the car parks, standing in their bays. */
function Parked({ lite }: { lite: boolean }) {
  const fleets = useMemo(() => {
    const all = parkedCars().filter((c) => fadeAt(c.x, c.z) < 1);
    return KINDS.map((kind) => {
      const own = all.filter((c) => c.kind === kind);
      return { kind, matrices: own.map((c) => compose(c.x, GROUND_Y + 0.01, c.z, c.rot)), colours: own.map((c) => c.colour) };
    }).filter((f) => f.matrices.length > 0);
  }, []);
  const geo = useMemo(() => new Map(KINDS.map((k) => [k, vehicleBody(k, lite)])), [lite]);
  return (
    <group>
      {fleets.map(({ kind, matrices, colours }) => (
        <Instances key={kind} geometry={geo.get(kind) as THREE.BufferGeometry} material={lite ? M.shaded : M.vehicle} matrices={matrices} colours={colours} />
      ))}
    </group>
  );
}

/** Pools in the back yards: their coping, and the water, which glows a little at night. */
function Yards() {
  const { coping, water } = useMemo(() => {
    const stone: THREE.BufferGeometry[] = [];
    const wet: THREE.BufferGeometry[] = [];
    for (const [x0, z0, x1, z1] of town().pools) {
      if (fadeAt((x0 + x1) / 2, (z0 + z1) / 2) >= 1) continue;
      const c = 0.45;
      stone.push(tint(box(x1 - x0 + 2 * c, 0.12, z1 - z0 + 2 * c, (x0 + x1) / 2, GROUND_Y + 0.06, (z0 + z1) / 2), "#d8d2c4"));
      wet.push(tint(rectFlat([x0, z0, x1, z1], GROUND_Y + 0.13), "#4cc9e8"));
    }
    return { coping: stone.length ? merge(stone) : null, water: wet.length ? merge(wet) : null };
  }, []);
  return (
    <group>
      {coping && <Merged geometry={coping} material={M.shaded} />}
      {water && <Merged geometry={water} material={M.glow} />}
    </group>
  );
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
        for (const side of [-1, 1]) y.push(onRoad(r, (from + to) / 2, side * (STREET.median / 2 + 0.2), to - from, 0.12, LAYER.paint));
        for (let s = from + 2; s + 3 < to; s += 9) for (const side of [-1, 1]) w.push(onRoad(r, s + 1.5, side * lane, 3, 0.13, LAYER.paint));
      }
    }
    // The lines either side of every bay in the car parks.
    for (const cp of town().carParks) {
      if (fadeAt((cp.rect[0] + cp.rect[2]) / 2, (cp.rect[1] + cp.rect[3]) / 2) >= 1) continue;
      for (const bay of bays(cp)) {
        const alongZ = Math.abs(Math.sin(bay.rot)) < 0.5;
        for (const side of [-1, 1]) {
          const line = alongZ ? flat(0.12, BAY.depth - 0.4).translate(bay.x + (side * BAY.width) / 2, LAYER.paint, bay.z) : flat(BAY.depth - 0.4, 0.12).translate(bay.x, LAYER.paint, bay.z + (side * BAY.width) / 2);
          w.push(line);
        }
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

/**
 * A pitched roof over `r`, its eaves at `y` and reaching a little past the walls: a ridge along its length with
 * gable ends, or hipped on every side.
 */
function pitchedRoof(r: Rect, y: number, pitch: Pitch): THREE.BufferGeometry {
  const eaves = 0.45;
  const alongX = r[2] - r[0] >= r[3] - r[1];
  const [l0, l1] = alongX ? [r[0] - eaves, r[2] + eaves] : [r[1] - eaves, r[3] + eaves];
  const [c0, c1] = alongX ? [r[1] - eaves, r[3] + eaves] : [r[0] - eaves, r[2] + eaves];
  const half = (c1 - c0) / 2;
  const mid = (c0 + c1) / 2;
  const rise = Math.min(3.2, half * 0.6);
  const hip = pitch === "hip" ? Math.min(half, (l1 - l0) / 2 - 0.05) : 0;
  const at = (along: number, acrossAt: number, up: number): THREE.Vector3 => (alongX ? new THREE.Vector3(along, y + up, acrossAt) : new THREE.Vector3(acrossAt, y + up, along));
  const e00 = at(l0, c0, 0);
  const e10 = at(l1, c0, 0);
  const e11 = at(l1, c1, 0);
  const e01 = at(l0, c1, 0);
  const r0 = at(l0 + hip, mid, rise);
  const r1 = at(l1 - hip, mid, rise);
  const centre = at((l0 + l1) / 2, mid, 0);
  const tris = [
    [e00, e10, r1],
    [e00, r1, r0],
    [e11, e01, r0],
    [e11, r0, r1],
    [e01, e00, r0],
    [e10, e11, r1],
  ];
  const pos: number[] = [];
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const out = new THREE.Vector3();
  for (const [a, b, c] of tris) {
    // Wind each face to look outward and up, away from the middle of the roof.
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    out.set((a.x + b.x + c.x) / 3 - centre.x, 1, (a.z + b.z + c.z) / 3 - centre.z);
    const flip = ab.clone().cross(ac).dot(out) < 0;
    for (const v of flip ? [a, c, b] : [a, b, c]) pos.push(v.x, v.y, v.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

/** Roofs and the terraces on setbacks, their parapets, and the plant on top. */
function roofs(list: Building[], lite: boolean): Record<Fabric, THREE.BufferGeometry[]> {
  const out = noParts();
  const parts = out.plain;
  // Roofs of gravel, of grass, of tiles or shingles, and of everything else, each laid with its photo at HD.
  const deck = (b: Building): Fabric => (b.finish === "gravel" ? "gravel" : b.finish === "green" ? "lawn" : "pavement");
  for (const b of list) {
    for (const m of b.masses) {
      if (b.pitch !== "flat") {
        out.roofTiles.push(tint(pitchedRoof(m.rect, m.y1, b.pitch), b.roof));
        continue;
      }
      const [x0, z0, x1, z1] = m.rect;
      const w = x1 - x0;
      const d = z1 - z0;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const t = 0.35;
      out[deck(b)].push(tint(flat(w, d).translate(cx, m.y1, cz), b.roof));
      parts.push(
        tint(box(w, PARAPET, t, cx, m.y1 + PARAPET / 2, z0 + t / 2), b.wall),
        tint(box(w, PARAPET, t, cx, m.y1 + PARAPET / 2, z1 - t / 2), b.wall),
        tint(box(t, PARAPET, d - 2 * t, x0 + t / 2, m.y1 + PARAPET / 2, cz), b.wall),
        tint(box(t, PARAPET, d - 2 * t, x1 - t / 2, m.y1 + PARAPET / 2, cz), b.wall),
      );
    }
    if (!lite) for (const p of roofPlant(b)) parts.push(...plantGeometry(p));
  }
  return out;
}

/** The ring's roof: a band of solar panels between pale rims. */
function ringRoof(ring: Ring): THREE.BufferGeometry[] {
  const top = GROUND_Y + ring.storeys * STOREY;
  const band = (r0: number, r1: number, lift: number, colour: string) => tint(new THREE.RingGeometry(r0, r1, 160).rotateX(-Math.PI / 2).translate(ring.x, top + lift, ring.z), colour);
  return [band(ring.inner + 0.8, ring.outer - 0.8, 0.02, "#2f4166"), band(ring.outer - 0.8, ring.outer, 0.03, "#d9dbde"), band(ring.inner, ring.inner + 0.8, 0.03, "#d9dbde")];
}

/** Billboards on the shops' roofs: their legs and frames, and their faces cut from the sheet of advertisements. */
function Billboards() {
  const { frames, faces } = useMemo(() => {
    const solid: THREE.BufferGeometry[] = [];
    const shown: THREE.BufferGeometry[] = [];
    for (const b of town().billboards) {
      if (fadeAt(b.x, b.z) >= 1) continue;
      const place = (g: THREE.BufferGeometry) => g.rotateY(b.rot).translate(b.x, 0, b.z);
      const legs = BILLBOARD_LEGS + b.h / 2;
      for (const side of [-1, 1]) solid.push(tint(place(box(0.18, legs, 0.18, side * b.w * 0.32, b.y0 - BILLBOARD_LEGS + legs / 2, 0.2)), "#4a4c55"));
      solid.push(tint(place(box(b.w + 0.3, b.h + 0.3, 0.2, 0, b.y0 + b.h / 2, 0.12)), "#3b3d45"));
      // The face looks the way the billboard does, -z before it is turned; its picture is one cell of the sheet.
      const face = new THREE.PlaneGeometry(b.w, b.h).rotateY(Math.PI).translate(0, b.y0 + b.h / 2, -0.005);
      const col = b.ad % 2;
      const row = Math.floor(b.ad / 2);
      const uv = face.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 2, 1 - (row + 1 - uv.getY(i)) / 4);
      shown.push(place(face));
    }
    return { frames: solid.length ? merge(solid) : null, faces: shown.length ? merge(shown) : null };
  }, []);
  const ads = useMemo(() => adsTexture(), []);
  const paper = useMemo(() => faded({ map: ads, toneMapped: false }, "city-ads", "sign"), [ads]);
  useEffect(() => () => paper.dispose(), [paper]);
  return (
    <group>
      {frames && <Merged geometry={frames} material={M.shaded} />}
      {faces && <Merged geometry={faces} material={paper} />}
    </group>
  );
}

/** A box or a drum that casts a shadow, its heights above the ground; a drum may stand round an open courtyard. */
type Caster = { rect: Rect; from: number; to: number } | { drum: [number, number, number]; court?: number; from: number; to: number };

/** Turn the light this many degrees before the shadows are worked out again. */
const SHADOW_TURN = Math.cos(THREE.MathUtils.degToRad(0.75));

/**
 * The shadows every building casts on the ground, away from the sun or the moon (see shadows.ts), worked out again
 * as the light turns. They are drawn with depth, and a shadow's later pixels at the same depth are turned away, so
 * where two overlap the ground is no darker than under one. Low quality draws none.
 */
function BuildingShadows() {
  const casters = useMemo(() => {
    const list = buildings();
    const out: Caster[] = [];
    const add = (b: Building) => {
      for (const m of b.masses) out.push({ rect: m.rect, from: m.y0 - GROUND_Y, to: m.y1 - GROUND_Y + (b.pitch === "flat" ? PARAPET : 2.5) });
    };
    for (const b of list) add(b);
    add(TOWER);
    // The office's own storey stands on top of its building.
    out.push({ rect: BUILDING, from: SLAB - GROUND_Y, to: ROOM.wallH - GROUND_Y });
    const ring = town().ring;
    if (ring) out.push({ drum: [ring.x, ring.z, ring.outer], court: ring.inner, from: 0, to: ring.storeys * STOREY + PARAPET });
    return out;
  }, []);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(
    () => faded({ color: "#000000", opacity: 0.7, transparent: true, depthWrite: true, depthFunc: THREE.LessDepth, ...KEEP_ALPHA }, "city-building-shadow", "shadow"),
    [],
  );
  const light = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  useFrame(() => {
    const key = world.uKeyDir.value;
    if (key.dot(light) > SHADOW_TURN) return;
    light.copy(key);
    const step = shadowStep([key.x, key.y, key.z]);
    const pos: number[] = [];
    const y = LAYER.shade;
    for (const c of casters) {
      const outline = "rect" in c ? boxShadow(c.rect, c.from, c.to, step) : drumShadow(c.drum[0], c.drum[1], c.drum[2], c.from, c.to, step);
      const lit = "drum" in c && c.court ? courtyardLight(c.drum[0], c.drum[1], c.court, c.to, step) : [];
      const points = [...outline, ...lit].map(([x, z]) => new THREE.Vector2(x, z));
      for (const [a, b, d] of THREE.ShapeUtils.triangulateShape(points.slice(0, outline.length), lit.length ? [points.slice(outline.length)] : [])) {
        // Each triangle wound to face up.
        const [p, q, r] = [points[a], points[b], points[d]];
        const up = (q.y - p.y) * (r.x - p.x) - (q.x - p.x) * (r.y - p.y) > 0;
        for (const v of up ? [p, q, r] : [p, r, q]) pos.push(v.x, y, v.y);
      }
    }
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  });
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
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

function Buildings({ lite, looks }: { lite: boolean; looks: Looks }) {
  const list = useMemo(() => buildings(), []);
  // The office's own photo sets, already loaded for its floors and walls at HD.
  const surfaces = useSurfaces();
  const material = useMemo(() => facadeMaterial(!lite, surfaces && { plaster: surfaces.plaster, concrete: surfaces.concrete }), [lite, surfaces]);
  const ring = town().ring;
  const walls = useMemo(() => facades([...list, TOWER], ring), [list, ring]);
  const tops = useMemo(() => {
    const parts = roofs(list, lite);
    if (ring) parts.plain.push(...ringRoof(ring));
    return parts;
  }, [list, lite, ring]);
  const bands = useMemo(() => crowns(list), [list]);
  const lights = useMemo(() => (lite ? null : roofLights(list)), [list, lite]);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <Merged geometry={walls} material={material} />
      <Surfaces parts={tops} looks={looks} />
      {bands && <Merged geometry={bands} material={M.glow} />}
      {lights && <Merged geometry={lights} material={M.glow} />}
      <Beacons list={list} />
    </group>
  );
}

/** The podium's roof garden round the foot of the shaft, and the company's sign on the tower's top storey. */
/**
 * The lobby wing's roof: a paved roof garden round the foot of the building, with an oak planter of lawn and shrubs
 * along each side. Low quality leaves out the shrubs.
 */
function terraceParts(lite: boolean): Record<Fabric, THREE.BufferGeometry[]> {
  const out = noParts();
  const top = TOWER.masses[0].y1;
  const [x0, z0, x1, z1] = PODIUM;
  const [bx0, bz0, bx1, bz1] = BUILDING;
  out.pavement.push(tint(flat(x1 - x0, z1 - z0).translate((x0 + x1) / 2, top, (z0 + z1) / 2), TOWER.roof));
  out.plain.push(
    tint(box(x1 - x0, PARAPET, 0.35, (x0 + x1) / 2, top + PARAPET / 2, z0 + 0.17), TOWER.wall),
    tint(box(x1 - x0, PARAPET, 0.35, (x0 + x1) / 2, top + PARAPET / 2, z1 - 0.17), TOWER.wall),
    tint(box(0.35, PARAPET, z1 - z0, x0 + 0.17, top + PARAPET / 2, (z0 + z1) / 2), TOWER.wall),
    tint(box(0.35, PARAPET, z1 - z0, x1 - 0.17, top + PARAPET / 2, (z0 + z1) / 2), TOWER.wall),
  );
  // A planter: an oak box with lawn on top and a row of shrubs along it, the same every visit.
  const rng: RngHolder = { rngState: 83 };
  const planter = (x: number, z: number, w: number, d: number) => {
    out.plain.push(tint(box(w, 0.55, d, x, top + 0.275, z), "#8a6a4c"));
    out.lawn.push(tint(flat(w - 0.2, d - 0.2).translate(x, top + 0.56, z), "#5d7f45"));
    if (lite) return;
    const along = w > d;
    const length = along ? w : d;
    for (let s = -length / 2 + 0.9; s < length / 2 - 0.6; s += 1.6 + rand(rng) * 0.8) {
      const r = 0.45 + rand(rng) * 0.3;
      const [sx, sz] = along ? [x + s, z] : [x, z + s];
      out.plain.push(tint(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.85, 1).translate(sx, top + 0.55 + r * 0.7, sz), rand(rng) < 0.3 ? "#6f9a4a" : "#4f7a3f"));
    }
  };
  planter((x0 + bx0) / 2, (z0 + z1) / 2, 2, z1 - z0 - 6);
  planter((x1 + bx1) / 2, (z0 + z1) / 2, 2, z1 - z0 - 6);
  planter((bx0 + bx1) / 2, (z0 + bz0) / 2, bx1 - bx0 - 4, 1.6);
  planter((bx0 + bx1) / 2, (z1 + bz1) / 2, bx1 - bx0 - 4, 1.6);
  return out;
}

function Tower({ looks, lite }: { looks: Looks; lite: boolean }) {
  const terrace = useMemo(() => terraceParts(lite), [lite]);
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
      <Surfaces parts={terrace} looks={looks} />
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

const SHAPES: TreeShape[] = ["round", "cone", "umbrella", "palm"];
const shapeOf = (t: Tree): TreeShape => (t.kind === "blossom" ? "round" : t.kind);

/**
 * Every tree, by shape and by model: its bark and its leaves share each tree's place, turn and size, a little wider
 * or narrower than the model, and the leaves take the tree's own colour. A shadow lies under each, except at Low quality.
 */
function Trees({ basic, lite }: { basic: boolean; lite: boolean }) {
  const surfaces = useCitySurfaces();
  const groups = useMemo(() => {
    const list = trees().filter((_, i) => !basic || i % 2 === 0);
    const placed = list.map((t, i) => {
      // Each tree a little wider or narrower than its model, the same way every visit.
      const sx = 0.92 + 0.16 * ((i * 0.618) % 1);
      const sz = 0.92 + 0.16 * ((i * 0.382 + 0.5) % 1);
      return { t, i, matrix: compose(t.x, GROUND_Y, t.z, t.turn, [t.h * sx, t.h, t.h * sz]) };
    });
    return SHAPES.flatMap((shape) =>
      Array.from({ length: TREE_VARIANTS[shape] }, (_, variant) => {
        const own = placed.filter((p) => shapeOf(p.t) === shape && p.i % TREE_VARIANTS[shape] === variant);
        return { shape, variant, matrices: own.map((p) => p.matrix), colours: own.map((p) => p.t.leaf) };
      }).filter((g) => g.matrices.length > 0),
    );
  }, [basic]);
  const models = useMemo(() => new Map(groups.map((g) => [`${g.shape}${g.variant}`, treeModel(g.shape, g.variant, lite)])), [groups, lite]);
  // Low quality draws no shadows, the trees' included.
  const shadows = useMemo(
    () =>
      trees()
        .filter((_, i) => !basic || i % 2 === 0)
        .map((t) => {
          const across = 2.2 * TREE_SPREAD[t.kind] * t.h;
          return compose(t.x, LAYER.shade, t.z, 0, [across, t.h, across]);
        }),
    [basic],
  );
  const looks = useMemo(
    () => ({ bark: foliageMaterial(null, THREE.DoubleSide), fronds: foliageMaterial(surfaces?.lawn ?? null, THREE.DoubleSide), clumps: foliageMaterial(surfaces?.lawn ?? null, THREE.FrontSide) }),
    [surfaces],
  );
  const shade = useMemo(() => {
    const map = shadowTexture();
    return { map, material: treeShadowMaterial(map) };
  }, []);
  useEffect(
    () => () => {
      looks.bark.dispose();
      looks.fronds.dispose();
      looks.clumps.dispose();
    },
    [looks],
  );
  useEffect(
    () => () => {
      shade.map.dispose();
      shade.material.dispose();
    },
    [shade],
  );
  const disc = useMemo(() => flat(1, 1), []);
  return (
    <group>
      {!basic && <Instances geometry={disc} material={shade.material} matrices={shadows} />}
      {groups.map(({ shape, variant, matrices, colours }) => {
        const m = models.get(`${shape}${variant}`) as TreeModel;
        return (
          <group key={`${shape}${variant}`}>
            <Instances geometry={m.bark} material={looks.bark} matrices={matrices} />
            <Instances geometry={m.leaves} material={shape === "palm" ? looks.fronds : looks.clumps} matrices={matrices} colours={colours} />
          </group>
        );
      })}
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
function Fleet({ vehicles, body, lights, material }: { vehicles: Vehicle[]; body: THREE.BufferGeometry; lights: THREE.BufferGeometry; material: THREE.Material }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bodies.current;
    if (!mesh) return;
    const c = new THREE.Color();
    vehicles.forEach((v, i) => mesh.setColorAt(i, c.set(v.colour)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // A new body or material makes a new mesh, which needs its colours again.
  }, [vehicles, body, material]);
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
      <instancedMesh key={`b${vehicles.length}`} ref={bodies} args={[body, material, vehicles.length]} frustumCulled={false} />
      <instancedMesh key={`l${vehicles.length}`} ref={lamps} args={[lights, M.lamps, vehicles.length]} frustumCulled={false} />
    </group>
  );
}

const KINDS: VehicleKind[] = ["sedan", "hatch", "suv", "taxi", "robotaxi", "van", "truck", "bus"];

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
        return <Fleet key={kind} vehicles={vehicles} body={g.body} lights={g.lights} material={lite ? M.shaded : M.vehicle} />;
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Pedestrians                                                         */
/* ------------------------------------------------------------------ */

/** A palette as a GLSL array of linear colours. */
const palette = (name: string, hexes: string[]) => {
  const c = new THREE.Color();
  return `const vec3 ${name}[${hexes.length}] = vec3[${hexes.length}](${hexes.map((h) => (c.set(h), `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`)).join(", ")});`;
};

/** The walkers' clock: their arms and legs swing in the vertex shader, so only their places change each frame. */
const walkClock = { value: 0 };

/**
 * Passers-by (see walkerModels.ts). Each walker's stride (aStride: strides a second, where in its stride it starts,
 * and a seed for its looks) swings each leg from the hip against the arm on the same side, and lowers the body as
 * the legs spread, so the feet stay on the ground. The shirt takes the walker's own colour, a little muted; skin,
 * hair and trousers are picked from their palettes by the seed.
 */
const WALKER_GLSL = `
attribute vec2 aWho;
attribute vec3 aStride;
uniform float uWalkTime;
${palette("SKIN", SKIN)}
${palette("HAIR", HAIR)}
${palette("TROUSERS", TROUSERS)}
`;

const WALKER_STRIDE = `
float stride = uWalkTime * aStride.x + aStride.y;
float spread = 0.45 * sin(stride);
if (aWho.y > 0.5) {
  float side = mod(aWho.y, 2.0) > 0.5 ? 1.0 : -1.0;
  float leg = step(aWho.y, 2.5);
  float angle = spread * side * mix(-0.8, 1.0, leg);
  float pivot = mix(${SHOULDER.toFixed(2)}, ${HIP.toFixed(2)}, leg);
  vec2 yz = vec2(transformed.y - pivot, transformed.z);
  transformed.y = pivot + yz.x * cos(angle) - yz.y * sin(angle);
  transformed.z = yz.x * sin(angle) + yz.y * cos(angle);
}
transformed.y -= ${HIP.toFixed(2)} * (1.0 - cos(spread));
`;

const WALKER_COLOUR = `
vec3 dress = color;
float seed = aStride.z;
if (aWho.x < 0.5) {
  #ifdef USE_INSTANCING_COLOR
    dress = mix(instanceColor.rgb, vec3(dot(instanceColor.rgb, vec3(0.3, 0.59, 0.11))), 0.3);
  #endif
} else if (aWho.x < 1.5) dress = SKIN[int(fract(seed * 7.31) * ${SKIN.length}.0)];
else if (aWho.x < 2.5) dress = HAIR[int(fract(seed * 3.17) * ${HAIR.length}.0)];
else if (aWho.x < 3.5) dress = TROUSERS[int(fract(seed * 5.53) * ${TROUSERS.length}.0)];
vColor = vec4(dress, 1.0);
`;

function walkerMaterial(): THREE.MeshBasicMaterial {
  return faded({ vertexColors: true }, "city-walker", "lit", (shader) => {
    shader.uniforms.uWalkTime = walkClock;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${WALKER_GLSL}`)
      .replace("#include <color_vertex>", WALKER_COLOUR)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${WALKER_STRIDE}`);
  });
}

const walkerLook = walkerMaterial();

const stretch = new THREE.Vector3();

/** People walking the pavements, the park and the plaza, each at their own height and pace. `share` thins the crowd without a GPU. */
function Crowd({ share, lite }: { share: number; lite: boolean }) {
  const people = useMemo(() => pedestrians().filter((_, i) => (i * share) % 1 < share), [share]);
  const body = useMemo(() => {
    const g = walkerModel(lite);
    // A stride is about 0.8 of a person's height, two steps; each walker starts somewhere in theirs.
    const strides = new Float32Array(people.length * 3);
    people.forEach((p, i) => strides.set([(2 * Math.PI * p.speed) / (0.8 * stature(p.size)), (p.at * 1.37) % (2 * Math.PI), (p.at * 0.618 + p.walk * 0.29) % 1], i * 3));
    g.setAttribute("aStride", new THREE.InstancedBufferAttribute(strides, 3));
    return g;
  }, [lite, people]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new THREE.Color();
    people.forEach((p, i) => m.setColorAt(i, c.set(p.colour)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // A new body makes a new mesh, which needs its colours again.
  }, [people, body]);
  useFrame(({ clock }) => {
    const m = mesh.current;
    if (!m) return;
    const t = clock.elapsedTime;
    walkClock.value = t;
    for (let k = 0; k < people.length; k++) {
      const p = people[k];
      const at = walkerAt(p, t);
      place.set(at.x, GROUND_Y + 0.01, at.z);
      spin.setFromAxisAngle(UP, at.heading);
      const s = stature(p.size) / STATURE;
      turned.compose(place, spin, stretch.set(s, s, s));
      m.setMatrixAt(k, turned);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => () => body.dispose(), [body]);
  if (people.length === 0) return null;
  return <instancedMesh key={`b${people.length}`} ref={mesh} args={[body, walkerLook, people.length]} frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Downtown                                                            */
/* ------------------------------------------------------------------ */

/** Whether the camera is zoomed out far enough for the city's lighter models (see zoomedOut in camera.ts). */
function useZoomedOut(): boolean {
  const [far, setFar] = useState(false);
  useFrame(({ camera }) => {
    const next = zoomedOut((camera as THREE.OrthographicCamera).zoom, far);
    if (next !== far) setFar(next);
  });
  return far;
}

/** The world outside the office, lit for the time of day by applyDaylight. */
export function Exterior() {
  const basic = useDetail() === "basic";
  // Far out, the trees, cars and people draw their lighter models, as they always do at basic detail.
  const lite = useZoomedOut() || basic;
  const looks = useLooks();
  return (
    <group>
      <Ground looks={looks} />
      <Markings />
      <Yards />
      <Billboards />
      <Parked lite={lite} />
      <Buildings lite={basic} looks={looks} />
      {!basic && <BuildingShadows />}
      <Tower looks={looks} lite={basic} />
      <Trees basic={basic} lite={lite} />
      <Park basic={basic} />
      <Lamps pools={!basic} />
      <Traffic share={basic ? 0.4 : 1} lite={lite} />
      <Crowd share={basic ? 0.4 : 1} lite={lite} />
    </group>
  );
}
