import { describe, expect, it } from 'vitest';
import { CLOSED_ROOMS, deskSeat, GLASS, OBSTACLES, SPOTS, type Obstacle } from './floorplan';
import { ROOM } from './layout';
import { heading, neighbours, PATHS, planLoop, poseAt, TURN_RATE, WAYPOINTS, wrapAngle, type WaypointId } from './routes';

type P = [number, number];

/** How wide a walker is, from its centre. */
const WALKER_RADIUS = 0.3;
/** How close a walker may pass a pane of glass. */
const GLASS_CLEARANCE = 0.4;
/** How close a walker may pass someone standing or sitting still. */
const CREW_CLEARANCE = 0.7;
/** How far from the outer walls waypoints keep. */
const WALL_MARGIN = 0.5;

function pointToSegment(p: P, a: P, b: P): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

function crosses(a: P, b: P, c: P, d: P): boolean {
  const side = (p: P, q: P, r: P) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

function segmentToSegment(a: P, b: P, c: P, d: P): number {
  if (crosses(a, b, c, d)) return 0;
  return Math.min(pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b));
}

const inBox = (p: P, [x0, z0, x1, z1]: [number, number, number, number]) => p[0] >= x0 && p[0] <= x1 && p[1] >= z0 && p[1] <= z1;

function segmentToObstacle(a: P, b: P, o: Obstacle): number {
  if ('disc' in o) {
    const [x, z, r] = o.disc;
    return pointToSegment([x, z], a, b) - r;
  }
  const [x0, z0, x1, z1] = o.box;
  if (inBox(a, o.box) || inBox(b, o.box)) return 0;
  const corners: P[] = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  return Math.min(...corners.map((c, i) => segmentToSegment(a, b, c, corners[(i + 1) % 4])));
}

const point = (id: WaypointId): P => [WAYPOINTS[id].x, WAYPOINTS[id].z];
const paths = PATHS.map(([a, b]) => ({ name: `${a} to ${b}`, a: point(a), b: point(b) }));
const ids = Object.keys(WAYPOINTS) as WaypointId[];

/** Everyone who stays put: the engineers at their desks and the crew in SPOTS. */
const stillCrew: { name: string; p: P }[] = [
  ...Array.from({ length: 8 }, (_, i) => ({ name: `engineer ${i}`, p: [deskSeat(i).x, deskSeat(i).z] as P })),
  ...Object.entries(SPOTS).map(([name, s]) => ({ name, p: [s.x, s.z] as P })),
];

