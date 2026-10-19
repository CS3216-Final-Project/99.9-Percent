import { describe, expect, it } from "vitest";
import { CLOSED_ROOMS, ELEVATOR_DOOR, ELEVATOR_SPOT, SERVER_ROOMS, SERVER_ZONE_NAMES, ZONE_NAMES } from "./floorplan";
import { ROOM } from "./layout";
import { placeAt, whereLine, ZONE_TONES, zoneAreas } from "./places";

/** Whether (x, z) lies inside an outline, by counting the edges a ray to the east crosses. */
function within(points: [number, number][], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Spots across the whole floor, a little off any round number so none sits exactly on an edge. */
function spots(step: number): [number, number][] {
  const out: [number, number][] = [];
  for (let x = ROOM.x0 + 0.137; x < ROOM.x1; x += step) for (let z = ROOM.z0 + 0.091; z < ROOM.z1; z += step) out.push([x, z]);
  return out;
}

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

describe("the map's zones", () => {
  it("colour every spot as the zone the line names there, on both floors", () => {
    for (const floor of ["office", "servers"] as const) {
      const areas = zoneAreas(floor);
      for (const [x, z] of spots(0.31)) {
        // The last area drawn over a spot is the one seen there.
        const seen = [...areas].reverse().find((a) => within(a.points, x, z));
        expect(seen?.name, `${floor} at ${x.toFixed(2)}, ${z.toFixed(2)}`).toBe(placeAt(floor, x, z));
      }
    }
  });

  it("give zones that meet different tints, and the elevator none", () => {
    for (const floor of ["office", "servers"] as const) {
      const areas = zoneAreas(floor);
      const tone = new Map(areas.map((a) => [a.name, a.tone]));
      expect(tone.get("Elevator")).toBeNull();
      for (const [name, t] of tone) {
        if (name === "Elevator") continue;
        expect(t, name).toBeGreaterThanOrEqual(0);
        expect(t, name).toBeLessThan(ZONE_TONES);
      }
      // Neighbouring spots in different zones: those zones meet.
      for (const [x, z] of spots(0.4)) {
        const here = placeAt(floor, x, z);
        for (const there of [placeAt(floor, x + 0.4, z), placeAt(floor, x, z + 0.4)])
          if (there !== here && here !== "Elevator" && there !== "Elevator") expect(tone.get(here), `${here} beside ${there}`).not.toBe(tone.get(there));
      }
    }
  });

  it("name every zone the line can name, once each apart from the elevator's two parts", () => {
    const names = zoneAreas("office").map((a) => a.name);
    for (const [name] of ZONE_NAMES) expect(names.filter((n) => n === name), name).toHaveLength(1);
    expect(zoneAreas("servers").map((a) => a.name)).toEqual(expect.arrayContaining([...SERVER_ZONE_NAMES.map(([n]) => n), ...SERVER_ROOMS.map(([n]) => n)]));
  });
});

describe("the map's line", () => {
  it("says the place and the floor, or which way the elevator is going", () => {
    expect(whereLine("office", 18.25, 6.2)).toBe("Lounge, office floor");
    expect(whereLine("servers", -2, 9.9)).toBe("Workshop, server floor");
    expect(whereLine("servers", 10, -2, "office")).toBe("In the elevator, going up to the office floor");
    expect(whereLine("office", 10, -2, "servers")).toBe("In the elevator, going down to the server floor");
  });

  it("leaves the floor unsaid when it is the one the map shows", () => {
    expect(whereLine("office", 18.25, 6.2, null, "office")).toBe("Lounge");
    expect(whereLine("office", 18.25, 6.2, null, "servers")).toBe("Lounge, office floor");
    expect(whereLine("servers", 10, -2, "office", "servers")).toBe("In the elevator, going up to the office floor");
  });
});
