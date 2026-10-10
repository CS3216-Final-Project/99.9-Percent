"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  AVENUE,
  BUILDING,
  DRIVE,
  EXPRESSWAY,
  FADE,
  FRONTAGE,
  GROUND_Y,
  isTruck,
  lamps,
  LANE,
  LANES,
  LOT,
  MONUMENT,
  NEIGHBOURS,
  NIGHT,
  oaks,
  palms,
  PAVEMENT,
  parkedCars,
  RAILWAY,
  REACH,
  ROADS,
  SIDE_ROAD,
  STALL,
  stalls,
  STOREY,
  TRAIN,
  trainAt,
  vehicleX,
  type Tree,
} from "./campus";
import { useDetail } from "./detail";
import { logoSign } from "./textures";

/*
 * Draws the campus around the office (see campus.ts) at night. Everything
 * outside is unlit: shading is baked into vertex colours under a moon from
 * the north-west, and windows, lamps and headlights are simply bright, so the
 * office's own lights do not turn the night into day. Every material fades to
 * the night sky with distance from the building, so the world has no edge.
 * Things that repeat are instanced; the lot, the trees, the lamps and the
 * traffic each cost a handful of draw calls.
 */

/* ------------------------------------------------------------------ */
/* Materials that fade into the night                                  */
/* ------------------------------------------------------------------ */

const fade = {
  uFade: { value: new THREE.Vector4(FADE.x, FADE.z, FADE.from, FADE.to) },
  uNight: { value: new THREE.Color(NIGHT) },
};

/** The night colour as the shader needs it: linear when effects render off-screen first, display colour otherwise. */
function setNight(linear: boolean): void {
  fade.uNight.value.set(NIGHT);
  if (!linear) fade.uNight.value.convertLinearToSRGB();
}

function faded(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFade = fade.uFade;
    shader.uniforms.uNight = fade.uNight;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vFadeXZ;").replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vec4 fadeWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fadeWorld = instanceMatrix * fadeWorld;
      #endif
      vFadeXZ = (modelMatrix * fadeWorld).xz;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vFadeXZ;\nuniform vec4 uFade;\nuniform vec3 uNight;")
      .replace(
        "#include <fog_fragment>",
        `#include <fog_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uNight, smoothstep(uFade.z, uFade.w, distance(vFadeXZ, uFade.xy)));`,
      );
  };
  m.customProgramCacheKey = () => "campus-fade";
  return m;
}

/** Shared materials: plain vertex colours, tinted per instance where needed, and the bright ones that glow. */
const M = {
  shaded: faded({ vertexColors: true }),
  glow: faded({ vertexColors: true, toneMapped: false }),
  paint: faded({ color: "#b9b4a0" }),
  yellow: faded({ color: "#b8962e" }),
};

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

const MOON = new THREE.Vector3(-0.45, 1, -0.3).normalize();

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

function palmTrunk(): THREE.BufferGeometry {
  // A unit-tall trunk, ringed like a palm's, narrowing to the top.
  const rings = Array.from({ length: 7 }, (_, i) => tint(new THREE.CylinderGeometry(0.2 - i * 0.012, 0.23 - i * 0.012, 1 / 7, 7).translate(0, (i + 0.5) / 7, 0), i % 2 ? "#5b4636" : "#4d3b2e", 0.55));
  return merge(rings);
}

function palmCrown(): THREE.BufferGeometry {
  const fronds: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + (k % 2) * 0.2;
    const droop = 0.45 + (k % 3) * 0.12;
    const g = box(0.55, 0.04, 3.0, 0, 0, -1.5)
      .rotateX(-droop)
      .rotateY(a);
    fronds.push(tint(g, k % 2 ? "#2f5e3b" : "#27503a", 0.55));
  }
  fronds.push(tint(new THREE.IcosahedronGeometry(0.35, 0), "#3d2e22", 0.6));
  return merge(fronds);
}

function oakTrunk(): THREE.BufferGeometry {
  return tint(new THREE.CylinderGeometry(0.22, 0.32, 1, 7).translate(0, 0.5, 0), "#4a3a2e", 0.55);
}

/** A unit-scale canopy: a few lumps of leaves, coarser when lite. */
function oakCanopy(lite = false): THREE.BufferGeometry {
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

const compose = (x: number, y: number, z: number, yaw = 0, s: THREE.Vector3Tuple = [1, 1, 1], tilt = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, yaw, 0, "YXZ")), new THREE.Vector3(...s));

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

