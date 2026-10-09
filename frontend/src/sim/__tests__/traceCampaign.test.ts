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
