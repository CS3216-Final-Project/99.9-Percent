import { beforeEach, describe, expect, it } from "vitest";
import { EQUIPMENT_ORDER, newLegacyGame, type EquipmentId } from "@/sim";
import { FUN_PROPS } from "./floorplan";
import { footprint, type Footprint } from "./layout";
import { facing, promptAt } from "./player";
import { avatar, held, placeAvatar, play, stepAvatar } from "./walk";
import { FIRST } from "./views";

const s = newLegacyGame(1);
const footprints = Object.fromEntries(EQUIPMENT_ORDER.map((id) => [id, footprint(s, id)])) as Record<EquipmentId, Footprint>;
const names = Object.fromEntries(EQUIPMENT_ORDER.map((id) => [id, id === "db" ? "Database" : id])) as Record<EquipmentId, string>;

describe("playing with the office's fun things", () => {
  beforeEach(() => {
    placeAvatar("office");
  });

  it("every fun thing is within reach where it stands, and playing it turns the avatar to it and keeps it busy", () => {
    for (const p of FUN_PROPS) {
      placeAvatar("office", [p.x, p.z]);
      avatar.path = [[p.x + 1, p.z + 1]];
      expect(promptAt("office", avatar.x, avatar.z, footprints, names), p.id).toMatchObject({ kind: "prop", prop: { id: p.id } });
      play(p, 10);
      expect(avatar.path, p.id).toEqual([]);
      expect(avatar.yaw, p.id).toBeCloseTo(facing(p.face[0] - p.x, p.face[1] - p.z));
      expect(avatar.busy, p.id).toEqual({ clip: p.clip, until: 12.6 });
      stepAvatar(0.8, [0, 1], footprints, names, 12.7);
      expect(avatar.busy, p.id).toBeNull();
    }
    expect(held.size).toBe(0);
  });
});

describe("walking seen through the avatar's eyes", () => {
  // On the open floor by the shared table, a metre and a half clear every way.
  const START: [number, number] = [1, 3];
  beforeEach(() => {
    placeAvatar("office", START, 0);
    held.clear();
  });

  it("turns with the left and right arrows instead of stepping sideways, and faces where the view looks", () => {
    held.add("ArrowLeft");
    stepAvatar(0.5, [0, -1], footprints, names, 0, { heading: 1.2, pace: FIRST.pace });
    expect(avatar.x).toBeCloseTo(START[0]);
    expect(avatar.z).toBeCloseTo(START[1]);
    expect(avatar.moving).toBe(false);
    expect(avatar.yaw).toBeCloseTo(1.2);
    // Seen from above, the same key steps sideways as it always has.
    stepAvatar(0.5, [0, -1], footprints, names, 0);
    expect(avatar.x).toBeLessThan(START[0] - 0.5);
  });

  it("walks forward at a gentler pace, and A and D still step sideways", () => {
    held.add("KeyW");
    stepAvatar(0.5, [0, -1], footprints, names, 0, { heading: 0, pace: FIRST.pace });
    const eyes = START[1] - avatar.z;
    placeAvatar("office", START, 0);
    held.add("KeyW");
    stepAvatar(0.5, [0, -1], footprints, names, 0);
    const above = START[1] - avatar.z;
    expect(eyes).toBeGreaterThan(0);
    expect(eyes / above).toBeCloseTo(FIRST.pace, 2);
    placeAvatar("office", START, 0);
    held.add("KeyD");
    stepAvatar(0.5, [0, -1], footprints, names, 0, { heading: 0, pace: FIRST.pace });
    expect(avatar.x).toBeGreaterThan(START[0] + 0.3);
  });
});
