import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { shadowDepthMaterial } from "./shadowDepth";

describe("shadowDepthMaterial", () => {
  it("returns one instance per kind, differing between kinds", () => {
    expect(shadowDepthMaterial("skinned")).toBe(shadowDepthMaterial("skinned"));
    expect(shadowDepthMaterial("instanced")).toBe(shadowDepthMaterial("instanced"));
    expect(shadowDepthMaterial("skinned")).not.toBe(shadowDepthMaterial("instanced"));
    expect(shadowDepthMaterial("instanced")).not.toBe(shadowDepthMaterial("instancedTinted"));
    expect(shadowDepthMaterial("instancedTinted").depthPacking).toBe(THREE.RGBADepthPacking);
  });
});
