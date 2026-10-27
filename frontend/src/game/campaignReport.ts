import type { Campaign, CampaignPostmortem, CampaignScorecard, CombinedRound, Snapshot, TraceEvent } from "@/sim/campaignTypes";
import { incidentCause, incidentLesson } from "./campaignPostmortem";
import { verifiedPrevention } from "@/sim/openingPrevention";

/** `responseTitle` replaces "How did you respond?" when the recovery was not the player's doing. */
export interface ReportLesson { happened: string; response: string; responseTitle?: string; improve?: string; takeaway: string }
const names: Record<string, string> = { "upgrade-db": "a database upgrade", "scale-up": "server scaling", "add-app": "an added server", routing: "a routing change", limit: "a traffic limit", unlimit: "removing the traffic limit", cache: "a read cache", "cache-tuning": "cache tuning", "restore-app": "a server restore", "deploy-autoscaler": "an autoscaling controller" };
const list = (items: string[]) => items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The player's own changes and the automatic ones, kept apart so the report credits each truthfully. */
function recordedResponses(events: TraceEvent[], from: number, end: number, firstEventId = 0) {
  const requested = new Map(events.filter(e => e.type === "action-requested").map(e => [e.data.actionId, e.data]));
  const during = events.filter(e => e.step >= from && e.step <= end && e.id >= firstEventId);
  const player = new Set<string>(), automatic = new Set<string>();
  for (const e of during) {
    if (e.type === "action-activated") {
      const request = requested.get(e.data.actionId), type = request?.type;
      // The autoscaler and failover schedule their own changes; only the player's requests are "your" response.
      if (request?.source === "autoscaler") automatic.add("autoscaling added servers and routed traffic to them");
      else if (request?.source !== "failover" && typeof type === "string" && names[type]) player.add(names[type]);
    }
    if (e.type === "failover-activated") automatic.add("Automatic Failover moved traffic to a spare");
    if (e.type === "instance-restored") {
      if (e.data.source === "manual") player.add(names["restore-app"]);
      else automatic.add("the failed server returned on its own");
    }
  }
  // Put lasting capacity/recovery changes before temporary admission toggles.
  const ordered = [...player].sort((a, b) => Number(/traffic limit/.test(a)) - Number(/traffic limit/.test(b)));
  return { player: ordered, automatic: [...automatic] };
}
/** Report observed actions, never infer a purchase from installed equipment. */
function responses(events: TraceEvent[], from: number, end: number, firstEventId = 0) {
  const { player, automatic } = recordedResponses(events, from, end, firstEventId);
  const yours = player.length ? `You responded with ${list(player.slice(0, 3))}${player.length > 3 ? "; other changes are in the evidence" : ""}.` : "";
  const auto = automatic.length ? `${player.length ? " Meanwhile, " + list(automatic) : sentence(list(automatic))}.` : "";
  return yours || auto ? (yours + auto).trim() : "No new corrective action was recorded.";
}
/** "How did you respond?" only when the player actually changed something during the window. */
export function responseTitle(events: TraceEvent[], from: number, end: number) {
  return recordedResponses(events, from, end).player.length ? undefined : "What resolved it?";
}
function tradeoff(samples: Snapshot[]) {
  const incoming = samples.reduce((n, m) => n + m.incoming, 0), rejected = samples.reduce((n, m) => n + m.rejected, 0);
  return incoming > 0 && rejected / incoming >= .1 ? " Many incoming requests were rejected by traffic limiting." : rejected > 0 ? " Some incoming requests were rejected." : "";
}
export function incidentSummary(report: CampaignPostmortem): ReportLesson {
  const lesson = incidentLesson(report);
  return { happened: incidentCause(report), response: responses(report.events, report.openedStep, report.recoveredStep) + tradeoff(report.snapshots),
    responseTitle: responseTitle(report.events, report.openedStep, report.recoveredStep),
    improve: report.limited ? "Check capacity before removing the limit; rejected requests earn no revenue." : lesson.remember,
    takeaway: lesson.learned };
}

