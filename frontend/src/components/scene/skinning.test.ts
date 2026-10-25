import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cloneSharingSkeletons } from "./skinning";

function skinned(skeleton: THREE.Skeleton): THREE.SkinnedMesh {
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.bind(skeleton, mesh.matrixWorld);
  return mesh;
}

describe("cloneSharingSkeletons", () => {
  it("gives meshes that shared a skeleton one clone, and the rest their own", () => {
    const bones = [new THREE.Bone(), new THREE.Bone()];
    bones[0].add(bones[1]);
    const shared = new THREE.Skeleton(bones);
    const otherBone = new THREE.Bone();
    const other = new THREE.Skeleton([otherBone]);
    const source = new THREE.Group();
    source.add(bones[0], otherBone, skinned(shared), skinned(shared), skinned(other));

    const clone = cloneSharingSkeletons(source);
    const meshes: THREE.SkinnedMesh[] = [];
    clone.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh);
    });
    expect(meshes).toHaveLength(3);
    expect(meshes[0].skeleton).toBe(meshes[1].skeleton);
    expect(meshes[0].skeleton).not.toBe(shared);
    expect(meshes[2].skeleton).not.toBe(meshes[0].skeleton);
    expect(meshes[2].skeleton).not.toBe(other);
    // The clones pose the cloned bones, not the source's.
    for (const mesh of meshes) for (const bone of mesh.skeleton.bones) expect(source.getObjectById(bone.id)).toBeUndefined();
  });
});
