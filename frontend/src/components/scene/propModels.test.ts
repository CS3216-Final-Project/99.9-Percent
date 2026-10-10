import { describe, expect, it } from 'vitest';
import { buildProp, MAC, MAC_COLOUR_NAMES, type PropKind } from './propModels';

const KINDS: [PropKind, string[]][] = [
  ['imac', MAC_COLOUR_NAMES],
  ['keyboard', MAC_COLOUR_NAMES],
  ['mouse', MAC_COLOUR_NAMES],
  ['vending', ['red', 'blue']],
  ['cooler', ['']],
  ['arcade', ['purple', 'red']],
  ['crac', ['']],
  ['fridge', ['']],
  ['espresso', ['']],
];

/** Vertices one prop may cost, so the office stays cheap to draw without a GPU. */
const VERTEX_BUDGET = 40_000;

describe('detailed props', () => {
  it.each(KINDS)('builds every %s variant within the vertex budget', (kind, variants) => {
    for (const variant of variants) {
      const { geometries } = buildProp(kind, variant);
      let vertices = 0;
      for (const g of geometries.values()) {
        expect(g.attributes.color.count).toBe(g.attributes.position.count);
        vertices += g.attributes.position.count;
      }
      expect(geometries.size).toBeGreaterThan(0);
      expect(vertices).toBeLessThan(VERTEX_BUDGET);
    }
  });

  it('keeps every part of a Mac behind its picture', () => {
    // The office draws the picture MAC.gap in front of the glass; nothing may poke through it. The bezel and
    // border are single quads whose corners lie just outside the picture, so look a little beyond its edge.
    const { geometries } = buildProp('imac', 'blue');
    const margin = 0.02;
    let frontmost = -Infinity;
    for (const g of geometries.values()) {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const near = Math.abs(pos.getX(i)) < MAC.screenW / 2 + margin && Math.abs(pos.getY(i) - MAC.displayY) < MAC.screenH / 2 + margin;
        if (near) frontmost = Math.max(frontmost, pos.getZ(i));
      }
    }
    expect(frontmost).toBeLessThan(MAC.gap);
    // And the glass is right behind it, so the picture does not float.
    expect(frontmost).toBeGreaterThan(0);
  });

  it('labels the vending machines and arcade marquees', () => {
    expect(buildProp('vending', 'blue').signs.map((s) => s.text)).toEqual(['COLD DRINKS']);
    expect(buildProp('arcade', 'purple').signs).toHaveLength(1);
    expect(buildProp('fridge').signs).toHaveLength(0);
  });
});
