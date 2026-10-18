import type { GameState } from "@/sim";
import type { CampaignPostmortem } from "@/sim/campaignTypes";
import { canStartGrowth, pendingCombined } from "@/sim/combinedCampaign";

/** Presentation of recorded progress, never an alternative recovery test. */
export function incidentGuidance(g: GameState, running = true) {
  const c = g.campaign!, incident = c.incident;
  if (!incident) return null;
  const checking = incident.stableSteps > 0;
  const reset = !checking && c.trace.some(e => e.step >= incident.openedStep &&
    e.type === "recovery-streak" && Number(e.data.from) > 0 && Number(e.data.to) === 0);
  const investigate = !checking && !reset && !c.pending.length;
  const message = checking ? running ? "Keep running while we check if your app has recovered." : "Run to continue checking whether your app has recovered."
    : reset ? "Your app has not stayed stable long enough. Compare response time, failed requests and waiting work."
    : c.pending.length ? "Changes are pending. Observe the measurements as they take effect."
    : running ? "Pause to investigate the problem." : "Investigate the problem using the recorded evidence.";
  return { checking, reset, investigate, message, steps: incident.stableSteps };
}

export function growthGuidance(g: GameState, running = false) {
  const c = g.campaign!, d = c.combinedStage;
  if (!d || g.phase === "ended") return null;
  const incident = incidentGuidance(g, running);
  const objective = g.phase === "review" ? "Read the postmortem before continuing your company."
    : d.finalReview ? "Review your final campaign scorecard."
    : pendingCombined(c) ? "Review your latest growth milestone."
    : incident ? incident.checking ? incident.message : "Your app is having trouble. Investigate the recorded evidence."
    : c.limit !== null ? "Your traffic limit is restricting customers. Check whether your app can handle more traffic."
    : c.pending.length ? "Let accepted changes finish, then check full-traffic performance."
    : canStartGrowth(g) ? "Start the next growth wave when you are ready."
    : !running ? "Run your company to see how it handles full traffic."
    : "Keep your app reliable while working toward your remaining growth targets.";
  const key = [c.runId, c.limit, d.completedRounds.length, d.currentRound?.id,
    d.currentRound?.startedStep, d.currentRound?.pressureEndedStep, d.users,
    c.pending.map(a => a.id).join(), d.readinessSteps, d.finalStableSteps,
    d.currentRound?.stableSteps, g.phase, !!d.finalReview].join(":");
  const admissionPending = c.pending.some(a => a.type === "limit" || a.type === "unlimit");
  const hint = admissionPending
    ? { topic: "wait", offer: "A traffic change is waiting to activate. Would you like a hint?",
      text: "A traffic-limit change is already pending. Run to observe it before requesting another change." }
    : c.limit !== null
    ? { topic: "traffic", offer: "Your traffic limit is restricting customers. Would you like a hint about what to do next?",
      text: "To serve all customers, you'll need to remove the traffic limit. Check your infrastructure capacity first." }
    : canStartGrowth(g)
    ? { topic: "wave", offer: "Your company is ready for another growth wave. Would you like a hint?",
      text: "Start next growth wave is now available in System Overview. Prepare first; the wave increases demand." }
    : { topic: "observe", offer: "There are growth targets left to reach. Would you like a hint about how to continue?",
      text: d.currentRound ? "Run to observe the announced wave. After pressure ends, restore all apps, review any incidents and serve five stable full-traffic game seconds."
        : d.completedRounds.length === 3 ? "After all three outcomes are reviewed, serve five more stable full-traffic game seconds with no active promotion to unlock the final scorecard."
        : "Run for five stable full-traffic game seconds to unlock Start next growth wave. Registered users increase when that wave begins; promotions are optional." };
  return { objective, key, hint, manualEligible: g.phase === "management" && !c.incident && !pendingCombined(c) && !d.acknowledged,
    eligible: !running && g.phase === "management" && !c.incident &&
    !pendingCombined(c) && !c.pending.length && !d.acknowledged };
}

/** Short observations only; complete explanations and chronological events stay in disclosures. */
export function postmortemSummary(report: CampaignPostmortem) {
  const first = report.snapshots.find(m => m.step === report.openedStep) ?? report.snapshots[0], last = report.snapshots.at(-1);
  const actions = new Map<string, number>();
  for (const e of report.events) if (e.type === "action-requested" && (e.data.source === undefined || e.data.source === "player")) {
    const type = String(e.data.type); actions.set(type, (actions.get(type) ?? 0) + 1);
  }
  return {
    happened: first ? `At incident opening: response time ${first.latencyMs.toFixed(0)} ms; failed requests ${first.serviceErrorRate === null ? "unavailable" : `${(first.serviceErrorRate * 100).toFixed(2)}%`}; ${first.app.backlog + first.db.backlog} requests waiting.` : "An incident was recorded; earlier measurements are unavailable.",
    actions: [...actions],
    result: `${report.limited ? "Recovery was verified under a traffic limit; some incoming requests were rejected. Full demand was not restored." : "Recovery was verified at full demand."}${last ? ` Final response time: ${last.latencyMs.toFixed(0)} ms.` : ""}`,
    lesson: report.limited ? "A traffic limit reduces admitted work, not infrastructure capacity. Rejected requests differ from failed requests and earn no money."
      : "Compare the recorded changes and measurements. A change made during an incident is not, by itself, proof that it caused recovery.",
  };
}
