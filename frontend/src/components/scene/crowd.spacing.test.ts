import { describe, expect, it } from "vitest";
import { ROOM } from "./layout";
import { clearLine } from "./navgrid";
import { gridHere } from "./walk";
import { stepVisitors, populate, visitors } from "./crowd";
import { facing } from "./player";
import { clearOf, radiusOf } from "./spacing";
import type { Body } from "./spacing";

function corridor(): [[number, number], [number, number]] {
  const world = gridHere("office").world;
  for (let z = ROOM.z0 + 2; z < ROOM.z1 - 2; z += 0.5) {
    for (let x = ROOM.x0 + 3; x < ROOM.x1 - 7; x += 0.5) {
      const a: [number, number] = [x, z];
      const b: [number, number] = [x + 4, z];
      if (clearLine(world, a, b, 0.5)) return [a, b];
    }
  }
  throw new Error("No clear office corridor for the spacing test");
}

function step(seconds: number, around: (floor: "office" | "servers") => Body[] = () => []): void {
  for (let i = 1; i <= Math.round(seconds * 10); i++) stepVisitors(0.1, i / 10, false, around);
}

describe("visitor spacing", () => {
  it("keeps a walking visitor out of a fixed body while it continues or gives up its route", () => {
    populate(1, 99);
    const visitor = visitors()[0];
    const [start, end] = corridor();
    const fixed: Body = { x: (start[0] + end[0]) / 2, z: start[1], r: 0.35 };
    Object.assign(visitor, {
      floor: "office",
      x: start[0],
      z: start[1],
      yaw: facing(end[0] - start[0], end[1] - start[1]),
      doing: "roam",
      path: [end],
      bound: "office",
      stuck: 0,
    });
    step(12, (floor) => floor === "office" ? [fixed] : []);
    expect(Math.hypot(visitor.x - fixed.x, visitor.z - fixed.z)).toBeGreaterThanOrEqual(radiusOf(visitor.species) + fixed.r - 1e-6);
    expect(Math.hypot(visitor.x - start[0], visitor.z - start[1])).toBeGreaterThan(0.5);
  });

  it("lets visitors pass head-on without overlapping", () => {
    populate(2, 101);
    const [a, b] = visitors();
    const [start, end] = corridor();
    Object.assign(a, {
      floor: "office",
      x: start[0],
      z: start[1],
      yaw: facing(end[0] - start[0], end[1] - start[1]),
      doing: "roam",
      path: [end],
      bound: "office",
      stuck: 0,
    });
    Object.assign(b, {
      floor: "office",
      x: end[0],
      z: end[1],
      yaw: facing(start[0] - end[0], start[1] - end[1]),
      doing: "roam",
      path: [start],
      bound: "office",
      stuck: 0,
    });
    let minimum = Infinity;
    for (let i = 1; i <= 240; i++) {
      stepVisitors(0.1, i / 10, false);
      minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.z - b.z) - radiusOf(a.species) - radiusOf(b.species));
    }
    expect(minimum).toBeGreaterThanOrEqual(-1e-6);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it("populates and re-goals only at spots clear of other visitors and fixed bodies", () => {
    populate(10, 999);
    const people = visitors();
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        if (people[i].floor !== people[j].floor) continue;
        expect(clearOf([{ x: people[j].x, z: people[j].z, r: radiusOf(people[j].species) }], radiusOf(people[i].species), people[i].x, people[i].z)).toBe(true);
      }
    }

    const target = people[0];
    const fixed: Body = { x: target.x + 5, z: target.z, r: 0.5 };
    Object.assign(target, { doing: "linger", until: 0, path: [], bound: target.floor });
    stepVisitors(0.1, 0.1, false, (floor) => floor === target.floor ? [fixed] : []);
    const goal = target.path.at(-1);
    if (goal) {
      expect(clearOf([{ ...fixed }], radiusOf(target.species), goal[0], goal[1])).toBe(true);
    } else {
      expect(target.doing).toBe("linger");
    }
  });
});
