import { describe, expect, it } from "vitest";
import { ELEVATOR_DOOR, SHAFT } from "./floorplan";
import { ROOM } from "./layout";
import { AVATAR_RADIUS } from "./navgrid";
import { facing } from "./player";
import {
  blendPose,
  dimAt,
  ease,
  FIRST,
  firstHit,
  firstPose,
  FOLLOW,
  followPose,
  headingDir,
  headingFromOffset,
  headingOf,
  overviewOffset,
  POINT,
  pointTurn,
  reachInside,
  VIEW_EASE,
  type Pose,
} from "./views";

const near = (a: number, b: number, digits = 5) => expect(a).toBeCloseTo(b, digits);

describe("headings", () => {
  it("measure the way a camera looks just as a creature's yaw measures the way it faces", () => {
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0], [0.6, -0.8]] as [number, number][]) {
      near(headingOf(dx, dz), facing(dx, dz));
      const [x, z] = headingDir(headingOf(dx, dz));
      near(x, dx);
      near(z, dz);
    }
  });

  it("round-trip through the overview's camera offset, whatever its tilt and distance", () => {
    for (const h of [0, 0.7, 2.4, -1.9]) {
      const [ox, oy, oz] = overviewOffset(h, 0.8, 50);
      near(headingFromOffset(ox, oz), h);
      near(Math.hypot(ox, oy, oz), 50);
      near(Math.acos(oy / 50), 0.8);
    }
  });
});

describe("the follow view", () => {
  const MIDDLE = { x: 0, z: 2.5 };

  it("stands back along the heading and above the avatar, looking at it", () => {
    const p = followPose(MIDDLE.x, 0, MIDDLE.z, 0, FOLLOW.pitch, FOLLOW.distance);
    near(Math.hypot(p.x - p.lx, p.y - p.ly, p.z - p.lz), FOLLOW.distance);
    // Heading 0 looks along -z, so the camera stands to +z of the avatar.
    expect(p.z).toBeGreaterThan(MIDDLE.z);
    near(p.x, MIDDLE.x);
    expect(p.y).toBeGreaterThan(p.ly);
    expect([p.lx, p.lz]).toEqual([MIDDLE.x, MIDDLE.z]);
    near(p.ly, FOLLOW.aim);
  });

  it("keeps its distance and tilt within bounds", () => {
    const close = followPose(MIDDLE.x, 0, MIDDLE.z, 0, FOLLOW.pitch, 0.1);
    near(Math.hypot(close.x - close.lx, close.y - close.ly, close.z - close.lz), FOLLOW.nearest);
    const flat = followPose(MIDDLE.x, 0, MIDDLE.z, 0, -1, FOLLOW.distance);
    near(Math.atan2(flat.y - flat.ly, flat.z - flat.lz), FOLLOW.lowest);
  });

  it("comes in under the walls' tops rather than rise above them, on either floor", () => {
    for (const floorY of [0, -4.2]) {
      const p = followPose(MIDDLE.x, floorY, MIDDLE.z, 0, FOLLOW.highest, FOLLOW.farthest);
      expect(p.y).toBeLessThanOrEqual(floorY + ROOM.wallH - FOLLOW.margin + 1e-9);
    }
  });

  it("comes in rather than leave the room", () => {
    // Beside the east wall, looking west: the camera would stand outside it.
    const p = followPose(ROOM.x1 - 1, 0, MIDDLE.z, Math.PI / 2, FOLLOW.pitch, FOLLOW.farthest);
    expect(p.x).toBeLessThanOrEqual(ROOM.x1 - FOLLOW.margin + 1e-9);
    expect(reachInside(ROOM.x1 - 1, 0, 1, 0)).toBeCloseTo(1 - FOLLOW.margin);
    expect(reachInside(0, 0, 0, 0)).toBe(Infinity);
  });

  it("comes round to the near side of the elevator's shaft rather than stand behind it", () => {
    // Beside the shaft's front, looking east out of it: the camera would stand inside the shaft, behind its wall.
    const at = { x: ELEVATOR_DOOR.x + 0.8, z: ELEVATOR_DOOR.z - 1.0 };
    const open = followPose(at.x, 0, at.z, -Math.PI / 2, FOLLOW.pitch, FOLLOW.distance);
    expect(firstHit(at.x, at.z, open.x, open.z, SHAFT)).toBeLessThan(1);
    const kept = followPose(at.x, 0, at.z, -Math.PI / 2, FOLLOW.pitch, FOLLOW.distance, SHAFT);
    expect(firstHit(at.x, at.z, kept.x, kept.z, SHAFT)).toBe(1);
    expect(Math.hypot(kept.x - kept.lx, kept.y - kept.ly, kept.z - kept.lz)).toBeGreaterThan(0.5);
  });

  it("rises and looks down more steeply rather than come up to the avatar's face when a wall is close behind", () => {
    // A metre and a half from the east wall, looking west: the camera has little floor behind it.
    const p = followPose(ROOM.x1 - 1.5, 0, MIDDLE.z, Math.PI / 2, FOLLOW.pitch, FOLLOW.distance);
    const pitch = Math.atan2(p.y - p.ly, Math.hypot(p.x - p.lx, p.z - p.lz));
    expect(pitch).toBeGreaterThan(FOLLOW.pitch + 0.3);
    expect(Math.hypot(p.x - p.lx, p.y - p.ly, p.z - p.lz)).toBeGreaterThanOrEqual(FOLLOW.nearest);
    expect(p.x).toBeLessThanOrEqual(ROOM.x1 - FOLLOW.margin + 1e-9);
    expect(p.y).toBeLessThanOrEqual(ROOM.wallH - FOLLOW.margin + 1e-9);
  });

  it("keeps a little way off and above even with the avatar's back to a wall", () => {
    expect(FOLLOW.least).toBeLessThan(AVATAR_RADIUS);
    const p = followPose(ROOM.x1 - AVATAR_RADIUS, 0, MIDDLE.z, Math.PI / 2, FOLLOW.pitch, FOLLOW.distance);
    for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
    expect(p.x).toBeLessThan(ROOM.x1);
    expect(p.y - p.ly).toBeGreaterThan(0.5);
  });
});

