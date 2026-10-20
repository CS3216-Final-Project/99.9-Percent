import type { Action, GameState } from "@/sim";
import { allocateTraffic, canEnterData, pendingStop, qualifiesForRecovery, routableApps, databaseUpgrade } from "@/sim/step";
import { recoverySafe, reportsAcknowledged } from "@/sim/reliability";
import { currentFault, finalRequirements, stableManagement, canStartGrowth } from "@/sim/combinedCampaign";
import { preventionAvailable, preventionRequirements } from "@/sim/openingPrevention";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { campaignChapters, chapterAdvance } from "./campaignChapters";
import { previewCampaignAction } from "./campaignFinance";

export type GuidanceTarget = "run" | "db" | "app" | "network" | "requirements" | "next" | "reliability" | "growth" | "risk" | "menu";
export interface AttentionDecision {
  chapter: number;
  key: string;
  reason: string;
  attention: "run" | "hint" | "progression" | null;
  observation: string;
  recommendation: string;
  target: GuidanceTarget | null;
  growthChoices?: { upgrade?: GuidanceAction; risk: boolean };
  actions?: GuidanceAction[];
  action?: GuidanceAction;
  message: string;
}

export interface GuidanceAction { action: Action; label: string; evidence: string }
/** Shared stable identity on existing controls; no dispatch or UI availability rules. */
export const guidanceActionId = (action: Action) => encodeURIComponent(JSON.stringify(action, Object.keys(action).sort()));

/** UI transition eligibility only. Installation, drainage and qualifying recovery already resolve to Run. */
export function incidentNeedsPause(game: GameState, decision = campaignAttention(game)): boolean {
  const c = game.campaign;
  return game.phase === "incident" && !!c?.incident && decision.attention === "hint" &&
    !(c.incident.stableSteps > 0 && qualifiesForRecovery(c.snapshot) && recoverySafe(c));
}

