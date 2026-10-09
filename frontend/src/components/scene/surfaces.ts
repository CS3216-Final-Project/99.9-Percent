import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useDetail } from "./detail";

/*
 * Photo-scanned floors and walls for the HD detail level: CC0 sets from Poly
 * Haven and ambientCG, credited in public/textures/License.txt. Each set has a
 * colour map, a normal map and one map packing ambient occlusion, roughness and
 * metalness into red, green and blue, which is how three.js reads them.
 *
 * Surfaces are mapped in world metres, so a plank is the same size everywhere
 * and the pattern runs on across neighbouring floors.
 */

export type SurfaceId = "parquet" | "concrete" | "kitchenTiles" | "serverTiles" | "plaster" | "carpet";

/**
 * Folder under /textures, the width in metres one copy of the texture covers,
 * and whether the set was turned grey so the game can colour it.
 */
const SURFACES: Record<SurfaceId, { dir: string; size: number; grey: boolean }> = {
  parquet: { dir: "parquet", size: 3.4, grey: false },
  concrete: { dir: "concrete", size: 3, grey: true },
  kitchenTiles: { dir: "kitchen-tiles", size: 3, grey: false },
  // Three by three tiles, so each is 0.9 m like the raised floor it replaces.
  serverTiles: { dir: "server-tiles", size: 2.7, grey: true },
  plaster: { dir: "plaster", size: 3.2, grey: true },
  carpet: { dir: "carpet", size: 1.7, grey: true },
};

export interface Surface {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** Ambient occlusion, roughness and metalness. */
  arm: THREE.Texture;
  /** Metres covered by one copy of the texture. */
  size: number;
  /** A grey set, coloured entirely by its tint. */
  grey: boolean;
}

export type Surfaces = Record<SurfaceId, Surface>;

/**
 * The grey sets average about this much in linear light. Dividing a tint by it
 * gives the surface that colour on average.
 */
const GREY_MEAN = 0.58;

const loader = new THREE.TextureLoader();
let pending: Promise<Surfaces> | null = null;

function texture(url: string, colour: boolean, anisotropy: number): Promise<THREE.Texture> {
  return loader.loadAsync(url).then((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    // Only the colour map holds colours; the others hold data and must not be gamma-corrected.
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    return t;
  });
}

/**
 * Fetch every surface once, however many floors ask. If any file fails, the
 * attempt is forgotten so a later mount tries again, and the room keeps its
 * basic surfaces meanwhile.
 */
export function loadSurfaces(anisotropy: number): Promise<Surfaces> {
  if (pending) return pending;
  const ids = Object.keys(SURFACES) as SurfaceId[];
  const attempt = Promise.all(
    ids.map(async (id): Promise<[SurfaceId, Surface]> => {
      const { dir, size, grey } = SURFACES[id];
      const base = `/textures/${dir}/`;
      const [map, normalMap, arm] = await Promise.all([
        texture(`${base}color.jpg`, true, anisotropy),
        texture(`${base}normal.jpg`, false, anisotropy),
        texture(`${base}arm.jpg`, false, anisotropy),
      ]);
      return [id, { map, normalMap, arm, size, grey }];
    }),
  ).then((entries) => Object.fromEntries(entries) as Surfaces);
  pending = attempt;
  attempt.catch((error: unknown) => {
    if (pending === attempt) pending = null;
    console.warn("HD textures failed to load; drawing the basic surfaces.", error);
  });
  return attempt;
}

/** The HD surfaces once they have loaded, or null at basic detail, while loading and after a failure. */
export function useSurfaces(): Surfaces | null {
  const detail = useDetail();
  const gl = useThree((s) => s.gl);
  const [surfaces, setSurfaces] = useState<Surfaces | null>(null);
  useEffect(() => {
    if (detail !== "hd") return;
    let live = true;
    loadSurfaces(Math.min(8, gl.capabilities.getMaxAnisotropy())).then(
      (s) => {
        if (live) setSurfaces(s);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [detail, gl]);
  return detail === "hd" ? surfaces : null;
}

/**
 * A physically based material for a surface. A grey set comes out `tint` on
 * average; a coloured set is multiplied by it.
 */
export function surfaceMaterial(s: Surface, tint = "#ffffff", roughness = 1): THREE.MeshStandardMaterial {
  const color = new THREE.Color(tint).multiplyScalar(s.grey ? 1 / GREY_MEAN : 1);
  return new THREE.MeshStandardMaterial({ color, map: s.map, normalMap: s.normalMap, aoMap: s.arm, roughnessMap: s.arm, roughness, metalness: 0 });
}

/**
 * Give a geometry texture coordinates in world metres, projected along each
 * face's normal. `offset` is where the geometry's origin sits in the plane it
 * is projected on, so neighbouring pieces line up.
 */
export function projectUV(geometry: THREE.BufferGeometry, size: number, offset: [number, number, number] = [0, 0, 0]): THREE.BufferGeometry {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + offset[0];
    const y = pos.getY(i) + offset[1];
    const z = pos.getZ(i) + offset[2];
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const [u, v] = nx >= ny && nx >= nz ? [z, y] : ny >= nz ? [x, z] : [x, y];
    uv[i * 2] = u / size;
    uv[i * 2 + 1] = v / size;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}
