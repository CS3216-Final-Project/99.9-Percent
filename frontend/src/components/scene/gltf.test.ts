import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { toFloatAttributes } from './gltf';

describe('compressed geometry', () => {
  it('turns normalised integer positions into floats so transforms are not clipped', () => {
    // A compressed vertex at 0.5 along x, stored as a normalised 16-bit integer.
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Int16Array([16383, 0, 0]), 3, true));
    toFloatAttributes(g).applyMatrix4(new THREE.Matrix4().makeScale(10, 1, 1));
    const pos = g.attributes.position as THREE.BufferAttribute;
    expect(pos.array).toBeInstanceOf(Float32Array);
    // Left as an integer the result would have been clamped to 1.
    expect(pos.getX(0)).toBeCloseTo(5, 2);
  });

  it('leaves plain float attributes as they are', () => {
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(new Float32Array([1, 2, 3]), 3);
    g.setAttribute('position', attr);
    toFloatAttributes(g);
    expect(g.attributes.position).toBe(attr);
  });
});
