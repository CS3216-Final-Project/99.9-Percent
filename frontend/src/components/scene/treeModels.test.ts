import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { TREE_SPREAD } from './city';
import { reach, TREE_VARIANTS, treeModel, type TreeShape } from './treeModels';

const shapes = Object.keys(TREE_VARIANTS) as TreeShape[];
const every = shapes.flatMap((shape) => Array.from({ length: TREE_VARIANTS[shape] }, (_, variant) => [false, true].map((lite) => ({ shape, variant, lite }))).flat());
const top = (g: BufferGeometry) => {
  const p = g.attributes.position;
  let most = -Infinity;
  for (let i = 0; i < p.count; i++) most = Math.max(most, p.getY(i));
  return most;
};

describe('tree models', () => {
  it('stand one unit tall from the ground, so a tree is exactly as tall as it is said to be', () => {
    for (const { shape, variant, lite } of every) {
      const m = treeModel(shape, variant, lite);
      expect(Math.max(top(m.bark), top(m.leaves)), `${shape} ${variant} ${lite}`).toBeCloseTo(1, 6);
      m.bark.computeBoundingBox();
      expect(m.bark.boundingBox!.min.y, `${shape} ${variant} ${lite} roots`).toBeGreaterThan(-0.05);
    }
  });

  it('reach no further than the crown width the city keeps clear of the office, even at their widest', () => {
    // Each tree may be drawn up to 8% wider than its model.
    for (const { shape, variant, lite } of every) {
      const kinds = shape === 'round' ? (['round', 'blossom'] as const) : ([shape] as const);
      for (const kind of kinds) expect(reach(treeModel(shape, variant, lite)) * 1.08, `${shape} ${variant} ${lite}`).toBeLessThanOrEqual(TREE_SPREAD[kind]);
    }
  });

  it('come as indexed bark and leaves with a colour at every vertex, lighter in lite', () => {
    for (const { shape, variant, lite } of every) {
      const m = treeModel(shape, variant, lite);
      for (const g of [m.bark, m.leaves]) {
        expect(g.index).not.toBeNull();
        expect(g.attributes.color.count).toBe(g.attributes.position.count);
        expect(g.attributes.normal.count).toBe(g.attributes.position.count);
      }
      const size = (x: typeof m) => x.bark.attributes.position.count + x.leaves.attributes.position.count;
      if (!lite) expect(size(treeModel(shape, variant, true))).toBeLessThan(size(m) / 2);
      expect(size(m)).toBeLessThan(lite ? 1000 : 1800);
    }
  });

  it('shades leaves darker at the bottom of a crown than at the top', () => {
    const { leaves } = treeModel('round', 0, false);
    const p = leaves.attributes.position;
    const c = leaves.attributes.color;
    let low = 0, high = 0, nl = 0, nh = 0;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 0.55) { low += c.getX(i); nl++; }
      if (p.getY(i) > 0.85) { high += c.getX(i); nh++; }
    }
    expect(low / nl).toBeLessThan(high / nh);
  });

  it('is the same tree every time it is made', () => {
    const a = treeModel('palm', 1, false);
    const b = treeModel('palm', 1, false);
    expect(Array.from(b.leaves.attributes.position.array)).toEqual(Array.from(a.leaves.attributes.position.array));
  });
});
