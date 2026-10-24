import type { Action, GameState } from "@/sim";
import type { Campaign } from "@/sim/campaignTypes";
import { admissionCeiling, allocateTraffic, canEnterData, pendingStop, qualifiesForRecovery, routableApps, databaseUpgrade, classifyData } from "@/sim/step";
import { recoverySafe, reportsAcknowledged } from "@/sim/reliability";
import { currentFault, finalRequirements, stableManagement, canStartGrowth } from "@/sim/combinedCampaign";
import { preventionAvailable, preventionRequirements } from "@/sim/openingPrevention";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { LAUNCH_WEEK as LW } from "@/sim/scenarios/launchWeek";
import { launchResearchPending, milestoneBlocks } from "./campaignGuidance";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { campaignChapters, chapterAdvance } from "./campaignChapters";
import { previewCampaignAction } from "./campaignFinance";
import { chapter4Stage, chapter4Performance } from "./chapter4Guidance";
import { chapter6Attention, combinedDatabaseDemand } from "./chapter6Guidance";

export type GuidanceTarget = "run" | "db" | "app" | "network" | "monitoring" | "requirements" | "next" | "reliability" | "growth" | "risk" | "menu" | "finance" | "endweek" | "research";
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

/**
 * The machines a guidance spotlight lights in the room: the recommended action's own equipment, or the machine
 * family the decision is about. App instance ids light one rack; an equipment id lights its whole pad.
 */
export function spotlightMachines(decision: AttentionDecision, action: Action | undefined, c: Campaign | null): string[] {
  if (!c) return [];
  if (action) switch (action.type) {
    case "start_db_upgrade": return ["db"];
    case "scale_up": case "restore_app": return [action.appId];
    case "deploy_cache": case "tune_cache": return ["cache"];
    case "deploy_health_checks": return ["monitoring"];
    case "install_spare": case "reserve_spare": case "release_spare": case "deploy_failover": return ["standby"];
    case "pick_launch_tech": return [action.tech === "caching" ? "cache" : "app"];
    case "run_promotion": return ["growth"];
    case "set_routing": case "deploy_load_balancer": case "set_traffic_limit": return ["gateway"];
    case "add_server": case "deploy_autoscaler": return ["app"];
    default: break;
  }
  switch (decision.target) {
    case "db": return ["db"];
    case "network": return ["gateway"];
    case "app": {
      const troubled = c.apps.find(a => a.health === "failed")?.id
        ?? c.snapshot.instances?.find(i => i.routed && i.demand > i.capacity)?.id
        ?? c.apps.find(a => !a.routed && a.role !== "spare" && a.health !== "failed")?.id;
      return [troubled ?? "app"];
    }
    default: return [];
  }
}
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
  if (c?.combinedStage) return chapter6Attention(game, decision);
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
    if (c.loadBalancer || c.launchWeek) offer({ type: "add_server" }, "Add server", "Another server adds installed capacity after activation. You must then route traffic to it; installation alone does not relieve the current bottleneck.");
  }
  if (decision.reason === "unrouted") {
    const targets = routableApps(c).filter(a => a.health !== "failed").map(a => a.id);
    // Match an existing routing choice; do not invent an unsupported target subset.
    if (targets.length === routableApps(c).length && targets.length > 1) {
      const allocation = allocateTraffic(c.snapshot.admitted, targets);
      if (targets.every(id => c.apps.find(a => a.id === id)!.capacity >= allocation[id]))
        offer({ type: "set_routing", mode: "balanced", targets }, "All apps", "Share admitted traffic across the installed serving apps. Their current capacities support this allocation; database capacity is unchanged.");
      // Chapter 4's equal allocation may overload a new base server even when
      // aggregate installed capacity fits. Prepare that server before routing.
      if (decision.chapter === 4) for (const app of c.apps.filter(a => !a.routed && a.tier === "base"))
        if (allocation[app.id] > app.capacity && allocation[app.id] < P.appCapacity)
          offer({ type: "scale_up", appId: app.id }, `Scale up App ${app.id.slice(4)}`, "The new server needs more capacity before it can share the observed traffic.");
    }
    if (!c.loadBalancer) offer({ type: "deploy_load_balancer" }, "Deploy load balancing", "An installed serving app is unrouted. Installation enables routing choices; you must configure traffic separately afterward.");
  }
  if (["failure", "round-restoration"].includes(decision.reason))
    for (const app of c.apps) if (app.health === "failed") offer({ type: "restore_app", appId: app.id }, `Restore App ${app.id.slice(4)}`, "This server is currently failed. Restoration is free and takes three game seconds; service recovery still requires observations.");
  // Launch Week never recommends turning traffic away: the lesson is capacity, and limiting costs uptime.
  const launchLive = !!c.launchWeek && c.launchWeek.completedStep === null;
  if (["database", "application", "unrouted", "failure"].includes(decision.reason) && c.limit === null && !launchLive)
    offer({ type: "set_traffic_limit", enabled: true }, `Limit to ~${admissionCeiling(c)} requests/s`, "Temporary admission relief is free. Rejected requests earn no revenue and count against uptime; full-demand chapter checks may still require removing the limit later.");
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
    if (!action && launchLive) action = find("add_server");
  } else if (decision.reason === "unrouted") action = find("set_routing") ?? find("scale_up") ?? find("deploy_load_balancer");
  else if (decision.reason === "failure" || decision.reason === "round-restoration") action = find("restore_app");
  else if (decision.reason === "full-demand") action = find("set_traffic_limit");
  if (!action && !launchLive && c.limit === null && c.snapshot.admitted > admissionCeiling(c) && admissionReliefFits(game)) action = find("set_traffic_limit");
  const message = decision.reason === "unrouted" && action?.action.type === "scale_up"
    ? "Your new server needs more capacity before sharing traffic. Scale it up, then connect it." : action ? actionMessage(action, c) : decision.message;
  return { ...decision, actions, action, message, key: `${decision.key}:${action ? guidanceActionId(action.action) : "inspect"}` };
}

