import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EQUIPMENT_ORDER, newLegacyGame, type EquipmentId } from "@/sim";
import { FUN_PROPS } from "./floorplan";
import { footprint, type Footprint } from "./layout";
import { facing, promptAt } from "./player";
import { avatar, busyProgress, endBusyAt, held, jump, onBusy, placeAvatar, play, stepAvatar, stopPlaying, walkTo } from "./walk";
import { ride } from "./ride";
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
      expect(avatar.busy, p.id).toEqual({ prop: p.id, clip: p.clip, since: 10, until: 10 + p.seconds });
      if (!Number.isFinite(p.seconds)) {
        // An endless thing (the arcade) never times out: its game schedules the end instead.
        stepAvatar(0.8, [0, 1], footprints, names, 1000);
        expect(avatar.busy, p.id).not.toBeNull();
        stopPlaying();
        continue;
      }
      stepAvatar(0.8, [0, 1], footprints, names, 10 + p.seconds + 0.1);
      expect(avatar.busy, p.id).toBeNull();
    }
    expect(held.size).toBe(0);
  });

  it("reads how far through a fun thing the avatar is, until it is dropped", () => {
    const p = FUN_PROPS[0];
    placeAvatar("office", [p.x, p.z]);
    play(p, 10);
    expect(busyProgress(10)).toBe(0);
    expect(busyProgress(10 + p.seconds / 2)).toBe(0.5);
    expect(busyProgress(99)).toBe(1);
    stopPlaying();
    expect(avatar.busy).toBeNull();
    expect(busyProgress(11)).toBeNull();
  });

  it("does not move the avatar while it is busy, however the player steers or clicks", () => {
    const p = FUN_PROPS[0];
    placeAvatar("office", [p.x, p.z]);
    play(p, 10);
    held.add("KeyD");
    stepAvatar(0.5, [0, -1], footprints, names, 10.5);
    expect(avatar.x).toBeCloseTo(p.x);
    expect(avatar.z).toBeCloseTo(p.z);
    expect(avatar.moving).toBe(false);
    expect(avatar.busy).not.toBeNull();
    expect(walkTo(p.x + 1, p.z + 1)).toBe(false);
    expect(avatar.path).toEqual([]);
    expect(avatar.busy).not.toBeNull();
    held.clear();
  });

  it("tells listeners when a fun thing starts and ends, not every frame", () => {
    const heard: (string | null)[] = [];
    const off = onBusy((b) => heard.push(b?.prop ?? null));
    const p = FUN_PROPS[0];
    placeAvatar("office", [p.x, p.z]);
    play(p, 10);
    stepAvatar(0.1, [0, -1], footprints, names, 10.1);
    stepAvatar(0.1, [0, -1], footprints, names, 10.2);
    // The timer's end is news too, and so is being cut short or the walk being placed anew.
    stepAvatar(0.1, [0, -1], footprints, names, 10 + p.seconds + 0.1);
    play(p, 20);
    stopPlaying();
    play(p, 30);
    placeAvatar("office", [1, 3]);
    expect(heard).toEqual([p.id, null, p.id, null, p.id, null]);
    off();
  });

  it("never times out an endless fun thing and schedules its own end", () => {
    const arcade = FUN_PROPS.find((p) => p.id === "arcade")!;
    expect(arcade.seconds).toBe(Infinity);
    placeAvatar("office", [arcade.x, arcade.z]);
    play(arcade, 10);
    expect(busyProgress(9999)).toBe(0);
    stepAvatar(0.5, [0, -1], footprints, names, 9999);
    expect(avatar.busy).not.toBeNull();
    // The game schedules its own ending, which the clock then honours.
    endBusyAt(10_010);
    stepAvatar(0.5, [0, -1], footprints, names, 10_009);
    expect(avatar.busy).not.toBeNull();
    stepAvatar(0.5, [0, -1], footprints, names, 10_011);
    expect(avatar.busy).toBeNull();
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

describe("jumping in walk mode", () => {
  const rideBefore = { ...ride };

  beforeEach(() => {
    placeAvatar("office", [1, 3], 0);
    held.clear();
    Object.assign(ride, { start: -Infinity, arrived: -Infinity });
  });

  afterEach(() => Object.assign(ride, rideBefore));

  it("rises, keeps steering in the air, and lands within seven tenths of a second", () => {
    const x = avatar.x;
    expect(jump()).toBe(true);
    held.add("KeyD");
    let peak = 0;
    for (let i = 0; i < 7; i++) {
      stepAvatar(0.1, [0, -1], footprints, names, i / 10);
      peak = Math.max(peak, avatar.lift);
      if (i === 0) expect(avatar.x).toBeGreaterThan(x);
    }
    expect(peak).toBeGreaterThan(0.3);
    expect(avatar.lift).toBe(0);
    expect(avatar.vy).toBe(0);
  });

  it("cannot double-jump while airborne or jump while riding or busy", () => {
    expect(jump()).toBe(true);
    stepAvatar(0.1, [0, -1], footprints, names, 0);
    const lift = avatar.lift;
    expect(jump()).toBe(false);
    expect(avatar.lift).toBe(lift);

    Object.assign(ride, { start: 2, arrived: 1 });
    placeAvatar("office", [1, 3]);
    expect(jump()).toBe(false);
    Object.assign(ride, { start: -Infinity, arrived: -Infinity });
    avatar.busy = { prop: FUN_PROPS[0].id, clip: FUN_PROPS[0].clip, since: 0, until: 10 };
    expect(jump()).toBe(false);
  });
});
