// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyAction, newGame } from "@/sim";
import { advanceSteps, step } from "@/sim/step";
import type { Action, GameState } from "@/sim/types";
import { trafficModel } from "./traffic";

const run = (s: GameState, n: number) => advanceSteps(s, n).state;
const act = (s: GameState, a: Action) => { const r = applyAction(s, a); if (!r.ok) throw Error(r.message); return r.state; };
const sum = (xs: { rate: number }[]) => xs.reduce((n, x) => n + x.rate, 0);

describe("trafficModel", () => {
  it("accounts for every request in each recorded second", () => {
    let s = newGame(2);
    for (let i = 0; i < 40; i++) {
      if (i === 8) s = act(s, { type: "start_db_upgrade" });
      if (i === 9) s = act(s, { type: "incident_inspect", equipment: "db" });
      if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
      s = step(s).state;
      const c = s.campaign!, m = c.snapshot, t = trafficModel(c);
      expect(sum(t.edges.filter(e => e.from === "in"))).toBe(m.incoming);
      expect(sum(t.edges.filter(e => e.kind === "served"))).toBe(m.successful);
      expect(t.outRate).toBe(m.successful);
      expect(sum(t.drops)).toBe(m.failed);
      // What the servers finish is exactly what the cache and database receive.
      expect(sum(t.edges.filter(e => e.to === "db" || e.to === "cache"))).toBe(m.app.processed);
    }
  });

  it("serves everything while healthy, with no drops or queues", () => {
    const t = trafficModel(run(newGame(1), 3).campaign!);
    expect(t).toMatchObject({ inRate: 300, outRate: 300, dropped: 0, drops: [], queues: [], hidden: false });
    expect(t.edges).toContainEqual({ from: "gateway", to: "app-1", rate: 300, kind: "flow" });
    expect(t.edges).toContainEqual({ from: "db", to: "out", rate: 300, kind: "served" });
  });

  it("keeps an incident's failures at the door until the machine is inspected", () => {
    let s = run(newGame(1), 6);
    expect(s.phase).toBe("incident");
    s = step(s).state;
    const before = trafficModel(s.campaign!);
    expect(before.hidden).toBe(true);
    expect(before.drops.length).toBeGreaterThan(0);
    expect(before.drops.every(d => d.at === "in")).toBe(true);
    expect(before.queues.some(q => q.at === "db")).toBe(false);

    s = act(s, { type: "incident_inspect", equipment: "app" });
    expect(trafficModel(s.campaign!).drops.every(d => d.at === "in")).toBe(true);
    s = act(s, { type: "incident_inspect", equipment: "db" });
    const after = trafficModel(s.campaign!);
    expect(after.hidden).toBe(false);
    expect(after.drops.map(d => d.at)).toEqual(["db"]);
    expect(after.queues.some(q => q.at === "db")).toBe(true);
  });

  it("dims a server that is installed but receives no traffic", () => {
    let s = run(newGame(1), 6);
    s = act(s, { type: "add_server" });
    for (let i = 0; i < 20 && s.campaign!.apps.length < 2; i++) s = step(s).state;
    const c = s.campaign!, added = c.apps.at(-1)!.id;
    expect(c.apps.length).toBe(2);
    const t = trafficModel(c);
    expect(t.dimmed).toEqual([added]);
    expect(t.edges.some(e => e.to === added)).toBe(false);
  });
});
