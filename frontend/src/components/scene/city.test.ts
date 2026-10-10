import { describe, expect, it } from 'vitest';
import {
  beacons,
  blocks,
  BUILDING,
  buildings,
  CARRIAGEWAY,
  clearOfOffice,
  CLEAR,
  CROSS_X,
  CROSS_Z,
  CYCLE,
  FADE,
  fadeAt,
  FLOORS_BELOW,
  gap,
  GROUND_Y,
  inside,
  LAG,
  LANE,
  LANES,
  lamps,
  overlaps,
  parkBlock,
  parkPaths,
  PODIUM,
  REACH,
  roadRect,
  ROADS,
  ROOF_HEADROOM,
  roofPlant,
  SLAB,
  STOREY,
  STREET,
  STREET_WIDTH,
  TOWER,
  towerBlock,
  traffic,
  trees,
  TURN,
  vehicleAt,
  vehicleRect,
  type Rect,
  type Vehicle,
} from './city';

const town = buildings();
const masses = town.flatMap((b, i) => b.masses.map((m) => ({ ...m, building: i })));
const inJunction = (x: number, z: number, margin: number) => CROSS_X.some((cx) => Math.abs(x - cx) < margin) && CROSS_Z.some((cz) => Math.abs(z - cz) < margin);

describe('the office tower', () => {
  it('puts the office on the top floor, fifteen storeys above the street', () => {
    expect(TOWER.masses[0].y0).toBe(GROUND_Y);
    expect(TOWER.masses[TOWER.masses.length - 1].y1).toBe(SLAB);
    expect((SLAB - GROUND_Y) / STOREY).toBe(FLOORS_BELOW);
    expect(TOWER.masses[TOWER.masses.length - 1].rect).toEqual(BUILDING);
  });

  it('stands its podium and plaza inside its own block, clear of the street', () => {
    const block = towerBlock().rect;
    expect(inside(PODIUM[0], PODIUM[1], block, -4)).toBe(true);
    expect(inside(PODIUM[2], PODIUM[3], block, -4)).toBe(true);
    for (const r of ROADS) expect(overlaps(PODIUM, roadRect(r, STREET_WIDTH))).toBe(false);
  });
});

describe('the buildings round the tower', () => {
  it('never rises between the camera and the office, roof plant and beacons included', () => {
    expect(masses.length).toBeGreaterThan(150);
    for (const m of masses) expect(clearOfOffice(m.rect, m.y1 + ROOF_HEADROOM), `building ${m.building}`).toBe(true);
    for (const b of town) {
      const top = b.masses[b.masses.length - 1];
      for (const p of roofPlant(b)) expect(p.y1).toBeLessThanOrEqual(top.y1 + ROOF_HEADROOM);
      for (const l of beacons(b)) expect(l.y).toBeLessThanOrEqual(top.y1 + ROOF_HEADROOM);
    }
  });

  it('allows a tall tower only far enough away, and anything below the office floor anywhere', () => {
    const across: Rect = [BUILDING[2] + 25, BUILDING[1], BUILDING[2] + 45, BUILDING[3]];
    expect(clearOfOffice(across, 40)).toBe(false);
    expect(clearOfOffice(across, 25 / CLEAR)).toBe(true);
    expect(clearOfOffice(across, -0.5)).toBe(true);
    expect(clearOfOffice([BUILDING[0] - 300, 0, BUILDING[0] - 280, 20], 150)).toBe(true);
    // The city does reach above the office further out, so the rule is doing the work.
    expect(masses.some((m) => m.y1 > 60)).toBe(true);
    expect(masses.filter((m) => gap(m.rect, BUILDING) < 40).every((m) => m.y1 + ROOF_HEADROOM <= 40 / CLEAR)).toBe(true);
  });

  it('builds on lots inside the blocks, off the streets, the plaza and the park, and apart from each other', () => {
    const lots = blocks().filter((b) => !(b.i === 0 && b.j === 0) && !(b.i === -1 && b.j === -1));
    for (const m of masses) {
      expect(lots.some((b) => inside(m.rect[0], m.rect[1], b.rect, 0.01) && inside(m.rect[2], m.rect[3], b.rect, 0.01)), `building ${m.building}`).toBe(true);
      for (const r of ROADS) expect(overlaps(m.rect, roadRect(r, STREET_WIDTH))).toBe(false);
    }
    const footprints = town.map((b) => b.masses[0].rect);
    for (let i = 0; i < footprints.length; i++) for (let j = i + 1; j < footprints.length; j++) expect(overlaps(footprints[i], footprints[j], 0.5), `buildings ${i} and ${j}`).toBe(false);
  });

  it('stacks each building in whole storeys, each part standing on the one below and no wider', () => {
    for (const b of town) {
      b.masses.forEach((m, k) => {
        expect(m.y1).toBeGreaterThan(m.y0);
        expect(Math.abs((m.y1 - GROUND_Y) / STOREY - Math.round((m.y1 - GROUND_Y) / STOREY))).toBeLessThan(1e-9);
        if (k === 0) return expect(m.y0).toBe(GROUND_Y);
        const below = b.masses[k - 1];
        expect(m.y0).toBe(below.y1);
        expect(inside(m.rect[0], m.rect[1], below.rect, 0.01) && inside(m.rect[2], m.rect[3], below.rect, 0.01)).toBe(true);
      });
      for (const p of roofPlant(b)) {
        const top = b.masses[b.masses.length - 1].rect;
        expect(inside(p.x - p.w / 2, p.z - p.d / 2, top) && inside(p.x + p.w / 2, p.z + p.d / 2, top)).toBe(true);
      }
    }
  });

  it('is the same town on every visit', () => {
    expect(buildings()).toEqual(town);
    expect(buildings(32)).not.toEqual(town);
  });
});