/** Keep technical candidates internal; present one justified, validated next interaction. */
export function campaignAttention(game: GameState): AttentionDecision {
  const decision = baseAttention(game), c = game.campaign;
  if (c && decision.reason === "scaling-choice") {
    const upgrade = previewCampaignAction(game, { type: "start_db_upgrade" }).ok
      ? { action: { type: "start_db_upgrade" } as Action, label: "Upgrade database", evidence: "Prepare database capacity before growth." } : undefined;
    const risk = previewCampaignAction(game, { type: "accept_scaling_risk" }).ok;
    const message = upgrade && risk
      ? "Your database may struggle when more users arrive. Upgrade it to prepare, or accept the risk and continue."
      : upgrade ? "Your database may struggle when more users arrive. Upgrade it to prepare for growth."
      : risk ? "Your database may struggle when more users arrive. Consider growth with current capacity to review the risk before continuing."
      : "Your database may struggle when more users arrive. Check Chapter requirements before continuing.";
    return { ...decision, attention: upgrade || risk ? "hint" : null, message, growthChoices: { upgrade, risk }, key: `${decision.key}:${!!upgrade}:${risk}` };
  }
  if (!c || decision.attention === "run" || !["database", "application", "unrouted", "failure", "round-restoration", "full-demand"].includes(decision.reason)) return decision;
  const actions: GuidanceAction[] = [];
  const offer = (action: Action, label: string, evidence: string) => {
    if (previewCampaignAction(game, action).ok) actions.push({ action, label, evidence });
  };
  if (decision.reason === "database") {
    offer({ type: "start_db_upgrade" }, "Upgrade database", `Database demand ${c.snapshot.db.demand} exceeds capacity ${c.snapshot.db.capacity}. More capacity also increases upkeep; installation takes game time.`);
    // Cache benefits depend on observed reads and warmth. Never prescribe it for writes.
    if (c.dataStage && c.snapshot.data?.profile === "read-heavy") {
      offer({ type: "deploy_cache" }, "Deploy Read Cache", "The observed workload is read-heavy. Cache starts cold; writes and cache misses still reach the database.");
      if (c.snapshot.data.eligibleMisses > 0) offer({ type: "tune_cache" }, "Tune cache ceiling", "Eligible reads are still missing the cache. Tuning raises its ceiling, preserves warmth and does not remove write pressure or existing queues.");
    }
  }
  if (decision.reason === "application") {
    for (const instance of c.snapshot.instances ?? []) if (instance.routed && instance.health !== "failed" && instance.demand > instance.capacity)
      offer({ type: "scale_up", appId: instance.id }, `Scale up App ${instance.id.slice(4)}`, `This server receives ${instance.demand} requests/s against ${instance.capacity} capacity. Scaling changes this server only.`);
    if (c.loadBalancer) offer({ type: "add_server" }, "Add server", "Another server adds installed capacity after activation. You must then route traffic to it; installation alone does not relieve the current bottleneck.");
  }
  if (decision.reason === "unrouted") {
    const targets = routableApps(c).filter(a => a.health !== "failed").map(a => a.id);
    // Match an existing routing choice; do not invent an unsupported target subset.
    if (targets.length === routableApps(c).length && targets.length > 1) {
      const allocation = allocateTraffic(c.snapshot.admitted, targets);
      if (targets.every(id => c.apps.find(a => a.id === id)!.capacity >= allocation[id]))
        offer({ type: "set_routing", mode: "balanced", targets }, "All apps", "Share admitted traffic across the installed serving apps. Their current capacities support this allocation; database capacity is unchanged.");
    }
    if (!c.loadBalancer) offer({ type: "deploy_load_balancer" }, "Deploy load balancing", "An installed serving app is unrouted. Installation enables routing choices; you must configure traffic separately afterward.");
  }
  if (["failure", "round-restoration"].includes(decision.reason))
    for (const app of c.apps) if (app.health === "failed") offer({ type: "restore_app", appId: app.id }, `Restore App ${app.id.slice(4)}`, "This server is currently failed. Restoration is free and takes three game seconds; service recovery still requires observations.");
  if (["database", "application", "unrouted", "failure"].includes(decision.reason) && c.limit === null)
    offer({ type: "set_traffic_limit", enabled: true }, "Limit to 500 requests/s", "Temporary admission relief is free. Rejected requests earn no revenue; full-demand chapter checks may still require removing the limit later.");
  if (decision.reason === "full-demand" && c.limit !== null && c.routing.targets.length) {
    const m = c.snapshot, allocation = allocateTraffic(m.incoming, c.routing.targets);
    const observedDbLoad = m.admitted > 0 ? Math.ceil(m.db.demand * m.incoming / m.admitted) : Infinity;
    // Justification from observed workload, not a new action-availability rule or recovery forecast.
    if (c.dbCapacity >= observedDbLoad && c.routing.targets.every(id => {
      const app = c.apps.find(a => a.id === id);
      return app && app.health !== "failed" && app.role !== "spare" && !app.backlog && app.capacity >= allocation[id];
    })) offer({ type: "set_traffic_limit", enabled: false }, "Remove traffic limit", "Full-demand validation requires removing the limit. Current capacities fit the observed workload at full incoming demand; conditions can still change after admitting more traffic.");
  }
  const find = (type: Action["type"]) => actions.find(x => x.action.type === type);
  let action: GuidanceAction | undefined;
  if (decision.reason === "database") {
    // Prefer a direct capacity correction when its actual unlocked tier fits the observed load.
    if ((databaseUpgrade(c)?.capacity ?? 0) > c.snapshot.db.demand) action = find("start_db_upgrade");
    const data = c.snapshot.data;
    if (!action && data && data.databaseWriteDemand + data.nonCacheableReads < c.dbCapacity)
      action = find("tune_cache") ?? find("deploy_cache");
  } else if (decision.reason === "application") {
    const scales = actions.filter(x => x.action.type === "scale_up").filter(x => {
      const id = x.action.type === "scale_up" ? x.action.appId : "";
      return (c.snapshot.instances?.find(i => i.id === id)?.demand ?? Infinity) < P.appCapacity;
    });
    action = scales.sort((a,b) => {
      const demand = (x: GuidanceAction) => c.snapshot.instances?.find(i => x.action.type === "scale_up" && i.id === x.action.appId)?.demand ?? 0;
      return demand(b) - demand(a);
    })[0];
    if (!action && c.snapshot.app.demand < c.snapshot.app.capacity + Q.appCapacity) action = find("add_server");
  } else if (decision.reason === "unrouted") action = find("set_routing") ?? find("deploy_load_balancer");
  else if (decision.reason === "failure" || decision.reason === "round-restoration") action = find("restore_app");
  else if (decision.reason === "full-demand") action = find("set_traffic_limit");
  if (!action && c.limit === null && c.snapshot.admitted > Q.admissionLimit && admissionReliefFits(game)) action = find("set_traffic_limit");
  const message = action ? actionMessage(action) : decision.message;
  return { ...decision, actions, action, message, key: `${decision.key}:${action ? guidanceActionId(action.action) : "inspect"}` };
}