/** Same recorded capacity/safety evidence used for accepted admission changes below. */
function admissionReliefFits(game: GameState) {
  const c = game.campaign!, m = c.snapshot;
  const targets = m.instances?.filter(x => x.routed).map(x => x.id) ?? c.routing.targets;
  const cap = c.scenarioVersion === 2 ? admissionCeiling(c) : Q.admissionLimit;
  if (!targets.length || !recoverySafe(c) || c.apps.some(x => x.health === "failed") || c.dbCapacity <= cap) return false;
  const allocation = allocateTraffic(cap, targets);
  return targets.every(id => (c.apps.find(x => x.id === id)?.capacity ?? 0) > allocation[id]);
}

function actionMessage({action}: GuidanceAction, c: Campaign): string {
  switch (action.type) {
    case "start_db_upgrade": return "Your database is overloaded. Upgrade it to handle more requests.";
    case "scale_up": return c.launchWeek && c.launchWeek.completedStep === null
      ? `Keep up with traffic: scale up App ${action.appId.slice(4)}, then the other app. Limiting traffic instead hurts your uptime and reputation.`
      : `App ${action.appId.slice(4)} is overloaded. Scale it up to handle more requests.`;
    case "add_server": return c.launchWeek && c.launchWeek.completedStep === null
      ? "One App Server can't keep up with this traffic. Buy a second server to share it."
      : "Your app servers need more capacity. Add a server, then connect it after installation.";
    case "set_routing": return "Your new server isn't receiving traffic. Send traffic to All apps in Configure routing.";
    case "deploy_load_balancer": return c.apps.length > 1 ? "Your new server isn't receiving traffic. Install load balancing so you can connect it."
      : "One app server can't absorb this spike. Install load balancing so a second server can share the traffic.";
    case "deploy_cache": return "Repeated lookups are overloading your database. Deploy Read Cache to reduce that work as it warms up.";
    case "tune_cache": return "Your cache could handle more repeat requests. Tune it to reduce database work.";
    case "restore_app": return `App ${action.appId.slice(4)} has failed. Restore it to bring it back online.`;
    case "set_traffic_limit": return action.enabled ? "Your equipment is overloaded. Temporarily limit traffic to give it room to recover; rejected requests won't earn money and count against uptime." : "Your company is ready to serve more traffic. Remove the limit to check it at full demand.";
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
    "prevention-recorded": "Your prevention result is recorded. Review its verification and complete the Opening recognition to continue.",
    requirements: "Open View chapters to see what your company needs next.",
    "launch-first-incident": "Your App Server is overloading. Inspect it to see its status turn red, then fix the cause.",
    "launch-db-incident": "Your database is overloading. Inspect it to see the work piling up.",
    "launch-end-week": "Everything is stable again. Use End week to skip to the end of the week.",
    "launch-open": "Your launch week starts now. Press Run - the first customers are arriving.",
    "launch-week-report": "A launch week settled. Lost or turned-away requests so far are counted.",
    "launch-research": "You earned a research point. Spend it on Caching or Autoscaling; each carries into later chapters.",
    "launch-surge": "The launch campaign is sending five times the traffic. Keep the service up until it ends.",
    "launch-week": "Your launch week is running. Press Run and keep the service up.",
    "launch-score": "Launch Week is complete. Check your uptime score and continue into Chapter 2.",
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
  // The score card waits for the research pick, so the week's last lesson is never covered.
  if (launchResearchPending(game))
    return result("launch-research", "hint", "Research points buy technology. This one is free; it is billed at the week's settlement.", "Pick Caching or Autoscaling to see your Launch Week score.", "research");
  if (c.launchWeek && milestoneBlocks(game)) return required("launch-score", "Launch Week is complete.", "Review your uptime score and continue into Chapter 2.", "next");
  if (game.phase === "review" || pendingStop(c) || milestoneBlocks(game))
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
      return !dbOver && (c.combinedStage ? c.dbCapacity >= combinedDatabaseDemand(game, m.admitted) : c.dbCapacity >= m.admitted) && targets.every(id => {
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
      return safeRoute && (c.combinedStage ? c.dbCapacity >= combinedDatabaseDemand(game, m.admitted) : c.dbCapacity >= m.admitted) && targets.every(id => {
        const app = c.apps.find(x => x.id === id);
        return app && app.health !== "failed" && app.role !== "spare" && (app.backlog ? app.capacity > allocation[id] : app.capacity >= allocation[id]);
      });
    }
    if (chapter === 4 && safe && !dbOver && appOver && (a.type === "add-app" || a.type === "scale-up")) {
      const targets = routableApps(c).filter(app => app.health !== "failed");
      const count = targets.length + (a.type === "add-app" ? 1 : 0);
      const share = Math.ceil(m.admitted / count);
      const preparing = a.type === "add-app" ? count <= T.maximum && share < P.appCapacity
        : targets.some(app => app.id === a.targetId && !app.routed && (a.capacityAfter ?? 0) > share);
      if (preparing && targets.every(app => !app.routed || app.capacity > share)) return true;
    }
    if (a.type === "scale-up") return safe && !dbOver && !!m.instances?.every(x => x.id === a.targetId ? (a.capacityAfter ?? 0) > x.demand : x.demand <= x.capacity && !x.backlog);
    // Other pending changes may be useful, but do not infer their future effect.
    return false;
  });
  const scalingChoice = c.scaling && !c.scaling.consumed && c.dbCapacity < P.dbCapacity && !c.scalingConsent;
  if (relevant && (!scalingChoice || relevant.type === "upgrade-db")) return run(`activation-${relevant.type}`, "An accepted change is still waiting to activate. Activation alone does not guarantee recovery.");
  // Launch Week says nothing before an incident: no upgrade or limit prompts while the week simply runs.
  if (c.launchWeek && c.launchWeek.completedStep === null && !c.incident) {
    const lw = c.launchWeek, week = Math.floor(c.step / LW.periodSteps);
    const settled = c.trace.some(t => t.type === "incident-opened" && Math.floor(t.step / LW.periodSteps) === week);
    // The free research point is explained before the week is skipped past it.
    if (lw.researchEarned && !lw.tech) return result("launch-research", "hint", "Research points buy technology. This one is free; it is billed at the week's settlement.", "Pick Caching or Autoscaling. Hover each to preview it in the room.", "research");
    if (settled && qualifies && !appOver && !dbOver && !c.dbBacklog && c.apps.every(a => !a.backlog) && !pending.length && reportsAcknowledged(c) && game.phase === "management")
      return progression("launch-end-week", "The incident is settled and service is stable.", "Use End week to skip to the end of this week.", "endweek");
    {
      if (c.step < LW.spikeStep) return run("launch-open", "Your company opens its doors this week; the first traffic arrives now.");
      const report = c.settlements.at(-1);
      if (report && c.step - report.step < 6) return run("launch-week-report", `Week ${report.period} report: ${c.cumulative.failed.toLocaleString("en-US")} requests lost so far.`);
      if (lw.surge && lw.surge.endedStep === null) return run("launch-surge", `The launch campaign is sending ${LW.surgeFactor}× traffic until game second ${lw.surge.endStep}.`);
      return run("launch-week", `Launch week ${Math.min(LW.weeks, Math.floor(c.step / LW.periodSteps) + 1)} of ${LW.weeks}. The launch campaign surge arrives in week 3 - keep the service up.`);
    }
  }
  if (c.incident && qualifies && !appOver && !dbOver) return run("recovery", `The latest readings meet recovery conditions. Healthy observations: ${c.incident.stableSteps} / ${Q.stableSteps}. Pausing adds no observations.`);
  if (!safe || fault?.startedStep != null && fault.restoredStep === null && !qualifies)
    return hint("failure", "Service has a server-health problem. Check the observed health and surviving capacity.", "Open App Server to inspect health. Restoration, routing and admission relief are different available strategies.", "app");
  if (appOver && c.apps.some(a => !a.routed && a.role !== "spare" && a.health !== "failed"))
    return hint("unrouted", "An installed App Server is not receiving traffic while routed capacity is under pressure.", "Open Network to compare routing and the available options.", "network");
  if (dbOver && c.launchWeek && c.launchWeek.completedStep === null && c.incident &&
      !c.trace.some(t => t.type === "inspection" && t.step >= c.incident!.openedStep && t.data.component === "db"))
    return hint("launch-db-incident", "The database is receiving more work than it can process.", "Inspect the Database to see its overload, then upgrade it.", "db");
  if (dbOver) return hint("database", "The database is receiving more work than it can process.", "Open Database to compare demand, capacity and waiting work before choosing a response.", "db");
  // First Launch Week incident: teach the inspect-first beat - the status bar stays up, the app shows red
  // once looked at, and guidance then points at the fix.
  if (appOver && c.launchWeek && c.launchWeek.completedStep === null && c.incident &&
      !c.trace.some(t => t.type === "inspection" && t.step >= c.incident!.openedStep && t.data.component === "app"))
    return hint("launch-first-incident", "An app server is overloaded and the incident is open.", "Inspect the App Server to see its status turn red, then fix the cause.", "app");
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
    const stage = chapter4Stage(game);
    const inspected = (component: string) => !!stage && c.trace.some(t => t.type === "inspection" && t.id > stage.eventId && t.step >= stage.since && t.data.component === component);
    const inspection = (component: "app" | "network" | "monitoring", message: string) => ({ ...hint(`spike-${stage?.stage}-inspect`, "Inspect current evidence for this traffic stage.", message, component), message });
    const limited = c.limit !== null;
    if (stage?.stage === "prepare" && !inspected("app"))
      return inspection("app", limited ? "Check App Server capacity before the spike. Your traffic limit protects service by rejecting requests." : "Check App Server capacity before the spike. Upgrades are optional; Run when you are ready.");
    if (!limited && (stage?.stage === "spike1" || stage?.stage === "spike2")) {
      if (!inspected("monitoring")) return inspection("monitoring", "The spike is active. Check Monitoring to see whether latency, errors and queues remain healthy.");
    }
    if (stage?.stage === "between") {
      const performance = chapter4Performance(game)!;
      const first = performance.readings;
      const appStruggled = performance.appStruggled;
      const dbDemand = performance.dbDemand;
      const tradeoff = performance.rejected ? " Limiting protected admitted traffic but turned users away." : "";
      const plan = (action: Action, message: string): AttentionDecision | null => {
        if (!previewCampaignAction(game, action).ok) return null;
        const advice = hint("spike-plan", "The first pulse exposed a capacity constraint. Preparation remains optional.", message, action.type === "set_routing" || action.type === "set_traffic_limit" ? "network" : action.type === "start_db_upgrade" ? "db" : "app");
        return { ...advice, action: { action, label: "Prepare for the next spike", evidence: performance.summary }, message: `${performance.summary}${tradeoff} ${message} Changes are optional.`, key: `${advice.key}:${guidanceActionId(action)}` };
      };
      if ((appStruggled || performance.rejected > 0) && (!d.controller?.enabled || limited)) {
        const targets = routableApps(c).filter(a => a.health !== "failed");
        const peak = Math.max(0, ...first.map(m => m.incoming));
        const allocation = targets.length ? allocateTraffic(peak, targets.map(a => a.id)) : {};
        const small = targets.find(a => a.capacity < allocation[a.id] && allocation[a.id] < P.appCapacity && a.tier === "base");
        const advice = small ? plan({ type: "scale_up", appId: small.id }, `The first spike exposed a small server. Scale up App ${small.id.slice(4)} before sharing the next spike.`)
          : targets.every(a => a.capacity >= allocation[a.id]) && targets.some(a => !a.routed)
          ? plan({ type: "set_routing", mode: "balanced", targets: targets.map(a => a.id) }, "Your prepared servers can share the observed spike. Connect All apps before the next one.")
          : targets.some(a => a.capacity < allocation[a.id]) && targets.length < T.maximum
          ? plan({ type: "add_server" }, "Serving more of the observed spike needs application capacity. You can add a server, prepare it, then connect it.") : null;
        if (advice) return advice;
      }
      const peak = Math.max(T.peak, ...first.map(m => m.incoming));
      const data = first.at(-1)?.data;
      const fullDb = data ? classifyData(peak, data.readShare, data.cacheableReadShare, Math.min(c.readCache?.warmth ?? 0, c.readCache?.target ?? 0)).databaseNewDemand : peak;
      if (dbDemand > c.dbCapacity || performance.rejected > 0 && fullDb > c.dbCapacity) {
        const upgrade = databaseUpgrade(c);
        const advice = upgrade && upgrade.capacity > Math.max(dbDemand, fullDb) ? plan({ type: "start_db_upgrade" }, "More admitted traffic would strain the database. You can upgrade it before the next spike.") : null;
        if (advice) return advice;
        if (!inspected("db")) return { ...hint("spike-database-history", "Database headroom needs evaluation before serving more traffic.", "Check Database before the next spike.", "db"), message: `${performance.summary}${tradeoff} Check Database before admitting more traffic; more app servers cannot fix a database bottleneck.` };
      }
      if (limited && c.dbCapacity >= fullDb && c.routing.targets.length) {
        const allocation = allocateTraffic(peak, c.routing.targets);
        if (c.routing.targets.every(id => { const app = c.apps.find(a => a.id === id); return app && app.health !== "failed" && app.role !== "spare" && !app.backlog && app.capacity >= allocation[id]; })) {
          const advice = plan({ type: "set_traffic_limit", enabled: false }, "Prepared capacity fits the next spike. You may remove the traffic limit to test serving more users, or keep your strategy.");
          if (advice) return advice;
        }
      }
      const evaluated = c.trace.some(t => t.type === "inspection" && t.step >= d.deadlines[0] && t.data.component === "monitoring");
      if (!evaluated) return inspection("monitoring", `${performance.summary}${tradeoff} Check Monitoring to evaluate errors, queues and your strategy before Spike 2; changes are optional.`);
      const advice = run("spike-pulses", performance.summary);
      return { ...advice, message: `${performance.summary}${tradeoff} Keep your strategy or make an optional change. Press Run to test it during Spike 2.` };
    }
    const pulsePending = d.deadlines.some((deadline, i) => deadline > c.step &&
      !d.consumed.includes(`spike-${Math.floor(i / 2) + 1}-${i % 2 ? "end" : "start"}`));
    if (d.completedStep === null && pulsePending) {
      // Removing an active cap is optional. Check the announced peak as well as
      // current demand, so the quiet interval does not cause an unsafe ON/OFF loop.
      const demand = Math.max(m.incoming, T.peak), allocation = c.routing.targets.length ? allocateTraffic(demand, c.routing.targets) : {};
      const dbDemand = m.admitted > 0 ? Math.ceil(m.db.demand * demand / m.admitted) : Infinity;
      if (limited && c.dbCapacity >= dbDemand && c.routing.targets.length && c.routing.targets.every(id => {
        const app = c.apps.find(a => a.id === id);
        return app && app.health !== "failed" && app.role !== "spare" && !app.backlog && app.capacity >= allocation[id];
      }) && previewCampaignAction(game, { type: "set_traffic_limit", enabled: false }).ok) {
        const action: GuidanceAction = { action: { type: "set_traffic_limit", enabled: false }, label: "Remove traffic limit", evidence: "Routed capacity fits the announced spike at the observed database workload ratio. Verify service after activation." };
        const advice = hint("spike-unlimit", action.evidence, "Remove the traffic limit, then verify service.", "network");
        return { ...advice, action, message: "Current capacity fits the announced spike. Remove the traffic limit to serve more users, then check your readings.", key: `${advice.key}:${guidanceActionId(action.action)}` };
      }
      const advice = run("spike-pulses", "The announced traffic pulses still need game time to develop or end.");
      const remaining = d.deadlines.find(step => step > c.step)! - c.step;
      return { ...advice, message: limited ? `Keep the limit to protect service; it rejects users. Press Run to observe the next pulse boundary in ${remaining} game seconds.`
        : `Press Run to observe the next pulse boundary in ${remaining} game seconds, then check your readings.` };
    }
    // Earlier diagnosis checks establish healthy service, empty queues and acknowledged
    // reports. Match the remaining baseline-observation conditions, not traffic alone.
    if (d.completedStep === null && c.step >= d.deadlines[3] && game.phase === "management" && c.incomingRate === T.baseline)
      return { ...run("spike-stability", `Both pulses ended. Stable baseline observations: ${d.baselineStableSteps} / 5.`), message: `Both spikes ended. Press Run to verify stability: ${d.baselineStableSteps} of 5 observations.${limited ? " Your limit still rejects requests." : ""}` };
    return hint("requirements", "No remaining traffic pulse or qualifying baseline observation is identified.", "Use View chapters to compare the unfinished Chapter requirements with the current readings.", "requirements");
  }
  if (c.dataStage && !c.dataStage.consumed && canEnterData(game)) return run("data-growth", "The company is ready to observe the scheduled workload increase.");
  if (c.scaling && !c.scaling.consumed) {
    if (c.dbCapacity >= P.dbCapacity || c.scalingConsent) return run("scaling-growth", "Growth preparation is resolved. The next wave requires game time.");
    return result("scaling-choice", previewCampaignAction(game, { type: "accept_scaling_risk" }).ok ? "progression" : null, "The next growth wave needs database headroom or your explicit acceptance of the risk.", "Consider growth with current capacity explains the risk choice. You can Keep preparing instead; opening it does not accept the risk.", "risk");
  }
  if (!c.consumedEvents.includes("opening-growth")) return run("opening-growth", "The first scheduled growth has not arrived yet.");
  if (preventionAvailable(c)) {
    const p = c.openingPrevention;
    if (p?.outcome?.acknowledged) return hint("prevention-recorded", "Prevention was recorded. Its verification and Opening recognition are required before continuing.", "Review Chapter requirements and complete the Opening recognition when it is available.", "requirements");
    const req = preventionRequirements(c);
    if (Object.values(req).every(Boolean)) return run("prevention-stability", `Full-demand service qualifies. Fresh prevention observations: ${p?.stableSteps ?? 0} / 5.`);
    return hint("prevention-inspection", "Opening prevention requires recorded inspections and healthy full-demand service.", !req.applicationInspected ? "Open App Server to inspect the current application." : !req.databaseInspected ? "Open Database to inspect the current workload." : "Open Network to compare admitted and rejected traffic with full-demand requirements.", !req.applicationInspected ? "app" : !req.databaseInspected ? "db" : "network");
  }
  return hint("requirements", "There is no confidently identified next time-dependent requirement.", "Use View chapters to review the journey, and compare Chapter requirements with the latest readings before choosing a response.", "requirements");
}
