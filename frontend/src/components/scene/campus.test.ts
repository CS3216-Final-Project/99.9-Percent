import { describe, expect, it } from 'vitest';
import {
  AVENUE,
  BUILDING,
  CLEAR,
  EXPRESSWAY,
  EXPRESSWAY_WIDTH,
  fadeAt,
  FADE,
  fromBuilding,
  inside,
  isTruck,
  lamps,
  LANE,
  LANES,
  LOOP,
  LOT,
  MONUMENT,
  NEIGHBOURS,
  neighbourRect,
  oaks,
  overlaps,
  palms,
  PAVEMENT,
  parkedCars,
  RAILWAY,
  REACH,
  ROADS,
  STALL,
  stalls,
  STOREY,
  TRAIN,
  TRAIN_LENGTH,
  trainAt,
  VEHICLE,
  vehicleX,
  type Rect,
} from './campus';

const stallRects: Rect[] = stalls().map((s) => [s.x - STALL.w / 2, s.z - STALL.d / 2, s.x + STALL.w / 2, s.z + STALL.d / 2]);
const tall = [...palms().map((t) => ({ ...t, kind: 'palm' })), ...oaks().map((t) => ({ ...t, kind: 'oak' })), ...lamps().map((l) => ({ ...l, kind: 'lamp' }))];

/** Shortest distance between two rectangles, zero if they touch. */
function gap(a: Rect, b: Rect): number {
  return Math.hypot(Math.max(b[0] - a[2], 0, a[0] - b[2]), Math.max(b[1] - a[3], 0, a[1] - b[3]));
}

describe('the campus outside the office', () => {
  it('keeps trees, lamps and other buildings far enough away that they never hide the office', () => {
    for (const t of tall) expect(fromBuilding(t.x, t.z), `${t.kind} at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`).toBeGreaterThanOrEqual(CLEAR);
    for (const n of NEIGHBOURS) expect(gap(neighbourRect(n), BUILDING)).toBeGreaterThanOrEqual(1.6 * n.floors * STOREY);
  });

  it('keeps trees and lamps off the roads and out of the parking stalls', () => {
    for (const t of tall) {
      for (const r of ROADS) expect(inside(t.x, t.z, r.rect, 0.3), `${t.kind} on the ${r.name}`).toBe(false);
      for (const s of stallRects) expect(inside(t.x, t.z, s, 0.2), `${t.kind} in a stall`).toBe(false);
      for (const n of NEIGHBOURS) expect(inside(t.x, t.z, neighbourRect(n), 0.5), `${t.kind} in a neighbour`).toBe(false);
    }
  });

  it('gives the neighbours lots of their own, clear of the roads, the parking and each other', () => {
    NEIGHBOURS.forEach((n, i) => {
      const r = neighbourRect(n);
      for (const road of ROADS) expect(overlaps(r, road.rect, 2), `neighbour ${i} on the ${road.name}`).toBe(false);
      expect(overlaps(r, LOT, 2)).toBe(false);
      NEIGHBOURS.forEach((m, j) => {
        if (j > i) expect(overlaps(r, neighbourRect(m), 4), `neighbours ${i} and ${j}`).toBe(false);
      });
    });
  });

  it('parks cars only in stalls in the lot, never on the drive', () => {
    const cars = parkedCars();
    expect(stalls().length).toBeGreaterThan(60);
    expect(cars.length).toBeGreaterThan(35);
    expect(cars.length).toBeLessThan(stalls().length);
    const drive = ROADS.find((r) => r.name === 'drive')!.rect;
    for (const c of cars) {
      expect(inside(c.x, c.z, LOT)).toBe(true);
      expect(inside(c.x, c.z, drive, STALL.w / 2)).toBe(false);
      expect(fromBuilding(c.x, c.z)).toBeGreaterThan(PAVEMENT);
    }
    for (let i = 0; i < stallRects.length; i++) for (let j = i + 1; j < stallRects.length; j++) expect(overlaps(stallRects[i], stallRects[j], -0.01)).toBe(false);
    expect(parkedCars()).toEqual(cars);
  });

  it('stands the monument sign on the lawn by the drive', () => {
    const sign: Rect = [MONUMENT.x - MONUMENT.w / 2, MONUMENT.z - MONUMENT.d / 2, MONUMENT.x + MONUMENT.w / 2, MONUMENT.z + MONUMENT.d / 2];
    for (const r of ROADS) expect(overlaps(sign, r.rect), r.name).toBe(false);
    expect(overlaps(sign, LOT)).toBe(false);
    expect(fadeAt(MONUMENT.x, MONUMENT.z)).toBe(0);
  });

  it('runs the long roads and the railway out into the night, so their ends are never seen', () => {
    for (const z of [EXPRESSWAY.z, RAILWAY.z, AVENUE.z]) {
      expect(fadeAt(-REACH, z)).toBe(1);
      expect(fadeAt(REACH, z)).toBe(1);
    }
    expect(fadeAt(FADE.x, FADE.z)).toBe(0);
  });
});

