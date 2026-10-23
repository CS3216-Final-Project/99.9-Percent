// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyAction, newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { trafficModel } from "./traffic";
import { dots, edgePath, MAX_DOTS, nodePoint, packetSpeed, pathLength, pointAt, REQUESTS_PER_DOT } from "./trafficLayout";

describe("traffic layout", () => {
  it("places every edge, drop and queue of a busy company on the floor", () => {
    let s = advanceSteps(newGame(1), 6).state;
    const r = applyAction(s, { type: "add_server" });
    if (!r.ok) throw Error(r.message);
    s = advanceSteps(advanceSteps(r.state, 8).state, 3).state;
    const c = s.campaign!, layout = { apps: c.apps.map(a => a.id), dbCabinets: 1 };
    const t = trafficModel(c, new Set(["app", "db"]));
    for (const e of t.edges) expect(edgePath(e, layout), `${e.from} > ${e.to}`).not.toBeNull();
    for (const d of t.drops) expect(nodePoint(d.at, layout)).not.toBeNull();
    for (const q of t.queues) expect(nodePoint(q.at, layout)).not.toBeNull();
    for (const id of t.dimmed) expect(edgePath({ from: "gateway", to: id }, layout)).not.toBeNull();
  });

  it("shows volume as the number of dots, within a cap", () => {
    expect(dots(0)).toBe(0);
    expect(dots(1)).toBe(1);
    expect(dots(REQUESTS_PER_DOT * 10)).toBe(10);
    expect(dots(1e9)).toBe(MAX_DOTS);
  });

  it("slows packets as latency rises", () => {
    expect(packetSpeed(100)).toBeGreaterThan(packetSpeed(500));
    expect(packetSpeed(500)).toBeGreaterThan(packetSpeed(1100));
  });

  it("walks a polyline by distance", () => {
    const line: [number, number][] = [[0, 0], [2, 0], [2, 3]];
    expect(pathLength(line)).toBe(5);
    expect(pointAt(line, 1)).toEqual([1, 0]);
    expect(pointAt(line, 3)).toEqual([2, 1]);
    expect(pointAt(line, 99)).toEqual([2, 3]);
  });
});
