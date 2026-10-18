import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { isLong, vehicleSize, type VehicleKind } from './city';
import { FINISH, vehicleBody, vehicleLights, vehicleSeams } from './vehicleModels';

const KINDS: VehicleKind[] = ['sedan', 'hatch', 'suv', 'taxi', 'robotaxi', 'van', 'truck', 'bus'];

const bounds = (g: BufferGeometry) => {
  g.computeBoundingBox();
  return g.boundingBox!;
};

/** Whether a geometry stays on the ground and within the ground a lane keeps for a kind of vehicle. */
const fits = (g: BufferGeometry, kind: VehicleKind) => {
  const b = bounds(g);
  const { length, width } = vehicleSize(kind);
  const e = 1e-6;
  return b.min.y >= -e && b.min.x >= -width / 2 - e && b.max.x <= width / 2 + e && b.min.z >= -length / 2 - e && b.max.z <= length / 2 + e;
};

const finishes = (g: BufferGeometry) => {
  const f = g.attributes.aFinish;
  const out = new Map<number, number[]>();
  for (let i = 0; i < f.count; i++) out.set(f.getX(i), [...(out.get(f.getX(i)) ?? []), i]);
  return out;
};

describe('vehicle models', () => {
  it('keep every kind, lamps and all, within the ground its lane keeps for it, so the junctions stay clear', () => {
    for (const kind of KINDS) {
      for (const lite of [false, true]) expect(fits(vehicleBody(kind, lite), kind), `${kind} body${lite ? ' (lite)' : ''}`).toBe(true);
      expect(fits(vehicleLights(kind), kind), `${kind} lamps`).toBe(true);
    }
  });

  it('would not fit a bus or a truck where a car goes', () => {
    expect(fits(vehicleBody('bus'), 'sedan')).toBe(false);
    expect(fits(vehicleBody('truck'), 'van')).toBe(false);
  });

  it('stand on their tyres, or on the ground at their lowest when lite', () => {
    for (const kind of KINDS) {
      expect(bounds(vehicleBody(kind)).min.y, kind).toBeCloseTo(0, 6);
      expect(bounds(vehicleBody(kind, true)).min.y, `${kind} lite`).toBeGreaterThan(0.1);
    }
  });

  it('come indexed, with a normal, a colour and a finish at every vertex', () => {
    for (const kind of KINDS) {
      for (const g of [vehicleBody(kind), vehicleBody(kind, true), vehicleLights(kind)]) {
        expect(g.index, kind).not.toBeNull();
        for (const name of ['normal', 'color', 'aFinish', 'aWheel']) expect(g.attributes[name].count, `${kind} ${name}`).toBe(g.attributes.position.count);
      }
    }
  });

  it('paint pale for each vehicle to tint its own colour, behind dark glass and trim', () => {
    for (const kind of KINDS) {
      const g = vehicleBody(kind);
      const by = finishes(g);
      const c = g.attributes.color;
      const lightest = (ids: number[]) => Math.max(...ids.map((i) => Math.min(c.getX(i), c.getY(i), c.getZ(i))));
      const darkest = (ids: number[]) => Math.min(...ids.map((i) => Math.min(c.getX(i), c.getY(i), c.getZ(i))));
      expect(darkest(by.get(FINISH.paint) ?? []), `${kind} paint`).toBeGreaterThan(0.6);
      expect(lightest(by.get(FINISH.glass) ?? []), `${kind} glass`).toBeLessThan(0.05);
      expect(by.get(FINISH.trim)?.length ?? 0, `${kind} trim`).toBeGreaterThan(0);
    }
  });

  it('shows side windows where a car has its cabin', () => {
    const g = vehicleBody('sedan');
    const p = g.attributes.position;
    const glass = finishes(g).get(FINISH.glass) ?? [];
    // Beside the driver, above the doors: glass at the side, and none along the doors below it.
    expect(glass.some((i) => p.getZ(i) > -0.06 && p.getZ(i) < 0.86 && Math.abs(p.getX(i)) > 0.6 && p.getY(i) > 1.0)).toBe(true);
    expect(glass.some((i) => p.getY(i) < 0.85)).toBe(false);
  });

  it('marks only wheel vertices with their place from hub to rim, and only when not lite', () => {
    for (const kind of KINDS) {
      const full = vehicleBody(kind);
      const w = full.attributes.aWheel;
      const f = full.attributes.aFinish;
      let wheels = 0;
      for (let i = 0; i < w.count; i++) {
        const v = w.getX(i);
        expect(v === 0 || (v >= 1 && v <= 2), `${kind} aWheel ${v}`).toBe(true);
        if (v > 0) {
          expect(f.getX(i), `${kind} wheel finish`).toBe(FINISH.trim);
          wheels++;
        }
      }
      expect(wheels, `${kind} full wheels`).toBeGreaterThan(0);
      const lite = vehicleBody(kind, true).attributes.aWheel;
      expect(Math.max(...(lite.array as Float32Array)), `${kind} lite wheels`).toBe(0);
    }
  });

  it('parts the doors along each side where the windows let it, inside the kind\'s own length', () => {
    const expected: Record<VehicleKind, number> = { sedan: 3, taxi: 3, robotaxi: 3, hatch: 3, suv: 3, van: 2, truck: 2, bus: 0 };
    for (const kind of KINDS) {
      const seams = vehicleSeams(kind);
      expect(seams.length, kind).toBe(expected[kind]);
      expect([...seams].sort((a, b) => a - b), kind).toEqual(seams);
      for (const z of seams) expect(Math.abs(z), `${kind} seam ${z}`).toBeLessThan(vehicleSize(kind).length / 2);
    }
  });

  it('cost little to draw a thousand times over, and less still when lite', () => {
    for (const kind of KINDS) {
      const full = vehicleBody(kind).attributes.position.count;
      const lite = vehicleBody(kind, true).attributes.position.count;
      expect(full, kind).toBeLessThan(isLong(kind) ? 1800 : 1400);
      expect(lite, `${kind} lite`).toBeLessThan(isLong(kind) ? 260 : 160);
      expect(lite, `${kind} lite`).toBeLessThan(full / 3);
    }
  });
});
