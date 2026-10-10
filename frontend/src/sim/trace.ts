import type { Campaign, CampaignPostmortem, TraceEvent } from "./campaignTypes";
export function trace(c: Campaign, type: string, data: TraceEvent["data"] = {}): void {
    c.trace.push({ id: c.nextEventId++, step: c.step, type, data });
}
export function causalPostmortem(c: Campaign): CampaignPostmortem {
    const inc = c.incident!;
    const snapshots = inc.snapshots;
    const start = snapshots[0];
    const episodeStart = c.reports.at(-1)?.recoveredStep ?? 0;
    const events = c.trace.filter(e => e.step >= episodeStart);
    const opening = snapshots.find(m => m.step === inc.openedStep)!;
    const demandEvent = events.filter(e => e.step <= inc.openedStep && (e.type === "traffic-change" || e.type === "action-activated")).at(-1);
    const explanations = [
        `At step ${inc.openedStep}, database demand was ${opening.db.demand} ops/s against ${opening.db.capacity} ops/s capacity. Three consecutive overloaded steps opened the incident.`,
        events.some(e => e.type === "traffic-change") ? "The recorded traffic increase initiated the overload." :
            `The incident followed an admission or capacity change at step ${demandEvent?.step ?? start?.step}; compare its recorded effect with the opening metrics.`,
    ];
    for (const action of c.actions.filter(a => a.requestedStep <= c.step && (a.activatedStep === null || a.activatedStep >= episodeStart))) {
        const effect = events.find(e => e.type === "action-activated" && e.data.actionId === action.id);
        if (!effect) {
            if (action.activatedStep === null)
                explanations.push(`${action.type} is pending and has not contributed to recovery.`);
            continue;
        }
        const d = effect.data;
        const before = snapshots.find(m => m.step === effect.step - 1) ?? c.recent.find(m => m.step === effect.step - 1);
        const after = snapshots.find(m => m.step === effect.step) ?? c.recent.find(m => m.step === effect.step);
        const drainage = before && after && before.db.backlog > after.db.backlog
            ? `Database backlog fell from ${before.db.backlog} to ${after.db.backlog} at activation (step ${effect.step}).`
            : before?.db.backlog === 0
                ? "Database backlog was already zero before activation; this change is not credited with clearing it."
                : "No database backlog drainage was observed at activation; this change is not credited with clearing it.";
        if (Number(d.dbAfter) > Number(d.dbBefore))
            explanations.push(`Database capacity increased from ${d.dbBefore} to ${d.dbAfter} ops/s. ${drainage}`);
        else if (Number(d.admittedAfter) < Number(d.admittedBefore))
            explanations.push(`Admitted demand fell from ${d.admittedBefore} to ${d.admittedAfter} requests/s, rejecting demand. ${drainage}`);
        else if (Number(d.appAfter) > Number(d.appBefore))
            explanations.push("Installed application capacity increased, but routed capacity and database demand/capacity did not change. This investment did not relieve the database constraint.");
        else
            explanations.push(`${action.type} changed admission without increasing database capacity.`);
    }
    if (events.some(e => e.type === "action-activated" && events.some(other => other !== e && other.type === "action-activated" && other.step === e.step)))
        explanations.push("Multiple changes activated on the same step; the observed backlog change does not isolate their individual effects.");
    explanations.push(`Backlog changed from ${start?.db.backlog ?? 0} to ${c.snapshot.db.backlog}; latency from ${start?.latencyMs ?? 100} to ${c.snapshot.latencyMs} ms. Five consecutive steps met recovery thresholds.`);
    explanations.push(c.limit === null ? "Full incoming demand is admitted. Compare dependency headroom before future traffic growth." : "Recovery retains the traffic limit. Rejected demand earns no revenue; inspect available capacity before removing the limit.");
    return {
        id: inc.id, openedStep: inc.openedStep, recoveredStep: c.step,
        snapshots, events, explanations, limited: c.limit !== null,
        setupCents: c.actions.filter(a => a.requestedStep >= episodeStart && a.requestedStep <= c.step).reduce((n, a) => n + a.costCents, 0)
    };
}