/* ------------------------------------------------------------------ */
/* Canvas textures                                                     */
/* ------------------------------------------------------------------ */

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d") as CanvasRenderingContext2D);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Office windows: eight across, eight floors up, some lit late into the night. */
function windowsTexture(): THREE.CanvasTexture {
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#151827";
    g.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const lit = r();
        g.fillStyle = lit < 0.32 ? (r() < 0.7 ? "#ffd98a" : "#cfe6ff") : lit < 0.45 ? "#2c3c5c" : "#1f2a44";
        g.fillRect(col * 32 + 3, row * 32 + 6, 26, 21);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Double-deck train windows along a carriage side, all lit. */
function trainSideTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 96, (g) => {
    g.fillStyle = "#9aa0ad";
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = "#2a7f96";
    g.fillRect(0, 70, 512, 10);
    g.fillStyle = "#ffe7b0";
    for (let i = 0; i < 14; i++) {
      g.fillRect(14 + i * 35, 14, 26, 18);
      g.fillRect(14 + i * 35, 42, 26, 18);
    }
    g.fillStyle = "#30333d";
    g.fillRect(60, 14, 18, 56);
    g.fillRect(434, 14, 18, 56);
  });
}

/** A soft pool of lamplight on the ground. */
function poolTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,214,150,0.55)");
    grad.addColorStop(0.5, "rgba(255,200,130,0.18)");
    grad.addColorStop(1, "rgba(255,200,130,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

/* ------------------------------------------------------------------ */
/* Ground, roads, the lot and the railway                              */
/* ------------------------------------------------------------------ */

const LAYER = { ground: GROUND_Y, verge: GROUND_Y + 0.004, tarmac: GROUND_Y + 0.01, paint: GROUND_Y + 0.02, glow: GROUND_Y + 0.03 };

function Ground() {
  const parts = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    const add = (g: THREE.BufferGeometry, colour: string, x: number, y: number, z: number) => out.push(tint(g.translate(x, y, z), colour, 1));
    add(flat(2 * REACH + 60, 2 * REACH + 60), "#18241f", FADE.x, LAYER.ground, FADE.z);
    // The pavement round the office, the lot and every road.
    const [bx0, bz0, bx1, bz1] = BUILDING;
    add(flat(bx1 - bx0 + 2 * PAVEMENT, bz1 - bz0 + 2 * PAVEMENT), "#3b384c", (bx0 + bx1) / 2, LAYER.verge, (bz0 + bz1) / 2);
    add(flat(LOT[2] - LOT[0], LOT[3] - LOT[1]), "#25232e", (LOT[0] + LOT[2]) / 2, LAYER.tarmac, (LOT[1] + LOT[3]) / 2);
    for (const r of ROADS) {
      const [x0, z0, x1, z1] = r.rect;
      add(flat(x1 - x0, z1 - z0), r.name === "railway" ? "#2a2730" : "#222129", (x0 + x1) / 2, LAYER.tarmac, (z0 + z1) / 2);
    }
    return merge(out);
  }, []);
  useEffect(() => () => parts.dispose(), [parts]);
  return <mesh geometry={parts} material={M.shaded} />;
}

