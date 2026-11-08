import { describe, expect, it } from "vitest";
import type { CampaignPostmortem, TraceEvent } from "@/sim/campaignTypes";
import { autoscalerActivity, describeEvents, reportWindowStart, windowSpending } from "./reportEvents";

const event = (id: number, step: number, type: string, data: TraceEvent["data"] = {}): TraceEvent => ({ id, step, type, data });

describe("readable recorded events", () => {
  it("links delayed activations to their request and explains observed changes", () => {
    const events = [event(1, 2, "action-requested", { actionId: "a1", type: "upgrade-db", costCents: 250000, activationStep: 5 }),
      event(2, 5, "action-activated", { actionId: "a1", dbBefore: 1000, dbAfter: 2000, appBefore: 1600, appAfter: 1600 }),
      event(3, 5, "metrics", { latencyMs: 100 })];
    expect(describeEvents(events)).toEqual([
      { id: 1, step: 2, title: "Database upgrade requested", detail: "Setup $2,500.00 · Activates at game second 5", kind: "decision" },
      { id: 2, step: 5, title: "Database upgrade activated", detail: "Database capacity 1,000 to 2,000 ops/s", kind: "decision" },
    ]);
  });
  it("marks an incident opening, a failure and a recovery the way History's feed does", () => {
    expect(describeEvents([event(1, 2, "incident-opened", { component: "db" }), event(2, 3, "reliability-failure-started", { appId: "app-1" }), event(3, 9, "incident-recovered"), event(4, 9, "settlement", { period: 1 })]).map(e => e.kind))
      .toEqual(["incident", "incident", "success", "finance"]);
  });
  it("does not invent an action when the retained request is unavailable", () => {
    expect(describeEvents([event(1, 5, "action-activated", { actionId: "old" })])[0]).toMatchObject({ title: "Infrastructure change activated", detail: null });
    expect(describeEvents([event(2, 5, "future-trace-event")])[0].title).toBe("Future trace event");
  });
  it("names a refused decision in words, including the retired Grow the Company entry kept in old saves", () => {
    const titles = describeEvents([event(1, 3, "action-rejected", { action: "enter_combined", reason: "Review the reliability outcome first." }),
      event(2, 4, "action-rejected", { action: "set_traffic_limit" }), event(3, 5, "action-rejected", { action: "enter_reliability" })]).map(e => e.title);
    expect(titles).toEqual(["Continue to Grow the Company rejected", "Set traffic limit rejected", "Continue to Stay Online rejected"]);
  });
  it("makes routing and failure evidence readable without exposing stored JSON", () => {
    const route = JSON.stringify({ mode: "balanced", targets: ["app-1", "app-2"] });
    const result = describeEvents([event(1, 3, "action-requested", { actionId: "r", type: "routing", routing: route }),
      event(2, 5, "reliability-failure-started", { appId: "app-3" }),
      event(3, 6, "health-change-detected", { appId: "app-3", detectedHealth: "unhealthy", source: "probe", delay: 1 })]);
    expect(result[0].detail).toBe("Route to Server 1, Server 2 (balanced)");
    expect(result[1].title).toBe("Server 3 failed");
    expect(result[2].detail).toBe("By Health Checks · 1 s after the change");
    expect(JSON.stringify(result)).not.toContain("targets");
  });
  it("keeps autoscaler lines glanceable and names pauses and resumes", () => {
    const events = [event(1, 3, "autoscale-scale-out-decided", { targetId: "app-3" }),
      event(2, 4, "autoscale-scale-in-eligible", { targetId: "app-4" }),
      event(3, 5, "autoscaler-blocked", { reason: "Cooldown" }),
      event(4, 9, "autoscaler-blocked", { reason: null })];
    expect(describeEvents(events)).toEqual([
      { id: 1, step: 3, title: "Autoscaler: +Server 3", detail: null, kind: "decision" },
      { id: 2, step: 4, title: "Autoscaler: -Server 4", detail: "retiring", kind: "decision" },
      { id: 3, step: 5, title: "Autoscaler: paused", detail: "cooldown", kind: "warning" },
      { id: 4, step: 9, title: "Autoscaler: observing", detail: null, kind: "success" },
    ]);
    expect(autoscalerActivity([], events)).toEqual(["Autoscaler: +Server 3", "Autoscaler: -Server 4 retiring", "Autoscaler paused: cooldown", "Autoscaler: observing"]);
  });
  it("announces a finished provisioning without repeating the retirement", () => {
    const events = [event(1, 2, "action-requested", { actionId: "a1", type: "add-app", source: "autoscaler", targetId: "app-3", activationStep: 5 }),
      event(2, 5, "action-activated", { actionId: "a1", source: "autoscaler", targetId: "app-3" }),
      event(3, 6, "action-requested", { actionId: "a2", type: "retire-app", source: "autoscaler", targetId: "app-4", activationStep: 7 }),
      event(4, 7, "action-activated", { actionId: "a2", source: "autoscaler", targetId: "app-4" })];
    expect(autoscalerActivity([], events)).toEqual(["Autoscaler: Server 3 installed"]);
  });
  it("shows only a short incident lead-in and counts purchases requested in that window", () => {
    const report: CampaignPostmortem = { id: "history", openedStep: 20, recoveredStep: 25, snapshots: [], events: [], explanations: [], limited: false, setupCents: 300 };
    report.events = [event(1, 0, "action-requested", { costCents: 100 }), event(2, 18, "action-requested", { costCents: 200 }), event(3, 20, "action-activated")];
    expect(reportWindowStart(report)).toBe(17);
    expect(windowSpending(report, 17)).toBe(200);
  });
});
