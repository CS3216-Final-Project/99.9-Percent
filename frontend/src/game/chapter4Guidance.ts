import type { GameState } from "@/sim";

const COPY = {
  prepare: "A traffic spike is coming. Check your capacity, then Run when ready.",
  spike1: "Traffic is rising! Watch how your system handles the increased demand.",
  respond: "Your app is struggling. Pause and inspect the overloaded component.",
  between: "The first spike is over. Check what struggled and prepare for the next one.",
  spike2: "The second spike has started. See whether your changes are working.",
  recover: "Both spikes have finished. Check that your app is stable, then review your results.",
};
export type SpikeStage = Exclude<keyof typeof COPY, "respond">;
/** Presentation of recorded events only; no clock, dispatcher or progression state. */
export function chapter4Stage(game: GameState) {
  const c = game.campaign, d = c?.spikeStage;
  if (!c || !d || c.reliabilityStage || c.combinedStage || d.acknowledged || game.phase === "ended") return null;
  const events = d.consumed;
  const stage: SpikeStage = events.includes("spike-2-end") ? "recover" : events.includes("spike-2-start") ? "spike2"
    : events.includes("spike-1-end") ? "between" : events.includes("spike-1-start") ? "spike1" : "prepare";
  const since = stage === "prepare" ? d.enteredStep : d.deadlines[{ spike1: 0, between: 1, spike2: 2, recover: 3 }[stage]];
  const event = c.trace.find(t => stage === "prepare" ? t.type === "spike-stage-entered"
    : t.data.eventId === ({ spike1: "spike-1-start", between: "spike-1-end", spike2: "spike-2-start", recover: "spike-2-end" })[stage]);
  const overloaded = c.snapshot.db.demand > c.snapshot.db.capacity || !!c.snapshot.instances?.some(x => x.routed && x.demand > x.capacity);
  const cues: { id: string; title: string; message: string }[] = [{ id: stage, title: ({ prepare: "Prepare", spike1: "Spike 1", between: "Between spikes", spike2: "Spike 2", recover: "Recover" })[stage], message: COPY[stage] }];
  if (overloaded && (stage === "spike1" || stage === "spike2")) cues.push({ id: `respond-${stage}`, title: "Respond", message: COPY.respond });
  return { stage, since, eventId: event?.id ?? -1, key: `${c.runId}:${d.enteredStep}`, cues };
}
