import type { Campaign, CampaignPostmortem, TraceEvent } from "./campaignTypes";
import { currentFault } from "./combinedCampaign";
import { ACTION_NAMES, appName } from "./actionNames";
/** A report's evidence starts this many game seconds before its incident opened. */
export const REPORT_LEAD_SECONDS = 3;
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
const SPIKE_LINES: Record<string,string> = {
    "traffic-spike-started": "a traffic spike started", "traffic-spike-ended": "the traffic spike ended", "autoscale-scale-out-decided": "autoscaling requested another server",
    "autoscaler-blocked": "autoscaling was blocked", "autoscale-instance-retired": "autoscaling retired a server",
};
export function causalPostmortem(c: Campaign): CampaignPostmortem {
    const inc = c.incident!;
    const snapshots = inc.snapshots;
    const start = snapshots[0];
    const episodeStart = c.reports.at(-1)?.recoveredStep ?? 0;
    const events = c.trace.filter(e => e.step >= episodeStart);
    // Explanations cover the incident and its short lead-in; older history is already part of the opening readings.
    const windowStart = Math.max(episodeStart, inc.openedStep - REPORT_LEAD_SECONDS);
    const inWindow = events.filter(e => e.step >= windowStart);
    const opening = snapshots.find(m => m.step === inc.openedStep)!;
    const demandEvent = events.filter(e => e.step <= inc.openedStep && (e.type === "traffic-change" || e.type === "traffic-spike-started" || e.type === "traffic-spike-ended" || e.type === "action-activated")).at(-1);
    const spikeEvent=events.filter(e=>e.type==="traffic-spike-started"&&e.step<=inc.openedStep).at(-1);
    const workloadEvent=events.filter(e=>e.type==="workload-changed"&&e.step<=inc.openedStep).at(-1);
    const primary = inc.primaryComponent ?? "db";
    const constraint = primary === "db" ? opening.db : opening.instances!.find(a=>a.id===primary)!;
    const explanations = [
        inc.kind==="application-failure"?`At game second ${inc.openedStep}, three seconds in a row of requests lost to a failed server opened an application-failure incident. Detecting the failure and promoting a spare are separate, delayed effects.`:!opening.instances ? `At game second ${inc.openedStep}, database demand was ${opening.db.demand} ops/s against ${opening.db.capacity} ops/s capacity. Three overloaded seconds in a row opened the incident.` :
            `At game second ${inc.openedStep}, ${primary === "db" ? "database" : appName(primary)} demand was ${constraint.demand} ${primary==="db"?"ops/s":"req/s"} against ${constraint.capacity} ${primary==="db"?"ops/s":"req/s"} capacity. Three overloaded seconds in a row on this component opened the incident.`,
        inc.kind==="application-failure"?"The failure reduced useful capacity without any increase in incoming traffic. Compare each server's health, when the failure was detected, and which servers the route actually used.":opening.spikes?.activePulse&&spikeEvent?`Traffic spike ${spikeEvent.data.pulse} began at game second ${spikeEvent.step}, raising incoming traffic to ${spikeEvent.data.to} req/s; compare admitted demand with each component's capacity.`:opening.data&&workloadEvent?`Workload changed to ${String(workloadEvent.data.profile).replaceAll("-"," ")} at game second ${workloadEvent.step}; compare the work it created and the reads the cache could not serve with database capacity.`:events.some(e => e.type === "traffic-change") ? "The recorded traffic increase started the overload." :
            `The incident followed an admission or capacity change at game second ${demandEvent?.step ?? start?.step}; compare its recorded effect with the opening readings.`,
    ];
    const fault=currentFault(c);
    // Only a fault that was still unrestored during this episode explains it.
    if(fault?.startedStep!==null&&fault&&fault.startedStep<=c.step&&(fault.restoredStep===null||fault.restoredStep>=episodeStart)) {
        explanations.push(`${appName(fault.targetId)} failed at game second ${fault.startedStep}. A failed server does no work, and its queue stays until it is restored. Health Checks detect a failure but add no capacity; a spare helps only once traffic is routed to it.`);
        for(const e of events.filter(e=>e.step>=fault.startedStep!)) {
            if(e.type==="health-change-detected")explanations.push(`At game second ${e.step}, ${appName(String(e.data.appId))} was detected ${e.data.detectedHealth} by ${e.data.source==="probe"?"Health Checks":"manual inspection"}, ${e.data.delay} s after the change.`);
            if(e.type==="failover-activated")explanations.push(`At game second ${e.step}, Automatic Failover moved ${appName(String(e.data.appId))} into the route, using capacity that was already installed.`);
            if(e.type==="failover-cancelled")explanations.push(`At game second ${e.step}, the spare promotion was cancelled because the restore, the spare or the configured route changed.`);
            if(e.type==="instance-restored")explanations.push(`At game second ${e.step}, ${appName(String(e.data.appId))} was restored ${e.data.source==="manual"?"by your restore request":"when its temporary fault ended"}. Routing and health detection still decide whether it receives traffic.`);
        }
        const bypass=snapshots.find(m=>m.reliability&&m.step>=fault.startedStep!&&!m.reliability.effective.includes(fault.targetId)&&m.instances?.some(a=>a.id===fault.targetId&&a.health==="failed"));
        if(bypass) {
            const capacity=bypass.reliability!.healthyRoutedCapacity;
            explanations.push(`At game second ${bypass.step}, traffic stopped going to the failed server. The healthy servers in the route could serve ${capacity} req/s against ${bypass.admitted} req/s of admitted traffic. ${bypass.admitted>capacity?"Traffic exceeded that capacity, so correct rerouting still left the applications overloaded.":"That was enough for the admitted traffic; leftover queues and database pressure still decided when service recovered."}`);
        }
        explanations.push(`At recovery, the healthy servers in the route could serve ${c.snapshot.reliability?.healthyRoutedCapacity??0} req/s. ${c.combinedStage?"Autoscaling counted only healthy routed capacity during the growth wave":"Autoscaling was paused during the test"}; installed spare and failed servers still cost upkeep.`);
    }
    if(c.combinedStage) {
        // The growth wave or promotion driving demand when the incident opened, then anything that changed during it.
        const driver=events.filter(e=>(e.type==="scenario-started"||e.type==="promotion-started")&&e.step<windowStart).at(-1);
        for(const e of [...(driver?[driver]:[]),...inWindow]) {
            if(e.type==="scenario-started")explanations.push(`At game second ${e.step}, growth wave ${Number(e.data.index)+1} (${String(e.data.template).replaceAll("-"," ")}) began: users rose to ${e.data.users} and demand peaked at ${e.data.peak} req/s.`);
            if(e.type==="scenario-pressure-ended")explanations.push(`At game second ${e.step}, the growth wave eased and demand returned to the ${e.data.baseline} req/s baseline.`);
            if(e.type==="promotion-started")explanations.push(`At game second ${e.step}, a promotion added ${e.data.increment} req/s until game second ${e.data.endStep}.`);
            if(e.type==="promotion-ended")explanations.push(`At game second ${e.step}, the promotion ended and demand returned to the ${e.data.baseline} req/s baseline.`);
        }
        explanations.push("Registrations are a growth opportunity; only successful requests earn revenue.");
    }
    if(c.spikeStage) {
      for(const e of inWindow.filter(x=>SPIKE_LINES[x.type])) {
        const line=SPIKE_LINES[e.type], reason=typeof e.data.reason==="string"?` (${e.data.reason.toLowerCase()})`:"";
        explanations.push(`At game second ${e.step}, ${line}${reason}.${e.data.to?` Incoming demand ${e.data.to} req/s.`:""}`);
      }
      explanations.push("Automatic application capacity still has to be installed and routed. It does not add database capacity or make the cache more effective; compare each server's and the database's readings.");
    }
    if(opening.data) {
        const w=opening.data;
        explanations.push(`The ${w.profile.replaceAll("-"," ")} workload was ${w.readShare/100}% reads and ${(10000-w.readShare)/100}% writes, and ${w.cacheableReadShare/100}% of reads could be cached. It created ${w.logical} requests of work; the cache served ${w.hits}, missed ${w.eligibleMisses}, and the database received ${w.databaseNewDemand} ops/s.`);
        const last=c.snapshot.data!;
        explanations.push(`At recovery the cache hit ${last.effectiveHitRateUsed/100}% of eligible reads and was ${last.warmthAfterStep/100}% warm. Hits ${last.hits}, writes ${last.writes}, uncacheable reads ${last.nonCacheableReads}; writes, uncacheable reads and misses still reach the database, which handles ${c.dbCapacity} ops/s. A cache reduces only new demand, never an existing queue.`);
    }
    for (const action of c.actions.filter(a => a.requestedStep <= c.step && (a.activatedStep === null || a.activatedStep >= windowStart))) {
        const name = ACTION_NAMES[action.type];
        const effect = events.find(e => e.type === "action-activated" && e.data.actionId === action.id);
        if (!effect) {
            if (action.activatedStep === null && action.cancelledStep===undefined)
                explanations.push(`${name} is pending and has not contributed to recovery.`);
            continue;
        }
        const d = effect.data;
        const before = snapshots.find(m => m.step === effect.step - 1) ?? c.recent.find(m => m.step === effect.step - 1);
        const after = snapshots.find(m => m.step === effect.step) ?? c.recent.find(m => m.step === effect.step);
        const drainage = before && after && before.db.backlog > after.db.backlog
            ? `Database backlog fell from ${before.db.backlog} to ${after.db.backlog} at activation (game second ${effect.step}).`
            : before?.db.backlog === 0
                ? "Database backlog was already zero before activation; this change is not credited with clearing it."
                : "No database backlog drainage was observed at activation; this change is not credited with clearing it.";
        const routed = d.effectiveBefore === d.effectiveAfter ? `routed capacity stayed at ${d.effectiveAfter} req/s` : `routed capacity went from ${d.effectiveBefore} to ${d.effectiveAfter} req/s`;
        if (["health-checks","create-spare","reserve-spare","release-spare","failover","promote-spare","restore-app"].includes(action.type))
            explanations.push(`${name} activated at game second ${effect.step}. Compare the recorded health, routing and surviving capacity; activation alone does not establish recovery.`);
        else if (Number(d.dbAfter) > Number(d.dbBefore))
            explanations.push(`Database capacity increased from ${d.dbBefore} to ${d.dbAfter} ops/s. ${drainage}`);
        else if (Number(d.admittedAfter) < Number(d.admittedBefore))
            explanations.push(`Admitted demand fell from ${d.admittedBefore} to ${d.admittedAfter} req/s, rejecting demand. ${drainage}`);
        else if (action.type === "promotion")
            explanations.push(`Promotion activated at game second ${effect.step}, costing $${action.costCents/100} and adding temporary demand. It creates demand opportunity, not infrastructure capacity or a guaranteed recovery.`);
        else if(action.type==="cache"||action.type==="cache-tuning")
            explanations.push(`${action.type === "cache" ? "Read Cache" : "Cache tuning"} activated at game second ${effect.step}, aiming for ${Number(d.cacheTarget)/100}% of eligible reads. Warm-up and eligible reads decide the actual hits; writes and uncacheable reads still go to the database. Compare recorded demand rather than treating activation as recovery.`);
        else if (action.type === "routing" || action.type === "scale-up")
            explanations.push(`${action.type === "routing" ? "Routing changed" : `${appName(action.targetId ?? "")} was scaled up`} at game second ${effect.step}; ${routed}. ${d.measuredRelief ? "Without this change the same second would have had more queued work or higher latency, so it contributed to recovery." : "Without this change the same second showed no measured relief, so it is not credited with clearing queues."} Database capacity stayed at ${d.dbAfter} ops/s.${opening.data?" Scaling applications does not reduce database work; faster application processing can add database pressure.":""}`);
        else if (Number(d.appAfter) > Number(d.appBefore))
            explanations.push(!opening.instances ? "Installed application capacity increased, but routed capacity and database demand/capacity did not change. This investment did not relieve the database constraint." : "Installed application capacity increased, but the added application remained unrouted. Routed capacity did not change; installation alone did not relieve the active constraint.");
        else if (action.type === "deploy-lb")
            explanations.push("Load balancing was deployed; routing remained unchanged until an explicit routing configuration activated.");
        else if(action.type==="deploy-autoscaler"||action.type==="retire-app")
            explanations.push(`${name} activated at game second ${effect.step}; check its automatic decisions and running costs, not a promised recovery.`);
        else if (action.type === "unlimit")
            explanations.push(`The traffic limit was removed at game second ${effect.step}. More traffic was admitted, with no capacity added.`);
        else
            explanations.push(`${name} activated at game second ${effect.step} and changed how much traffic was admitted, without adding capacity.`);
    }
    const activations = inWindow.filter(e => e.type === "action-activated");
    if (activations.some(e => activations.some(other => other !== e && other.step === e.step)))
        explanations.push("Several changes activated in the same game second, so the backlog change cannot be split between them.");
    explanations.push(!opening.instances ? `Database backlog went from ${start?.db.backlog ?? 0} to ${c.snapshot.db.backlog} and latency from ${start?.latencyMs ?? 100} to ${c.snapshot.latencyMs} ms. Five seconds in a row passed the recovery checks.` : `Application backlog went from ${start?.app.backlog ?? 0} to ${c.snapshot.app.backlog}, database backlog from ${start?.db.backlog ?? 0} to ${c.snapshot.db.backlog}, and latency from ${start?.latencyMs ?? 100} to ${c.snapshot.latencyMs} ms. Five seconds in a row passed the recovery checks. Latency here is a simplified estimate from the longest application and database queues.`);
    explanations.push(c.limit === null ? "Full incoming demand is admitted. Compare dependency headroom before future traffic growth." : "Recovery retains the traffic limit. Rejected demand earns no revenue; inspect available capacity before removing the limit.");
    return {
        id: inc.id, openedStep: inc.openedStep, recoveredStep: c.step,
        snapshots, events, explanations, limited: c.limit !== null,
        setupCents: c.actions.filter(a => a.requestedStep >= episodeStart && a.requestedStep <= c.step).reduce((n, a) => n + a.costCents, 0)
    };
}