/** Same recorded capacity/safety evidence used for accepted admission changes below. */
function admissionReliefFits(game: GameState) {
  const c = game.campaign!, m = c.snapshot;
  const targets = m.instances?.filter(x => x.routed).map(x => x.id) ?? c.routing.targets;
  if (!targets.length || !recoverySafe(c) || c.apps.some(x => x.health === "failed") || c.dbCapacity <= Q.admissionLimit) return false;
  const allocation = allocateTraffic(Q.admissionLimit, targets);
  return targets.every(id => (c.apps.find(x => x.id === id)?.capacity ?? 0) > allocation[id]);
}

function actionMessage({action}: GuidanceAction): string {
  switch (action.type) {
    case "start_db_upgrade": return "Your database is overloaded. Upgrade it to handle more requests.";
    case "scale_up": return `App ${action.appId.slice(4)} is overloaded. Scale it up to handle more requests.`;
    case "add_server": return "Your app servers need more capacity. Add a server, then connect it after installation.";
    case "set_routing": return "Your new server isn't receiving traffic. Send traffic to All apps in Configure routing.";
    case "deploy_load_balancer": return "Your new server isn't receiving traffic. Install load balancing so you can connect it.";
    case "deploy_cache": return "Repeated lookups are overloading your database. Deploy Read Cache to reduce that work as it warms up.";
    case "tune_cache": return "Your cache could handle more repeat requests. Tune it to reduce database work.";
    case "restore_app": return `App ${action.appId.slice(4)} has failed. Restore it to bring it back online.`;
    case "set_traffic_limit": return action.enabled ? "Your equipment is overloaded. Temporarily limit traffic to give it room to recover; rejected requests won't earn money." : "Your company is ready to serve more traffic. Remove the limit to check it at full demand.";
    default: return "Check the highlighted action to continue.";
  }
}

function shortMessage(reason: string, target: GuidanceTarget | null): string {
  if (reason.startsWith("activation-")) return "Your change is being installed. Press Run to let it finish, then check your app.";
  if (["recovery", "draining", "reliability-stability"].includes(reason))
    return "Your app is recovering. Keep it running to make sure everything is stable.";
  if (["spike-stability", "prevention-stability", "final-stability"].includes(reason)) return "Your company looks stable. Keep it running to finish the stability checks.";
  const messages: Record<string,string> = {
    inactive: "Hints are available in Guided Mode.", ended: "This company has ended. Review its scorecard.",
    review: "An outcome is ready. Finish its review before continuing.", next: "This chapter is complete. Use Next to continue.",
    database: "Your database is struggling. Check Database to understand what needs attention.",
    application: "Your app servers are struggling. Check App Server to find what needs attention.",
    unrouted: "An installed server isn't receiving traffic. Check Network before changing its connections.",
    failure: "A server has failed. Check App Server health before choosing a response.",
    "round-restoration": "A server still needs repair. Check App Server health to see what needs restoring.",
    "missing-review": "A report needs attention. Open Menu to export your company details for investigation.",
    "growth-decision": "Your company is ready to grow. Choose Start next growth wave when you're ready.",
    "full-demand": "Your company must handle all incoming traffic. Check Network before removing any limits.",
    "final-requirements": "Some company requirements are unfinished. Open View chapters to see what's missing.",
    arm: "Your company is ready. Choose Start reliability test to see how it handles a failure.",
    "arm-requirements": "Your company isn't ready for the reliability test. Open View chapters to see what's needed.",
    "isolated-failure": "Service is stable, but a server is still offline. Press Run to let it return.",
    "scaling-choice": "Growth needs preparation. Upgrade your database, or review the optional risk with Consider growth with current capacity.",
    "prevention-recorded": "Your prevention result is recorded. View chapters to review the journey; this result doesn't unlock Scaling.",
    requirements: "Open View chapters to see what your company needs next.",
  };
  if (messages[reason]) return messages[reason];
  if (["opening-growth", "scaling-growth", "data-growth", "spike-pulses", "scheduled-failure", "growth-wave", "growth-readiness"].includes(reason)) return "Press Run to see what happens next.";
  return target === "db" ? "Work is building up. Check Database to see what needs attention." : target === "network" ? "Check Network to understand which traffic your company is serving." : "Check App Server to see what needs attention.";
}

