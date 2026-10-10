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
    const workloadEvent=events.filter(e=>e.type==="workload-changed"&&e.step<=inc.openedStep).at(-1);
    const primary = inc.primaryComponent ?? "db";
    const constraint = primary === "db" ? opening.db : opening.instances!.find(a=>a.id===primary)!;
    const explanations = [
        `At step ${inc.openedStep}, ${primary === "db" ? "database" : primary} demand was ${constraint.demand} ${primary==="db"?"ops/s":"requests/s"} against ${constraint.capacity} capacity. Three consecutive overloaded steps on this component opened the incident.`,
        opening.data&&workloadEvent?`Workload changed to ${workloadEvent.data.profile} at step ${workloadEvent.step}; compare logical work and uncached DB demand with capacity.`:events.some(e => e.type === "traffic-change") ? "The recorded traffic increase initiated the overload." :
            `The incident followed an admission or capacity change at step ${demandEvent?.step ?? start?.step}; compare its recorded effect with the opening metrics.`,
    ];
    if(opening.data) {
        const w=opening.data;
        explanations.push(`Workload ${w.profile}: ${w.readShare/100}% reads, ${(10000-w.readShare)/100}% writes; ${w.cacheableReadShare/100}% of reads eligible. Raw logical demand ${w.logical}; hits ${w.hits}, eligible misses ${w.eligibleMisses}; DB demand ${w.databaseNewDemand} ops/s.`);
        const last=c.snapshot.data!;
        explanations.push(`Cache effective hit rate used ${last.effectiveHitRateUsed/100}%; warmth after work ${last.warmthAfterStep/100}%. Hits ${last.hits}, writes ${last.writes}, non-cacheable reads ${last.nonCacheableReads}; these writes, reads and misses still reach DB. Capacity ${c.dbCapacity} ops/s. Cache reduces only new demand, never old backlog.`);
    }
    for (const action of c.actions.filter(a => a.requestedStep <= c.step && (a.activatedStep === null || a.activatedStep >= episodeStart))) {
        const effect = events.find(e => e.type === "action-activated" && e.data.actionId === action.id);
        if (!effect) {
            if (action.activatedStep === null)
                explanations.push(`${action.type} is pending and has not contributed to recovery.`);
            continue;
        }
        const d = effect.data;
        const before = snapshots.filter(m=>m.step<effect.step).at(-1);
        const after = snapshots.find(m=>m.step===effect.step);
        const relieved = before && after && (after.app.backlog+after.db.backlog < before.app.backlog+before.db.backlog || after.latencyMs < before.latencyMs);
        if (Number(d.dbAfter) > Number(d.dbBefore))
            explanations.push(`Database capacity increased from ${d.dbBefore} to ${d.dbAfter} ops/s. ${relieved?"Recorded backlog or latency fell after activation.":"Compare the recorded subsequent drainage; capacity alone is not recovery."}`);
        else if (Number(d.admittedAfter) < Number(d.admittedBefore))
            explanations.push(`Admitted demand fell from ${d.admittedBefore} to ${d.admittedAfter} requests/s, enabling drainage while rejecting demand.`);
        else if(action.type==="cache"||action.type==="cache-tuning")
            explanations.push(`${action.type} activated at step ${effect.step}; target ${Number(d.cacheTarget)/100}%. Warm-up and eligible reads determine actual hits; writes and non-cacheable reads continue to DB. Compare recorded demand rather than treating activation as recovery.`);
        else if (action.type === "routing" || action.type === "scale-up")
            explanations.push(`${action.type === "routing" ? "Routing changed" : `Capacity changed for ${action.targetId}`} at step ${effect.step}: effective routed capacity ${d.effectiveBefore} to ${d.effectiveAfter}. ${relieved?"Recorded backlog or latency fell after activation; this contributed to recovery.":"No immediate measured relief at activation; inspect subsequent per-instance evidence."} Database capacity remained ${d.dbAfter} ops/s. Application scaling does not directly reduce DB work; increased application processing may increase DB pressure.`);
        else if (Number(d.appAfter) > Number(d.appBefore))
            explanations.push("Installed application capacity increased, but the added application remained unrouted. Routed capacity did not change; installation alone did not relieve the active constraint.");
        else if (action.type === "deploy-lb")
            explanations.push("Load balancing was deployed; routing remained unchanged until an explicit routing configuration activated.");
        else
            explanations.push(`${action.type} changed admission without increasing database capacity.`);
    }
    explanations.push(`Application/database backlog changed from ${start?.app.backlog ?? 0}/${start?.db.backlog ?? 0} to ${c.snapshot.app.backlog}/${c.snapshot.db.backlog}; latency from ${start?.latencyMs ?? 100} to ${c.snapshot.latencyMs} ms. Five consecutive steps met recovery thresholds. Latency is a gameplay approximation based on the largest per-instance queue and database queue.`);
    explanations.push(c.limit === null ? "Full incoming demand is admitted. Compare dependency headroom before future traffic growth." : "Recovery retains the traffic limit. Rejected demand earns no revenue; inspect available capacity before removing the limit.");
    return {
        id: inc.id, openedStep: inc.openedStep, recoveredStep: c.step,
        snapshots, events, explanations, limited: c.limit !== null,
        setupCents: c.actions.filter(a => a.requestedStep >= episodeStart && a.requestedStep <= c.step).reduce((n, a) => n + a.costCents, 0)
    };
}
