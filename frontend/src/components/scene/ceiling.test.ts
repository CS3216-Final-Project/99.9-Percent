import { describe, expect, it } from "vitest";
import { CEILING_LIGHTS, CEILING_VENTS, ELEVATOR_SPOT } from "./floorplan";
import { ROOM } from "./layout";

describe("the ceiling seen from the avatar", () => {
  const overShaft = ([x, z]: [number, number]) => x > ELEVATOR_SPOT[0] - 0.6 && x < ELEVATOR_SPOT[2] + 0.6 && z > ELEVATOR_SPOT[1] - 0.6 && z < ELEVATOR_SPOT[3] + 0.6;
  const inRoom = ([x, z]: [number, number]) => x > ROOM.x0 + 0.6 && x < ROOM.x1 - 0.6 && z > ROOM.z0 + 0.6 && z < ROOM.z1 - 0.6;

  it("hangs its lights and vents across the whole room, inside the walls, leaving the shaft open for the car", () => {
    expect(CEILING_LIGHTS.length).toBeGreaterThan(40);
    expect(CEILING_VENTS.length).toBeGreaterThan(5);
    for (const p of [...CEILING_LIGHTS, ...CEILING_VENTS]) {
      expect(inRoom(p), String(p)).toBe(true);
      expect(overShaft(p), String(p)).toBe(false);
    }
    // Lights reach all four corners' quarters, so no part of the room is left unlit.
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      expect(CEILING_LIGHTS.some(([x, z]) => Math.sign(x - ROOM.cx) === sx && Math.sign(z - ROOM.cz) === sz)).toBe(true);
    }
  });

  it("never puts a vent where a light panel is", () => {
    for (const [x, z] of CEILING_VENTS) expect(CEILING_LIGHTS.some(([lx, lz]) => Math.abs(lx - x) < 1 && Math.abs(lz - z) < 1)).toBe(false);
  });
});