describe("a wall in the way", () => {
  it("is met where the line crosses it, and not where it only would beyond the line's end", () => {
    const wall: [number, number, number, number] = [1, -1, 1, 1];
    expect(firstHit(0, 0, 4, 0, [wall])).toBeCloseTo(0.25);
    expect(firstHit(0, 0, 0.5, 0, [wall])).toBe(1);
    expect(firstHit(0, 2, 4, 2, [wall])).toBe(1);
    // Running alongside a wall is not meeting it.
    expect(firstHit(1, -2, 1, 2, [wall])).toBe(1);
    expect(firstHit(0, 0, 4, 0, [[3, -1, 3, 1], wall])).toBeCloseTo(0.25);
  });
});

describe("the view through the avatar's eyes", () => {
  it("stands at eye height over the avatar, looking along the heading and down by the pitch", () => {
    const p = firstPose(2, -4.2, 3, Math.PI / 2, 0.3, 80);
    expect([p.x, p.z]).toEqual([2, 3]);
    near(p.y, -4.2 + FIRST.eye);
    // Heading a quarter turn round looks along -x.
    expect(p.lx).toBeLessThan(p.x);
    near(p.lz, p.z);
    near(Math.atan2(p.y - p.ly, Math.hypot(p.lx - p.x, p.lz - p.z)), 0.3);
    expect(p.fov).toBe(80);
  });

  it("cannot look further up or down than its limit", () => {
    const up = firstPose(0, 0, 0, 0, -9, 75);
    near(Math.atan2(up.ly - up.y, Math.hypot(up.lx - up.x, up.lz - up.z)), FIRST.pitch);
  });
});

describe("looking round by pointing", () => {
  it("leaves the middle of the view still, so things there can be clicked, and turns harder towards the edges", () => {
    for (const offset of [0, 0.2, -0.3, POINT.dead, -POINT.dead]) expect(pointTurn(offset)).toBeCloseTo(0);
    expect(pointTurn(1)).toBe(1);
    expect(pointTurn(-1)).toBe(-1);
    expect(pointTurn(0.9)).toBeGreaterThan(pointTurn(0.6));
    expect(pointTurn(0.6)).toBeGreaterThan(0);
    expect(pointTurn(-0.6)).toBeCloseTo(-pointTurn(0.6));
    // Past the edge, as a cursor a pixel outside the view reads, is no faster than at it.
    expect(pointTurn(1.4)).toBe(1);
  });
});

describe("moving between views", () => {
  const a: Pose = { x: 0, y: 1, z: 0, lx: 0, ly: 0, lz: -1, fov: 55 };
  const b: Pose = { x: 4, y: 3, z: 2, lx: 1, ly: 1, lz: 1, fov: 75 };

  it("eases from one pose to the next, starting and ending still", () => {
    expect(blendPose(a, b, 0)).toEqual(a);
    expect(blendPose(a, b, 1)).toEqual(b);
    expect(blendPose(a, b, 2)).toEqual(b);
    near(blendPose(a, b, 0.5).x, 2);
    near(blendPose(a, b, 0.5).fov, 65);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });

  it("dims to dark, cuts at the darkest, and comes back, within the time a move takes", () => {
    expect(dimAt(0)).toEqual({ dark: 0, cut: false });
    expect(dimAt(VIEW_EASE / 4).dark).toBeGreaterThan(0);
    expect(dimAt(VIEW_EASE / 4).cut).toBe(false);
    near(dimAt(VIEW_EASE / 2).dark, 1);
    expect(dimAt(VIEW_EASE / 2).cut).toBe(true);
    expect(dimAt((VIEW_EASE * 3) / 4)).toMatchObject({ cut: true });
    expect(dimAt((VIEW_EASE * 3) / 4).dark).toBeLessThan(1);
    expect(dimAt(VIEW_EASE)).toEqual({ dark: 0, cut: true });
    expect(VIEW_EASE).toBeCloseTo(0.6);
  });
});
