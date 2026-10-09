// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction } from "../index";
import { step, advanceSteps, processWork, qualifiesForRecovery } from "../step";
import { settlePeriod } from "../settlement";
import type { GameState, Action } from "../types";

const run = (s: GameState, n: number) => advanceSteps(s, n).state;
const act = (s: GameState, a: Action) => { const r = applyAction(s, a); if (!r.ok) throw Error(r.message); return r.state; };
function recover(s: GameState): GameState { for (let i = 0; i < 80 && s.phase !== "review"; i++)s = step(s).state; expect(s.phase).toBe("review"); return s; }
describe("opening-db physical model", () => {
  it("has exact healthy and growth arithmetic with mandatory batch stop", () => {
    const healthy = run(newGame(1), 3); expect(healthy.campaign!.snapshot).toMatchObject({ successful: 300, failed: 0, latencyMs: 100 });
    let s = healthy; for (const b of [200, 400, 600]) { s = step(s).state; expect(s.campaign!.dbBacklog).toBe(b); }
    expect(s.phase).toBe("incident"); expect(advanceSteps(newGame(1), 100).stepsConsumed).toBe(6);
    s = step(s).state; expect(s.campaign!.snapshot).toMatchObject({ successful: 600, failed: 200, serviceErrorRate: .25 });
  });
  it.each([[0, 100, 200, 50, 100, 0, 0], [0, 200, 200, 50, 200, 0, 0], [0, 300, 200, 50, 200, 50, 50], [100, 50, 200, 100, 150, 0, 0]])("bounded queue %j", (b, d, c, l, p, q, f) => {
    expect(processWork(b, d, c, l)).toMatchObject({ processed: p, backlog: q, failed: f });
  });
  it("conserves incoming and terminal work across drainage and period boundaries", () => {
    let s = newGame(2), old = 0;
    for (let i = 0; i < 130; i++) {
      if (i === 8) s = act(s, { type: "start_db_upgrade" });
      if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
      s = step(s).state; const c = s.campaign!, m = c.snapshot;
      expect(m.incoming).toBe(m.admitted + m.rejected);
      expect(old + m.admitted).toBe(m.successful + m.failed + m.app.backlog + m.db.backlog);
      old = m.app.backlog + m.db.backlog;
      expect(c.cumulative.admitted).toBe(c.cumulative.successful + c.cumulative.failed + old);
    }
  });
  it("allows repeatable free inspection and rejects unsupported actions immutably", () => {
    const s = run(newGame(), 6), before = JSON.stringify(s);
    const inspected = act(s, { type: "incident_inspect", equipment: "db" });
    expect(inspected.campaign!.snapshot).toEqual(s.campaign!.snapshot);
    expect(inspected.campaign!.cashCents).toBe(s.campaign!.cashCents);
    expect(inspected.campaign!.trace.at(-1)!.type).toBe("inspection");
    expect(applyAction(s, { type: "start_tech", tech: "caching" }).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("requires strict thresholds, positive traffic and completed outcomes", () => {
    const m = newGame().campaign!.snapshot;
    expect(qualifiesForRecovery({ ...m, latencyMs: 499, serviceErrorRate: .0099 })).toBe(true);
    for (const change of [{ latencyMs: 500 }, { serviceErrorRate: .01 }, { serviceErrorRate: null }, { admitted: 0 }, { successful: 0, failed: 0 }])
      expect(qualifiesForRecovery({ ...m, ...change })).toBe(false);
  });
  it("resets opening and stable streaks and never uses a timeout", () => {
    let s = run(newGame(), 5); s = act(s, { type: "set_traffic_limit", enabled: true }); s = step(s).state;
    expect(s.campaign!.overloadSteps).toBe(0);
    s = run(newGame(), 6); s = run(s, 130); expect(s.phase).toBe("incident"); expect(s.campaign!.step).toBe(136);
    s = act(s, { type: "start_db_upgrade" }); s = run(s, 4);
    expect(s.campaign!.incident!.stableSteps).toBe(1);
    s.campaign!.dbBacklog = 600; s = step(s).state;
    expect(s.campaign!.incident!.stableSteps).toBe(0);
  });
});
describe("opening acceptance paths", () => {
  it("A: delayed DB upgrade, exact boundary, five stable steps, continued identity", () => {
    let s = run(newGame(1, "company-a"), 6);
    s = act(s, { type: "start_db_upgrade" }); expect(s.campaign!.cashCents).toBe(1700000);
    expect(applyAction(s, { type: "add_server" }).ok).toBe(false);
    s = run(s, 2); expect(s.campaign!.dbCapacity).toBe(600);
    s = step(s).state; expect(s.campaign!.snapshot.latencyMs).toBe(500); expect(s.campaign!.incident!.stableSteps).toBe(0);
    s = run(s, 4); expect(s.phase).toBe("incident");
    s = step(s).state; expect(s.phase).toBe("review"); expect(s.campaign!.step).toBe(14);
    const c = s.campaign!; s = act(s, { type: "acknowledge_review" });
    expect(s.campaign).toMatchObject({ ...c, trace: s.campaign!.trace, nextEventId: s.campaign!.nextEventId, inputs: [...c.inputs, { step: 14, action: { type: "acknowledge_review" } }] });
    s = run(s, 80); expect(s.campaign!.runId).toBe("company-a");
    expect(s.campaign!.consumedEvents).toEqual(["opening-growth"]); expect(s.campaign!.reports).toHaveLength(1);
  });
  it("B: limit drains backlog, preserves rejection, removal opens a new incident", () => {
    let s = act(run(newGame(), 6), { type: "set_traffic_limit", enabled: true });
    s = recover(s); expect(s.campaign!.limit).toBe(500); expect(s.campaign!.snapshot.rejected).toBe(300);
    expect(s.campaign!.reports[0].limited).toBe(true);
    s = act(s, { type: "acknowledge_review" }); s = act(s, { type: "set_traffic_limit", enabled: false });
    s = run(s, 3); expect(s.phase).toBe("incident"); expect(s.campaign!.limit).toBeNull();
  });
  it("C: app addition has no physical benefit; later DB upgrade recovers", () => {
    let s = act(run(newGame(), 6), { type: "add_server" });
    s = run(s, 2); expect(s.campaign!.apps).toHaveLength(2);
    expect(s.campaign!.snapshot).toMatchObject({ installedAppCapacity: 2000, latencyMs: 1100, db: { capacity: 600, demand: 800 } });
    s = act(s, { type: "incident_inspect", equipment: "app" }); s = act(s, { type: "start_db_upgrade" }); s = recover(s);
    expect(s.campaign!.reports[0].explanations.join(" ")).toContain("did not relieve");
  });
  it("preserves unactivated work on recovery and gives it no causal credit", () => {
    let s = act(run(newGame(), 6), { type: "set_traffic_limit", enabled: true });
    while (s.campaign!.incident!.stableSteps < 4) s = step(s).state;
    s = act(s, { type: "start_db_upgrade" }); s = step(s).state;
    expect(s.phase).toBe("review"); expect(s.campaign!.pending).toHaveLength(1);
    expect(s.campaign!.reports[0].explanations.join(" ")).toContain("has not contributed");
  });
  it("replays deterministically including JSON continuation", () => {
    let a = run(newGame(77, "same"), 6); a = act(a, { type: "start_db_upgrade" });
    let b = JSON.parse(JSON.stringify(a)) as GameState;
    a = run(a, 100); for (let i = 0; i < 100 && b.phase !== "review"; i++)b = step(b).state;
    expect(b).toEqual(a); expect(advanceSteps(a, 100).stepsConsumed).toBe(0);
  });
});
describe("period settlement", () => {
  it("settles at 60 exactly once with proration, and no legacy charges", () => {
    let s = run(newGame(), 6); s = act(s, { type: "start_db_upgrade" }); s = recover(s); s = act(s, { type: "acknowledge_review" });
    s = run(s, 45); expect(s.campaign!.step).toBe(59); expect(s.campaign!.cashCents).toBe(1700000);
    s = step(s).state; const c = s.campaign!, period = c.settlements[0];
    expect(period.dbCents).toBe(Math.floor((8 * 50000 + 52 * 150000) / 60));
    expect(period.appCents).toBe(70000); expect(period.salaryCents).toBe(640000);
    expect(period.revenueCents).toBe(c.cumulative.successful * 20);
    const before = JSON.stringify(c); settlePeriod(c); expect(JSON.stringify(c)).toBe(before);
    expect(c.cashCents).toBe(1700000 + period.netCents);
    expect(c.ledger.successes).toBe(0);
  });
  it("gives bankruptcy precedence over a fifth stable step", () => {
    let s = run(newGame(), 6); s.campaign!.step = 59; s.campaign!.cashCents = 1;
    s.campaign!.ledger.salaryNumerator = 60000000; s.campaign!.dbCapacity = 1000;
    s.campaign!.dbBacklog = 0; s.campaign!.incident!.stableSteps = 4;
    s = step(s).state; expect(s.phase).toBe("ended"); expect(s.campaign!.reports).toHaveLength(0);
  });
});
