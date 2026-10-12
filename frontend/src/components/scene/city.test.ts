import { describe, expect, it } from 'vitest';
import {
  bays,
  BEACON_STOREYS,
  beacons,
  benches,
  blocks,
  byThePark,
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
  flowerBeds,
  flowers,
  FOUNTAIN,
  gap,
  GROUND_Y,
  inside,
  isLong,
  LAG,
  LANE,
  LANES,
  lamps,
  overlaps,
  parkBlock,
  parkedCars,
  parkCentre,
  parkPaths,
  pedestrians,
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
  town as cityTown,
  towerBlock,
  traffic,
  trees,
  TURN,
  vehicleAt,
  vehicleRect,
  walkerAt,
  WALK,
  WALKS,
  type Building,
  type Rect,
  type Vehicle,
} from './city';

const town = buildings();
const masses = town.flatMap((b, i) => b.masses.map((m) => ({ ...m, building: i })));
const inJunction = (x: number, z: number, margin: number) => CROSS_X.some((cx) => Math.abs(x - cx) < margin) && CROSS_Z.some((cz) => Math.abs(z - cz) < margin);

describe("the startup's building", () => {
  it('puts the office on the top floor, three storeys above the street', () => {
    expect(FLOORS_BELOW).toBe(3);
    expect(TOWER.masses[0].y0).toBe(GROUND_Y);
    expect(TOWER.masses[TOWER.masses.length - 1].y1).toBe(SLAB);
    expect((SLAB - GROUND_Y) / STOREY).toBe(FLOORS_BELOW);
    expect(TOWER.masses[TOWER.masses.length - 1].rect).toEqual(BUILDING);
  });

  it('stands its lobby wing and lawn inside its own block, clear of the street', () => {
    const block = towerBlock().rect;
    expect(inside(PODIUM[0], PODIUM[1], block, -4)).toBe(true);
    expect(inside(PODIUM[2], PODIUM[3], block, -4)).toBe(true);
    for (const r of ROADS) expect(overlaps(PODIUM, roadRect(r, STREET_WIDTH))).toBe(false);
  });
});

