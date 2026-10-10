import { describe, expect, it } from "vitest";
import { BALANCE, EQUIPMENT_ORDER, equipmentInfo, newLegacyGame, type GameState, type TechId } from "@/sim";
import { GLASS } from "./floorplan";
import { buildGrid, clearLine, findPath, isOpen, navKey, navObstacles, slide, touches, type NavGrid, type Point } from "./nav";
import { canWork, machineAt, SPAWN, station, ZONE_MARGIN } from "./stations";

/** A company with every machine built and the rows full. */
function builtOut(): GameState {
  const s = newLegacyGame();
  const techs: TechId[] = ["load_balancing", "autoscaling", "caching", "backups", "replicas", "standby", "health_checks", "auto_failover"];
  s.techDone = [...s.techDone, ...techs];
  s.infra.appHosts = Array.from({ length: BALANCE.server.maxWithLb }, (_, i) => ({ id: `app-${i + 1}`, status: "healthy" as const, bornTurn: 1 }));
  s.infra.dbTier = 2;
  s.live.tempServers = 6;
  return s;
}

const companies: [string, GameState][] = [
  ["a new company", newLegacyGame()],
  ["a built-out company", builtOut()],
];

function pathLength(from: Point, path: Point[]): number {
  let at = from;
  let total = 0;
  for (const p of path) {
    total += Math.hypot(p.x - at.x, p.z - at.z);
    at = p;
  }
  return total;
}

function crossesGlass(a: Point, b: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => Math.sign((q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x));
  return GLASS.some(([x1, z1, x2, z2]) => {
    const c = { x: x1, z: z1 };
    const d = { x: x2, z: z2 };
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  });
}

describe.each(companies)("the founder's floor in %s", (_, game) => {
  const grid: NavGrid = buildGrid(navObstacles(game));

  it("starts on open floor", () => {
    expect(isOpen(grid, SPAWN)).toBe(true);
  });

  it.each(EQUIPMENT_ORDER)("can stand at %s", (id) => {
    const spot = station(game, id);
    expect(touches(spot, navObstacles(game)), `${id} spot touches something`).toBe(false);
    expect(isOpen(grid, spot)).toBe(true);
  });

  it.each(EQUIPMENT_ORDER)("can walk from the door to %s without passing through glass", (id) => {
    const spot = station(game, id);
    const path = findPath(grid, SPAWN, spot);
    expect(path, `no way to ${id}`).not.toBeNull();
    const last = path![path!.length - 1];
    expect(Math.hypot(last.x - spot.x, last.z - spot.z)).toBeLessThan(0.01);
    let at: Point = SPAWN;
    for (const p of path!) {
      expect(clearLine(grid, at, p)).toBe(true);
      expect(crossesGlass(at, p)).toBe(false);
      at = p;
    }
    // No detours: the office is 44 m across.
    expect(pathLength(SPAWN, path!)).toBeLessThan(60);
  });
});

describe("the founder's floor", () => {
  it("keeps the founder out of the racks and the glass", () => {
    const game = builtOut();
    const obstacles = navObstacles(game);
    expect(touches({ x: -6.6, z: -6.3 }, obstacles)).toBe(true);
    expect(touches({ x: -5, z: 5 }, obstacles)).toBe(true);
    // The meeting room and the network room are closed to the founder.
    expect(touches({ x: -9, z: 12 }, obstacles)).toBe(true);
    expect(touches({ x: -18, z: -5 }, obstacles)).toBe(true);
  });

  it("rebuilds the floor when a rack is added", () => {
    const before = newLegacyGame();
    const after = structuredClone(before);
    after.infra.appHosts.push({ id: "app-2", status: "healthy", bornTurn: 1 });
    expect(navKey(after)).not.toBe(navKey(before));
    expect(navKey(structuredClone(before))).toBe(navKey(before));
  });

  it("finds the open floor nearest a click on furniture", () => {
    const game = newLegacyGame();
    const grid = buildGrid(navObstacles(game));
    // The middle of the reception desk.
    const path = findPath(grid, SPAWN, { x: 3.2, z: 12.15 });
    expect(path).not.toBeNull();
    expect(isOpen(grid, path![path!.length - 1])).toBe(true);
  });

  it("slides along a wall instead of stopping dead", () => {
    const grid = buildGrid(navObstacles(newLegacyGame()));
    // Walking diagonally into the glass in front of the database row keeps the sideways part.
    const from = { x: -5, z: 5.45 };
    expect(isOpen(grid, from)).toBe(true);
    const to = slide(grid, from, 0.15, -0.25);
    expect(to.x).toBeCloseTo(from.x + 0.15);
    expect(to.z).toBe(from.z);
  });

  it("never steps into an obstacle", () => {
    const grid = buildGrid(navObstacles(newLegacyGame()));
    let p: Point = { ...SPAWN };
    // Head straight up, into the release console and the server floor glass.
    for (let i = 0; i < 200; i++) {
      p = slide(grid, p, 0, -0.1);
      expect(isOpen(grid, p)).toBe(true);
    }
  });

  it("works the database from any side, but not beyond its zone", () => {
    const game = newLegacyGame();
    // The database cabinet's footprint runs from x -4.3 to -2.5 and z 2.18 to 4.03.
    for (const p of [
      { x: -3.4, z: 4.4 },
      { x: -3.4, z: 1.6 },
      { x: -4.8, z: 3.1 },
      { x: -2.0, z: 3.1 },
    ]) {
      expect(canWork(game, "db", p), `${p.x}, ${p.z}`).toBe(true);
    }
    expect(canWork(game, "db", { x: -3.4, z: 2.18 - ZONE_MARGIN - 0.1 })).toBe(false);
    expect(canWork(game, "db", { x: -2.5 + ZONE_MARGIN + 0.1, z: 3.1 })).toBe(false);
  });

  it("never works a machine through glass", () => {
    const game = newLegacyGame();
    // On the server floor, inside the monitoring wall's zone but on the other side of the monitoring room's glass.
    expect(canWork(game, "monitoring", { x: 5.2, z: -8.2 })).toBe(false);
    expect(canWork(game, "monitoring", { x: 6.0, z: -8.2 })).toBe(true);
  });

  it.each(companies)("works each machine, and only it, from its spot in %s", (_, game) => {
    const built = EQUIPMENT_ORDER.filter((id) => equipmentInfo(game, id).built);
    for (const id of built) expect(machineAt(game, built, station(game, id)), id).toBe(id);
  });
});
