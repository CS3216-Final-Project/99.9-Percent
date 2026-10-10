import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/*
 * One glTF loader for every model in the room. The creature and photo-scanned
 * models are compressed with meshopt, which this loader can decode; the older
 * furniture packs are plain glTF and load as before.
 */

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loads = new Map<string, Promise<GLTF>>();

/** Fetch a model once however often it is asked for. A failed fetch is forgotten, so a later mount tries again. */
export function loadGltf(url: string): Promise<GLTF> {
  let load = loads.get(url);
  if (!load) {
    load = loader.loadAsync(url);
    load.catch(() => loads.delete(url));
    loads.set(url, load);
  }
  return load;
}

/**
 * Compressed models store positions, normals and texture coordinates as small
 * normalised integers. Before a geometry is moved and merged with others, turn
 * every attribute back into plain floats so transforms are not clipped.
 */
export function toFloatAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const a = attr as THREE.BufferAttribute;
    if (a.array instanceof Float32Array && !a.normalized && !(a as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    geometry.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  return geometry;
}
