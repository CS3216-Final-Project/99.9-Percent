import { describe, expect, it } from "vitest";
import { EQUIPMENT_ORDER, newLegacyGame, type EquipmentId } from "@/sim";
import { ELEVATOR_DOOR, ELEVATOR_SPOT, FUN_PROPS, OFFICE_DOORS } from "./floorplan";
import { footprint, POS, type Footprint } from "./layout";
import { AVATAR_RADIUS, blocked, findPath, gridOf, worldOf } from "./navgrid";
import { facing, followPath, promptAt, slide, SPEED, steer, turnTowards } from "./player";

const office = worldOf("office");
const s = newLegacyGame(1);
const footprints = Object.fromEntries(EQUIPMENT_ORDER.map((id) => [id, footprint(s, id)])) as Record<EquipmentId, Footprint>;
const names = Object.fromEntries(EQUIPMENT_ORDER.map((id) => [id, id === "db" ? "Database" : id])) as Record<EquipmentId, string>;

describe("steering", () => {
  it("walks away from the camera with up, to its right with right, and no faster on a diagonal", () => {
    const forward: [number, number] = [-1, -1];
    const none = { up: false, down: false, left: false, right: false };
    const up = steer({ ...none, up: true }, forward);
    expect(up[0]).toBeCloseTo(-Math.SQRT1_2);
    expect(up[1]).toBeCloseTo(-Math.SQRT1_2);
    // Looking along -x-z, the right hand points along +x-z.
    const right = steer({ ...none, right: true }, forward);
    expect(right[0]).toBeCloseTo(Math.SQRT1_2);
    expect(right[1]).toBeCloseTo(-Math.SQRT1_2);
    const both = steer({ ...none, up: true, right: true }, forward);
    expect(Math.hypot(both[0], both[1])).toBeCloseTo(1);
    expect(steer({ ...none, up: true, down: true }, forward)).toEqual([0, 0]);
  });

  it("turns the short way round, no faster than its rate", () => {
    expect(turnTowards(0, Math.PI / 2, 1)).toBeCloseTo(Math.PI / 2);
    expect(turnTowards(0, Math.PI / 2, 0.01)).toBeCloseTo(0.1);
    expect(turnTowards(3, -3, 1)).toBeGreaterThan(3);
    expect(facing(0, -1)).toBeCloseTo(0);
  });
});

describe("moving", () => {
  it("covers a walk's or a run's distance in the open", () => {
    const [x, z] = slide(office, 13.2, 0, 0, SPEED.walk);
    expect(z).toBeCloseTo(SPEED.walk);
    expect(x).toBe(13.2);
    expect(SPEED.run).toBeGreaterThan(SPEED.walk);
  });

  it("slides along a wall it walks into at an angle, rather than stopping", () => {
    // Heading into the front wall at 45 degrees from just in front of it, beside the foosball corner.
    expect(blocked(office, 12.0, 14.1)).toBe(false);
    const [x, z] = slide(office, 12.0, 14.1, 0.5, 0.5);
    // It closes on the wall, then carries on along it for the rest of the step.
    expect(z).toBeGreaterThan(14.1);
    expect(z).toBeLessThanOrEqual(14.5 - AVATAR_RADIUS);
    expect(x).toBeGreaterThan(12.4);
    expect(blocked(office, x, z)).toBe(false);
  });

  it("never passes through glass, however long the frame", () => {
    // The meeting room's front, beside its door: a big step straight at it stops at the glass.
    const door = OFFICE_DOORS[0];
    const [, z] = slide(office, door.x - 0.85, 9.6, 0, 3);
    expect(z).toBeLessThan(door.z);
    // Through the doorway itself it goes on.
    const [, through] = slide(office, door.x, 9.6, 0, 1.2);
    expect(through).toBeGreaterThan(door.z);
  });

  it("follows a planned walk to its end, and stops at something in the way", () => {
    const g = gridOf("office");
    const from: [number, number] = [-7.3, 9.75];
    const to: [number, number] = [13.2, 3.35];
    const path = findPath(g, from, to) as [number, number][];
    let at = { x: from[0], z: from[1], path };
    for (let i = 0; i < 400 && at.path.length; i++) at = followPath(office, at.x, at.z, at.path, SPEED.walk, 1 / 20);
    expect(at.path).toEqual([]);
    expect(at.x).toBeCloseTo(to[0]);
    expect(at.z).toBeCloseTo(to[1]);
    // A walk planned straight into a desk gives up at the desk instead of pushing.
    const stuck = followPath(office, -9.6, 6.0, [[-9.6, 7.4]], SPEED.walk, 1);
    expect(stuck.path).toEqual([]);
    expect(blocked(office, stuck.x, stuck.z)).toBe(false);
  });
});

describe("what is within reach", () => {
  it("offers the elevator inside its car and in front of its doors, to the other floor", () => {
    const car = promptAt("office", (ELEVATOR_SPOT[0] + ELEVATOR_SPOT[2]) / 2, ELEVATOR_DOOR.z, footprints, names);
    expect(car).toMatchObject({ kind: "elevator", to: "servers", label: "Ride down to the server floor" });
    expect(promptAt("servers", ELEVATOR_DOOR.x + 0.6, ELEVATOR_DOOR.z, footprints, names)).toMatchObject({ kind: "elevator", to: "office" });
  });

  it("offers equipment on the floor it stands on, only within reach of its outline", () => {
    const db = footprints.db;
    expect(promptAt("servers", db.x, db.z + db.d / 2 + 0.5, footprints, names)).toEqual({ kind: "equipment", id: "db", label: "Inspect Database" });
    // The same spot upstairs is open desks, with no database.
    expect(promptAt("office", db.x, db.z + db.d / 2 + 0.5, footprints, names)?.kind).not.toBe("equipment");
    expect(promptAt("servers", db.x, db.z + db.d / 2 + 1.2, footprints, names)).toBeNull();
    expect(promptAt("office", POS.growth.x, POS.growth.z + 1.6, footprints, names)).toMatchObject({ kind: "equipment", id: "growth" });
  });

  it("offers the office's fun things, and nothing in an empty corridor", () => {
    for (const p of FUN_PROPS) expect(promptAt("office", p.x, p.z, footprints, names), p.id).toMatchObject({ kind: "prop", prop: { id: p.id } });
    expect(promptAt("office", 13.2, 1.0, footprints, names)).toBeNull();
    expect(promptAt("servers", FUN_PROPS[0].x, FUN_PROPS[0].z, footprints, names)).toBeNull();
  });
});
