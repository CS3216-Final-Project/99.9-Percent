import { describe, expect, it } from "vitest";
import { CLOSED_ROOMS, ELEVATOR_DOOR, ELEVATOR_SPOT, SERVER_ROOMS, SERVER_ZONE_NAMES, ZONE_NAMES } from "./floorplan";
import { placeAt, whereLine } from "./places";

describe("the place a spot is in", () => {
  it("is named by the zone name hung over it, for every name on both floors: the map and the room agree", () => {
    for (const [name, x, z] of ZONE_NAMES) expect(placeAt("office", x, z), name).toBe(name);
    for (const [name, x, z] of SERVER_ZONE_NAMES) expect(placeAt("servers", x, z), name).toBe(name);
  });

  it("is the room behind glass it stands in, right up to the glass", () => {
    for (const [name, r] of SERVER_ROOMS) {
      // The monitoring room is in the server hall's corner, so the hall is checked at a corner of its own.
      const corner = name === "Server hall" ? [r[0] + 0.1, r[3] - 0.1] : [r[0] + 0.1, r[1] + 0.1];
      expect(placeAt("servers", corner[0], corner[1]), name).toBe(name);
    }
    for (const r of CLOSED_ROOMS) {
      const name = placeAt("office", (r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
      expect(placeAt("office", r[0] + 0.05, r[1] + 0.05)).toBe(name);
      expect(ZONE_NAMES.map(([n]) => n)).toContain(name);
    }
  });

  it("is the elevator inside the car or in front of its doors, on either floor", () => {
    const car: [number, number] = [(ELEVATOR_SPOT[0] + ELEVATOR_SPOT[2]) / 2, (ELEVATOR_SPOT[1] + ELEVATOR_SPOT[3]) / 2];
    for (const floor of ["office", "servers"] as const) {
      expect(placeAt(floor, ...car)).toBe("Elevator");
      expect(placeAt(floor, ELEVATOR_DOOR.x + 0.6, ELEVATOR_DOOR.z)).toBe("Elevator");
    }
  });

  it("is otherwise the nearest open zone", () => {
    expect(placeAt("office", 19, 5)).toBe("Lounge");
    expect(placeAt("office", -18, 6)).toBe("Events");
  });
});

describe("the map's line", () => {
  it("says the place and the floor, or which way the elevator is going", () => {
    expect(whereLine("office", 18.25, 6.2)).toBe("Lounge, office floor");
    expect(whereLine("servers", -2, 9.9)).toBe("Workshop, server floor");
    expect(whereLine("servers", 10, -2, "office")).toBe("In the elevator, going up to the office floor");
    expect(whereLine("office", 10, -2, "servers")).toBe("In the elevator, going down to the server floor");
  });
});
