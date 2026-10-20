import { expect, it } from "vitest";
import { newGame, newLegacyGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { campaignAttention as guidance } from "./campaignAttention";
import { act, tick, dataCompany, spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { reliabilityCompany, preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { combinedCompany, finishRound } from "@/sim/__tests__/combinedFixture";
import { dataCompany as enteredDataCompany } from "@/sim/__tests__/dataFixture";

it("identifies Opening's real scheduled event and is immutable/deterministic", () => {
  const game = newGame(), before = structuredClone(game);
  expect(guidance(game)).toMatchObject({ attention: "run", reason: "opening-growth", chapter: 1 });
  expect(guidance(game)).toEqual(guidance(before)); expect(game).toEqual(before);
  expect(guidance(newLegacyGame()).attention).toBeNull();
});
it("does not endorse an unresolved incident or an unrelated pending server", () => {
  const game = advanceSteps(newGame(), 6).state;
  expect(guidance(game)).toMatchObject({ attention: "hint", target: "db" });
  expect(guidance(act(game, { type: "add_server" })).attention).toBe("hint");
});
it("distinguishes accepted relevant installation from a proven recovery", () => {
  const game = act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" });
  expect(guidance(game)).toMatchObject({ attention: "run", reason: "activation-upgrade-db" });
  expect(guidance(game).observation).toContain("does not guarantee");
});
it("recognises free admission relief and the real drainage after activation", () => {
  let game = act(advanceSteps(newGame(), 6).state, { type: "set_traffic_limit", enabled: true });
  expect(guidance(game)).toMatchObject({ attention: "run", reason: "activation-limit" });
  game = tick(game); expect(guidance(game)).toMatchObject({ attention: "run", reason: "draining" });
  game = tick(game); expect(guidance(game).attention).toBe("run");
});
it("recognises an accepted route that uses healthy capacity rather than merely installing a server", () => {
  let game = tick(act(dataCompany(), { type: "set_routing", mode: "single", targets: ["app-1"] }), 2);
  expect(guidance(game)).toMatchObject({ attention: "hint", target: "network" });
  game = act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2"] });
  expect(guidance(game)).toMatchObject({ attention: "run", reason: "activation-routing" });
});
it("checks individual routed capacity even when the aggregate total looks sufficient", () => {
  let game = tick(act(spikeCompany(false), { type: "add_server" }), 2);
  game = tick(act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }), 1);
  game = tick(game, game.campaign!.spikeStage!.deadlines[0] - game.campaign!.step);
  expect(game.campaign!.snapshot.app.demand).toBeLessThan(game.campaign!.snapshot.app.capacity);
  expect(guidance(game)).toMatchObject({ attention: "hint", target: "app" });
});
it("allows measured recovery while an incident is still open, then yields to review", () => {
  let game = act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" });
  for (let i = 0; i < 40 && game.phase !== "review"; i++) {
    game = tick(game);
    if (game.campaign!.incident?.stableSteps) expect(guidance(game).attention).toBe("run");
  }
  expect(game.phase).toBe("review"); expect(guidance(game).attention).toBeNull();
  game = act(game, { type: "acknowledge_review" }); expect(guidance(game).reason).toBe("review");
});
it("does not let a healthy aggregate threshold conceal a recorded unresolved bottleneck", () => {
  let game = act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" });
  for (let i = 0; i < 30 && !game.campaign!.incident?.stableSteps; i++) game = tick(game);
  // Boundary evidence: even with qualifying latency/errors, known excess component demand needs diagnosis.
  const snapshot = game.campaign!.snapshot;
  snapshot.db.demand = snapshot.db.capacity + 1;
  expect(guidance(game)).toMatchObject({ attention: "hint", target: "db" });
});
it("keeps Scaling's preparation/risk choice ahead of Run, without requiring a purchase", () => {
  let game = tick(act(tick(newGame(), 6), { type: "start_db_upgrade" }), 30);
  game = act(act(game, { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
  expect(guidance(game)).toMatchObject({ chapter: 2, attention: "hint", target: "risk" });
  expect(guidance(act(game, { type: "add_server" })).attention).toBe("hint");
  expect(guidance(act(game, { type: "accept_scaling_risk" })).attention).toBe("run");
});
it("uses Data's real scheduling eligibility and preserves explicit continuation", () => {
  const game = dataCompany();
  expect(guidance(game)).toMatchObject({ chapter: 3, attention: "progression", target: "next" });
  expect(guidance(enteredDataCompany())).toMatchObject({ attention: "run", reason: "data-growth" });
});
it("recognises traffic pulse time without requiring autoscaling", () => {
  expect(guidance(spikeCompany(false))).toMatchObject({ chapter: 4, attention: "run", reason: "spike-pulses" });
});
it("reliability requires explicit arming; pending setup is not a mandatory arm blocker", () => {
  const game = reliabilityCompany();
  expect(guidance(game)).toMatchObject({ chapter: 5, attention: "progression", target: "reliability" });
  expect(guidance(act(game, { type: "arm_reliability" }))).toMatchObject({ attention: "run", reason: "scheduled-failure" });
  const pending = act(act(game, { type: "unlock_reliability", tech: "health_checks" }), { type: "deploy_health_checks" });
  expect(guidance(pending)).toMatchObject({ attention: "run", reason: "activation-health-checks" });
});
it("does not spotlight Run for an untreated actual failure", () => {
  const game = tick(act(reliabilityCompany(), { type: "arm_reliability" }), 8);
  expect(guidance(game)).toMatchObject({ attention: "hint", target: "app" });
});
it("recognises a queued valid failover and rejects it when its recorded route is stale", () => {
  const game = tick(act(preparedReliability(), { type: "arm_reliability" }), 9);
  expect(game.campaign!.pending.some(a => a.type === "promote-spare")).toBe(true);
  expect(guidance(game)).toMatchObject({ attention: "run", reason: "activation-promote-spare" });
  game.campaign!.pending.find(a => a.type === "promote-spare")!.expectedRouting = "stale";
  expect(guidance(game).attention).toBe("hint");
});
it("distinguishes growth readiness, wave decision, accepted wave and outcome", () => {
  let game = combinedCompany();
  expect(guidance(game)).toMatchObject({ chapter: 6, attention: "run", reason: "growth-readiness" });
  game = tick(game, 5); expect(guidance(game)).toMatchObject({ attention: "progression", target: "growth" });
  game = act(game, { type: "start_growth_wave" }); expect(guidance(game).attention).toBe("run");
  game = finishRound(game); expect(guidance(game).attention).toBeNull();
});
it("does not impose a blanket traffic-limit rule on reliability; full-demand growth is different", () => {
  const reliability = tick(act(reliabilityCompany(), { type: "set_traffic_limit", enabled: true }), 1);
  expect(guidance(reliability).target).toBe("reliability");
  const growth = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }), 1);
  expect(guidance(growth)).toMatchObject({ attention: "hint", reason: "full-demand" });
});
it("does not reveal future fault details and keeps passive time out of the stage key", () => {
  let game = act(reliabilityCompany(), { type: "arm_reliability" });
  const before = guidance(game); game = tick(game);
  expect(guidance(game).key).toBe(before.key);
  expect(before.observation).not.toContain(game.campaign!.reliabilityStage!.fault!.targetId);
});

it("offers affordable DB capacity and free admission alternatives, excluding invalid purchases", () => {
  const game = advanceSteps(newGame(), 6).state, before = structuredClone(game);
  expect(guidance(game).actions?.map(x => x.action.type)).toEqual(["start_db_upgrade", "set_traffic_limit"]);
  expect(game).toEqual(before);
  game.campaign!.cashCents = 1;
  expect(guidance(game).actions?.map(x => x.action.type)).toEqual(["set_traffic_limit"]);
  expect(guidance(act(before, { type: "start_db_upgrade" })).actions).toBeUndefined();
});
it("offers actual routed server scaling and an existing routing choice, rather than another unrelated purchase", () => {
  let game = tick(act(dataCompany(), { type: "set_routing", mode: "single", targets: ["app-1"] }), 2);
  expect(guidance(game).actions?.some(x => x.action.type === "set_routing")).toBe(true);
  game = tick(act(spikeCompany(false), { type: "add_server" }), 2);
  game = tick(act(game, { type: "set_routing", mode: "balanced", targets: ["app-1", "app-2", "app-3"] }), 1);
  game = tick(game, game.campaign!.spikeStage!.deadlines[0] - game.campaign!.step);
  expect(guidance(game).actions?.some(x => x.action.type === "scale_up" && x.action.appId === "app-3")).toBe(true);
  expect(guidance(game).actions?.some(x => x.action.type === "deploy_autoscaler")).toBe(false);
});
it("restoration targets the observed failure and full-demand guidance targets the existing unlimit control", () => {
  const failure = tick(act(reliabilityCompany(), { type: "arm_reliability" }), 8);
  expect(guidance(failure).actions?.some(x => x.action.type === "restore_app")).toBe(true);
  const limited = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }), 1);
  expect(guidance(limited).actions?.map(x => x.action)).toEqual([{ type: "set_traffic_limit", enabled: false }]);
  limited.campaign!.snapshot.incoming = 1_000_000;
  expect(guidance(limited).actions?.some(x => x.action.type === "set_traffic_limit" && !x.action.enabled)).toBe(false);
});