describe('the streets', () => {
  it('stands lamps and trees on the pavements, off the carriageways, the junctions and the buildings', () => {
    const things = [...lamps().map((l) => ({ ...l, kind: 'lamp' })), ...trees().map((t) => ({ ...t, kind: 'tree' }))];
    expect(lamps().length).toBeGreaterThan(200);
    for (const t of things) {
      for (const r of ROADS) expect(inside(t.x, t.z, roadRect(r), 0.2), `${t.kind} at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`).toBe(false);
      expect(inJunction(t.x, t.z, STREET_WIDTH / 2), `${t.kind} in a junction`).toBe(false);
      for (const m of masses) expect(inside(t.x, t.z, m.rect, 0.3), `${t.kind} in building ${m.building}`).toBe(false);
      expect(inside(t.x, t.z, PODIUM, 0.3)).toBe(false);
    }
    for (const t of trees()) for (const l of lamps()) expect(Math.hypot(t.x - l.x, t.z - l.z)).toBeGreaterThan(3);
    for (const t of trees()) for (const p of parkPaths()) expect(inside(t.x, t.z, p, 1)).toBe(false);
    expect(trees().filter((t) => inside(t.x, t.z, parkBlock().rect)).length).toBeGreaterThan(25);
  });

  it('runs every road out into the night, so its ends are never seen', () => {
    for (const r of ROADS) {
      const [x0, z0, x1, z1] = roadRect(r);
      expect(fadeAt(x0, z0)).toBe(1);
      expect(fadeAt(x1, z1)).toBe(1);
    }
    expect(REACH).toBeGreaterThan(FADE.to);
    expect(fadeAt(FADE.x, FADE.z)).toBe(0);
  });
});

/** Every pair of vehicles overlapping at some moment in the first minute, with crossing traffic `late` seconds behind its turn. */
function collisions(list: Vehicle[], late = 0, until = 60): string[] {
  const found: string[] = [];
  for (let t = 0; t < until && found.length < 5; t += 0.05) {
    const cells = new Map<string, { i: number; r: Rect }[]>();
    list.forEach((v, i) => {
      const r = vehicleRect(v, t + (LANES[v.lane].axis === 'z' ? late : 0));
      const cx = Math.floor((r[0] + r[2]) / 32);
      const cz = Math.floor((r[1] + r[3]) / 32);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (const o of cells.get(`${cx + dx},${cz + dz}`) ?? []) if (overlaps(r, o.r, -0.05)) found.push(`vehicles ${o.i} and ${i} at ${t.toFixed(2)}s`);
      const key = `${cx},${cz}`;
      cells.set(key, [...(cells.get(key) ?? []), { i, r }]);
    });
  }
  return found;
}

describe('traffic', () => {
  const vehicles = traffic();

  it('keeps every lane on its road, on the right of the median', () => {
    expect(LANES.length).toBeGreaterThan(30);
    for (const lane of LANES) {
      const road = ROADS.find((r) => r.axis === lane.axis && Math.abs(r.at - lane.at) < CARRIAGEWAY / 2)!;
      expect(road).toBeDefined();
      expect(Math.abs(lane.at - road.at) + LANE / 2).toBeLessThanOrEqual(CARRIAGEWAY / 2 + 1e-9);
      expect(Math.abs(lane.at - road.at)).toBeGreaterThan(STREET.median / 2);
      const side = Math.sign(lane.at - road.at);
      expect(side).toBe(lane.axis === 'x' ? lane.dir : -lane.dir);
    }
  });

  it('drives each lane the way it points, and leaves it only far out in the night', () => {
    for (const lane of LANES) {
      const a = vehicleAt(lane, 0, 1);
      const b = vehicleAt(lane, 0, 1.1);
      expect(Math.sign(lane.axis === 'x' ? b.x - a.x : b.z - a.z)).toBe(lane.dir);
      expect(lane.loop / 2).toBeGreaterThan(FADE.to);
      for (let t = 0; t < 40; t += 0.5) {
        const p = vehicleAt(lane, 3, t);
        expect(lane.axis === 'x' ? p.z : p.x).toBe(lane.at);
      }
    }
  });

  it('takes turns at the junctions, so crossing traffic never meets', () => {
    expect(vehicles.length).toBeGreaterThan(250);
    expect(TURN.x[1] + 2 * LAG).toBeLessThan(TURN.z[0]);
    expect(TURN.z[1] + 2 * LAG).toBeLessThan(CYCLE);
    expect(collisions(vehicles)).toEqual([]);
  });

  it('would collide if the crossing traffic came out of turn', () => {
    expect(collisions(vehicles, TURN.z[0], 20).length).toBeGreaterThan(0);
  });

  it('is the same traffic on every visit', () => {
    expect(traffic()).toEqual(vehicles);
  });
});
