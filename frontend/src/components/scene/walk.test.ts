import { beforeEach, describe, expect, it } from "vitest";
import { EQUIPMENT_ORDER, newLegacyGame, type EquipmentId } from "@/sim";
import { FUN_PROPS } from "./floorplan";
import { footprint, type Footprint } from "./layout";
import { facing, promptAt } from "./player";
import { avatar, held, placeAvatar, play, stepAvatar } from "./walk";

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
