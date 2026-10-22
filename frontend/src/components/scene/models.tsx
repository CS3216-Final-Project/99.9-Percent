"use client";

import * as THREE from "three";
import { useEffect, useMemo, useState } from "react";
import { useDetail, type Detail } from "./detail";
import { bake } from "./bakeModels";
import { HD_MODELS, HD_SWAPS, loadModel, MODELS, type HdId, type ModelId } from "./modelCatalog";
import type { Placement } from "./bakeModels";
export type { Placement } from "./bakeModels";

/*
 * Furniture models from two CC0 packs, Kenney's Furniture Kit (kenney.nl) and
 * KayKit Furniture Bits (kaylousberg.com); the licences sit beside the files in
 * public/models. Nothing here moves, so every placed model is baked into one
 * mesh per material: the whole office's furniture costs a dozen draw calls.
 *
 * Models are placed by their bounding box: `p` is where the bottom centre of
 * the box goes, so it does not matter where each artist put the origin. Both
 * packs face +z.
 *
 * At HD detail the most visible pieces (plants, sofas, armchairs, tables,
 * boxes, a lamp) are swapped for photo-scanned CC0 models from Poly Haven.
 * Each stand-in is scaled to fit inside the box of the model it replaces, so
 * the layout is the same at both levels of detail.
 */
/**
 * Draw placed models. They appear together once all have loaded, and the rest
 * of the room never waits for them. If they cannot be downloaded, the office is
 * drawn without them and the game carries on.
 */
export function ModelBatch({ placements, shadows = true }: { placements: Placement[]; shadows?: boolean }) {
  const [scenes, setScenes] = useState<Map<ModelId, THREE.Object3D> | null>(null);
  useEffect(() => {
    const ids = [...new Set(placements.map((p) => p.id))];
    let live = true;
    Promise.all(ids.map((id) => loadModel(MODELS[id]))).then(
      (loaded) => {
        if (live) setScenes(new Map(ids.map((id, i) => [id, loaded[i]])));
      },
      (error: unknown) => {
        if (live) console.warn("Furniture models failed to load; drawing the office without them.", error);
      },
    );
    return () => {
      live = false;
    };
  }, [placements]);
  const detail = useDetail();
  const standIns = useStandIns(placements, detail);
  const batches = useMemo(() => (scenes ? bake(placements, scenes, standIns, detail) : []), [placements, scenes, standIns, detail]);
  useEffect(() => () => batches.forEach((b) => b.geometry.dispose()), [batches]);
  return (
    <group>
      {batches.map((b, i) => (
        <mesh key={i} geometry={b.geometry} material={b.material} castShadow={shadows} receiveShadow />
      ))}
    </group>
  );
}

/**
 * The photo-scanned stand-ins these placements need, at HD detail only. Until
 * they load, or if they cannot be downloaded, the stylised models stay.
 */
function useStandIns(placements: Placement[], detail: Detail): Map<HdId, THREE.Object3D> | null {
  const [loaded, setLoaded] = useState<Map<HdId, THREE.Object3D> | null>(null);
  const ids = useMemo(() => [...new Set(placements.flatMap((p) => HD_SWAPS[p.id]?.id ?? []))], [placements]);
  useEffect(() => {
    if (detail !== "hd" || ids.length === 0) return;
    let live = true;
    Promise.all(ids.map((id) => loadModel(HD_MODELS[id]))).then(
      (list) => {
        if (live) setLoaded(new Map(ids.map((id, i) => [id, list[i]])));
      },
      (error: unknown) => {
        if (live) console.warn("HD furniture failed to load; keeping the stylised models.", error);
      },
    );
    return () => {
      live = false;
    };
  }, [ids, detail]);
  return detail === "hd" ? loaded : null;
}
