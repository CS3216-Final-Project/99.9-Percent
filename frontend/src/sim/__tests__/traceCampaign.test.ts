// @vitest-environment node
import { describe, it, expect } from "vitest";
import { newGame, applyAction } from "../index";
import { advanceSteps, step } from "../step";
describe("causal evidence", () => {
  it("credits combined state changes, preserves inspection and peak errors", () => {
    let s = advanceSteps(newGame(), 6).state;
    for (const action of [{ type: "incident_inspect", equipment: "db" }, { type: "set_traffic_limit", enabled: true }, { type: "start_db_upgrade" }] as const) {
      const r = applyAction(s, action); if (!r.ok) throw Error(r.message); s = r.state;
    }
    while (s.phase !== "review") s = step(s).state;
    const report = s.campaign!.reports[0];
    expect(report.explanations.join(" ")).toContain("Admitted demand fell");
    expect(report.explanations.join(" ")).toContain("Database capacity increased");
    expect(report.events.some(e => e.type === "inspection")).toBe(true);
    expect(report.snapshots.at(-1)!.serviceErrorRate).toBe(0);
    expect(report.events.filter(e => e.type === "action-activated")).toHaveLength(2);
  });
  it("keeps unresolved evidence beyond the chart window and stores rejected outcomes once", () => {
    let s = advanceSteps(newGame(), 6).state;
    s = advanceSteps(s, 600).state;
    expect(s.phase).toBe("incident");
    expect(s.campaign!.recent).toHaveLength(600);
    expect(s.campaign!.incident!.snapshots).toHaveLength(603);
    expect(s.campaign!.trace.filter(e => e.type === "incident-opened")).toHaveLength(1);
    expect(JSON.stringify(s)).not.toMatch(/NaN|Infinity/);
  });
});


it.each([10, 11])("does not credit a database upgrade requested at step %i after limiting already drained the backlog", requestedStep => {
  const act = (s: ReturnType<typeof newGame>, action: Parameters<typeof applyAction>[1]) => {
    const r = applyAction(s, action); if (!r.ok) throw Error(r.message); return r.state;
  };
  let limited = act(advanceSteps(newGame(1, "late-upgrade"), 6).state, { type: "set_traffic_limit", enabled: true });
  limited = advanceSteps(limited, requestedStep - 6).state;
  expect(limited.campaign!.incident!.stableSteps).toBe(requestedStep - 9);
  let upgraded = act(limited, { type: "start_db_upgrade" });
  upgraded = advanceSteps(upgraded, 14 - requestedStep).state;
  const baseline = advanceSteps(limited, 14 - requestedStep).state;
  expect(upgraded.phase).toBe("review"); expect(baseline.phase).toBe("review");
  expect(upgraded.campaign!.step).toBe(baseline.campaign!.step);
  const report = upgraded.campaign!.reports[0];
  expect(report.snapshots.find(m => m.step === 13)!.db.backlog).toBe(0);
  const capacity = report.explanations.find(t => t.startsWith("Database capacity increased"))!;
  expect(capacity).toContain("already zero"); expect(capacity).toContain("not credited");
  expect(report.explanations.find(t => t.startsWith("Admitted demand fell"))).toContain("backlog fell from 600 to 500");
  expect(report.explanations.join(" ")).not.toContain("enabling backlog drainage");
});

it("records actual drainage when upgrading the overloaded database", () => {
  let s = advanceSteps(newGame(), 6).state;
  const action = applyAction(s, { type: "start_db_upgrade" });
  if (!action.ok) throw Error(action.message);
  s = advanceSteps(action.state, 30).state;
  expect(s.phase).toBe("review");
  expect(s.campaign!.reports[0].explanations.join(" ")).toContain("backlog fell from 600 to 400 at activation (step 9)");
});
