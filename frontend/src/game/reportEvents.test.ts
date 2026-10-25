import { describe, expect, it } from "vitest";
import type { CampaignPostmortem, TraceEvent } from "@/sim/campaignTypes";
import { describeEvents, reportWindowStart, windowSpending } from "./reportEvents";

const event = (id: number, step: number, type: string, data: TraceEvent["data"] = {}): TraceEvent => ({ id, step, type, data });

describe("readable recorded events", () => {
  it("links delayed activations to their request and explains observed changes", () => {
    const events = [event(1, 2, "action-requested", { actionId: "a1", type: "upgrade-db", costCents: 250000, activationStep: 5 }),
      event(2, 5, "action-activated", { actionId: "a1", dbBefore: 1000, dbAfter: 2000, appBefore: 1600, appAfter: 1600 }),
      event(3, 5, "metrics", { latencyMs: 100 })];
    expect(describeEvents(events)).toEqual([
      { id: 1, step: 2, title: "Database upgrade requested", detail: "Setup $2,500.00 · Activates at game second 5" },
      { id: 2, step: 5, title: "Database upgrade activated", detail: "Database capacity 1,000 to 2,000 ops/s" },
    ]);
  });
  it("does not invent an action when the retained request is unavailable", () => {
    expect(describeEvents([event(1, 5, "action-activated", { actionId: "old" })])[0]).toMatchObject({ title: "Infrastructure change activated", detail: null });
    expect(describeEvents([event(2, 5, "future-trace-event")])[0].title).toBe("Future trace event");
  });
  it("makes routing and failure evidence readable without exposing stored JSON", () => {
    const route = JSON.stringify({ mode: "balanced", targets: ["app-1", "app-2"] });
    const result = describeEvents([event(1, 3, "action-requested", { actionId: "r", type: "routing", routing: route }),
      event(2, 5, "reliability-failure-started", { appId: "app-3" }),
      event(3, 6, "health-change-detected", { appId: "app-3", detectedHealth: "unhealthy", source: "probe", delay: 1 })]);
    expect(result[0].detail).toBe("Route to App 1, App 2 (balanced)");
    expect(result[1].title).toBe("App 3 failed");
    expect(result[2].detail).toBe("By Health Checks · 1 s after the change");
    expect(JSON.stringify(result)).not.toContain("targets");
  });
  it("shows only a short incident lead-in and counts purchases requested in that window", () => {
    const report: CampaignPostmortem = { id: "history", openedStep: 20, recoveredStep: 25, snapshots: [], events: [], explanations: [], limited: false, setupCents: 300 };
    report.events = [event(1, 0, "action-requested", { costCents: 100 }), event(2, 18, "action-requested", { costCents: 200 }), event(3, 20, "action-activated")];
    expect(reportWindowStart(report)).toBe(17);
    expect(windowSpending(report, 17)).toBe(200);
  });
});