describe('office walking routes', () => {
  it('keeps every waypoint indoors and out of the rooms behind glass', () => {
    for (const id of ids) {
      const p = point(id);
      expect(p[0], id).toBeGreaterThanOrEqual(ROOM.x0 + WALL_MARGIN);
      expect(p[0], id).toBeLessThanOrEqual(ROOM.x1 - WALL_MARGIN);
      expect(p[1], id).toBeGreaterThanOrEqual(ROOM.z0 + WALL_MARGIN);
      expect(p[1], id).toBeLessThanOrEqual(ROOM.z1 - WALL_MARGIN);
      for (const room of CLOSED_ROOMS) expect(inBox(p, room), `${id} is in a closed room`).toBe(false);
    }
  });

  it('keeps every walk clear of the glass partitions', () => {
    const tooClose = paths.flatMap((path) =>
      GLASS.filter(([x1, z1, x2, z2]) => segmentToSegment(path.a, path.b, [x1, z1], [x2, z2]) < GLASS_CLEARANCE).map((g) => `${path.name} by glass ${g.join(',')}`),
    );
    expect(tooClose).toEqual([]);
  });

  it('keeps every walk clear of the furniture', () => {
    const blocked = paths.flatMap((path) => OBSTACLES.filter((o) => segmentToObstacle(path.a, path.b, o) < WALKER_RADIUS).map((o) => `${path.name} through ${o.name}`));
    expect(blocked).toEqual([]);
  });

  it('keeps every walk clear of the crew who stay put', () => {
    const bumped = paths.flatMap((path) => stillCrew.filter((c) => pointToSegment(c.p, path.a, path.b) < CREW_CLEARANCE).map((c) => `${path.name} into ${c.name}`));
    expect(bumped).toEqual([]);
  });

  it('notices a walk that goes through furniture', () => {
    // The check itself must catch a real collision: straight through the dining table.
    const table = OBSTACLES.find((o) => o.name === 'dining table and chairs') as Obstacle;
    expect(segmentToObstacle([16, 0], [21, 0], table)).toBe(0);
    expect(segmentToObstacle([16, -2], [21, -2], table)).toBeGreaterThan(WALKER_RADIUS);
  });

  it('connects every waypoint to every other', () => {
    const seen = new Set<WaypointId>(['spineFront']);
    const queue: WaypointId[] = ['spineFront'];
    while (queue.length) {
      for (const n of neighbours(queue.shift() as WaypointId)) {
        if (seen.has(n)) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it('only stops at dead ends, so walkers passing through never pause in a corridor', () => {
    for (const id of ids) if (WAYPOINTS[id].stop) expect(neighbours(id), id).toHaveLength(1);
  });
});

describe('a walker loop', () => {
  const plan = planLoop('spineCooler', 7, { legs: 30, speed: 0.6 });

  it('is the same for the same seed and differs for another', () => {
    expect(planLoop('spineCooler', 7, { legs: 30, speed: 0.6 })).toEqual(plan);
    expect(planLoop('spineCooler', 8, { legs: 30, speed: 0.6 }).route).not.toEqual(plan.route);
  });

  it('follows the paths and comes home', () => {
    expect(plan.route[0]).toBe('spineCooler');
    expect(plan.route[plan.route.length - 1]).toBe('spineCooler');
    for (let i = 1; i < plan.route.length; i++) expect(neighbours(plan.route[i - 1])).toContain(plan.route[i]);
  });

  it('runs on without jumps, and its end runs into its start', () => {
    const { steps } = plan;
    for (let i = 1; i < steps.length; i++) {
      const before = steps[i - 1];
      const after = steps[i];
      expect(after.start).toBeCloseTo(before.start + before.seconds);
      expect(after.from).toEqual(before.to);
      expect(after.yaw[0]).toBeCloseTo(before.yaw[1]);
    }
    const last = steps[steps.length - 1];
    expect(last.to).toEqual(steps[0].from);
    expect(wrapAngle(last.yaw[1] - steps[0].yaw[0])).toBeCloseTo(0);
    expect(plan.total).toBeCloseTo(last.start + last.seconds);
  });

  it('turns the short way round, faces where it walks, and faces what it stops for', () => {
    let stops = 0;
    for (const s of plan.steps) {
      if (s.kind === 'turn') {
        expect(Math.abs(s.yaw[1] - s.yaw[0])).toBeLessThanOrEqual(Math.PI + 1e-9);
        expect(s.seconds).toBeCloseTo(Math.abs(s.yaw[1] - s.yaw[0]) / TURN_RATE);
      }
      if (s.kind === 'walk') expect(wrapAngle(s.yaw[0] - heading(s.to[0] - s.from[0], s.to[1] - s.from[1]))).toBeCloseTo(0);
      if (s.kind === 'stop') {
        stops++;
        const stop = WAYPOINTS[s.waypoint].stop!;
        expect(s.activity).toBe(stop.activity);
        expect(s.seconds).toBeGreaterThanOrEqual(stop.seconds[0]);
        expect(s.seconds).toBeLessThanOrEqual(stop.seconds[1]);
        expect(wrapAngle(s.yaw[0] - heading(stop.face[0] - s.to[0], stop.face[1] - s.to[1]))).toBeCloseTo(0);
      }
    }
    expect(stops).toBeGreaterThan(2);
  });

  it('gives a pose for any time, repeating with the loop', () => {
    const stop = plan.steps.find((s) => s.kind === 'stop')!;
    const mid = poseAt(plan, stop.start + stop.seconds / 2);
    expect(mid.activity).toBe(stop.activity);
    expect([mid.x, mid.z]).toEqual(stop.to);
    const later = poseAt(plan, stop.start + stop.seconds / 2 + 3 * plan.total);
    expect(later.x).toBeCloseTo(mid.x);
    expect(later.z).toBeCloseTo(mid.z);
    expect(later.index).toBe(mid.index);
    // Either side of a step boundary the walker is in the same place.
    const edge = plan.steps[5].start;
    const a = poseAt(plan, edge - 1e-6);
    const b = poseAt(plan, edge + 1e-6);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.z).toBeCloseTo(b.z);
    expect(a.yaw).toBeCloseTo(b.yaw);
  });

  it('refuses a waypoint that does not exist', () => {
    expect(() => planLoop('nowhere' as WaypointId, 1, { legs: 5, speed: 0.6 })).toThrow(/Unknown waypoint/);
  });
});
