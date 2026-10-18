import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useDetail } from "./detail";

/*
 * Photo-scanned ground, roofs and tree surfaces for the city at HD detail: seven CC0 sets from Poly Haven, credited in
 * public/textures/License.txt. Each was turned grey, so the city's own colours tint it, and keeps a colour map and a
 * normal map. The city's shaders map them by world position, so they need no texture coordinates; the trees' bark and
 * leaves are laid round the trunks and crowns from three sides.
 */

export type CitySurfaceId = "asphalt" | "lawn" | "pavement" | "gravel" | "roofTiles" | "bark" | "leaves";

/**
 * Folder under /textures, the metres one copy of the texture covers on the surface, how strongly its light and dark
 * show, how much broad patches of lighter and darker vary it, and the colour those broad lighter patches drift toward.
 */
const SURFACES: Record<CitySurfaceId, { dir: string; tile: number; contrast: number; mottle: number; hue: [number, number, number] }> = {
  asphalt: { dir: "asphalt", tile: 9, contrast: 1.2, mottle: 0.25, hue: [1, 1, 1] },
  lawn: { dir: "lawn", tile: 3.5, contrast: 1.45, mottle: 0.6, hue: [1.1, 1.02, 0.78] }, // sun-dried patches
  pavement: { dir: "pavement", tile: 3.6, contrast: 1.2, mottle: 0.2, hue: [1, 1, 1] },
  gravel: { dir: "gravel", tile: 2.4, contrast: 1.4, mottle: 0.3, hue: [1, 1, 1] },
  roofTiles: { dir: "roof-tiles", tile: 2.5, contrast: 1.5, mottle: 0.25, hue: [1, 1, 1] },
  bark: { dir: "bark", tile: 1.6, contrast: 1.3, mottle: 0, hue: [1, 1, 1] },
  leaves: { dir: "leaves", tile: 1.1, contrast: 1.1, mottle: 0, hue: [1, 1, 1] },
};

export interface CitySurface {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  tile: number;
  contrast: number;
  mottle: number;
  hue: [number, number, number];
}

export type CitySurfaces = Record<CitySurfaceId, CitySurface>;

const loader = new THREE.TextureLoader();
let pending: Promise<CitySurfaces> | null = null;

function texture(url: string, colour: boolean, anisotropy: number): Promise<THREE.Texture> {
  return loader.loadAsync(url).then((t) => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = anisotropy;
    return t;
  });
}

/** Fetch every set once. If any file fails, the attempt is forgotten and the city keeps its plain colours. */
function loadCitySurfaces(anisotropy: number): Promise<CitySurfaces> {
  if (pending) return pending;
  const ids = Object.keys(SURFACES) as CitySurfaceId[];
  const attempt = Promise.all(
    ids.map(async (id): Promise<[CitySurfaceId, CitySurface]> => {
      const { dir, tile, contrast, mottle, hue } = SURFACES[id];
      const [map, normalMap] = await Promise.all([texture(`/textures/${dir}/color.jpg`, true, anisotropy), texture(`/textures/${dir}/normal.jpg`, false, anisotropy)]);
      return [id, { map, normalMap, tile, contrast, mottle, hue }];
    }),
  ).then((list) => Object.fromEntries(list) as CitySurfaces);
  pending = attempt;
  attempt.catch((error: unknown) => {
    if (pending === attempt) pending = null;
    console.warn("City textures failed to load; the city keeps its plain colours.", error);
  });
  return attempt;
}

/** The city's photo surfaces once loaded at HD detail, or null: at basic detail, while loading, or if they failed. */
export function useCitySurfaces(): CitySurfaces | null {
  const hd = useDetail() === "hd";
  const gl = useThree((s) => s.gl);
  const [surfaces, setSurfaces] = useState<CitySurfaces | null>(null);
  useEffect(() => {
    if (!hd) return;
    let live = true;
    loadCitySurfaces(Math.min(8, gl.capabilities.getMaxAnisotropy()))
      .then((s) => {
        if (live) setSurfaces(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hd, gl]);
  return hd ? surfaces : null;
}
