import { describe, expect, it } from "vitest";
import { floorOf, FLOORS, type Floor } from "@/game/floors";
import { EQUIPMENT_ORDER, newLegacyGame, type GameState } from "@/sim";
import { ALL_RACKS, ELEVATOR_DOOR, ELEVATOR_SPOT, FUN_PROPS, GLASS, OFFICE_DOORS, SERVER_DOORS, SERVER_GLASS, type Door } from "./floorplan";
import { buildModel, racksOf } from "./sceneModel";
import { footprint } from "./layout";
import { AVATAR_RADIUS, blocked, clearLine, findPath, gridOf, nearestFree, toSegment, worldOf } from "./navgrid";
import { REACH } from "./player";

/** A company with everything built, so every machine stands where it can. */
function builtOut(): GameState {
  const s = structuredClone(newLegacyGame(1));
  s.infra.appHosts = Array.from({ length: 12 }, () => structuredClone(s.infra.appHosts[0]));
  s.infra.dbTier = 3;
  s.live.tempServers = 6;
  s.engineers = 8;
  s.techDone = [...s.techDone, "load_balancing"];
  return s;
}

const doorsOf = (floor: Floor) => (floor === "office" ? OFFICE_DOORS : SERVER_DOORS);
/** Two places a step either side of a door. */
const through = (d: Door, by = 0.7): [[number, number], [number, number]] =>
  d.along === "x" ? [[d.x, d.z - by], [d.x, d.z + by]] : [[d.x - by, d.z], [d.x + by, d.z]];
/** Where to stand in front of the elevator's doors, on either floor. */
const lobby: [number, number] = [ELEVATOR_DOOR.x + 0.7, ELEVATOR_DOOR.z];

/** Whether every point of a walk keeps the avatar clear of everything, checked every few centimetres. */
function walkIsClear(floor: Floor, from: [number, number], path: [number, number][]): boolean {
  let at = from;
  for (const p of path) {
    if (!clearLine(worldOf(floor, ALL_RACKS), at, p)) return false;
    at = p;
  }
  return true;
}

describe("walking the building", () => {
  it("passes through every glass door on both floors, straight through the doorway", () => {
    for (const floor of FLOORS) {
      for (const d of doorsOf(floor)) {
        const [a, b] = through(d);
        expect(clearLine(worldOf(floor, ALL_RACKS), a, b), `${floor}: ${d.name}`).toBe(true);
        const path = findPath(gridOf(floor, ALL_RACKS), a, b);
        expect(path, `${floor}: ${d.name}`).not.toBeNull();
      }
    }
  });

  it("never walks through glass beside a door", () => {
    // The check itself: just along the partition from the meeting room's door, the glass is in the way.
    const meeting = OFFICE_DOORS[0];
    const [a, b] = through({ ...meeting, x: meeting.x - 0.85 }, 0.6);
    expect(clearLine(worldOf("office", ALL_RACKS), a, b)).toBe(false);
    // And a planned walk from one side to the other goes round through the door.
    const path = findPath(gridOf("office", ALL_RACKS), a, b) as [number, number][];
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(1);
    const legs = [a, ...path];
    for (let i = 1; i < legs.length; i++) {
      for (const g of GLASS) {
        const mid: [number, number] = [(legs[i - 1][0] + legs[i][0]) / 2, (legs[i - 1][1] + legs[i][1]) / 2];
        expect(toSegment(mid[0], mid[1], g)).toBeGreaterThanOrEqual(AVATAR_RADIUS - 1e-9);
      }
    }
  });

  it("gets into the elevator's car and out again on both floors, but not through its glass sides", () => {
    const car: [number, number] = [(ELEVATOR_SPOT[0] + ELEVATOR_SPOT[2]) / 2, (ELEVATOR_SPOT[1] + ELEVATOR_SPOT[3]) / 2];
    for (const floor of FLOORS) {
      expect(blocked(worldOf(floor, ALL_RACKS), car[0], car[1]), floor).toBe(false);
      expect(clearLine(worldOf(floor, ALL_RACKS), car, lobby), floor).toBe(true);
      expect(clearLine(worldOf(floor, ALL_RACKS), car, [car[0], ELEVATOR_SPOT[3] + 0.7]), floor).toBe(false);
    }
  });

  it("reaches every piece of equipment on its floor, and every fun prop, from the elevator", () => {
    const s = builtOut();
    for (const id of EQUIPMENT_ORDER) {
      const floor = floorOf(id);
      const f = footprint(s, id);
      const g = gridOf(floor, ALL_RACKS);
      // Somewhere free within reach of its outline that a walk from the elevator gets to.
      const spots: [number, number][] = [];
      for (let x = f.x - f.w / 2 - REACH; x <= f.x + f.w / 2 + REACH; x += 0.2) {
        for (const z of [f.z - f.d / 2 - REACH + 0.15, f.z + f.d / 2 + REACH - 0.15]) spots.push([x, z]);
      }
      for (let z = f.z - f.d / 2 - REACH; z <= f.z + f.d / 2 + REACH; z += 0.2) {
        for (const x of [f.x - f.w / 2 - REACH + 0.15, f.x + f.w / 2 + REACH - 0.15]) spots.push([x, z]);
      }
      const reached = spots.some((p) => !blocked(g.world, p[0], p[1]) && findPath(g, lobby, p) !== null);
      expect(reached, id).toBe(true);
    }
    for (const p of FUN_PROPS) {
      const spot = nearestFree(gridOf("office", ALL_RACKS), p.x, p.z, 0.8);
      expect(spot, p.id).not.toBeNull();
      expect(findPath(gridOf("office", ALL_RACKS), lobby, spot as [number, number]), p.id).not.toBeNull();
    }
  });

  it("plans walks that keep clear of everything, and finds none to somewhere walled in", () => {
    const g = gridOf("office", ALL_RACKS);
    // From the front corridor, past the meeting room.
    const start: [number, number] = [-7.3, 9.75];
    expect(blocked(g.world, ...start)).toBe(false);
    for (const to of [lobby, [18.6, 11.1], [-20.9, 9.75], [3.2, 13.3]] as [number, number][]) {
      const free = nearestFree(g, to[0], to[1]) as [number, number];
      const path = findPath(g, start, free);
      expect(path, `to ${to}`).not.toBeNull();
      expect(walkIsClear("office", start, path as [number, number][]), `to ${to}`).toBe(true);
    }
    // Inside a desk there is nowhere to stand, so no walk ends there.
    expect(findPath(g, start, [-10.4, 6.98])).toBeNull();
  });

  it("keeps each floor's furniture to its own floor", () => {
    // The stores' shelving stands downstairs where the lounge is open floor, and an open desk's chair upstairs where
    // the server hall's aisle is.
    expect(blocked(worldOf("servers", ALL_RACKS), 16.2, 2.6)).toBe(true);
    expect(blocked(worldOf("office", ALL_RACKS), 16.2, 2.6)).toBe(false);
    expect(blocked(worldOf("office", ALL_RACKS), -9.0, -3.0)).toBe(true);
    expect(blocked(worldOf("servers", ALL_RACKS), -9.0, -3.0)).toBe(false);
    // And each floor has its own glass.
    expect(worldOf("servers", ALL_RACKS).walls).toEqual(expect.arrayContaining(SERVER_GLASS));
    expect(worldOf("office", ALL_RACKS).walls).not.toEqual(expect.arrayContaining(SERVER_GLASS));
  });
});

