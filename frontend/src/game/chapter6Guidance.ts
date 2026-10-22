import type { Action, GameState } from "@/sim";
import { allocateTraffic, classifyData, databaseUpgrade, routableApps } from "@/sim/step";
import { combinedProfile, currentFault } from "@/sim/combinedCampaign";
import { DATA_PROFILES, DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { previewCampaignAction } from "./campaignFinance";
import type { AttentionDecision, GuidanceTarget } from "./campaignAttention";
import { chapter6FinancialRisk } from "./chapter6Finance";

/** Use the engine's integer workload classification, including current cache warmth. */
export function combinedDatabaseDemand(game: GameState, logical: number, rate?: number, profile = combinedProfile(game.campaign!)) {
  const c = game.campaign!, shares = DATA_PROFILES[profile];
  return classifyData(logical, shares.readShare, shares.cacheableReadShare,
    rate ?? Math.min(c.readCache?.warmth ?? 0, c.readCache?.target ?? 0)).databaseNewDemand;
}

/** One next existing interaction, validated by the dispatcher. No forecast advances time. */
export function chapter6Attention(game: GameState, decision: AttentionDecision): AttentionDecision {
  const c = game.campaign!, d = c.combinedStage!;
  if (["ended", "review", "next", "missing-review"].includes(decision.reason) || decision.attention === "progression") return decision;
  const advise = (action: Action, label: string, message: string, target: GuidanceTarget): AttentionDecision | null => {
    if (!previewCampaignAction(game, action).ok) return null;
    const selected = { action, label, evidence: message };
    return { ...decision, reason: decision.reason === "full-demand" ? "full-demand" : "combined-prepare", attention: "hint", target, message,
      observation: message, recommendation: label, action: selected, actions: [selected],
      key: `${decision.key}:${JSON.stringify(action)}` };
  };
  const run = (reason: string, message: string): AttentionDecision => ({ ...decision, reason, attention: "run", target: "run", message, key: `${decision.key}:${reason}` });
  if (decision.reason.startsWith("activation-")) return decision;
  const pending = c.pending.filter(a => a.cancelledStep === undefined), fault = currentFault(c);
  if (fault?.startedStep != null && fault.restoredStep === null && pending.some(a => a.type === "restore-app" && a.targetId === fault.targetId))
    return run("combined-restoration", "Your accepted server restoration needs game time. Run to finish it, then check capacity and recovery; restoration alone does not guarantee stable service.");
  if (["recovery", "draining"].includes(decision.reason)) return decision;
  if (decision.reason === "failure" || decision.reason === "round-restoration" || fault?.startedStep != null && fault.restoredStep === null) {
    for (const app of c.apps.filter(a => a.health === "failed")) {
      const advice = advise({ type: "restore_app", appId: app.id }, "Restore server", "A server is offline. Restore it for free, then Run to verify service; restoration takes three game seconds.", "app");
      if (advice) return advice;
    }
  }
  // Accepted preparation may need a later connection, but never owns an untreated failure.
  if (pending.some(a => ["add-app", "scale-up", "upgrade-db", "cache", "cache-tuning", "deploy-lb", "unlimit", "release-spare"].includes(a.type)))
    return run("combined-installation", "Your accepted change needs game time. Press Run to finish installation, then check the next requirement.");
  const round = d.currentRound;
  const pressurePending = !!round && round.pressureEndedStep === null;
  // Once a wave is accepted its announced workload is relevant preparation evidence.
  // Never inspect the identity of an unobserved failure target.
  const demand = pressurePending ? Math.max(c.snapshot.incoming, round.scenario.peak) : c.snapshot.incoming;
  const profile = pressurePending ? combinedProfile(c, Math.max(c.step, round.startStep)) : combinedProfile(c);
  const dbWork = (logical: number, rate?: number) => combinedDatabaseDemand(game, logical, rate, profile);
  const serving = routableApps(c).filter(a => a.health !== "failed");
  const routed = serving.filter(a => c.routing.targets.includes(a.id));
  if (c.limit !== null && routed.length && (c.dbBacklog || c.apps.some(a => a.backlog))) {
    const limited = allocateTraffic(c.snapshot.admitted, routed.map(a => a.id));
    if (c.apps.every(a => a.health !== "failed" && (!a.backlog || routed.includes(a))) &&
      routed.every(a => a.backlog ? a.capacity > limited[a.id] : a.capacity >= limited[a.id]) &&
      c.dbCapacity > combinedDatabaseDemand(game, c.snapshot.admitted))
      return run("combined-draining", "Keep the temporary limit while waiting work drains. Run to clear queues, then check full-demand capacity before removing the limit; rejected users earn no revenue.");
  }
  const fits = (apps: typeof serving) => {
    if (!apps.length) return false;
    const allocation = allocateTraffic(demand, apps.map(a => a.id));
    return apps.every(a => a.backlog ? a.capacity > allocation[a.id] : a.capacity >= allocation[a.id]);
  };
  // Full incoming demand, not the capped admitted rate. Reserved spares stay reserved.
  if (!fits(routed)) {
    if (fits(serving) && serving.length > routed.length) {
      const advice = advise({ type: "set_routing", mode: "balanced", targets: serving.map(a => a.id) }, "All apps", "Your installed serving servers can share full demand. Connect All apps, then Run to activate routing. Reserved spares are excluded.", "network")
        ?? advise({ type: "deploy_load_balancer" }, "Deploy load balancing", "Install load balancing so your serving servers can share traffic. Then connect All apps.", "network");
      if (advice) return advice;
    }
    const allocation = serving.length ? allocateTraffic(demand, serving.map(a => a.id)) : {};
    const small = serving.find(a => a.tier === "base" && a.capacity < allocation[a.id] && allocation[a.id] <= P.appCapacity);
    const advice = small ? advise({ type: "scale_up", appId: small.id }, "Scale up server", `App ${small.id.slice(4)} needs more capacity before full demand can be shared safely. Scale it up, then check routing.`, "app") : null;
    if (advice) return advice;
    const add = advise({ type: "add_server" }, "Add server", "Serving capacity is insufficient at full demand. Add a server, then prepare its capacity and connect it after installation.", "app");
    if (add) return add;
    // At the instance ceiling, vertical scaling can still improve an undersized pool.
    for (const app of serving.filter(a => a.tier === "base")) {
      const scale = advise({ type: "scale_up", appId: app.id }, "Scale up server", "Your serving pool needs more capacity. Scale this server before checking full-demand routing again.", "app");
      if (scale) return scale;
    }
    const spare = c.apps.find(a => a.role === "spare" && a.health !== "failed" && !a.backlog);
    if (spare && fits([...serving, spare])) {
      const release = advise({ type: "release_spare" }, "Release spare", "No affordable capacity purchase is available. You can release the reserved spare for serving capacity, then connect it; it will no longer be reserved for automatic failover.", "app");
      if (release) return release;
    }
  }
  const allocation = routed.length ? allocateTraffic(demand, routed.map(a => a.id)) : {};
  const processing = routed.reduce((sum, a) => sum + Math.min(a.capacity, a.backlog + allocation[a.id]), 0);
  const dbDemand = Math.max(dbWork(Math.max(demand, processing)), c.snapshot.db.demand);
  const dbFits = c.dbBacklog ? c.dbCapacity > dbDemand : c.dbCapacity >= dbDemand;
  if (!dbFits) {
    if (c.readCache && c.readCache.warmth < c.readCache.target && dbWork(Math.max(demand, processing), c.readCache.target) < c.dbCapacity)
      return run("combined-cache-warming", "Your cache is still warming. Run to collect cache hits, then check database demand before removing the limit.");
    const upgrade = databaseUpgrade(c);
    if (upgrade) {
      const advice = advise({ type: "start_db_upgrade" }, "Upgrade database", "Full demand leaves too little database capacity, including waiting work. Upgrade the database before removing the limit or verifying recovery.", "db");
      if (advice) return advice;
    }
    const futureRate = c.readCache ? c.readCache.tuned ? c.readCache.target : D.tunedTarget : D.baseTarget;
    if (dbWork(demand, futureRate) < c.dbCapacity) {
      const cache = advise(c.readCache ? { type: "tune_cache" } : { type: "deploy_cache" }, "Prepare read cache", "Repeated reads need less database work with a warm cache. Prepare the cache, then Run to warm it before checking full-demand service.", "db");
      if (cache) return cache;
    }
  }
  if (!fits(routed) || !dbFits) {
    if (pressurePending && c.limit !== null && routed.length) {
      const admitted = allocateTraffic(c.snapshot.admitted, routed.map(a => a.id));
      if (routed.every(a => a.capacity >= admitted[a.id]) && c.dbCapacity >= combinedDatabaseDemand(game, c.snapshot.admitted))
        return run("combined-limited-wave", "Keep the temporary limit through this accepted growth wave; it protects service by rejecting users. Run until pressure ends, then prepare and verify full baseline demand.");
    }
    if (c.limit === null) {
      const relief = advise({ type: "set_traffic_limit", enabled: true }, "Limit traffic", "Full demand currently exceeds usable capacity. Temporarily limit traffic to protect service and drain waiting work; rejected users earn no revenue. Capacity preparation is still needed before removing it.", "network");
      if (relief) return relief;
    }
    const finances = chapter6FinancialRisk(game);
    if (finances) return { ...decision, attention: "hint", reason: "combined-finance", target: "finance", action: undefined, actions: [],
      observation: finances.message, recommendation: "View finances", message: finances.message, key: `${decision.key}:finance:${finances.kind}:${c.cashCents}` };
    return { ...decision, attention: "hint", reason: "combined-blocked", target: "menu", action: undefined, actions: [],
      message: "Full-demand capacity is still insufficient, but no affordable preparation action is available. Review finances and installed equipment in Menu; running alone cannot repair missing capacity.", key: `${decision.key}:blocked` };
  }
  if (c.limit !== null) {
    const advice = advise({ type: "set_traffic_limit", enabled: false }, "Remove traffic limit", "Your serving capacity and current cache-adjusted database workload fit full demand. Remove the traffic limit, then Run to verify five stable checks. Conditions can change during a growth wave.", "network");
    if (advice) return advice;
  }
  if (c.dbBacklog || c.apps.some(a => a.backlog))
    return run("combined-draining", "Current capacity has room for waiting work. Run to drain queues before the five full-demand checks can count.");
  if (c.promotion && c.step < c.promotion.endStep && !d.currentRound)
    return run("combined-promotion", "Your optional promotion is still pending or active. Run until it ends, then collect five stable full-demand checks.");
  if (decision.reason === "growth-wave") {
    const r = d.currentRound!;
    return run("growth-wave", r.pressureEndedStep !== null ? `Pressure has ended. Run to verify stable full-demand service: ${r.stableSteps} of 5 checks.`
      : r.startedStep === null ? "Your accepted growth wave is scheduled. Run when ready, then watch incoming demand and App Health."
      : "The growth wave is active. Run to observe how service handles it; check App Health and demand as conditions change.");
  }
  if (decision.reason === "growth-readiness")
    return run("growth-readiness", `Run to verify full-demand readiness: ${d.readinessSteps} of 5 checks. Then choose Start next growth wave.`);
  return decision;
}

/** Milestones use saved engine state; receipts live separately from company saves. */
export function chapter6Stage(game: GameState) {
  const c = game.campaign, d = c?.combinedStage;
  if (!c || !d || game.phase === "ended") return null;
  const r = d.currentRound;
  const stage = r ? r.pressureEndedStep !== null ? "recover" : "wave" : d.nextRoundIndex === 3 ? "final" : "prepare";
  const id = r ? `${r.id}:${stage}` : `${stage}:${d.nextRoundIndex}`;
  const title = stage === "wave" ? `Growth wave ${r!.index + 1}` : stage === "recover" ? "Recover at full demand" : stage === "final" ? "Final checks" : "Prepare for full demand";
  const message = stage === "wave" ? "A growth wave is announced. Watch incoming demand and App Health as it develops; inspect actual bottlenecks before responding."
    : stage === "recover" ? "Temporary pressure has ended. Restore failed servers, finish incident reviews and verify five stable full-demand checks before reviewing this wave."
    : stage === "final" ? "All three growth outcomes are acknowledged. End any promotion and verify five stable full-demand checks, then complete the final Campaign review."
    : "Growth readiness needs five stable checks serving all incoming traffic. Prepare capacity and routing before removing any traffic limit; Hint can help with the next action.";
  return { key: `${c.runId}:${d.enteredStep}`, stage: id, cues: [{ id, title, message, tone: stage === "wave" ? "pressure" as const : stage === "prepare" ? "prepare" as const : "recovery" as const }] };
}
