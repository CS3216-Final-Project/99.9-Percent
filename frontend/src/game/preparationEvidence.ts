import type { Campaign, Snapshot } from "@/sim/campaignTypes";

/** Observations, not counterfactual claims. Missing retained evidence produces no claim. */
export function preparationEvidence(c: Campaign, chapter: "scaling" | "data" | "spikes" | "reliability") {
  const stage = chapter === "scaling" ? c.scaling : chapter === "data" ? c.dataStage : chapter === "spikes" ? c.spikeStage : c.reliabilityStage;
  if (!stage) return null;
  const end = chapter === "spikes" ? c.spikeStage?.completedStep : chapter === "reliability" ? c.reliabilityStage?.completedStep : undefined;
  const snapshots = new Map<number, Snapshot>();
  for (const m of [...c.reports.flatMap(r => r.snapshots), ...c.recent, c.snapshot]) {
    if (m.step > stage.enteredStep && (end == null || m.step <= end)) snapshots.set(m.step, m);
  }
  const observations = [...snapshots.values()].sort((a,b) => a.step - b.step);
  const challengeStep = chapter === "spikes" ? c.spikeStage!.deadlines[0]
    : chapter === "reliability" ? c.reliabilityStage!.fault?.startStep ?? stage.enteredStep
    : c.trace.find(e => e.data.eventId === (chapter === "data" ? "data-growth" : "scaling-growth") && (e.type === "workload-changed" || e.type === "traffic-change"))?.step ?? stage.enteredStep;
  const changed = c.actions.some(a => a.requestedStep >= challengeStep && a.requestedStep <= (end ?? c.step) && a.source !== "autoscaler" && a.source !== "failover");
  const notes: string[] = [];
  if (chapter === "data") {
    const m = observations.find(m => m.data?.deployed && m.data.hits > 0);
    if (m) notes.push(`At step ${m.step}, your cache served ${m.data!.hits} eligible reads. Database new demand was ${m.data!.databaseNewDemand} ops/s; writes and misses still reached the database.`);
    const adequate = observations.find(m => m.incoming === 2400 && m.rejected === 0 && m.db.demand <= m.db.capacity && m.db.backlog === 0 && m.db.failed === 0);
    if (adequate) notes.push(`At step ${adequate.step}, database demand was ${adequate.db.demand} against ${adequate.db.capacity} ops/s capacity, with no database backlog. Another database upgrade was not needed for this observed workload.`);
  } else if (chapter === "spikes") {
    const m = observations.find(m => m.spikes?.activePulse && m.rejected === 0 && m.app.demand <= m.app.capacity && !m.app.backlog && !m.app.failed && m.instances?.every(a => !a.routed || a.demand <= a.capacity));
    if (m) notes.push(`During pulse ${m.spikes!.activePulse} at game second ${m.step}, admitted application demand was ${m.app.demand} against ${m.app.capacity} req/s routed capacity, with no application backlog. Routed capacity handled this observation.`);
    const joined = c.actions.find(a => a.type === "routing" && a.source === "autoscaler" && a.requestedStep >= stage.enteredStep && a.activatedStep !== null && a.activatedStep <= (end ?? c.step));
    const added = c.actions.find(a => a.type === "add-app" && a.source === "autoscaler" && a.activatedStep !== null && a.requestedStep >= stage.enteredStep && joined?.routing?.targets.includes(a.targetId!));
    if (joined && added) notes.push(`Autoscaling installed ${added.targetId?.replace("app-", "App ")} at game second ${added.activatedStep}; automatic routing included it at game second ${joined.activatedStep}, after provisioning and routing delays. It added application capacity, not database capacity.`);
    else if (c.spikeStage?.researchSpent && !c.spikeStage.controller) notes.push("Autoscaling was researched but no controller was deployed. Research alone added no application capacity.");
  } else if (chapter === "reliability") {
    const f = c.reliabilityStage?.fault;
    const m = f && observations.find(m => m.step >= f.startedStep! && (f.restoredStep === null || m.step < f.restoredStep) && m.instances?.some(a => a.health === "failed") && m.reliability && m.reliability.healthyRoutedCapacity >= m.admitted && m.successful > 0);
    if (m) notes.push(`At step ${m.step}, a server was failed while healthy routed capacity was ${m.reliability!.healthyRoutedCapacity} req/s for ${m.admitted} admitted req/s. Healthy servers continued completing requests. This observation alone does not prove uninterrupted service throughout the test.`);
    if (c.reliabilityStage?.owned.includes("health_checks") && c.reliabilityStage.checksStep === null) notes.push("Health Checks were researched but not deployed. Research alone did not detect failed servers or create redundancy.");
  } else {
    const m = observations.find(m => m.incoming === 1400 && m.rejected === 0 && m.app.demand <= m.app.capacity && !m.app.backlog && !m.db.backlog);
    if (m) notes.push(`At step ${m.step}, application demand was ${m.app.demand} against ${m.app.capacity} req/s routed capacity. Installed capacity helps only when traffic reaches it; vertical scaling is also a valid strategy.`);
  }
  if (!notes.length) return null;
  const rejected = observations.some(m => m.rejected > 0);
  return { title: !changed ? "Your existing preparation: recorded evidence" : "What your infrastructure demonstrated", notes,
    caveat: `${rejected ? "Some observed traffic was rejected. This is not evidence of full-demand service. " : ""}These are recorded observations, not proof that one investment caused the entire outcome.` };
}
