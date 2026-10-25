import * as THREE from "three";

type Kind = "skinned" | "instanced" | "instancedTinted";

const cache = new Map<Kind, THREE.MeshDepthMaterial>();

/** The depth material the shadow pass draws a caster with, shared only by casters drawn the same way. three's own is one material for every caster, and its program is refetched whenever a skinned, an instanced and a plain caster follow one another (see WebGLRenderer.setProgram); casters of one kind through one material never switch. */
export function shadowDepthMaterial(kind: Kind): THREE.MeshDepthMaterial {
  let m = cache.get(kind);
  if (!m) {
    m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    cache.set(kind, m);
  }
  return m;
}