/** Lane lines, the stall lines in the lot and a crossing at the front door, as one batch of painted strips. */
function Markings() {
  const [white, yellow] = useMemo(() => {
    const w: THREE.BufferGeometry[] = [];
    const y: THREE.BufferGeometry[] = [];
    const strip = (list: THREE.BufferGeometry[], x: number, z: number, sx: number, sz: number) => list.push(flat(sx, sz).translate(x, LAYER.paint, z));
    const dashedX = (z: number, from = -REACH, to = REACH) => {
      for (let x = from; x < to; x += 12) strip(w, x + 1.5, z, 3, 0.15);
    };
    const dashedZ = (x: number, from: number, to: number) => {
      for (let z = from; z < to; z += 9) strip(w, x, z + 1.2, 0.15, 2.4);
    };
    // Expressway: solid edges, dashed lanes, and yellow beside the barrier.
    for (const side of [-1, 1]) {
      const inner = EXPRESSWAY.z + side * (EXPRESSWAY.median / 2 + 0.15);
      const outer = EXPRESSWAY.z + side * (EXPRESSWAY.median / 2 + EXPRESSWAY.lanes * LANE + 0.1);
      strip(y, 0, inner, 2 * REACH, 0.15);
      strip(w, 0, outer, 2 * REACH, 0.15);
      for (let k = 1; k < EXPRESSWAY.lanes; k++) dashedX(EXPRESSWAY.z + side * (EXPRESSWAY.median / 2 + k * LANE));
    }
    // The avenue: a double yellow line down the middle.
    strip(y, 0, AVENUE.z - 0.2, 2 * REACH, 0.12);
    strip(y, 0, AVENUE.z + 0.2, 2 * REACH, 0.12);
    dashedX(FRONTAGE.z, -60, SIDE_ROAD.x);
    dashedZ(SIDE_ROAD.x, FRONTAGE.z, AVENUE.z - AVENUE.width / 2);
    dashedZ(DRIVE.x, LOT[1] + 4, AVENUE.z - AVENUE.width / 2);
    // Stall lines, one either side of every stall.
    for (const s of stalls()) for (const dx of [-STALL.w / 2, STALL.w / 2]) strip(w, s.x + dx, s.z, 0.1, STALL.d);
    // A zebra crossing from the drive to the front door.
    for (let i = 0; i < 6; i++) strip(w, DRIVE.x - DRIVE.width / 2 + 0.6 + i * 1.15, LOT[1] + 1.6, 0.55, 2.6);
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
      <mesh geometry={white} material={M.paint} />
      <mesh geometry={yellow} material={M.yellow} />
    </group>
  );
}

/** The barrier down the middle of the expressway, and the railway's rails and, unless lite, its sleepers. */
function Hardware({ lite }: { lite: boolean }) {
  const geometry = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [tint(box(2 * REACH, 0.8, 0.5, 0, LAYER.tarmac + 0.4, EXPRESSWAY.z), "#6b6878", 0.55)];
    for (const side of [-1, 1]) {
      const z = RAILWAY.z + (side * RAILWAY.spacing) / 2;
      for (const g of [-1, 1]) parts.push(tint(box(2 * REACH, 0.14, 0.08, 0, LAYER.tarmac + 0.27, z + (g * RAILWAY.gauge) / 2), "#8f909c", 0.6));
    }
    return merge(parts);
  }, []);
  const sleepers = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    for (const side of [-1, 1]) for (let x = -REACH; x < REACH; x += 1.2) out.push(compose(x, LAYER.tarmac + 0.1, RAILWAY.z + (side * RAILWAY.spacing) / 2));
    return out;
  }, []);
  const sleeper = useMemo(() => tint(box(0.26, 0.16, 2.5), "#3e3530", 0.6), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry} material={M.shaded} />
      {!lite && <Instances geometry={sleeper} material={M.shaded} matrices={sleepers} />}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Buildings, trees, lamps and the sign                                */
/* ------------------------------------------------------------------ */

/** The walls of an office block with windows mapped a floor to a row, three metres to a column. */
function facade(w: number, d: number, h: number, shift: number): THREE.BufferGeometry {
  const sides: THREE.BufferGeometry[] = [];
  const side = (len: number, x: number, z: number, yaw: number) => {
    const g = new THREE.PlaneGeometry(len, h).translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 24 + shift, (uv.getY(i) * h) / (8 * STOREY));
    sides.push(g.rotateY(yaw).translate(x, 0, z));
  };
  side(w, 0, d / 2, 0);
  side(w, 0, -d / 2, Math.PI);
  side(d, w / 2, 0, Math.PI / 2);
  side(d, -w / 2, 0, -Math.PI / 2);
  return merge(sides);
}

function Neighbours() {
  const windows = useMemo(() => windowsTexture(), []);
  const glass = useMemo(() => faded({ map: windows }), [windows]);
  const [walls, roofs] = useMemo(() => {
    const w: THREE.BufferGeometry[] = [];
    const r: THREE.BufferGeometry[] = [];
    NEIGHBOURS.forEach((n, i) => {
      const h = n.floors * STOREY;
      w.push(facade(n.w, n.d, h, i * 0.37).translate(n.x, GROUND_Y, n.z));
      r.push(tint(box(n.w + 0.3, 0.5, n.d + 0.3, n.x, GROUND_Y + h + 0.25, n.z), "#2a283b", 0.6));
      // Plant on the roof.
      r.push(tint(box(4, 1.6, 3, n.x - n.w / 4, GROUND_Y + h + 1.3, n.z), "#4a4858", 0.55), tint(box(2.5, 1.2, 2.5, n.x + n.w / 5, GROUND_Y + h + 1.1, n.z + n.d / 5), "#4a4858", 0.55));
      // A lit lobby at the foot of the building.
      r.push(tint(box(n.w * 0.4, 3, 0.2, n.x, GROUND_Y + 1.5, n.z + n.d / 2 + 0.1), "#ffe2a8", 1));
    });
    return [merge(w), merge(r)];
  }, []);
  useEffect(
    () => () => {
      walls.dispose();
      roofs.dispose();
      glass.dispose();
      windows.dispose();
    },
    [walls, roofs, glass, windows],
  );
  return (
    <group>
      <mesh geometry={walls} material={glass} />
      <mesh geometry={roofs} material={M.shaded} />
    </group>
  );
}

