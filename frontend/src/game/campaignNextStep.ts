import type { GameState } from "@/sim";
import { qualifiesForRecovery } from "@/sim/step";
import { previewCampaignAction } from "./campaignFinance";
import { campaignGuidance } from "./campaignGuidance";
import { growthGuidance, incidentGuidance } from "./campaignFeedback";
import { canEnterReliability } from "@/sim/reliability";
import { APPLICATION_SCALING } from "@/sim/scenarios/applicationScaling";

export type HintTarget = "run" | "app" | "db" | "cache" | "gateway" | "routing" | "risk" | "progression" | "next" | "review" | "traffic";

/** Read-only advice. A stage key changes with objectives, never with counters or timer ticks. */
export function campaignNextStep(g: GameState, running = false) {
  const c = g.campaign!, guide = campaignGuidance(g);
  const chapter = c.combinedStage ? "combined" : c.reliabilityStage ? "reliability" : c.spikeStage ? "spikes" : c.dataStage ? "data" : c.scaling ? "scaling" : "opening";
  const result = (stage: string, message: string, target: HintTarget | null, automatic = true) => {
    const decision = target === "risk" || target === "progression" || target === "next";
    return {
    key: `${c.runId}:${chapter}:${stage}`, message, target,
    runAllowed: target === "run", manualEligible: g.phase !== "ended",
    eligible: automatic && !running && (g.phase === "management" || g.phase === "incident") && !c.pending.length,
    decision,
  }; };
  if (g.phase === "ended") return result("ended", "Review the final company evidence.", null, false);
  if (g.phase === "review") return result("postmortem", "Review the incident postmortem before continuing your company.", "review", false);
  if (guide.pendingMilestone) return result("milestone", "Review your Opening milestone to continue.", "review", false);
  if (c.incident) {
    const incident = incidentGuidance(g, running)!;
    if (incident.checking) return result(`incident:${c.incident.id}:verification`, incident.message, "run", false);
    if (c.pending.length) return result(`incident:${c.incident.id}:activation`, running ? "Keep running to observe the accepted changes and recovery measurements." : "Run your company to activate the accepted changes, then check recovery measurements.", "run", false);
    const m = c.snapshot;
    if (c.apps.some(a => a.health === "failed")) return result(`incident:${c.incident.id}:health`, "Inspect application health and surviving routed capacity. Health checks detect failure; a real healthy spare or manual restoration provides a response.", "app");
    if (m.app.demand > m.app.capacity && c.apps.some(a => !a.routed && a.role !== "spare")) return result(`incident:${c.incident.id}:routing`, c.loadBalancer ? "Some installed servers aren't receiving traffic. Check routing to distribute work across them." : "Some installed servers aren't receiving traffic. Inspect application routing; distributing traffic requires deployed load balancing.", c.loadBalancer ? "routing" : "app");
    if (m.db.demand > m.db.capacity || m.db.backlog > 0) return result(`incident:${c.incident.id}:database`, "Your database has more work than it can clear. Compare database demand, capacity and backlog before choosing a response. Cache hits reduce eligible reads; writes still reach the database.", "db");
    return result(`incident:${c.incident.id}:application`, "Compare application demand, routed capacity, per-server load and waiting work. Inspect the evidence before choosing a change.", "app");
  }
  // Reviews/entry decisions are authoritative existing controls, not new completion gates.
  if (guide.pendingAction) {
    const a = guide.pendingAction.action;
    if (!a) return result("outcome", `Your outcome is ready. ${guide.pendingAction.label} to continue.`, "review", false);
    if (a.type === "arm_reliability" && c.pending.length) return result("test-installing", running ? "Keep running while accepted changes finish before starting the reliability test." : "Run your company to finish accepted changes before starting the reliability test.", "run", false);
    if (a.type === "arm_reliability" && !previewCampaignAction(g, a).ok) {
      return result("test-not-ready", "Inspect service and waiting work. The reliability test needs stable management, empty queues and acknowledged reports.", "app");
    }
    if (a.type === "start_growth_wave") return result("decision:start_growth_wave", "Start next growth wave is available. Growth waves bring registered users and increase demand; check capacity before starting. Promotions are optional.", "progression");
    return result(`decision:${a.type}`, a.type === "arm_reliability" ? "Prepare if you wish, then start the reliability test to observe an application failure." : `${guide.pendingAction.label} is available. Continue when you are ready, or keep preparing.`, a.type.startsWith("enter_") ? "next" : "progression");
  }
  if (c.reports.some(r => !c.trace.some(t => t.type === "review-acknowledged" && t.data.incidentId === r.id))) return result("unreviewed", "A recorded report lacks acknowledgement. Inspect History; if no review is available, export company evidence for investigation.", null, false);
  if (c.pending.length) return result("activation", running ? "Keep running to observe accepted changes as they activate." : "Run your company to activate accepted changes, then inspect the results.", "run", false);
  if (canEnterReliability(g)) return result("decision:enter_reliability", "Your spike outcome is reviewed. Continue to Stay Online when you are ready.", "next");
  if ((c.spikeStage || c.reliabilityStage) && !c.apps.some(a => a.health === "failed")) {
    const m = c.snapshot;
    if (m.db.demand > m.db.capacity || m.db.backlog > 0 || m.db.failed > 0) return result("database-pressure", "Inspect database demand, capacity and waiting work. Stable observations need healthy service and empty queues; application autoscaling does not increase database capacity.", "db");
    if (m.app.demand > m.app.capacity || m.app.backlog > 0 || m.app.failed > 0) return result("application-pressure", "Inspect application demand, routed capacity and waiting work. Stable observations need healthy service and empty queues.", c.loadBalancer && c.apps.some(a => !a.routed && a.role !== "spare") ? "routing" : "app");
    if (!qualifiesForRecovery(m)) return result("service-evidence", "Inspect response time and failed requests before continuing verification. A stable observation needs healthy service with admitted traffic and completed requests.", "app");
  }
  if (c.combinedStage) {
    const d = c.combinedStage, growth = growthGuidance(g, running)!;
    return result(c.limit !== null ? "limited" : d.currentRound ? `wave:${d.currentRound.id}:${d.currentRound.pressureEndedStep === null ? "pressure" : "baseline"}` : `readiness:${d.completedRounds.length}`, c.limit !== null ? "Your traffic limit is restricting customers. Check your infrastructure capacity first, then consider Remove traffic limit to serve full demand." : growth.hint.text, c.limit !== null ? "traffic" : "run");
  }
  if (c.reliabilityStage) {
    const d = c.reliabilityStage, f = d.fault;
    if (f?.startedStep === null) return result("fault-scheduled", running ? "Keep running to observe the scheduled application failure." : "Run your company to observe the scheduled application failure.", "run");
    if (f && f.restoredStep === null) {
      const inspected = c.trace.some(e => e.type === "inspection" && e.data.component === "app" && e.step >= f.startedStep!);
      return result(inspected ? "failure-observed" : "failure", inspected ? `${running ? "Keep running" : "Run your company"} to observe scheduled natural restoration, or choose a manual response after comparing surviving capacity.` : "Inspect application health and surviving routed capacity. You can restore the failed app manually or observe its scheduled natural restoration.", inspected ? "run" : "app");
    }
    if (d.acknowledged && c.limit !== null) return result("limited", "The reliability outcome is reviewed. Inspect capacity before removing the traffic limit to prepare for full-demand growth.", "traffic");
    const left = Math.max(0, 5 - d.stableSteps);
    return result("stable", `${left === 1 ? "One more stable observation is" : `${left} stable observations are`} needed. ${running ? "Keep running" : "Run your company"} to verify stable service after restoration.`, "run");
  }
  if (c.spikeStage) {
    const d = c.spikeStage;
    if (c.step < d.deadlines[0]) return result("first-pulse", running ? "Your company is running. Watch for the upcoming traffic increase." : "Run your company to observe the first traffic spike.", "run");
    if (c.step < d.deadlines[1] || c.step >= d.deadlines[2] && c.step < d.deadlines[3]) {
      const pulse = c.step < d.deadlines[1] ? 1 : 2;
      const inspected = c.trace.some(e => e.type === "inspection" && e.step >= d.deadlines[pulse === 1 ? 0 : 2]);
      return result(`pulse-${pulse}${inspected ? ":observed" : ""}`, inspected ? `${running ? "Keep running" : "Run your company"} to observe the traffic spike response. Compare routed application capacity and database pressure as demand changes.` : "Traffic has increased. Check application demand, routed capacity and database pressure to see whether your infrastructure can handle it.", inspected ? "run" : "app");
    }
    if (c.step < d.deadlines[2]) return result("between-pulses", `The first spike has ended. ${running ? "Keep running" : "Run your company"} to observe the next.`, "run");
    const left = Math.max(0, 5 - d.baselineStableSteps);
    return result("baseline", `Both traffic spikes are over. ${left === 1 ? "One more stable observation is" : `${left} stable observations are`} needed. ${running ? "Keep running" : "Run your company"} to verify stable service at normal traffic.`, "run");
  }
  if (c.scaling && !c.scaling.consumed && c.dbCapacity < APPLICATION_SCALING.dbCapacity && !c.scalingConsent) return result("headroom", "Prepare database headroom, or consider growth with current capacity to review the risk. Taking that risk is optional.", "risk");
  if (guide.prevention && !c.openingPrevention?.outcome?.acknowledged) {
    if (c.limit !== null) return result("prevention-limited", "Prevention requires serving the full 800 req/s. Inspect capacity before removing the traffic limit; rejected requests do not qualify as full-demand service.", "traffic");
    const inspection = guide.incomplete.find(r => r.id === "app-inspection" || r.id === "db-inspection");
    if (inspection) return result(inspection.id, `Inspect the ${inspection.id === "db-inspection" ? "Database" : "Application"} after growth to compare demand and capacity.`, inspection.id === "db-inspection" ? "db" : "app");
  }
  if (c.openingPrevention?.outcome?.acknowledged && !c.openingMilestone) return result("prevention-recorded", "Your prevention outcome is recorded. Current Campaign rules keep this company in Opening; prevention does not unlock Scaling. You can inspect and experiment without another purchase.", null, false);
  if (c.snapshot.db.demand > c.snapshot.db.capacity || c.snapshot.db.backlog > 0) return result("database-pressure", "Compare database demand, capacity, read/write composition and backlog. Check measured cache hits before choosing a response; caching helps eligible reads, while writes still reach the database.", "db");
  if (c.snapshot.app.demand > c.snapshot.app.capacity && c.apps.some(a => !a.routed && a.role !== "spare") && c.loadBalancer) return result("routing-pressure", "You have extra application servers, but they're not receiving traffic. Check your routing configuration and compare routed capacity with demand.", "routing");
  if (!qualifiesForRecovery(c.snapshot) || c.dbBacklog || c.apps.some(a => a.backlog)) return result("inspect", "Compare component demand, capacity and waiting work before running further. Use the Database and Servers evidence to choose a response.", c.dbBacklog ? "db" : "app");
  return result("observe", running ? "Keep running to observe workload growth and measured service." : "Run your company to observe workload growth and measured service.", "run");
}
