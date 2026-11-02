import { describe, expect, it } from "vitest";
import { reliabilityOutcome } from "./__fixtures__/reliabilityOutcome";
import { newGame, type GameState } from "@/sim";
import type { CampaignPostmortem, Snapshot } from "@/sim/campaignTypes";
import { act, tick } from "@/sim/__tests__/spikeFixtures";
import { spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { combinedCompany, finishRound } from "@/sim/__tests__/combinedFixture";
import { respondToIncident } from "@/sim/__tests__/reliabilityFixture";
import { incidentAwaitingResponse } from "@/sim/step";
import { installPending } from "@/sim/reliability";
import { incidentLesson, incidentTitle, survivingCapacity } from "./campaignPostmortem";

export function recovered(game: GameState) {
  for (let i = 0; i < 120 && game.phase !== "review"; i++) {
    const c = game.campaign!;
    game = c.incident && incidentAwaitingResponse(c) && !installPending(c) ? respondToIncident(game) : tick(game);
  }
  if (game.phase !== "review") throw Error("Fixture did not recover");
  return game;
}
export const upgradeRecovery = (id = "report-upgrade") => recovered(act(tick(newGame(1, id), 6), { type: "start_db_upgrade" }));

describe("recorded incident lessons", () => {
  const incident = (g: GameState) => {
    for (let i = 0; i < 100 && g.phase !== "incident"; i++) g = tick(g);
    if (g.phase !== "incident") throw Error("Expected an actual incident");
    return g;
  };
  it.each([1, 2, 3, 4, 5, 6])("reads an engine-generated Chapter %i report without mutating its records", { timeout: 30_000 }, chapter => {
    let g: GameState;
    if (chapter === 1) g = upgradeRecovery();
    else if (chapter === 2) {
      g = act(act(upgradeRecovery(), { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
      g = recovered(act(incident(act(g, { type: "accept_scaling_risk" })), { type: "set_traffic_limit", enabled: true }));
    } else if (chapter === 3) g = recovered(act(incident(dataCompany()), { type: "deploy_cache" }));
    else if (chapter === 4) g = recovered(act(incident(spikeCompany(false)), { type: "set_traffic_limit", enabled: true }));
    else if (chapter === 5) {
      g = incident(act(reliabilityCompany(), { type: "arm_reliability" }));
      g = recovered(act(g, { type: "restore_app", appId: g.campaign!.reliabilityStage!.fault!.targetId }));
    } else {
      g = combinedCompany();
      for (let i = 0; i < 2; i++) g = act(finishRound(act(tick(g, 5), { type: "start_growth_wave" })), { type: "acknowledge_growth" });
      g = recovered(incident(act(tick(g, 5), { type: "start_growth_wave" })));
    }
    const r = g.campaign!.reports.at(-1)!; const before = JSON.stringify(r); const lesson = incidentLesson(r);
    expect(lesson.wrong).not.toContain("does not establish"); expect(lesson.changed).toContain("recovery was confirmed");
    expect(JSON.stringify(r)).toBe(before);
    if (chapter === 3) expect(lesson.learned).toContain("writes");
    if (chapter === 5) { expect(lesson.wrong).toContain("server failed"); expect(lesson.changed).toContain("server was restored"); }
  });
  it("describes a real DB upgrade without claiming isolated causation, using the report rather than later live state", () => {
    const game = upgradeRecovery(); const report = game.campaign!.reports[0];
    const before = JSON.stringify(report); const lesson = incidentLesson(report);
    expect(lesson.wrong).toContain("database could not keep up");
    expect(lesson.changed).toContain("database capacity increased");
    expect(lesson.changed).toContain("queues were empty");
    expect(lesson.remember).toContain("ongoing costs");
    expect(lesson.traffic).toBe("Recovered at full incoming demand");
    expect(lesson.latencyMs).toBe(report.snapshots.at(-1)!.latencyMs);
    expect(JSON.stringify(report)).toBe(before);
  });
  it("describes actual free admission relief and never equates limited recovery to all demand handled", () => {
    const game = recovered(act(tick(newGame(), 6), { type: "set_traffic_limit", enabled: true }));
    const report = game.campaign!.reports[0]; const lesson = incidentLesson(report);
    expect(report.setupCents).toBe(0); expect(lesson.changed).toContain("less traffic was admitted");
    expect(lesson.changed).not.toContain("capacity increased");
    expect(lesson.traffic).toContain("traffic limited"); expect(lesson.remember).toContain("full demand has not been verified");
  });
  it("uses prior serving capacity and falling pressure without crediting a purchase", () => {
    const r = structuredClone(upgradeRecovery().campaign!.reports[0]);
    r.events = r.events.filter(e => e.type !== "action-activated");
    expect(incidentLesson(r).changed).toContain("Previously installed capacity was already serving traffic");
    r.events.push({ id: 999, step: r.recoveredStep, type: "traffic-spike-ended", data: {} });
    expect(incidentLesson(r).changed).toContain("temporary demand eased");
    expect(incidentLesson(r).learned).toContain("without a new purchase");
  });
  it.each([
    ["add-app", "another server was installed", "Installed servers help only when traffic reaches them"],
    ["routing", "traffic routing changed", "Installed servers help only when traffic reaches them"],
    ["scale-up", "an application server gained capacity", "Installed servers help only when traffic reaches them"],
    ["cache", "a cache change activated", "writes and uncached reads still reach the database"],
  ])("records %s activation without manufacturing its effect", (type, change, learned) => {
    const r = structuredClone(upgradeRecovery().campaign!.reports[0]);
    r.events = [{ id: 1, step: r.openedStep, type: "action-requested", data: { actionId: "a", type } },
      { id: 2, step: r.recoveredStep, type: "action-activated", data: { actionId: "a" } }];
    const lesson = incidentLesson(r); expect(lesson.changed).toContain(change); expect(lesson.learned).toContain(learned);
    expect(lesson.changed).not.toMatch(/caused|fixed|contributed/);
  });
  it("never credits research, a pending/cancelled purchase, or an autoscaling decision as serving capacity", () => {
    const r = structuredClone(upgradeRecovery().campaign!.reports[0]);
    r.events = [{ id: 1, step: r.openedStep, type: "action-requested", data: { actionId: "a", type: "cache" } },
      { id: 2, step: r.openedStep, type: "autoscale-scale-out-decided", data: {} }];
    const lesson = incidentLesson(r); expect(lesson.changed).toContain("no new activation");
    expect(lesson.changed).not.toContain("cache change activated"); expect(lesson.remember).toContain("time to install and route");
  });
  it("keeps failure, restoration and promoted traffic separate", () => {
    const r = structuredClone(upgradeRecovery().campaign!.reports[0]);
    const opening = r.snapshots.find(s => s.step === r.openedStep)!;
    opening.instances![0].health = "failed";
    r.events.push({ id: 999, step: r.recoveredStep, type: "instance-restored", data: {} },
      { id: 1000, step: r.recoveredStep, type: "failover-activated", data: {} });
    const lesson = incidentLesson(r); expect(lesson.wrong).toContain("server failed");
    expect(lesson.changed).toContain("server was restored"); expect(lesson.changed).toContain("spare server joined the traffic route");
    expect(lesson.remember).toContain("separate checks");
  });
  it("does not manufacture missing historical cause, workload or final latency", () => {
    const r: CampaignPostmortem = { id: "old", openedStep: 1, recoveredStep: 8, snapshots: [], events: [], explanations: [], limited: false, setupCents: 0 };
    const lesson = incidentLesson(r); expect(lesson.wrong).toContain("does not establish");
    expect(lesson.latencyMs).toBeUndefined(); expect(lesson.changed).toContain("does not isolate");
  });
  it("does not treat missing or null before/after values as measured capacity or admission changes", () => {
    const r = structuredClone(upgradeRecovery().campaign!.reports[0]);
    r.events = [{ id: 1, step: r.recoveredStep, type: "action-activated", data: { dbBefore: null, dbAfter: 1000, admittedBefore: 800, admittedAfter: null } }];
    const lesson = incidentLesson(r);
    expect(lesson.changed).not.toContain("capacity increased"); expect(lesson.changed).not.toContain("less traffic was admitted");
    expect(lesson.changed).toContain("Infrastructure changes activated");
  });
  it("does not blame an unrelated failed server that received no traffic for a database incident", () => {
    const r = structuredClone(upgradeRecovery().campaign!.reports[0]);
    const opening = r.snapshots.find(s => s.step === r.openedStep)!;
    opening.instances!.push({ ...opening.instances![0], id: "app-unused", health: "failed", routed: false, demand: 0, processed: 0 });
    expect(incidentLesson(r).wrong).toContain("database could not keep up");
  });
});

describe("capacity after a server failure", () => {
  /** Health Checks are live before the failure, so the load balancer drops App 3 once they detect it. */
  function checkedFailure() {
    let g = act(reliabilityCompany(), { type: "unlock_reliability", tech: "health_checks" });
    g = act(tick(act(g, { type: "deploy_health_checks" }), 2), { type: "arm_reliability" });
    for (let i = 0; i < 150 && g.campaign!.reliabilityStage!.completedStep === null; i++) g = tick(g.phase === "review" ? act(g, { type: "acknowledge_review" }) : g);
    const c = g.campaign!, f = c.reliabilityStage!.fault!;
    const samples = [...new Map<number, Snapshot>([...c.reports.flatMap(r => r.snapshots), ...c.recent].map(m => [m.step, m])).values()];
    return { f, samples: samples.filter(m => m.step >= f.startedStep!).sort((a, b) => a.step - b.step) };
  }
  it("counts the traffic balanced routing still sent to the failed server until it was restored", () => {
    const c = reliabilityOutcome(true).campaign!, f = c.reliabilityStage!.fault!;
    const report = c.reports.find(r => r.snapshots.some(m => m.reliability?.faultId === f.id))!;
    // Three balanced servers share 2,400 req/s, so the failed App 3 still receives a third of it.
    expect(survivingCapacity(report.snapshots)).toEqual({ step: f.startedStep, admitted: 2400, capacity: 3200, failed: ["app-3"], toFailed: 800,
      stopped: { step: f.restoredStep, by: "restored", admitted: 2400, capacity: 4800 } });
    expect(incidentLesson(report).wrong).toBe("A server failed, but traffic was still routed to it, and every request it received failed.");
  });
  it("records when Health Checks take the failed server out of the route", () => {
    const { f, samples } = checkedFailure();
    expect(survivingCapacity(samples)).toEqual({ step: f.startedStep, admitted: 2400, capacity: 3200, failed: ["app-3"], toFailed: 800,
      stopped: { step: f.startedStep! + 1, by: "rerouted", admitted: 2400, capacity: 3200 } });
  });
  it("finds no traffic sent to a failed server that is already outside the route", () => {
    const { f, samples } = checkedFailure();
    expect(survivingCapacity(samples.filter(m => m.step > f.startedStep!))).toEqual({ step: f.startedStep! + 1, admitted: 2400, capacity: 3200, failed: ["app-3"], toFailed: 0, stopped: null });
  });
});

it("names the actual overload when the announced failed server was already outside the route", () => {
  let g=combinedCompany();
  for(let i=0;i<2;i++){
    g=act(tick(g,5),{type:"start_growth_wave"});
    g=act(finishRound(g),{type:"acknowledge_growth"});
  }
  g=act(tick(g,5),{type:"start_growth_wave"});
  g=act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2"]});
  for(let i=0;i<100&&g.phase!=="review";i++){const c=g.campaign!;g=c.incident&&incidentAwaitingResponse(c)&&!installPending(c)?respondToIncident(g):tick(g);}
  expect(g.phase).toBe("review");
  const report=g.campaign!.reports.at(-1)!,opening=report.snapshots.find(s=>s.step===report.openedStep)!;
  expect(opening.instances!.find(a=>a.id==="app-3")).toMatchObject({health:"failed",routed:false,demand:0});
  expect(opening.reliability!.failedDeliveries).toBe(0);
  expect(incidentLesson(report).wrong).toContain("Application work exceeded");
  expect(incidentTitle(report)).toBe("Application overloaded");
});
