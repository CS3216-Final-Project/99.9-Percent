import type { GameState } from "@/sim";
import type { SpikePulse, SpikeStage as Stage } from "@/sim/campaignTypes";
import { gradedSpikes, spikePeak, spikeTestPassed } from "@/sim/autoscaling";
import { GRADED_SPIKES as G } from "@/sim/scenarios/trafficSpikes";

const COPY = {
  prepare: "A traffic spike is coming. Check your capacity, then Run when ready.",
  spike1: "Traffic is rising! Watch how your system handles the increased demand.",
  respond: "Your app is struggling. Pause and inspect the overloaded component.",
  between: "The first spike is over. Check what struggled and prepare for the next one.",
  spike2: "The second spike has started. See whether your changes are working.",
  recover: "Both spikes have finished. Check that your app is stable, then review your results.",
};
export type SpikeStage = Exclude<keyof typeof COPY, "respond">;
const percent = (basisPoints: number) => `${Math.floor(basisPoints / 100)}%`;
export const PASS_SHARE = percent(G.passBasisPoints);
/** Served share of a spike in basis points, rounded down so a near miss never reads as a pass. */
export const servedBasisPoints = (p: Pick<SpikePulse, "served" | "incoming">) => p.incoming ? Math.floor(p.served * 10000 / p.incoming) : 0;
export const servedShare = (p: Pick<SpikePulse, "served" | "incoming">) => percent(servedBasisPoints(p));
/** The spikes whose start, and whose end, the company has already observed. */
function progress(d: Stage) {
  const count = (edge: "start" | "end") => d.consumed.filter(id => id.endsWith(`-${edge}`)).length;
  return { started: count("start"), ended: count("end") };
}
/** Retained observations of the most recently finished spike, deduplicated when an incident report overlaps recent readings. */
export function chapter4Performance(game: GameState) {
  const c = game.campaign, d = c?.spikeStage;
  if (!c || !d) return null;
  const pulse = Math.max(1, progress(d).ended), from = d.deadlines[2 * pulse - 2], to = d.deadlines[2 * pulse - 1];
  const readings = [...new Map([...c.reports.flatMap(r => r.snapshots), ...c.recent]
    .filter(m => m.step >= from && m.step < to).map(m => [m.step, m])).values()];
  const served = readings.reduce((n, m) => n + m.successful, 0), rejected = readings.reduce((n, m) => n + m.rejected, 0);
  const incidents = c.trace.filter(t => t.type === "incident-opened" && t.step >= from && t.step < to).length;
  const appStruggled = readings.some(m => m.app.demand > m.app.capacity || m.instances?.some(a => a.routed && a.demand > a.capacity));
  const dbDemand = Math.max(0, ...readings.map(m => m.db.demand));
  const summary = readings.length ? `Recorded Spike ${pulse}: ${served.toLocaleString("en-US")} served, ${rejected.toLocaleString("en-US")} rejected; ${incidents} incident${incidents === 1 ? "" : "s"} recorded.` : `Spike ${pulse} observations are unavailable.`;
  return { pulse, readings, served, rejected, incidents, appStruggled, dbDemand, summary };
}
/** What a graded company is told at each stage, given the spike it is in or has just finished. */
function gradedCopy(d: Stage, stage: SpikeStage, pulse: number, last: SpikePulse | undefined): { title: string; message: string } {
  const peak = spikePeak(d).toLocaleString("en-US");
  switch (stage) {
    case "prepare": return { title: "Prepare", message: `Two ${peak} req/s spikes are coming. The first is practice. The second is the test: serve at least ${PASS_SHARE} of its requests. Check your capacity, then Run.` };
    case "spike1": return { title: "Practice spike", message: "This spike is practice and is not graded. Watch which part of your system struggles." };
    case "between": return last?.result === "failed"
      ? { title: `Spike ${last.pulse} failed`, message: `Spike ${last.pulse} served ${servedShare(last)} of requests; the test needs ${PASS_SHARE}. Fix what struggled, then Run: Spike ${last.pulse + 1} is the next test.` }
      : { title: "Practice over", message: `${last ? `The practice spike served ${servedShare(last)} of requests. ` : ""}The next spike is the test: serve at least ${PASS_SHARE} of its requests. Prepare, then Run.` };
    case "spike2": return { title: `Spike ${pulse}: the test`, message: `Serve at least ${PASS_SHARE} of this spike's requests to pass. Rejected and failed requests both count against you.` };
    case "recover": return { title: "Test passed", message: `${last ? `Spike ${last.pulse} served ${servedShare(last)} of requests. ` : ""}Keep service stable for five baseline game seconds to finish the chapter.` };
  }
}
/** Presentation of recorded events only; no clock, dispatcher or progression state. */
export function chapter4Stage(game: GameState) {
  const c = game.campaign, d = c?.spikeStage;
  if (!c || !d || c.reliabilityStage || c.combinedStage || d.acknowledged || game.phase === "ended") return null;
  const graded = gradedSpikes(d), { started, ended } = progress(d);
  const pulse = Math.max(1, started);
  // Version 1 ends after its second spike; a graded company stays between spikes until a test passes.
  const stage: SpikeStage = started === 0 ? "prepare" : started > ended ? pulse === 1 ? "spike1" : "spike2"
    : (graded ? spikeTestPassed(d) : ended >= 2) ? "recover" : "between";
  const since = stage === "prepare" ? d.enteredStep : d.deadlines[2 * pulse - (stage === "spike1" || stage === "spike2" ? 2 : 1)];
  const eventId = stage === "prepare" ? null : `spike-${pulse}-${stage === "spike1" || stage === "spike2" ? "start" : "end"}`;
  const event = c.trace.find(t => eventId === null ? t.type === "spike-stage-entered" : t.data.eventId === eventId);
  const overloaded = c.snapshot.db.demand > c.snapshot.db.capacity || !!c.snapshot.instances?.some(x => x.routed && x.demand > x.capacity);
  const performance = stage === "between" ? chapter4Performance(game) : null;
  const last = d.pulses?.filter(p => p.result !== null).at(-1);
  const copy = graded ? gradedCopy(d, stage, pulse, last)
    : { title: ({ prepare: "Prepare", spike1: "Spike 1", between: "Between spikes", spike2: "Spike 2", recover: "Recover" })[stage],
      message: performance?.readings.length ? `Spike 1: ${performance.served.toLocaleString("en-US")} served, ${performance.rejected.toLocaleString("en-US")} rejected. Evaluate capacity and routing; changes are optional. Test your choice in Spike 2.` : COPY[stage] };
  // Graded stages repeat with each retry, so every spike's cue needs an id of its own to appear again.
  const id = graded ? `${stage}-${pulse}` : stage;
  const tone = stage === "prepare" ? "prepare" as const : stage === "between" || stage === "recover" ? "recovery" as const : "pressure" as const;
  const cues: { id: string; title: string; message: string; tone: "prepare" | "pressure" | "recovery" }[] = [{ id, title: copy.title, message: copy.message, tone }];
  if (overloaded && (stage === "spike1" || stage === "spike2")) cues.push({ id: `respond-${id}`, title: "Respond", message: COPY.respond, tone: "pressure" });
  return { stage, pulse, graded, since, eventId: event?.id ?? -1, key: `${c.runId}:${d.enteredStep}`, cues };
}
