import type { Campaign, CampaignPostmortem, TraceEvent } from "./campaignTypes";
export function trace(c: Campaign, type: string, data: TraceEvent["data"] = {}): void {
    c.trace.push({ id: c.nextEventId++, step: c.step, type, data });
}
/** Keep old observations in their original aggregate format; do not invent per-instance evidence. */
export function retainFoundationTrace(c: Campaign, start: number): void {
    const keys: Record<string,string[]> = {
        "action-requested":["actionId","type","costCents","activationStep"],
        "action-activated":["actionId","dbBefore","dbAfter","appBefore","appAfter","admittedBefore","admittedAfter"],
        "incident-opened":["incidentId","component"],
        inspection:["component","snapshotStep","snapshot"],
        settlement:["period","revenueCents","appCents","dbCents","salaryCents","netCents"]
    };
    for(const e of c.trace.slice(start))if(keys[e.type])e.data=Object.fromEntries(Object.entries(e.data).filter(([key])=>keys[e.type].includes(key)));
}
export function causalPostmortem(c: Campaign): CampaignPostmortem {
    const inc = c.incident!;
    const snapshots = inc.snapshots;
    const start = snapshots[0];
    const episodeStart = c.reports.at(-1)?.recoveredStep ?? 0;
    const events = c.trace.filter(e => e.step >= episodeStart);
    const opening = snapshots.find(m => m.step === inc.openedStep)!;
    const demandEvent = events.filter(e => e.step <= inc.openedStep && (e.type === "traffic-change" || e.type === "action-activated")).at(-1);
    const primary = inc.primaryComponent ?? "db";
    const constraint = primary === "db" ? opening.db : opening.instances!.find(a=>a.id===primary)!;
    const explanations = [
        !opening.instances ? `At step ${inc.openedStep}, database demand was ${opening.db.demand} ops/s against ${opening.db.capacity} ops/s capacity. Three consecutive overloaded steps opened the incident.` :
            `At step ${inc.openedStep}, ${primary === "db" ? "database" : primary.replace("app-","App ")} demand was ${constraint.demand} ${primary==="db"?"ops/s":"requests/s"} against ${constraint.capacity} capacity. Three consecutive overloaded steps on this component opened the incident.`,
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
        else if (action.type === "routing" || action.type === "scale-up")
            explanations.push(`${action.type === "routing" ? "Routing changed" : `Capacity changed for ${action.targetId}`} at step ${effect.step}: effective routed capacity ${d.effectiveBefore} to ${d.effectiveAfter}. ${d.measuredRelief ? "The same-step comparison without this change had more queued work or higher latency; this contributed to recovery." : "The same-step comparison found no measured relief from this change; it is not credited with clearing queues."} Database capacity remained ${d.dbAfter} ops/s.`);
        else if (Number(d.appAfter) > Number(d.appBefore))
            explanations.push(!opening.instances ? "Installed application capacity increased, but routed capacity and database demand/capacity did not change. This investment did not relieve the database constraint." : "Installed application capacity increased, but the added application remained unrouted. Routed capacity did not change; installation alone did not relieve the active constraint.");
        else if (action.type === "deploy-lb")
            explanations.push("Load balancing was deployed; routing remained unchanged until an explicit routing configuration activated.");
        else
            explanations.push(`${action.type} changed admission without increasing database capacity.`);
    }
    if (events.some(e => e.type === "action-activated" && events.some(other => other !== e && other.type === "action-activated" && other.step === e.step)))
        explanations.push("Multiple changes activated on the same step; the observed backlog change does not isolate their individual effects.");
    explanations.push(!opening.instances ? `Backlog changed from ${start?.db.backlog ?? 0} to ${c.snapshot.db.backlog}; latency from ${start?.latencyMs ?? 100} to ${c.snapshot.latencyMs} ms. Five consecutive steps met recovery thresholds.` : `Application/database backlog changed from ${start?.app.backlog ?? 0}/${start?.db.backlog ?? 0} to ${c.snapshot.app.backlog}/${c.snapshot.db.backlog}; latency from ${start?.latencyMs ?? 100} to ${c.snapshot.latencyMs} ms. Five consecutive steps met recovery thresholds. Latency is a gameplay approximation based on the largest per-instance queue and database queue.`);
    explanations.push(c.limit === null ? "Full incoming demand is admitted. Compare dependency headroom before future traffic growth." : "Recovery retains the traffic limit. Rejected demand earns no revenue; inspect available capacity before removing the limit.");
    return {
        id: inc.id, openedStep: inc.openedStep, recoveredStep: c.step,
        snapshots, events, explanations, limited: c.limit !== null,
        setupCents: c.actions.filter(a => a.requestedStep >= episodeStart && a.requestedStep <= c.step).reduce((n, a) => n + a.costCents, 0)
    };
}
