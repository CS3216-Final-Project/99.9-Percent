import type { GameState } from "@/sim";
import { campaignGuidance } from "./campaignGuidance";

/** Factual presentation only. Optional recommendations belong to campaignNextStep/Hint. */
export function campaignSituation(game: GameState) {
  const c = game.campaign!, guide = campaignGuidance(game);
  if (game.phase === "ended") return game.outcome === "won" ? "Campaign complete." : "Company closed.";
  if (game.phase === "review") return "Incident postmortem awaiting acknowledgement.";
  if (guide.pendingMilestone) return "Opening milestone awaiting acknowledgement.";
  if (c.incident) return "Active service incident. Recovery is not yet complete.";
  if (guide.pendingAction && !guide.pendingAction.action) return "Chapter outcome awaiting review.";
  if (c.reports.some(r => !c.trace.some(t => t.type === "review-acknowledged" && t.data.incidentId === r.id))) return "A recorded incident report is missing its acknowledgement.";
  if (c.pending.length) return `${c.pending.length} accepted change(s) awaiting activation.`;
  if (guide.pendingAction?.action) return "Progression decision pending.";
  if (c.combinedStage) {
    const d = c.combinedStage, wave = d.currentRound;
    return wave ? wave.startedStep === null ? "Growth wave announced." : wave.pressureEndedStep === null ? "Growth wave active." : `Growth wave pressure ended. Stable baseline observations: ${wave.stableSteps} / 5.`
      : d.completedRounds.length === 3 ? `Final stable observations: ${d.finalStableSteps} / 5.` : `Growth readiness observations: ${d.readinessSteps} / 5.`;
  }
  if (c.reliabilityStage) {
    const fault = c.reliabilityStage.fault;
    return !fault ? "Reliability test not started." : fault.startedStep === null ? "Application failure scheduled."
      : fault.restoredStep === null ? "Application failure active." : "Application restoration recorded.";
  }
  if (c.spikeStage) {
    const [first, firstEnd, second, secondEnd] = c.spikeStage.deadlines;
    return c.step < first ? "First traffic pulse pending." : c.step < firstEnd ? "First traffic pulse active."
      : c.step < second ? "First pulse ended; second pulse pending." : c.step < secondEnd ? "Second traffic pulse active." : "Both traffic pulses ended.";
  }
  if (c.dataStage) return c.dataStage.consumed ? "Data workload growth recorded." : "Data workload growth pending.";
  if (c.scaling) return c.scaling.consumed ? "Scaling growth recorded." : "Scaling growth pending.";
  return c.consumedEvents.includes("opening-growth") ? "Opening growth recorded." : "Opening workload growth pending.";
}
