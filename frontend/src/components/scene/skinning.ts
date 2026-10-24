import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Clone a rigged model so skinned meshes that shared a Skeleton in the source share one Skeleton in the clone.
 * SkeletonUtils.clone copies the skeleton once per skinned mesh, so a creature of six meshes was posed six times
 * a frame and uploaded six bone textures; the renderer poses each Skeleton once a frame.
 */
export function cloneSharingSkeletons(source: THREE.Object3D): THREE.Object3D {
  const src: THREE.SkinnedMesh[] = [];
  source.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) src.push(o as THREE.SkinnedMesh);
  });
  const object = cloneSkinned(source);
  const dst: THREE.SkinnedMesh[] = [];
  object.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) dst.push(o as THREE.SkinnedMesh);
  });
  // Both traversals visit the same structure in the same order, so src[i] and dst[i] are one mesh and its clone.
  const shared = new Map<THREE.Skeleton, THREE.Skeleton>();
  for (let i = 0; i < src.length && i < dst.length; i++) {
    const s = shared.get(src[i].skeleton);
    if (s) dst[i].bind(s, dst[i].bindMatrix);
    else shared.set(src[i].skeleton, dst[i].skeleton);
  }
  return object;
}
