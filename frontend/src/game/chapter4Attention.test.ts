import { expect, it } from "vitest";
import { campaignAttention } from "./campaignAttention";
import { act, tick, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";

const initial = spikeCompany(false);
const baseline = untilOffset(tick(act(initial, { type: "set_traffic_limit", enabled: true })), 68);

it("only recommends scheduled pulse time while a future pulse event remains", () => {
  expect(campaignAttention(initial)).toMatchObject({ chapter: 4, attention: "hint", target: "app" });
  const inspected = act(initial, { type: "incident_inspect", equipment: "app" });
  // Prepare's inspected company is pointed at Server management's optional controller before Run.
  expect(campaignAttention(inspected)).toMatchObject({ chapter: 4, attention: "hint", reason: "spike-autoscaling", action: { action: { type: "unlock_autoscaling" } } });
  const deployed = tick(act(act(inspected, { type: "unlock_autoscaling" }), { type: "deploy_autoscaler" }), 2);
  expect(campaignAttention(deployed)).toMatchObject({ chapter: 4, attention: "run", reason: "spike-pulses" });
  // Conservative handling of contradictory saved scheduling evidence: all four
  // recorded events already happened, even if a stale deadline remains ahead.
  const stale = structuredClone(baseline);
  stale.campaign!.spikeStage!.deadlines[3] += 100;
  expect(stale.campaign!.spikeStage!.consumed).toHaveLength(4);
  expect(campaignAttention(stale)).toMatchObject({ chapter: 4, attention: "hint", target: "requirements" });
});

it("recommends baseline Run only when real engine observations can advance", () => {
  const before = baseline.campaign!.spikeStage!.baselineStableSteps;
  expect(campaignAttention(baseline)).toMatchObject({ attention: "run", reason: "spike-stability" });
  expect(tick(baseline).campaign!.spikeStage!.baselineStableSteps).toBe(before + 1);
});

it("does not mistake baseline traffic for a valid management observation", () => {
  const inconsistent = structuredClone(baseline);
  inconsistent.phase = "incident";
  expect(campaignAttention(inconsistent)).toMatchObject({ attention: "hint", target: "requirements" });
});

it("prioritizes observed overload over the remaining pulse schedule and selects an existing action", () => {
  const pressure = tick(initial, initial.campaign!.spikeStage!.deadlines[0] - initial.campaign!.step);
  expect(campaignAttention(pressure)).toMatchObject({ chapter: 4, attention: "hint", reason: "application", action: { action: { type: "add_server" } } });
  expect(campaignAttention(act(pressure, { type: "set_traffic_limit", enabled: true }))).toMatchObject({ attention: "run", reason: "activation-limit" });
});

it("keeps completed spike recognition ahead of Run and recalculates Next after acknowledgement", () => {
  const complete = tick(baseline, 4);
  expect(campaignAttention(complete)).toMatchObject({ attention: null, reason: "review" });
  expect(campaignAttention(act(complete, { type: "acknowledge_spikes" }))).toMatchObject({ attention: "progression", target: "next" });
});

it("narrates the controller deployment while it installs", () => {
  const inspected = act(initial, { type: "incident_inspect", equipment: "app" });
  const deploying = act(act(inspected, { type: "unlock_autoscaling" }), { type: "deploy_autoscaler" });
  const advice = campaignAttention(deploying);
  expect(advice).toMatchObject({ attention: "run", reason: "activation-deploy-autoscaler" });
  expect(advice.message).toContain("autoscaling controller is installing");
});

it("narrates the controller's own queued work instead of a generic activation", () => {
  const controller = structuredClone(baseline);
  const d = controller.campaign!.spikeStage!;
  d.controller = { activatedStep: d.enteredStep, enabled: true, highSteps: 0, lowSteps: 0, cooldownUntil: 0, managedAppIds: [], joiningAppId: null, expectedRouting: "", blockedReason: null };
  controller.campaign!.pending.push({ id: "work-1", type: "add-app", requestedStep: d.enteredStep, activationStep: d.enteredStep + 10, costCents: 0, activatedStep: null, source: "autoscaler", targetId: "app-3" });
  const advice = campaignAttention(controller);
  expect(advice).toMatchObject({ attention: "run", reason: "activation-add-app" });
  expect(advice.message).toContain("Autoscaling is installing App 3");
});

it("narrates what the controller did until the player inspects Server management", () => {
  const acted = structuredClone(baseline);
  const c = acted.campaign!, d = c.spikeStage!;
  d.controller = { activatedStep: d.enteredStep, enabled: true, highSteps: 0, lowSteps: 0, cooldownUntil: 0, managedAppIds: ["app-3"], joiningAppId: null, expectedRouting: "", blockedReason: null };
  const lastId = Math.max(0, ...c.trace.map(t => t.id));
  c.trace.push({ id: lastId + 1, step: c.step, type: "autoscale-scale-out-decided", data: { targetId: "app-3" } });
  const advice = campaignAttention(acted);
  expect(advice).toMatchObject({ attention: "hint", reason: "spike-autoscale-acted", target: "app" });
  expect(advice.message).toContain("Autoscaling provisioned App 3");
  // Once Server management has been inspected since the act, guidance returns to the chapter.
  acted.campaign!.trace.push({ id: lastId + 2, step: acted.campaign!.step, type: "inspection", data: { component: "app" } });
  expect(campaignAttention(acted)).toMatchObject({ attention: "run", reason: "spike-stability" });
});

it("resumes an unfinished autoscaling arc during the closing baseline", () => {
  // A spent research point without a deployed controller keeps the next step available.
  const unlocked = structuredClone(baseline);
  unlocked.campaign!.spikeStage!.researchSpent = 1;
  expect(campaignAttention(unlocked)).toMatchObject({ attention: "hint", reason: "spike-autoscaling", action: { action: { type: "deploy_autoscaler" } } });
  // A deployed but disabled controller offers its switch instead.
  const disabled = structuredClone(baseline);
  const d = disabled.campaign!.spikeStage!;
  d.researchSpent = 1;
  d.controller = { activatedStep: d.enteredStep, enabled: false, highSteps: 0, lowSteps: 0, cooldownUntil: 0, managedAppIds: [], joiningAppId: null, expectedRouting: "", blockedReason: null };
  expect(campaignAttention(disabled)).toMatchObject({ attention: "hint", reason: "spike-autoscaling", action: { action: { type: "set_autoscaling", enabled: true } } });
});

it("tells an enabled-but-idle controller's story after the first pulse is evaluated", () => {
  // A company whose routed capacity and database absorbed Spike 1 gave the
  // controller nothing to do; the arc still says what it observed.
  const mid = untilOffset(tick(act(initial, { type: "set_traffic_limit", enabled: true })), 36);
  const idle = structuredClone(mid);
  const c = idle.campaign!, d = c.spikeStage!;
  d.controller = { activatedStep: d.enteredStep, enabled: true, highSteps: 0, lowSteps: 0, cooldownUntil: 0, managedAppIds: [], joiningAppId: null, expectedRouting: "", blockedReason: null };
  c.limit = null;
  c.dbCapacity = 1_000_000;
  for (const app of c.apps) { app.capacity = 1_000_000; app.routed = true; }
  c.routing.targets = c.apps.map(a => a.id);
  const lastId = Math.max(0, ...c.trace.map(t => t.id));
  c.trace.push({ id: lastId + 1, step: c.step, type: "inspection", data: { component: "monitoring" } });
  const advice = campaignAttention(idle);
  expect(advice).toMatchObject({ attention: "hint", reason: "spike-autoscale-idle", target: "app" });
  expect(advice.message).toContain("stayed idle");
});