it("offers cache only for observed read pressure, never as a write-pressure prescription", () => {
  const reads = tick(enteredDataCompany("read-heavy"), 12);
  const writes = tick(enteredDataCompany("write-heavy"), 12);
  expect(guidance(reads).reason).toBe("database");
  expect(guidance(writes).reason).toBe("database");
  expect(guidance(reads).actions?.some(x => x.action.type === "deploy_cache")).toBe(true);
  expect(guidance(writes).actions?.some(x => x.action.type === "deploy_cache")).toBe(false);
  const exhausted = advanceSteps(newGame(), 6).state; exhausted.campaign!.cashCents = 0;
  expect(guidance(exhausted).actions).toEqual([]);
  expect(guidance(exhausted).action).toBeUndefined();
  expect(guidance(exhausted).message).toContain("Check Database");
});

it("automatically recommends feasible capacity, then free relief when the upgrade is unaffordable", () => {
  const game = advanceSteps(newGame(),6).state;
  expect(guidance(game).action?.action).toEqual({type:"start_db_upgrade"});
  game.campaign!.cashCents = 1;
  expect(guidance(game).action?.action).toEqual({type:"set_traffic_limit",enabled:true});
  const pending = act(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"});
  expect(guidance(pending).action).toBeUndefined();
  expect(guidance(pending).target).toBe("run");
});
it("selects measured read-cache help when the unlocked DB tier cannot fit, while writes fall back safely", () => {
  const reads=tick(enteredDataCompany("read-heavy"),12),writes=tick(enteredDataCompany("write-heavy"),12);
  // Existing investment leaves no DB tier available; inspect recorded reads rather than prescribing writes a cache.
  reads.campaign!.cashCents=200000;
  writes.campaign!.cashCents=200000;
  expect(guidance(reads).action?.action.type).toBe("deploy_cache");
  expect(guidance(writes).action?.action.type).not.toBe("deploy_cache");
});
it("keeps every chapter's displayed Hint short while retaining its internal evidence", () => {
  const scaling=act(act(tick(act(tick(newGame(),6),{type:"start_db_upgrade"}),30),{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
  const games=[newGame(),advanceSteps(newGame(),6).state,scaling,enteredDataCompany(),tick(enteredDataCompany(),12),spikeCompany(false),reliabilityCompany(),tick(act(reliabilityCompany(),{type:"arm_reliability"}),8),combinedCompany(),tick(combinedCompany(),5)];
  for(const game of games){
    const hint=guidance(game);
    expect(hint.message.split(/\s+/).length).toBeLessThan(25);
    expect(hint.message).not.toMatch(/admission relief|queue drainage|predicate|headroom|activation state|ops\/s/);
    expect(hint.observation.length).toBeGreaterThan(0);
  }
});

it("derives Chapter 2 strategies from dispatcher availability and removes them after actual preparation or consent", () => {
  const game = act(act(tick(act(tick(newGame(), 6), { type: "start_db_upgrade" }), 30), { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
  const before = structuredClone(game);
  expect(guidance(game).growthChoices).toMatchObject({ upgrade: { action: { type: "start_db_upgrade" } }, risk: true });
  expect(game).toEqual(before);
  const poor = structuredClone(game); poor.campaign!.cashCents = 1;
  expect(guidance(poor).growthChoices).toEqual({ upgrade: undefined, risk: true });
  expect(guidance(act(game, { type: "start_db_upgrade" })).growthChoices).toBeUndefined();
  expect(guidance(act(game, { type: "accept_scaling_risk" })).growthChoices).toBeUndefined();
  expect(guidance(tick(newGame(), 6)).growthChoices).toBeUndefined();
});