describe("walk mode's starting places", () => {
  it("are free, inside the meeting room upstairs and in front of the elevator downstairs, and lead out", async () => {
    const { MEETING_START, LOBBY } = await import("./walk");
    expect(blocked(worldOf("office", ALL_RACKS), ...MEETING_START)).toBe(false);
    expect(MEETING_START[1]).toBeGreaterThan(10.2);
    expect(blocked(worldOf("servers", ALL_RACKS), ...LOBBY)).toBe(false);
    expect(findPath(gridOf("office", ALL_RACKS), MEETING_START, [13.2, 3.35])).not.toBeNull();
  });
});

describe("the server hall's machines", () => {
  /** In the aisle between the second row of app server places and the row kept for autoscaling. */
  const aisle: [number, number] = [-3.0, -2.3];
  /** Across the second row's places, in the cold aisle in front of the first row. */
  const coldAisle: [number, number] = [-4.8, -4.7];
  const newCompany = () => racksOf(buildModel(newLegacyGame(1)));

  it("stand in the way only once built: an empty place is open floor", () => {
    expect(newCompany().apps).toBe(1);
    expect(clearLine(worldOf("servers", newCompany()), aisle, coldAisle)).toBe(true);
    expect(clearLine(worldOf("servers", ALL_RACKS), aisle, coldAisle)).toBe(false);
    // A server fitted later blocks its place from then on.
    expect(blocked(worldOf("servers", { ...newCompany(), apps: 9 }), -3.85, -3.6)).toBe(true);
    expect(blocked(worldOf("servers", newCompany()), -3.85, -3.6)).toBe(false);
  });

  it("move the avatar aside when one is fitted where it stands", async () => {
    const { avatar, placeAvatar, setRacks } = await import("./walk");
    setRacks(newCompany());
    placeAvatar("servers", [-3.85, -3.6]);
    avatar.path = [[-3.85, -6.0]];
    setRacks({ ...newCompany(), apps: 9 });
    expect(blocked(worldOf("servers", { ...newCompany(), apps: 9 }), avatar.x, avatar.z)).toBe(false);
    expect(Math.hypot(avatar.x + 3.85, avatar.z + 3.6)).toBeLessThan(1);
    expect(avatar.path).toEqual([]);
  });
});