describe('traffic', () => {
  it('keeps every lane on its road', () => {
    const expressway = [EXPRESSWAY.z - EXPRESSWAY_WIDTH / 2, EXPRESSWAY.z + EXPRESSWAY_WIDTH / 2];
    const avenue = [AVENUE.z - AVENUE.width / 2, AVENUE.z + AVENUE.width / 2];
    for (const lane of LANES) {
      const [lo, hi] = Math.abs(lane.z - EXPRESSWAY.z) < 20 ? expressway : avenue;
      expect(lane.z - LANE / 2).toBeGreaterThanOrEqual(lo - 1e-9);
      expect(lane.z + LANE / 2).toBeLessThanOrEqual(hi + 1e-9);
      // Barrier on one side, so lanes either side of it never meet.
      if (Math.abs(lane.z - EXPRESSWAY.z) < 20) expect(Math.sign(lane.z - EXPRESSWAY.z)).toBe(lane.dir);
    }
  });

  it('never lets two vehicles in a lane run into each other', () => {
    LANES.forEach((lane, l) => {
      for (let t = 0; t < 60; t += 0.7) {
        const xs = Array.from({ length: lane.count }, (_, i) => ({ x: vehicleX(lane, i, t), long: isTruck(l, i) }));
        for (let i = 0; i < xs.length; i++)
          for (let j = i + 1; j < xs.length; j++) {
            // Measured round the loop, since vehicles leaving one end come back at the other.
            const d = Math.abs(xs[i].x - xs[j].x);
            expect(Math.min(d, LOOP - d)).toBeGreaterThan(VEHICLE.truck + VEHICLE.gap);
          }
        for (const v of xs) expect(Math.abs(v.x)).toBeLessThanOrEqual(REACH);
      }
    });
  });

  it('drives each lane the way it points', () => {
    const lane = LANES[0];
    expect(Math.sign(vehicleX(lane, 0, 1.1) - vehicleX(lane, 0, 1))).toBe(lane.dir);
    const back = LANES.find((l) => l.dir === -1)!;
    expect(Math.sign(vehicleX(back, 0, 1.1) - vehicleX(back, 0, 1))).toBe(-1);
  });
});

describe('the train', () => {
  it('comes through every so often, alternating direction, then the line is quiet', () => {
    const passing = Array.from({ length: Math.round(TRAIN.every * 10) }, (_, i) => trainAt(i / 10));
    expect(passing.some((p) => p === null)).toBe(true);
    expect(passing.some((p) => p !== null)).toBe(true);
    expect(trainAt(1)!.dir).toBe(-trainAt(TRAIN.every + 1)!.dir);
  });

  it('runs on its own track the whole way through, from out of the night and back into it', () => {
    let last = trainAt(0)!;
    expect(last.x).toBeCloseTo(-REACH);
    for (let t = 0.5; trainAt(t) !== null; t += 0.5) {
      const now = trainAt(t)!;
      expect(now.x).toBeGreaterThan(last.x);
      expect(Math.abs(now.z - RAILWAY.z)).toBeCloseTo(RAILWAY.spacing / 2);
      last = now;
    }
    expect(last.x - TRAIN_LENGTH).toBeGreaterThan(REACH - 20);
  });
});
