import { expect, it } from "vitest";
import { campaignAttention } from "./campaignAttention";
import { campaignGuidance } from "./campaignGuidance";
import { chapter6Stage } from "./chapter6Guidance";
import { act, tick, combinedCompany, strategyPredecessor, protectedCombined, sequence, finishRound } from "@/sim/__tests__/combinedFixture";
import { canStartGrowth, pendingCombined } from "@/sim/combinedCampaign";
import type { GameState } from "@/sim";

const prepared = combinedCompany();
function cappedSingle() {
  let s = tick(act(strategyPredecessor(true), { type: "set_traffic_limit", enabled: true }));
  s = tick(act(s, { type: "set_routing", mode: "single", targets: ["app-1"] }));
  return act(s, { type: "enter_combined", sequence });
}
const single = cappedSingle();
const nextAction = (s: GameState) => campaignAttention(s).action?.action;

it("prepares real serving capacity before removing the cap; routing, activation and readiness recalculate", () => {
  let s = single;
  const before = JSON.stringify(s);
  expect(nextAction(s)).toEqual({ type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] });
  expect(JSON.stringify(s)).toBe(before);
  s = act(s, nextAction(s)!); expect(campaignAttention(s).attention).toBe("run");
  s = tick(s); expect(nextAction(s)).toEqual({ type: "set_traffic_limit", enabled: false });
  s = act(s, nextAction(s)!); expect(campaignAttention(s).attention).toBe("run");
  s = tick(s, 5); expect(canStartGrowth(s)).toBe(true);
  expect(campaignAttention(s)).toMatchObject({ attention: "progression", target: "growth" });
});

it("excludes reserved spares and prepares an undersized serving instance before connecting", () => {
  let s = act(single, { type: "unlock_reliability", tech: "standby" });
  s = tick(act(s, { type: "reserve_spare", appId: "app-2" }));
  const poor = structuredClone(s); poor.campaign!.cashCents = 1;
  expect(nextAction(poor)).toEqual({ type: "release_spare" });
  expect(campaignAttention(poor).message).toContain("no longer be reserved");
  expect(nextAction(s)).toEqual({ type: "scale_up", appId: "app-1" });
  s = tick(act(s, nextAction(s)!), 3);
  expect(nextAction(s)).toEqual({ type: "scale_up", appId: "app-3" });
  s = tick(act(s, nextAction(s)!), 3);
  expect(nextAction(s)).toEqual({ type: "set_routing", mode: "balanced", targets: ["app-1", "app-3"] });
});

it("recognizes accepted cache-adjusted routing during an actual overloaded incident", () => {
  let s = tick(act(single, { type: "set_traffic_limit", enabled: false }), 3);
  expect(s.phase).toBe("incident"); expect(s.campaign!.dbCapacity).toBeLessThan(s.campaign!.snapshot.admitted);
  s = act(s, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] });
  expect(campaignAttention(s)).toMatchObject({ attention: "run", reason: "activation-routing" });
});

it("waits for a valid cached failover, but rejects stale expected routing", () => {
  let s = protectedCombined();
  s = tick(act(s, { type: "add_server" }), 2);
  s = tick(act(s, { type: "scale_up", appId: "app-4" }), 3);
  s = tick(act(s, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-3", "app-4"] }));
  s = tick(s, 5); s = tick(act(s, { type: "start_growth_wave" }), 9);
  expect(s.campaign!.pending.some(a => a.type === "promote-spare")).toBe(true);
  expect(s.campaign!.snapshot.admitted).toBeGreaterThan(s.campaign!.dbCapacity);
  expect(campaignAttention(s)).toMatchObject({ attention: "run", reason: "activation-promote-spare" });
  const stale = structuredClone(s); stale.campaign!.pending.find(a => a.type === "promote-spare")!.expectedRouting = "stale";
  expect(campaignAttention(stale).reason).not.toBe("activation-promote-spare");
  const restoring = act(stale, { type: "restore_app", appId: stale.campaign!.combinedStage!.currentRound!.fault!.targetId });
  expect(campaignAttention(restoring)).toMatchObject({ attention: "run", reason: "combined-restoration" });
});

it("does not prescribe endless Run for a database queue without headroom", () => {
  // A retained queue at demand==capacity is a legitimate post-review boundary.
  const s = structuredClone(prepared);
  s.campaign!.readCache = null;
  s.campaign!.incomingRate = 3000; s.campaign!.snapshot.incoming = 3000;
  s.campaign!.snapshot.admitted = 3000; s.campaign!.dbBacklog = 600;
  s.campaign!.snapshot.db = { ...s.campaign!.snapshot.db, demand: 3000, backlog: 600, processed: 3000 };
  expect(campaignAttention(s)).toMatchObject({ attention: "hint", action: { action: { type: "deploy_cache" } } });
  const poor = structuredClone(s); poor.campaign!.cashCents = 1; poor.campaign!.limit = 500;
  poor.campaign!.dbBacklog = 0; poor.campaign!.dbCapacity = 2000;
  poor.campaign!.snapshot.admitted = 500;
  poor.campaign!.snapshot.db = { ...poor.campaign!.snapshot.db, demand: 500, capacity: 2000, backlog: 0 };
  expect(campaignAttention(poor)).toMatchObject({ attention: "hint", reason: "combined-finance", target: "finance", action: undefined });
  expect(campaignAttention(poor).message).toContain("does not mean recovery is impossible");
});

it("warms an already-installed useful cache instead of prescribing another purchase", () => {
  const s = tick(act(single, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }));
  // A newly activated cold cache is valid while the cap protects inherited service.
  s.campaign!.readCache!.warmth = 0;
  expect(campaignAttention(s)).toMatchObject({ attention: "run", reason: "combined-cache-warming" });
  expect(campaignAttention(s).action).toBeUndefined();
  const warmed = tick(s, 7);
  expect(nextAction(warmed)).toEqual({ type: "set_traffic_limit", enabled: false });
});

it("uses capped headroom to drain a retained queue before exposing full demand", () => {
  const s = structuredClone(single);
  s.campaign!.dbBacklog = 600; s.campaign!.snapshot.db.backlog = 600;
  expect(campaignAttention(s)).toMatchObject({ attention: "run", reason: "combined-draining" });
  const clear = tick(s, 2);
  expect(clear.campaign!.dbBacklog).toBe(0);
  expect(nextAction(clear)).toEqual({ type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] });
});

