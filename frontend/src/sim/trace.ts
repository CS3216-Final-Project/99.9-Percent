import type { Campaign, CampaignPostmortem, TraceEvent } from "./campaignTypes";
import { currentFault } from "./combinedCampaign";
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
    const demandEvent = events.filter(e => e.step <= inc.openedStep && (e.type === "traffic-change" || e.type === "traffic-spike-started" || e.type === "traffic-spike-ended" || e.type === "action-activated")).at(-1);
    const spikeEvent=events.filter(e=>e.type==="traffic-spike-started"&&e.step<=inc.openedStep).at(-1);
    const workloadEvent=events.filter(e=>e.type==="workload-changed"&&e.step<=inc.openedStep).at(-1);
    const primary = inc.primaryComponent ?? "db";
    const constraint = primary === "db" ? opening.db : opening.instances!.find(a=>a.id===primary)!;
    const explanations = [
        inc.kind==="application-failure"?`At step ${inc.openedStep}, three consecutive steps of failure-attributed request losses opened an application-failure incident. Detection and promotion are separate delayed effects.`:!opening.instances ? `At step ${inc.openedStep}, database demand was ${opening.db.demand} ops/s against ${opening.db.capacity} ops/s capacity. Three consecutive overloaded steps opened the incident.` :
            `At step ${inc.openedStep}, ${primary === "db" ? "database" : primary.replace("app-","App ")} demand was ${constraint.demand} ${primary==="db"?"ops/s":"requests/s"} against ${constraint.capacity} capacity. Three consecutive overloaded steps on this component opened the incident.`,
        inc.kind==="application-failure"?"The recorded application failure reduced useful capacity without increasing incoming traffic. Compare actual health, detection and configured/effective recipients.":opening.spikes?.activePulse&&spikeEvent?`Temporary demand pulse ${spikeEvent.data.pulse} began at step ${spikeEvent.step}, changing incoming traffic to ${spikeEvent.data.to} req/s; compare admitted demand and each dependency.`:opening.data&&workloadEvent?`Workload changed to ${workloadEvent.data.profile} at step ${workloadEvent.step}; compare logical work and uncached DB demand with capacity.`:events.some(e => e.type === "traffic-change") ? "The recorded traffic increase initiated the overload." :
            `The incident followed an admission or capacity change at step ${demandEvent?.step ?? start?.step}; compare its recorded effect with the opening metrics.`,
    ];
    const fault=currentFault(c);
    // Only a fault that was still unrestored during this episode explains it.
    if(fault?.startedStep!==null&&fault&&fault.startedStep<=c.step&&(fault.restoredStep===null||fault.restoredStep>=episodeStart)) {
        const name=(id:string)=>`App ${id.slice(4)}`;
        explanations.push(`${name(fault.targetId)} failed at step ${fault.startedStep}. Failed recipients process no work; retained queues remain until restoration. Health checking detects failure but creates no capacity. A spare helps only when routed.`);
        for(const e of events.filter(e=>e.step>=fault.startedStep!)) {
            if(e.type==="health-change-detected")explanations.push(`At step ${e.step}, ${name(String(e.data.appId))} was detected ${e.data.detectedHealth} by ${e.data.source==="probe"?"Health Checks":"manual inspection"}. Detection delay: ${e.data.delay} step(s).`);
            if(e.type==="failover-activated")explanations.push(`At step ${e.step}, Automatic Failover promoted ${name(String(e.data.appId))} into the route using existing installed capacity.`);
            if(e.type==="failover-cancelled")explanations.push(`At step ${e.step}, spare promotion was cancelled because restoration, the spare or the configured route changed.`);
            if(e.type==="instance-restored")explanations.push(`At step ${e.step}, ${name(String(e.data.appId))} was restored ${e.data.source==="manual"?"by the requested restore action":"when the temporary fault expired"}. Routing and health detection still determine whether it receives traffic.`);
        }
        const bypass=snapshots.find(m=>m.reliability&&m.step>=fault.startedStep!&&!m.reliability.effective.includes(fault.targetId)&&m.instances?.some(a=>a.id===fault.targetId&&a.health==="failed"));
        if(bypass) {
            const capacity=bypass.reliability!.healthyRoutedCapacity;
            explanations.push(`At step ${bypass.step}, the failed instance was bypassed. Surviving routed capacity was ${capacity} req/s against ${bypass.admitted} req/s admitted traffic. ${bypass.admitted>capacity?"Traffic exceeded surviving capacity, so correct rerouting still left the applications overloaded.":"Surviving capacity could handle admitted traffic; retained queues and database pressure still determine recovery."}`);
        }
        explanations.push(`At recovery, healthy routed capacity was ${c.snapshot.reliability?.healthyRoutedCapacity??0} req/s. ${c.combinedStage?"Autoscaling observed only healthy routed capacity during growth pressure":"Autoscaling was suspended during the test"}; installed spare and failed apps still incurred upkeep.`);
    }
    if(c.combinedStage) {
        for(const e of events) {
            if(e.type==="scenario-started")explanations.push(`At step ${e.step}, growth round ${Number(e.data.index)+1} (${e.data.template}) began: users rose to ${e.data.users} and demand peaked at ${e.data.peak} req/s.`);
            if(e.type==="scenario-pressure-ended")explanations.push(`At step ${e.step}, round pressure ended and demand returned to the ${e.data.baseline} req/s baseline.`);
            if(e.type==="promotion-started")explanations.push(`At step ${e.step}, a promotion added ${e.data.increment} req/s until step ${e.data.endStep}.`);
            if(e.type==="promotion-ended")explanations.push(`At step ${e.step}, the promotion ended and demand returned to the ${e.data.baseline} req/s baseline.`);
        }
        explanations.push("Registrations are a growth opportunity; only successful requests earn revenue.");
    }
    if(c.spikeStage) {
      for(const e of events.filter(x=>["traffic-spike-started","traffic-spike-ended","autoscale-scale-out-decided","autoscaler-blocked","autoscale-instance-retired"].includes(x.type)))
        explanations.push(`Step ${e.step}: ${e.type}. ${e.data.reason??""} ${e.data.to?`Incoming demand ${e.data.to} req/s.`:""}`);
      explanations.push("Automatic application capacity still requires provisioning and routing. It does not increase database capacity or cache effectiveness; compare actual per-instance and database evidence.");
    }
    if(opening.data) {
        const w=opening.data;
        explanations.push(`Workload ${w.profile}: ${w.readShare/100}% reads, ${(10000-w.readShare)/100}% writes; ${w.cacheableReadShare/100}% of reads eligible. Raw logical demand ${w.logical}; hits ${w.hits}, eligible misses ${w.eligibleMisses}; DB demand ${w.databaseNewDemand} ops/s.`);
        const last=c.snapshot.data!;
        explanations.push(`Cache effective hit rate used ${last.effectiveHitRateUsed/100}%; warmth after work ${last.warmthAfterStep/100}%. Hits ${last.hits}, writes ${last.writes}, non-cacheable reads ${last.nonCacheableReads}; these writes, reads and misses still reach DB. Capacity ${c.dbCapacity} ops/s. Cache reduces only new demand, never old backlog.`);
    }
    for (const action of c.actions.filter(a => a.requestedStep <= c.step && (a.activatedStep === null || a.activatedStep >= episodeStart))) {
        const effect = events.find(e => e.type === "action-activated" && e.data.actionId === action.id);
        if (!effect) {
            if (action.activatedStep === null && action.cancelledStep===undefined)
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
        if (["health-checks","create-spare","reserve-spare","release-spare","failover","promote-spare","restore-app"].includes(action.type)) {
            const names: Record<string,string>={"health-checks":"Health Checks deployment","create-spare":"Spare application installation","reserve-spare":"Spare reservation","release-spare":"Spare release",failover:"Automatic Failover deployment","promote-spare":"Spare promotion","restore-app":"Application restoration"};
            explanations.push(`${names[action.type]} activated at step ${effect.step}. Compare the recorded health, routing and surviving capacity; activation alone does not establish recovery.`);
        }
        else if (Number(d.dbAfter) > Number(d.dbBefore))
            explanations.push(`Database capacity increased from ${d.dbBefore} to ${d.dbAfter} ops/s. ${drainage}`);
        else if (Number(d.admittedAfter) < Number(d.admittedBefore))
            explanations.push(`Admitted demand fell from ${d.admittedBefore} to ${d.admittedAfter} requests/s, rejecting demand. ${drainage}`);
        else if (action.type === "promotion")
            explanations.push(`Promotion activated at step ${effect.step}, costing $${action.costCents/100} and adding temporary demand. It creates demand opportunity, not infrastructure capacity or a guaranteed recovery.`);
        else if(action.type==="cache"||action.type==="cache-tuning")
            explanations.push(`${action.type === "cache" ? "Read Cache" : "Cache tuning"} activated at step ${effect.step}; target ${Number(d.cacheTarget)/100}%. Warm-up and eligible reads determine actual hits; writes and non-cacheable reads continue to DB. Compare recorded demand rather than treating activation as recovery.`);
        else if (action.type === "routing" || action.type === "scale-up")
            explanations.push(`${action.type === "routing" ? "Routing changed" : `Capacity changed for ${action.targetId}`} at step ${effect.step}: effective routed capacity ${d.effectiveBefore} to ${d.effectiveAfter}. ${d.measuredRelief ? "The same-step comparison without this change had more queued work or higher latency; this contributed to recovery." : "The same-step comparison found no measured relief from this change; it is not credited with clearing queues."} Database capacity remained ${d.dbAfter} ops/s.${opening.data?" Application scaling does not directly reduce DB work; increased application processing may increase DB pressure.":""}`);
        else if (Number(d.appAfter) > Number(d.appBefore))
            explanations.push(!opening.instances ? "Installed application capacity increased, but routed capacity and database demand/capacity did not change. This investment did not relieve the database constraint." : "Installed application capacity increased, but the added application remained unrouted. Routed capacity did not change; installation alone did not relieve the active constraint.");
        else if (action.type === "deploy-lb")
            explanations.push("Load balancing was deployed; routing remained unchanged until an explicit routing configuration activated.");
        else if(action.type==="deploy-autoscaler"||action.type==="retire-app")
            explanations.push(`${action.type} activated at step ${effect.step}; inspect automatic decisions and recurring cost, not a promised recovery.`);
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
