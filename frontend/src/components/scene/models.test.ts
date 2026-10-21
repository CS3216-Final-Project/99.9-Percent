import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { atop, mdl, placeModels } from "./furniture";
import { bake } from "./bakeModels";
import { type HdId, type ModelId } from "./modelCatalog";

function box(size: [number, number, number], color: string): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color })));
  return group;
}

describe("model placements", () => {
  it.each(["hd", "basic"] as const)("keeps a box on its support at %s detail", (detail) => {
    const scenes = new Map<ModelId, THREE.Object3D>([
      ["boxClosed", box([1, 1, 1], "#223344")],
      ["lampTable", box([0.5, 1, 0.5], "#aabbcc")],
    ]);
    const standIns = new Map<HdId, THREE.Object3D>([
      ["box", box([1.5, 0.35, 0.8], "#ccaa88")],
      ["deskLamp", box([0.2, 0.8, 0.2], "#dd7744")],
    ]);
    const lower = mdl("boxClosed", 0, 0, 0, 1.3);
    const upper = atop(lower, mdl("lampTable", 0, 0, 0, 1));
    const batches = bake([lower, upper], scenes, detail === "hd" ? standIns : null, detail);
    const bounds = batches
      .map(({ geometry }) => {
        geometry.computeBoundingBox();
        return geometry.boundingBox!;
      })
      .sort((a, b) => a.min.y - b.min.y);

    expect(bounds).toHaveLength(2);
    expect(Math.abs(bounds[1].min.y - bounds[0].max.y)).toBeLessThan(1e-6);
  });

  it("remaps support references to copied placements", () => {
    const lower = mdl("boxClosed", 0, 0);
    const upper = atop(lower, mdl("boxOpen", 0, 0));
    const [placedLower, placedUpper] = placeModels([lower, upper], 4, 6, Math.PI / 2);

    expect(placedUpper.on).toBe(placedLower);
    expect(placedLower).not.toBe(lower);
  });
});