it("reports current counters separately from final goals and exposes real blockers", () => {
  const model = campaignGuidance(single);
  expect(model.requirements.find(r => r.id === "admission")?.met).toBe(false);
  expect(model.requirements.find(r => r.id === "checks")?.label).toContain("0 / 5");
  expect(model.requirements.some(r => r.id === "rounds")).toBe(false);
  expect(model.finalGoals.find(r => r.id === "rounds")?.label).toContain("0 / 3");
});

it("prepares announced peak capacity before removing a cap during a quiet warning interval", () => {
  let s = act(strategyPredecessor(true), { type: "enter_combined", sequence });
  s = act(tick(s, 5), { type: "start_growth_wave" });
  s = tick(act(s, { type: "set_traffic_limit", enabled: true }));
  expect(s.campaign!.snapshot.incoming).toBe(2400);
  expect(s.campaign!.combinedStage!.currentRound!.startedStep).toBeNull();
  expect(nextAction(s)).toEqual({ type: "scale_up", appId: "app-1" });
  const poor = structuredClone(s); poor.campaign!.cashCents = 1;
  expect(campaignAttention(poor)).toMatchObject({ attention: "run", reason: "combined-limited-wave" });
  expect(campaignAttention(poor).message).toContain("rejecting users");
});

it("uses the accepted write-wave profile rather than baseline cache savings for removal safety", () => {
  let s = act(strategyPredecessor(true), { type: "enter_combined", sequence: [sequence[1], sequence[0], sequence[2]] });
  s = act(tick(s, 5), { type: "start_growth_wave" });
  s = tick(act(s, { type: "set_traffic_limit", enabled: true }));
  expect(s.campaign!.combinedStage!.currentRound!.startedStep).toBeNull();
  expect(nextAction(s)).toEqual({ type: "start_db_upgrade" });
});

it("repairs an observed failed server after recovery review before prescribing replacement capacity", () => {
  let s = prepared;
  for (let i = 0; i < 2; i++) s = act(finishRound(act(tick(s, 5), { type: "start_growth_wave" })), { type: "acknowledge_growth" });
  s = tick(act(tick(s, 5), { type: "start_growth_wave" }), 10);
  s = act(s, { type: "set_traffic_limit", enabled: true });
  s = act(s, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2"] });
  for (let i = 0; i < 15 && s.phase !== "review"; i++) s = tick(s);
  expect(s.phase).toBe("review");
  s = act(s, { type: "acknowledge_review" });
  const fault = s.campaign!.combinedStage!.currentRound!.fault!;
  expect(fault.restoredStep).toBeNull();
  expect(nextAction(s)).toEqual({ type: "restore_app", appId: fault.targetId });
  expect(campaignAttention(act(s, nextAction(s)!)).attention).toBe("run");
  expect(nextAction(tick(act(s, nextAction(s)!), 3))).toEqual({ type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] });
});

it("traces all three actual waves, mandatory acknowledgements, final promotion and Campaign completion", () => {
  let s = prepared;
  expect(chapter6Stage(s)?.cues[0].tone).toBe("prepare");
  for (let round = 0; round < 3; round++) {
    s = tick(s, 5); expect(canStartGrowth(s)).toBe(true);
    s = act(s, { type: "start_growth_wave" });
    const wave = chapter6Stage(s)!;
    expect(wave.cues[0].tone).toBe("pressure");
    s = tick(s, 8); expect(chapter6Stage(s)?.stage).toBe(wave.stage);
    for (let i = 0; i < 80 && !pendingCombined(s.campaign); i++) {
      const fault = s.campaign!.combinedStage!.currentRound!.fault;
      if (fault?.startedStep != null && fault.restoredStep === null && !s.campaign!.pending.some(a => a.type === "restore-app")) s = act(s, { type: "restore_app", appId: fault.targetId });
      if (s.phase === "review") { expect(campaignAttention(s).attention).toBeNull(); s = act(s, { type: "acknowledge_review" }); }
      s = tick(s);
    }
    expect(pendingCombined(s.campaign)).toBe(true);
    expect(chapter6Stage(s)?.cues[0].tone).toBe("recovery");
    expect(campaignAttention(s)).toMatchObject({ reason: "review", attention: null });
    s = act(s, { type: "acknowledge_growth" });
  }
  expect(chapter6Stage(s)?.cues[0].title).toBe("Final checks");
  s = tick(act(s, { type: "run_promotion" }), 1);
  expect(campaignAttention(s)).toMatchObject({ attention: "run", reason: "combined-promotion" });
  s = tick(s, 17);
  expect(s.campaign!.combinedStage!.finalReview).not.toBeNull();
  expect(campaignAttention(s)).toMatchObject({ attention: null, reason: "review" });
  s = act(s, { type: "complete_campaign" });
  expect(s).toMatchObject({ phase: "ended", outcome: "won" });
  expect(campaignGuidance(s).finalGoals.every(r => r.met)).toBe(true);
});