export type OutcomeKind = "opening" | "prevention" | "scaling" | "data" | "spikes" | "growth";
/** Scope to the recorded milestone. Historical summaries cannot absorb later decisions. */
export function outcomeSummary(c: Campaign, kind: OutcomeKind, round?: CombinedRound): ReportLesson {
  const prevented = kind === "opening" && c.openingMilestone?.outcomeId === "opening-prevention" && verifiedPrevention(c);
  const recovered = kind === "opening" && !!c.openingMilestone?.incidentId && c.openingRecovered &&
    c.reports.some(r => r.id === c.openingMilestone!.incidentId) && c.trace.some(e => e.type === "review-acknowledged" && e.data.incidentId === c.openingMilestone!.incidentId);
  const markerType = prevented ? "opening-prevention-qualified" : { opening: "milestone-awarded", prevention: "opening-prevention-qualified", scaling: "data-stage-entered", data: "spike-stage-entered", spikes: "traffic-spike-stage-completed", growth: "scenario-completed" }[kind];
  const marker = c.trace.find(e => e.type === markerType && (!round || e.data.roundId === round.id));
  const end = round?.completedStep ?? (kind === "prevention" || prevented ? c.openingPrevention?.outcome?.qualifiedStep : kind === "opening" ? c.openingMilestone?.awardedStep : kind === "spikes" ? c.spikeStage?.completedStep : marker?.step) ?? c.step;
  const from = round?.scheduledStep ?? (kind === "spikes" ? c.spikeStage?.enteredStep : kind === "data" ? c.dataStage?.enteredStep : kind === "scaling" ? c.scaling?.enteredStep : 0) ?? 0;
  const entryTypes: Partial<Record<OutcomeKind, string>> = { scaling: "scaling-stage-entered", data: "data-stage-entered", spikes: "spike-stage-entered", growth: "scenario-scheduled" };
  const entry = c.trace.find(e => e.type === entryTypes[kind] && e.step === from && (!round || e.data.roundId === round.id));
  const events = c.trace.filter(e => e.step <= end && (!marker || e.id <= marker.id));
  const samples = round?.observations ?? (kind === "prevention" || prevented ? c.openingPrevention?.outcome?.snapshots : undefined) ?? [...new Map([...c.reports.flatMap(r => r.snapshots), ...c.recent].filter(m => m.step >= from && m.step <= end).map(m => [m.step, m])).values()];
  const facts: Record<OutcomeKind, [string, string, string]> = {
    opening: [prevented ? "You spotted the bottleneck early and prevented an outage." : recovered ? "You diagnosed an outage and restored your service." : "The Opening outcome is ready for review.", "Leave capacity for the next increase in users.", "Stable service and serving every incoming user are different goals."],
    prevention: ["The first traffic increase was served at full demand without an incident.", "Compare capacity with the next expected demand before expanding.", "Prevention and recovery are both valid ways to complete Opening; acknowledge the recognition to continue."],
    scaling: ["The company met the scaling and routing chapter requirements.", "Check that added servers actually receive traffic before buying more.", "Installed capacity helps only when traffic reaches it."],
    data: ["The company met the database workload chapter requirements.", "Compare read and write pressure before changing the database or cache.", "A cache helps repeated reads; writes still need database capacity."],
    spikes: ["Both traffic spikes ended and baseline service passed its stability checks.", "Compare served and rejected traffic before preparing for another peak.", "A limit protects admitted traffic by turning other users away."],
    growth: ["The accepted growth wave ended and full-demand service passed its stability checks.", "Check healthy routed capacity before accepting another wave.", "More users are an opportunity only when their requests can be served."],
  };
  let [happened, improve, takeaway] = facts[kind];
  if (kind === "growth" && round?.fault?.startedStep != null) happened = "A server failed during the growth wave, and service later stabilised at full demand.";
  else if (kind === "growth" && round?.scenario.template === "write-pressure") {
    happened = "A write-heavy growth wave ended and service stabilised at full demand.";
    improve = "Check database capacity for writes; a read cache cannot remove write traffic.";
  }
  if (kind === "growth" && round?.index === 2) improve = "Compare service at full demand with your final Campaign goals.";
  if (kind === "spikes" && !samples.some(m => m.rejected > 0)) takeaway = "Prepare capacity for peaks, then compare service during and after each spike.";
  let response = responses(events, from, end, entry?.id);
  if (kind === "prevention" && response.startsWith("No new")) response = "Existing capacity handled the increase; no new corrective activation was recorded.";
  if (kind === "growth" && response.startsWith("No new")) response = "Existing infrastructure served the wave; no new corrective activation was recorded.";
  return { happened, response: response + tradeoff(samples), improve, takeaway };
}

export function scorecardSummary(card: CampaignScorecard, pending: boolean): ReportLesson {
  const won = card.outcome === "won";
  return { happened: won ? pending ? "The Campaign objectives are ready for your final review." : "The Campaign objectives were completed." : "The company ran out of cash.",
    response: `${card.incidentCount ? "The recorded journey included service incidents." : "No incidents appear in the retained record."}${card.rejectedDemand ? " Some incoming requests were rejected instead of served." : ""}`,
    improve: won ? "Compare service reliability, rejected traffic and costs when planning your next company." : "Compare operating costs with earned revenue before expanding.",
    takeaway: "Growth, reliable service and sustainable spending must work together." };
}
