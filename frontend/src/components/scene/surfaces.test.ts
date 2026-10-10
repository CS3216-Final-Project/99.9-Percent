import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSurfaces, projectUV, surfaceMaterial } from './surfaces';

afterEach(() => vi.restoreAllMocks());

function uRange(g: THREE.BufferGeometry): [number, number] {
  const uv = g.attributes.uv;
  const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
  return [Math.min(...us), Math.max(...us)];
}

describe('world-scale texture coordinates', () => {
  it('repeats a texture once per its size in metres', () => {
    const g = projectUV(new THREE.PlaneGeometry(6, 3), 1.5);
    expect(uRange(g)).toEqual([-2, 2]);
  });

  it('lines the pattern up across neighbouring floors', () => {
    // Two 4 m floors side by side, centred at x = 2 and x = 6.
    const left = projectUV(new THREE.PlaneGeometry(4, 2), 2, [2, 0, 0]);
    const right = projectUV(new THREE.PlaneGeometry(4, 2), 2, [6, 0, 0]);
    expect(uRange(left)[1]).toBeCloseTo(2);
    expect(uRange(right)[0]).toBeCloseTo(2);
  });

  it('maps the end faces of a wall along its own length', () => {
    // A wall running along z: its long faces point along x, so they are mapped by z and height.
    const g = projectUV(new THREE.BoxGeometry(0.2, 3, 8), 4);
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const side = Array.from({ length: nor.count }, (_, i) => i).filter((i) => Math.abs(nor.getX(i)) > 0.9);
    const us = side.map((i) => uv.getX(i));
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(2);
  });
});

describe('loading the HD surfaces', () => {
  it('warns once on a failed download, then retries and keeps the loaded set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const load = vi.spyOn(THREE.Loader.prototype, 'loadAsync').mockRejectedValue(new Error('offline'));
    await expect(loadSurfaces(4)).rejects.toThrow('offline');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('HD textures failed to load');

    load.mockImplementation(async () => new THREE.Texture());
    const surfaces = await loadSurfaces(4);
    expect(Object.keys(surfaces).sort()).toEqual(['carpet', 'concrete', 'kitchenTiles', 'parquet', 'plaster', 'serverTiles']);
    // Colour maps are gamma-corrected; normal and roughness data must not be.
    expect(surfaces.parquet.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(surfaces.parquet.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(surfaces.parquet.arm.colorSpace).toBe(THREE.NoColorSpace);
    expect(surfaces.parquet.map.wrapS).toBe(THREE.RepeatWrapping);

    const calls = load.mock.calls.length;
    expect(await loadSurfaces(4)).toBe(surfaces);
    expect(load.mock.calls.length).toBe(calls);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('colours a grey surface by its tint and multiplies a coloured one', () => {
    const grey = { map: new THREE.Texture(), normalMap: new THREE.Texture(), arm: new THREE.Texture(), size: 1, grey: true };
    const wood = { ...grey, grey: false };
    const tint = new THREE.Color('#4f4987');
    expect(surfaceMaterial(grey, '#4f4987').color.r).toBeGreaterThan(tint.r);
    expect(surfaceMaterial(wood, '#4f4987').color.equals(tint)).toBe(true);
  });
});