describe('the buildings round the office', () => {
  it('never rises between the camera and the office, roof plant and beacons included', () => {
    expect(masses.length).toBeGreaterThan(100);
    for (const m of masses) expect(clearOfOffice(m.rect, m.y1 + ROOF_HEADROOM), `building ${m.building}`).toBe(true);
    for (const b of town) {
      const top = b.masses[b.masses.length - 1];
      for (const p of roofPlant(b)) expect(p.y1).toBeLessThanOrEqual(top.y1 + ROOF_HEADROOM);
      for (const l of beacons(b)) expect(l.y).toBeLessThanOrEqual(top.y1 + ROOF_HEADROOM);
    }
  });

  it('allows a taller building only far enough away, and anything below the office floor anywhere', () => {
    const across: Rect = [BUILDING[2] + 25, BUILDING[1], BUILDING[2] + 45, BUILDING[3]];
    expect(clearOfOffice(across, 40)).toBe(false);
    expect(clearOfOffice(across, 25 / CLEAR)).toBe(true);
    expect(clearOfOffice(across, -0.5)).toBe(true);
    expect(clearOfOffice([BUILDING[0] - 300, 0, BUILDING[0] - 280, 20], 150)).toBe(true);
    // Some offices further out do rise well above the office floor, so the rule is doing the work.
    expect(masses.some((m) => m.y1 > 8)).toBe(true);
    expect(masses.filter((m) => gap(m.rect, BUILDING) < 40).every((m) => m.y1 + ROOF_HEADROOM <= 40 / CLEAR)).toBe(true);
  });

  it("builds inside the blocks, off the streets, the startup's campus and the park, and apart from each other", () => {
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

describe('the variety of buildings', () => {
  const storeys = (b: Building) => (b.masses[b.masses.length - 1].y1 - GROUND_Y) / STOREY;
  const centre = (r: Rect) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

  it('dresses every facade style and roof finish somewhere in town, and pitches only the houses\' roofs', () => {
    expect(new Set(town.map((b) => b.facade))).toEqual(new Set(['glass', 'ribbon', 'fins', 'grid', 'house']));
    expect(new Set(town.map((b) => b.finish))).toEqual(new Set(['membrane', 'gravel', 'green', 'solar', 'pool', 'helipad', 'tiles']));
    for (const b of town) {
      expect(b.pitch !== 'flat').toBe(b.facade === 'house');
      expect(b.finish === 'tiles').toBe(b.facade === 'house');
    }
  });

  it('fits each roof with what its finish promises', () => {
    for (const b of town) {
      const kinds = roofPlant(b).map((p) => p.kind);
      expect(kinds.filter((k) => k === 'helipad').length, `building ${town.indexOf(b)}`).toBe(b.finish === 'helipad' ? 1 : 0);
      if (b.finish === 'helipad') expect(storeys(b)).toBeGreaterThanOrEqual(6);
      if (b.pitch !== 'flat') expect(kinds).toEqual([]);
      if (b.finish === 'pool') expect(kinds).toContain('pool');
      // A solar roof is mostly panels, not a lone module squeezed between the plant.
      if (b.finish === 'solar') expect(kinds.filter((k) => k === 'panel').length, `building ${town.indexOf(b)}`).toBeGreaterThanOrEqual(6);
      if (b.finish !== 'solar') expect(kinds).not.toContain('panel');
    }
  });

  it('keeps plant, panels and pools on the roof clear of each other', () => {
    for (const b of town) {
      const plant = roofPlant(b);
      const pads = plant.map((p): Rect => [p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2]);
      for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) expect(overlaps(pads[i], pads[j]), `${plant[i].kind} and ${plant[j].kind}`).toBe(false);
    }
  });

  it('lays out office parks, neighbourhoods of low houses and strips of shops, some offices stepping back on top', () => {
    const { zones, pools } = cityTown();
    expect(new Set(zones.map((z) => z.zone))).toEqual(new Set(['offices', 'homes', 'shops']));
    const houses = town.filter((b) => b.facade === 'house');
    expect(houses.length).toBeGreaterThan(40);
    for (const h of houses) expect(storeys(h)).toBeLessThanOrEqual(2);
    expect(pools.length).toBeGreaterThan(5);
    const stepped = town.filter((b) => b.masses.length >= 2);
    expect(stepped.length).toBeGreaterThan(0);
    for (const b of stepped) expect(Math.hypot(centre(b.masses[1].rect)[0] - centre(b.masses[0].rect)[0], centre(b.masses[1].rect)[1] - centre(b.masses[0].rect)[1])).toBeGreaterThanOrEqual(0);
  });

  it('parks cars in the bays of car parks that stand clear of the buildings, the pools and each other', () => {
    const { carParks, pools } = cityTown();
    expect(carParks.length).toBeGreaterThan(10);
    const footprints = town.map((b) => b.masses[0].rect);
    for (let i = 0; i < carParks.length; i++) {
      const cp = carParks[i].rect;
      expect(footprints.filter((f) => overlaps(f, cp)), `car park ${i}`).toEqual([]);
      expect(pools.filter((p) => overlaps(p, cp))).toEqual([]);
      for (let j = i + 1; j < carParks.length; j++) expect(overlaps(cp, carParks[j].rect)).toBe(false);
      const spaces = bays(carParks[i]);
      expect(spaces.length, `car park ${i}`).toBeGreaterThan(0);
      for (const b of spaces) expect(inside(b.x, b.z, cp)).toBe(true);
    }
    // The startup's own car park, behind its building, is full of bays too.
    expect(carParks.some((cp) => inside((cp.rect[0] + cp.rect[2]) / 2, (cp.rect[1] + cp.rect[3]) / 2, towerBlock().rect))).toBe(true);
    const cars = parkedCars();
    expect(cars.length).toBeGreaterThan(300);
    for (const c of cars) expect(carParks.some((cp) => inside(c.x, c.z, cp.rect))).toBe(true);
    expect(parkedCars()).toEqual(cars);
  });

  it('lights aviation beacons only on the few tallest offices', () => {
    const lit = town.filter((b) => beacons(b).length > 0);
    expect(lit.length).toBeGreaterThan(0);
    for (const b of lit) expect(storeys(b)).toBeGreaterThanOrEqual(BEACON_STOREYS);
    expect(lit.length).toBeLessThan(town.length * 0.1);
  });
});

describe('the streets', () => {
  it('stands lamps and trees off the lanes, the junctions, the buildings, the car parks and the pools', () => {
    const posts = lamps();
    const planted = trees();
    const things = [...posts.map((l) => ({ ...l, kind: 'lamp' })), ...planted.map((t) => ({ ...t, kind: 'tree' }))];
    expect(posts.length).toBeGreaterThan(200);
    // Gathered first and checked once: an expect per pair is too slow for the coverage run.
    const stray = (where: string, test: (t: { x: number; z: number }) => boolean) => things.filter(test).map((t) => `${t.kind} at ${t.x.toFixed(1)}, ${t.z.toFixed(1)} ${where}`);
    expect([
      // The medians are planted, but nothing stands on a lane.
      ...stray('on a lane', (t) => ROADS.some((r) => inside(t.x, t.z, roadRect(r), 0.2) && Math.abs((r.axis === 'x' ? t.z : t.x) - r.at) > STREET.median / 2 - 0.5)),
      ...stray('in a car park', (t) => cityTown().carParks.some((cp) => inside(t.x, t.z, cp.rect, 0.5))),
      ...stray('in a pool', (t) => cityTown().pools.some((p) => inside(t.x, t.z, p, 0.5))),
      ...stray('in a junction', (t) => inJunction(t.x, t.z, STREET_WIDTH / 2)),
      ...stray('in a building', (t) => masses.some((m) => inside(t.x, t.z, m.rect, 0.3))),
      ...stray('in the podium', (t) => inside(t.x, t.z, PODIUM, 0.3)),
    ]).toEqual([]);
    const paths = parkPaths();
    expect(planted.filter((t) => posts.some((l) => Math.hypot(t.x - l.x, t.z - l.z) <= 3))).toEqual([]);
    expect(planted.filter((t) => paths.some((p) => inside(t.x, t.z, p, 1)))).toEqual([]);
    expect(planted.filter((t) => inside(t.x, t.z, parkBlock().rect)).length).toBeGreaterThan(25);
  });

  it('lights each road with one style and colour of lamp, and the park railings with lanterns', () => {
    const all = lamps();
    expect(new Set(all.map((l) => l.style))).toEqual(new Set(['arm', 'blade', 'lantern']));
    expect(new Set(all.map((l) => l.warm))).toEqual(new Set([true, false]));
    const park = parkBlock().rect;
    for (const l of all) expect(l.style === 'lantern').toBe(byThePark(l, park));
    expect(all.filter((l) => l.style === 'lantern').length).toBeGreaterThan(10);
    for (const r of ROADS) {
      const own = all.filter((l) => !byThePark(l, park) && Math.abs((r.axis === 'x' ? l.z : l.x) - r.at) < STREET_WIDTH / 2);
      expect(new Set(own.map((l) => `${l.style} ${l.warm}`)).size, `road ${r.axis} at ${r.at}`).toBeLessThanOrEqual(1);
    }
  });

  it('plants each pavement with one kind of tree and each median with another, mostly palms, and the park with a mix', () => {
    const all = trees();
    const [parkRect, campus] = [parkBlock().rect, towerBlock().rect];
    expect(new Set(all.map((t) => t.kind))).toEqual(new Set(['round', 'cone', 'umbrella', 'blossom', 'palm']));
    const park = all.filter((t) => inside(t.x, t.z, parkRect));
    expect(new Set(park.map((t) => t.kind)).size).toBeGreaterThanOrEqual(3);
    const lawn = all.filter((t) => inside(t.x, t.z, campus));
    expect(lawn.filter((t) => t.kind === 'palm').length).toBeGreaterThan(lawn.length / 2);
    let palmMedians = 0;
    for (const r of ROADS) {
      const across = (t: { x: number; z: number }) => Math.abs((r.axis === 'x' ? t.z : t.x) - r.at);
      const median = new Set(all.filter((t) => across(t) < STREET.median / 2).map((t) => t.kind));
      const kerb = new Set(all.filter((t) => across(t) > STREET.median / 2 && across(t) < STREET_WIDTH / 2).map((t) => t.kind));
      expect(median.size, `median of road ${r.axis} at ${r.at}`).toBeLessThanOrEqual(1);
      expect(kerb.size, `pavements of road ${r.axis} at ${r.at}`).toBeLessThanOrEqual(1);
      if (median.has('palm')) palmMedians++;
    }
    expect(palmMedians).toBeGreaterThanOrEqual(ROADS.length / 2);
  });

  it('keeps every tree low enough, or far enough away, never to hide the office', () => {
    for (const t of trees()) {
      const crown = t.h * 0.45;
      expect(clearOfOffice([t.x - crown, t.z - crown, t.x + crown, t.z + crown], GROUND_Y + t.h), `${t.kind} at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`).toBe(true);
    }
  });

  it('keeps the fountain, flower beds and benches on the lawn, clear of the paths, the trees and each other', () => {
    const [cx, cz] = parkCentre();
    const park = parkBlock().rect;
    const beds = flowerBeds();
    // A bench is 1.7 m long and 0.6 m deep, turned to face its path.
    const seats = benches().map((b): Rect => (Math.abs(Math.sin(b.rot)) < 0.5 ? [b.x - 0.85, b.z - 0.3, b.x + 0.85, b.z + 0.3] : [b.x - 0.3, b.z - 0.85, b.x + 0.3, b.z + 0.85]));
    const planted = trees();
    expect(beds.length).toBe(8);
    expect(seats.length).toBeGreaterThan(10);
    for (const r of [...beds, ...seats]) {
      expect(inside(r[0], r[1], park) && inside(r[2], r[3], park)).toBe(true);
      for (const p of parkPaths()) expect(overlaps(r, p)).toBe(false);
      expect(gap(r, [cx, cz, cx, cz])).toBeGreaterThan(FOUNTAIN.square);
      for (const t of planted) expect(inside(t.x, t.z, r, 0.5), `tree at ${t.x.toFixed(1)}, ${t.z.toFixed(1)}`).toBe(false);
    }
    for (const t of planted) expect(Math.hypot(t.x - cx, t.z - cz)).toBeGreaterThan(FOUNTAIN.square);
    for (const f of flowers()) expect(beds.some((b) => inside(f.x, f.z, b))).toBe(true);
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) expect(overlaps(seats[i], seats[j])).toBe(false);
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

describe('pedestrians', () => {
  const people = pedestrians();
  /** The four sides of a walking loop, each widened by the room a passer-by takes. */
  const sides = ([x0, z0, x1, z1]: Rect, by = WALK.radius): Rect[] => [
    [x0 - by, z0 - by, x1 + by, z0 + by],
    [x0 - by, z1 - by, x1 + by, z1 + by],
    [x0 - by, z0 - by, x0 + by, z1 + by],
    [x1 - by, z0 - by, x1 + by, z1 + by],
  ];

  it('walks round loops that never cross a road, a building, the podium, a lamp post or a tree', () => {
    expect(people.length).toBeGreaterThan(200);
    const posts = [...lamps(), ...trees()].map((p): Rect => [p.x - 0.25, p.z - 0.25, p.x + 0.25, p.z + 0.25]);
    const crossed = WALKS.flatMap((loop, i) =>
      sides(loop).flatMap((s) => [
        ...ROADS.filter((r) => overlaps(s, roadRect(r))).map(() => `loop ${i} on a road`),
        ...masses.filter((m) => overlaps(s, m.rect)).map((m) => `loop ${i} through building ${m.building}`),
        ...(overlaps(s, PODIUM) ? [`loop ${i} through the podium`] : []),
        ...posts.filter((p) => overlaps(s, p)).map((p) => `loop ${i} into a post at ${p[0].toFixed(1)}, ${p[1].toFixed(1)}`),
      ]),
    );
    expect(crossed).toEqual([]);
  });

  it('keeps walkers in the park on its loop path', () => {
    const park = WALKS.filter((loop) => inside(loop[0], loop[1], parkBlock().rect));
    expect(park.length).toBe(2);
    for (const loop of park) for (const s of sides(loop)) expect(parkPaths().some((p) => inside(s[0], s[1], p, 0.01) && inside(s[2], s[3], p, 0.01))).toBe(true);
  });

  it('moves each walker along its loop at walking pace, facing the way it goes', () => {
    for (const p of people.slice(0, 60)) {
      const [x0, z0, x1, z1] = WALKS[p.walk];
      for (let t = 0; t < 30; t += 1.3) {
        const a = walkerAt(p, t);
        const onEdge = Math.abs(a.x - x0) < 1e-6 || Math.abs(a.x - x1) < 1e-6 || Math.abs(a.z - z0) < 1e-6 || Math.abs(a.z - z1) < 1e-6;
        expect(onEdge && inside(a.x, a.z, WALKS[p.walk], 1e-6)).toBe(true);
        const b = walkerAt(p, t + 0.05);
        const step = Math.hypot(b.x - a.x, b.z - a.z);
        expect(step).toBeLessThanOrEqual(p.speed * 0.05 + 1e-6);
        // Away from the corners, the step is along the way the walker faces.
        if (step > p.speed * 0.049) {
          expect(-Math.sin(a.heading) * (b.x - a.x) - Math.cos(a.heading) * (b.z - a.z)).toBeCloseTo(step, 6);
        }
      }
    }
  });

  it('is the same crowd on every visit', () => {
    expect(pedestrians()).toEqual(people);
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

  it('mixes cars, taxis, vans, trucks and buses, the long ones a few in each lane', () => {
    const kinds = new Map<string, number>();
    for (const v of vehicles) kinds.set(v.kind, (kinds.get(v.kind) ?? 0) + 1);
    expect(new Set(kinds.keys())).toEqual(new Set(['sedan', 'hatch', 'suv', 'taxi', 'van', 'truck', 'bus']));
    expect(vehicles.filter((v) => isLong(v.kind)).length).toBeLessThan(vehicles.length * 0.15);
    expect(isLong('bus') && isLong('truck') && !isLong('van')).toBe(true);
  });

  it('is the same traffic on every visit', () => {
    expect(traffic()).toEqual(vehicles);
  });
});