function Trees({ basic }: { basic: boolean }) {
  const { palmTrunks, palmCrowns, oakTrunks, oakCanopies } = useMemo(() => {
    const p = palms();
    const o = oaks().filter((_, i) => !basic || i % 2 === 0);
    const lean = (t: Tree) => compose(t.x, GROUND_Y, t.z, t.turn, [1, t.h, 1], t.lean);
    return {
      palmTrunks: p.map(lean),
      palmCrowns: p.map((t) => compose(t.x + Math.sin(t.lean) * t.h * Math.sin(t.turn), GROUND_Y + t.h, t.z + Math.sin(t.lean) * t.h * Math.cos(t.turn), t.turn)),
      oakTrunks: o.map((t) => compose(t.x, GROUND_Y, t.z, t.turn, [1, t.h * 0.45, 1])),
      oakCanopies: o.map((t) => compose(t.x, GROUND_Y + t.h * 0.62, t.z, t.turn, [t.h * 0.42, t.h * 0.34, t.h * 0.42])),
    };
  }, [basic]);
  const geo = useMemo(() => ({ trunk: palmTrunk(), crown: palmCrown(), oak: oakTrunk(), canopy: oakCanopy(basic) }), [basic]);
  return (
    <group>
      <Instances geometry={geo.trunk} material={M.shaded} matrices={palmTrunks} />
      <Instances geometry={geo.crown} material={M.shaded} matrices={palmCrowns} />
      <Instances geometry={geo.oak} material={M.shaded} matrices={oakTrunks} />
      <Instances geometry={geo.canopy} material={M.shaded} matrices={oakCanopies} />
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
        return compose(l.x + reach.x, LAYER.glow, l.z + reach.z, 0, [1, 1, 1]);
      }),
    [spots],
  );
  const geo = useMemo(() => ({ post: lampPost(), head: lampHead(), pool: flat(11, 11) }), []);
  const pool = useMemo(() => {
    const map = poolTexture();
    return faded({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  }, []);
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

function ParkedCars({ lite }: { lite: boolean }) {
  const cars = useMemo(() => parkedCars(), []);
  const matrices = useMemo(() => cars.map((c) => compose(c.x, GROUND_Y, c.z, c.rot)), [cars]);
  const colours = useMemo(() => cars.map((c) => c.colour), [cars]);
  const body = useMemo(() => carBody(lite), [lite]);
  return <Instances geometry={body} material={M.shaded} matrices={matrices} colours={colours} />;
}

/** The monument at the end of the drive, lettered on both faces. */
function Monument() {
  const sign = useMemo(() => logoSign(), []);
  const letters = useMemo(() => faded({ map: sign, transparent: true, toneMapped: false }), [sign]);
  const block = useMemo(
    () =>
      merge([
        tint(box(MONUMENT.w, MONUMENT.h, MONUMENT.d, 0, MONUMENT.h / 2, 0), "#4b4762", 0.5),
        tint(box(MONUMENT.w + 0.6, 0.25, MONUMENT.d + 0.6, 0, 0.12, 0), "#3a3750", 0.5),
        // Little uplights in the lawn.
        ...[-2, 2].flatMap((x) => [-1.3, 1.3].map((z) => tint(box(0.25, 0.12, 0.25, x, 0.06, z), "#fff1c9", 1))),
      ]),
    [],
  );
  useEffect(
    () => () => {
      letters.dispose();
      block.dispose();
    },
    [letters, block],
  );
  const w = MONUMENT.w * 0.82;
  return (
    <group position={[MONUMENT.x, GROUND_Y, MONUMENT.z]}>
      <mesh geometry={block} material={M.shaded} />
      {[1, -1].map((side) => (
        <mesh key={side} material={letters} position={[0, MONUMENT.h / 2 + 0.05, (side * MONUMENT.d) / 2 + side * 0.01]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[w, w / 3.2]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Traffic and the train                                               */
/* ------------------------------------------------------------------ */

const turned = new THREE.Matrix4();
const place = new THREE.Vector3();
const spin = new THREE.Quaternion();
const unit = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** One kind of vehicle on the move: bodies and their lights, each slot a lane and a place in its queue. */
function Fleet({ slots, body, lights, colours }: { slots: [number, number][]; body: THREE.BufferGeometry; lights: THREE.BufferGeometry; colours?: string[] }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = bodies.current;
    if (!mesh || !colours) return;
    const c = new THREE.Color();
    colours.forEach((hex, i) => mesh.setColorAt(i, c.set(hex)));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [colours]);
  useFrame(({ clock }) => {
    const b = bodies.current;
    const l = lamps.current;
    if (!b || !l) return;
    for (let k = 0; k < slots.length; k++) {
      const lane = LANES[slots[k][0]];
      place.set(vehicleX(lane, slots[k][1], clock.elapsedTime), GROUND_Y + 0.01, lane.z);
      spin.setFromAxisAngle(UP, lane.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
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
  return (
    <group>
      <instancedMesh ref={bodies} args={[body, M.shaded, slots.length]} frustumCulled={false} />
      <instancedMesh ref={lamps} args={[lights, M.glow, slots.length]} frustumCulled={false} />
    </group>
  );
}

const TRAFFIC_COLOURS = ["#d9d9de", "#26262e", "#9c1f2b", "#2f4c8f", "#8a8f99", "#e8e4d8"];

/** Cars and trucks on the expressway and the avenue. `share` thins the traffic for a computer without a GPU. */
function Traffic({ share, lite }: { share: number; lite: boolean }) {
  const { cars, trucks, colours } = useMemo(() => {
    const c: [number, number][] = [];
    const t: [number, number][] = [];
    LANES.forEach((lane, l) => {
      for (let i = 0; i < Math.max(1, Math.round(lane.count * share)); i++) (isTruck(l, i) ? t : c).push([l, i]);
    });
    return { cars: c, trucks: t, colours: c.map(([l, i]) => TRAFFIC_COLOURS[(l * 3 + i) % TRAFFIC_COLOURS.length]) };
  }, [share]);
  const geo = useMemo(() => ({ car: carBody(lite), carLights: carLights(), truck: truckBody(), truckLights: carLights(8.6, 1.0, 2.3) }), [lite]);
  return (
    <group>
      <Fleet slots={cars} body={geo.car} lights={geo.carLights} colours={colours} />
      <Fleet slots={trucks} body={geo.truck} lights={geo.truckLights} />
    </group>
  );
}

function Train() {
  const side = useMemo(() => trainSideTexture(), []);
  const materials = useMemo(() => {
    const plain = faded({ color: "#8d93a1" });
    const windows = faded({ map: side, toneMapped: false });
    // Box faces: +x end, -x end, roof, floor, then the two long sides.
    return [plain, plain, plain, plain, windows, windows];
  }, [side]);
  const geometry = useMemo(() => new THREE.BoxGeometry(TRAIN.carLength, TRAIN.height, TRAIN.width), []);
  const ref = useRef<THREE.InstancedMesh>(null);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const at = trainAt(clock.elapsedTime);
    mesh.visible = at !== null;
    if (!at) return;
    for (let k = 0; k < TRAIN.cars; k++) {
      place.set(at.x - at.dir * (k * (TRAIN.carLength + TRAIN.gap) + TRAIN.carLength / 2), GROUND_Y + 0.6 + TRAIN.height / 2, at.z);
      turned.compose(place, spin.identity(), unit);
      mesh.setMatrixAt(k, turned);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  useEffect(
    () => () => {
      geometry.dispose();
      side.dispose();
      new Set(materials).forEach((m) => m.dispose());
    },
    [geometry, side, materials],
  );
  return <instancedMesh ref={ref} args={[geometry, materials, TRAIN.cars]} frustumCulled={false} visible={false} />;
}

/* ------------------------------------------------------------------ */
/* The campus                                                          */
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
      <Hardware lite={basic} />
      <Neighbours />
      <Trees basic={basic} />
      <Lamps pools={!basic} />
      <ParkedCars lite={basic} />
      <Monument />
      <Traffic share={basic ? 0.4 : 1} lite={basic} />
      <Train />
    </group>
  );
}