/** Read-only interpretation of recorded state. Never advances or repairs a company. */
function baseAttention(game: GameState): AttentionDecision {
  const c = game.campaign;
  const chapter = c ? campaignChapters(game).find(x => x.current)?.number ?? 1 : 0;
  const result = (reason: string, attention: AttentionDecision["attention"], observation: string, recommendation: string, target: GuidanceTarget | null): AttentionDecision => ({
    chapter, reason, attention, observation, recommendation, target, message: shortMessage(reason, target),
    // Physical observations can update without continually restarting an idle period.
    key: c ? `${c.runId}:${c.actions.length}:${chapter}:${game.phase}:${c.incident?.id ?? ""}:${reason}:${c.pending.map(a => a.id).join(",")}:${currentFault(c)?.restoredStep ?? ""}:${c.limit}:${c.routing.targets.join(",")}` : "inactive",
  });
  const run = (reason: string, observation: string) => result(reason, "run", observation, "Press Run to collect the next game seconds, then check the readings.", "run");
  const hint = (reason: string, observation: string, recommendation: string, target: GuidanceTarget) => result(reason, "hint", observation, recommendation, target);
  const required = (reason: string, observation: string, recommendation: string, target: GuidanceTarget | null) => result(reason, null, observation, recommendation, target);
  const progression = (reason: string, observation: string, recommendation: string, target: GuidanceTarget) => result(reason, "progression", observation, recommendation, target);
  if (!c) return required("inactive", "Guidance is available in Guided Mode.", "", null);
  if (game.phase === "ended") return required("ended", "This company has ended.", "Review the scorecard before starting another company.", null);
  if (game.phase === "review" || pendingStop(c) || c.openingMilestone && !c.openingMilestone.acknowledged)
    return required("review", "An outcome is waiting for your review.", "Finish the existing review or acknowledgement before continuing.", null);
  const next = chapterAdvance(game);
  if (!c.incident && next?.ready && previewCampaignAction(game, next.action).ok) return progression("next", "The current chapter requirements are complete.", `Use Next: ${next.label}.`, "next");
  const m = c.snapshot, fault = currentFault(c);
  const safe = recoverySafe(c), qualifies = qualifiesForRecovery(m) && safe;
  const appOver = m.app.demand > m.app.capacity || !!m.instances?.some(x => x.routed && x.health !== "failed" && x.demand > x.capacity);
  const dbOver = m.db.demand > m.db.capacity;
  const pending = c.pending.filter(a => a.cancelledStep === undefined);
  const relevant = pending.find(a => {
    if (qualifies && !appOver && !dbOver) return true;
    if (a.type === "restore-app") return !dbOver && !!fault && fault.targetId === a.targetId && fault.restoredStep === null &&
      !m.instances?.some(x => x.routed && x.id !== a.targetId && x.health !== "failed" && x.demand > x.capacity);
    if (a.type === "promote-spare" && fault && fault.restoredStep === null && a.failureId === fault.id && a.expectedRouting === JSON.stringify(c.routing) && fault.naturalStep > a.activationStep) {
      const spare = c.apps.find(x => x.id === a.targetId);
      if (!spare || spare.health === "failed" || spare.backlog || spare.role !== "spare" || c.reliabilityStage?.spareId !== spare.id ||
        c.routing.targets.includes(spare.id) || c.apps.find(x => x.id === fault.targetId)?.detectedHealth !== "unhealthy" ||
        pending.some(x => x.type === "restore-app" && x.activationStep === a.activationStep)) return false;
      const targets = [...c.routing.targets.filter(id => c.apps.find(x => x.id === id)?.detectedHealth !== "unhealthy"), spare.id];
      const allocation = allocateTraffic(m.admitted, targets);
      return !dbOver && c.dbCapacity >= m.admitted && targets.every(id => {
        const app = c.apps.find(x => x.id === id);
        return app && app.health !== "failed" && (app.backlog ? app.capacity > allocation[id] : app.capacity >= allocation[id]);
      });
    }
    if (a.type === "upgrade-db") return safe && !appOver && (a.capacityAfter ?? 0) > m.db.demand;
    if (a.type === "limit") {
      return admissionReliefFits(game);
    }
    if (a.type === "routing" && a.routing) {
      const targets = a.routing.targets, allocation = allocateTraffic(m.admitted, targets);
      const safeRoute = !fault || fault.restoredStep !== null || !targets.includes(fault.targetId) && !c.apps.find(x => x.id === fault.targetId)?.backlog;
      return safeRoute && c.dbCapacity >= m.admitted && targets.every(id => {
        const app = c.apps.find(x => x.id === id);
        return app && app.health !== "failed" && app.role !== "spare" && (app.backlog ? app.capacity > allocation[id] : app.capacity >= allocation[id]);
      });
    }
    if (a.type === "scale-up") return safe && !dbOver && !!m.instances?.every(x => x.id === a.targetId ? (a.capacityAfter ?? 0) > x.demand : x.demand <= x.capacity && !x.backlog);
    // Other pending changes may be useful, but do not infer their future effect.
    return false;
  });
  const scalingChoice = c.scaling && !c.scaling.consumed && c.dbCapacity < P.dbCapacity && !c.scalingConsent;
  if (relevant && (!scalingChoice || relevant.type === "upgrade-db")) return run(`activation-${relevant.type}`, "An accepted change is still waiting to activate. Activation alone does not guarantee recovery.");
  if (c.incident && qualifies && !appOver && !dbOver) return run("recovery", `The latest readings meet recovery conditions. Healthy observations: ${c.incident.stableSteps} / ${Q.stableSteps}. Pausing adds no observations.`);
  if (!safe || fault?.startedStep != null && fault.restoredStep === null && !qualifies)
    return hint("failure", "Service has a server-health problem. Check the observed health and surviving capacity.", "Open App Server to inspect health. Restoration, routing and admission relief are different available strategies.", "app");
  if (appOver && c.apps.some(a => !a.routed && a.role !== "spare" && a.health !== "failed"))
    return hint("unrouted", "An installed App Server is not receiving traffic while routed capacity is under pressure.", "Open Network to compare routing and the available options.", "network");
  if (dbOver) return hint("database", "The database is receiving more work than it can process.", "Open Database to compare demand, capacity and waiting work before choosing a response.", "db");
  if (appOver) return hint("application", "Routed application capacity is under pressure.", "Open App Server to compare workload and capacity before choosing a response.", "app");
  if (c.incident) {
    // A measured drainage path, not a forecast. Require comparable observations and spare processing budget.
    const prior = c.recent.at(-2), xs = m.instances;
    const correctiveActivation = c.actions.some(a => a.activatedStep === c.step && ["limit", "upgrade-db", "scale-up", "routing", "restore-app"].includes(a.type));
    const comparable = prior && prior.incoming === m.incoming && prior.admitted === m.admitted &&
      JSON.stringify(prior.routing) === JSON.stringify(m.routing) && prior.data?.profile === m.data?.profile &&
      !c.actions.some(a => a.activatedStep != null && a.activatedStep > prior.step);
    const draining = safe && prior && xs && m.step === prior.step + 1 && (comparable || correctiveActivation) &&
      m.app.backlog + m.db.backlog < prior.app.backlog + prior.db.backlog && m.latencyMs <= prior.latencyMs &&
      m.serviceErrorRate !== null && prior.serviceErrorRate !== null && m.serviceErrorRate <= prior.serviceErrorRate &&
      xs.every(x => !x.backlog || x.processed > x.demand) && (!m.db.backlog || m.db.processed > m.db.demand);
    if (draining) return run("draining", "The latest observations show waiting work decreasing. Recovery is still being checked.");
    return hint("investigate", "The incident has not yet met the recovery conditions.", "Inspect the current readings and compare waiting work with available capacity.", m.db.backlog ? "db" : "app");
  }
  if (!reportsAcknowledged(c)) return hint("missing-review", "A recorded report lacks an acknowledgement, but no review is active.", "Open Menu to export company evidence for investigation. Guidance cannot repair the saved state.", "menu");
  const empty = !c.dbBacklog && c.apps.every(a => !a.backlog);
  if (!qualifies || !empty) return hint("readings", "The current service readings do not yet satisfy the next chapter checks.", m.db.backlog ? "Open Database to inspect waiting work before continuing." : "Open App Server to inspect waiting work and service readings before continuing.", m.db.backlog ? "db" : "app");
  if (c.combinedStage) {
    const d = c.combinedStage, r = d.currentRound;
    if (canStartGrowth(game)) return progression("growth-decision", "The company is ready for another growth wave.", "Choose Start next growth wave when you are ready.", "growth");
    if (r) {
      if (r.pressureEndedStep !== null && r.fault && r.fault.restoredStep === null)
        return hint("round-restoration", "Service may be stable, but the failed application has not been restored.", "Inspect App Server health. The wave's final observations require restoration.", "app");
      if (r.pressureEndedStep === null || stableManagement(game, true))
        return run("growth-wave", r.pressureEndedStep === null ? "The accepted growth wave needs game time to develop." : `Pressure ended. Stable full-demand observations: ${r.stableSteps} / 5.`);
    }
    if (!stableManagement(game, true)) return hint("full-demand", "Growth checks require healthy service at full demand with finished actions.", "Read Chapter requirements. A traffic limit can help recovery but blocks full-demand growth checks.", c.limit !== null ? "network" : "requirements");
    if (d.nextRoundIndex < 3) return run("growth-readiness", `Readiness observations: ${d.readinessSteps} / 5. Finish any active promotion before the next wave.`);
    if (finalRequirements(game)) return run("final-stability", `Final stable observations: ${d.finalStableSteps} / 5.`);
    return hint("final-requirements", "Some final company requirements remain incomplete.", "Use View chapters to review the journey, and compare the Chapter requirements in Equipment & actions.", "requirements");
  }
  if (c.reliabilityStage) {
    const d = c.reliabilityStage;
    if (!fault) {
      if (previewCampaignAction(game, { type: "arm_reliability" }).ok)
        return progression("arm", "The company is ready for the reliability test.", "Choose Start reliability test when you are ready. Reliability purchases are optional.", "reliability");
      return hint("arm-requirements", "The reliability test is not ready to start.", "Use View chapters to review the journey, and compare Chapter requirements before starting the test.", "requirements");
    }
    if (fault.startedStep === null) return run("scheduled-failure", "The reliability test is armed; the failure has not happened yet.");
    if (fault.restoredStep === null) return run("isolated-failure", "Service is stable with the failed app isolated. The application must still return before chapter stability can complete.");
    if (d.completedStep === null) return run("reliability-stability", `The application is restored. Stable chapter observations: ${d.stableSteps} / 5.`);
  }
  if (c.spikeStage) {
    const d = c.spikeStage;
    if (c.step < d.deadlines[3]) return run("spike-pulses", "The announced traffic pulses still need game time to develop or end.");
    if (d.completedStep === null && c.incomingRate === T.baseline) return run("spike-stability", `Both pulses ended. Stable baseline observations: ${d.baselineStableSteps} / 5.`);
  }
  if (c.dataStage && !c.dataStage.consumed && canEnterData(game)) return run("data-growth", "The company is ready to observe the scheduled workload increase.");
  if (c.scaling && !c.scaling.consumed) {
    if (c.dbCapacity >= P.dbCapacity || c.scalingConsent) return run("scaling-growth", "Growth preparation is resolved. The next wave requires game time.");
    return result("scaling-choice", previewCampaignAction(game, { type: "accept_scaling_risk" }).ok ? "progression" : null, "The next growth wave needs database headroom or your explicit acceptance of the risk.", "Consider growth with current capacity explains the risk choice. You can Keep preparing instead; opening it does not accept the risk.", "risk");
  }
  if (!c.consumedEvents.includes("opening-growth")) return run("opening-growth", "The first scheduled growth has not arrived yet.");
  if (preventionAvailable(c)) {
    const p = c.openingPrevention;
    if (p?.outcome?.acknowledged) return hint("prevention-recorded", "Prevention was recorded. It does not unlock Scaling through the recovered-incident route.", "Use View chapters to review the journey; guidance cannot change progression rules.", "requirements");
    const req = preventionRequirements(c);
    if (Object.values(req).every(Boolean)) return run("prevention-stability", `Full-demand service qualifies. Fresh prevention observations: ${p?.stableSteps ?? 0} / 5.`);
    return hint("prevention-inspection", "Opening prevention requires recorded inspections and healthy full-demand service.", !req.applicationInspected ? "Open App Server to inspect the current application." : !req.databaseInspected ? "Open Database to inspect the current workload." : "Open Network to compare admitted and rejected traffic with full-demand requirements.", !req.applicationInspected ? "app" : !req.databaseInspected ? "db" : "network");
  }
  return hint("requirements", "There is no confidently identified next time-dependent requirement.", "Use View chapters to review the journey, and compare Chapter requirements with the latest readings before choosing a response.", "requirements");
}
