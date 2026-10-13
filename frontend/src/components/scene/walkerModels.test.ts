import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { WALK } from './city';
import { HIP, LIMB, PART, SHOULDER, STATURE, stature, walkerModel } from './walkerModels';

const bounds = (g: BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

/** Every vertex's part and limb. */
const who = (g: BufferGeometry) => {
  const a = g.attributes.aWho;
  return Array.from({ length: a.count }, (_, i) => ({ i, part: a.getX(i), limb: a.getY(i) }));
};

describe('walker models', () => {
  it('stand a person tall on the ground, no wider than a walking loop leaves room for', () => {
    for (const lite of [false, true]) {
      const b = bounds(walkerModel(lite));
      expect(b.min.y, `${lite}`).toBeCloseTo(0, 6);
      expect(b.max.y, `${lite}`).toBeGreaterThan(STATURE - 0.05);
      expect(b.max.y, `${lite}`).toBeLessThanOrEqual(STATURE + 1e-6);
      for (const v of [b.min.x, b.max.x, b.min.z, b.max.z]) expect(Math.abs(v), `${lite}`).toBeLessThan(WALK.radius);
    }
  });

  it('dress a person in a shirt, skin, hair, trousers and shoes, with a part at every vertex', () => {
    const g = walkerModel();
    expect(g.index).not.toBeNull();
    for (const name of ['normal', 'color', 'aWho']) expect(g.attributes[name].count).toBe(g.attributes.position.count);
    expect(new Set(who(g).map((w) => w.part))).toEqual(new Set(Object.values(PART)));
  });

  it('hang the legs from the hip and the arms from the shoulder, one of each on either side', () => {
    for (const lite of [false, true]) {
      const g = walkerModel(lite);
      const p = g.attributes.position;
      const all = who(g);
      for (const limb of [LIMB.leftLeg, LIMB.rightLeg, LIMB.leftArm, LIMB.rightArm]) {
        const own = all.filter((w) => w.limb === limb);
        const pivot = limb === LIMB.leftLeg || limb === LIMB.rightLeg ? HIP : SHOULDER;
        expect(own.length, `${lite} ${limb}`).toBeGreaterThan(0);
        expect(Math.max(...own.map((w) => p.getY(w.i))), `${lite} ${limb}`).toBeLessThanOrEqual(pivot + 1e-6);
        // Left limbs on the left (-x, facing -z), right on the right.
        const left = limb === LIMB.leftLeg || limb === LIMB.leftArm;
        expect(own.every((w) => (left ? p.getX(w.i) < 0 : p.getX(w.i) > 0)), `${lite} ${limb} side`).toBe(true);
      }
      // Nothing above the hips swings with a leg, and the head and torso never swing.
      expect(all.filter((w) => w.limb === LIMB.none && (w.part === PART.trousers || w.part === PART.shoes))).toEqual([]);
    }
  });

  it('cost no more than the round walkers they replace, and less when lite', () => {
    const full = walkerModel().attributes.position.count;
    const lite = walkerModel(true).attributes.position.count;
    expect(full).toBeLessThan(520);
    expect(lite).toBeLessThan(full / 2);
  });

  it('makes passers-by between 1.5 and 1.9 metres tall, taller the bigger their size', () => {
    expect(stature(0.75)).toBeCloseTo(1.5, 6);
    expect(stature(1.2)).toBeCloseTo(1.9, 6);
    expect(stature(1.0)).toBeGreaterThan(stature(0.9));
  });
});
