import type { Campaign, CampaignPostmortem, Intervention, TraceEvent } from "./campaignTypes";
import { currentFault } from "./combinedCampaign";

/** Game seconds of lead-in a report keeps before its incident, so the change that triggered it stays in view. */
export const REPORT_LEAD_SECONDS = 5;
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
/** Player-facing names for every scheduled action, shared by reports, the action list and the event feed. */
export const ACTION_NAMES: Record<Intervention, string> = {
    "add-app": "Add server", "upgrade-db": "Database upgrade", limit: "Traffic limit", unlimit: "Remove traffic limit", "scale-up": "Application scale up", "deploy-lb": "Load balancer deployment", routing: "Routing change", cache: "Read Cache deployment", "cache-tuning": "Cache tuning",
    "deploy-autoscaler": "Autoscaling controller deployment", "retire-app": "Safe application retirement", "health-checks": "Health Checks deployment", "create-spare": "Spare application install", "reserve-spare": "Reserve spare", "release-spare": "Release spare", failover: "Automatic Failover deployment", "promote-spare": "Promote spare", "restore-app": "Restore application", promotion: "Promotion",
};
/** Report numbers read like the rest of the UI: 4,800, not 4800. */
const n = (v: unknown) => Number(v).toLocaleString("en-US");
const SPIKE_EVENTS: Record<string,string> = { "traffic-spike-started":"traffic spike started", "traffic-spike-ended":"traffic spike ended", "autoscale-scale-out-decided":"autoscaling added a server", "autoscaler-blocked":"autoscaling was blocked", "autoscale-instance-retired":"autoscaling retired a server" };
export function causalPostmortem(c: Campaign): CampaignPostmortem {
    const inc = c.incident!;
    const snapshots = inc.snapshots;
    const start = snapshots[0];
    const episodeStart = c.reports.at(-1)?.recoveredStep ?? 0;
    const events = c.trace.filter(e => e.step >= episodeStart);
    // Explanations cover the incident and a short lead-in; older changes since the previous report are only named.
    const windowStart = Math.max(episodeStart, Math.min(inc.openedStep, snapshots[0]?.step ?? inc.openedStep) - REPORT_LEAD_SECONDS);
    const recent = events.filter(e => e.step >= windowStart);
    const opening = snapshots.find(m => m.step === inc.openedStep)!;
    const demandEvent = events.filter(e => e.step <= inc.openedStep && (e.type === "traffic-change" || e.type === "traffic-spike-started" || e.type === "traffic-spike-ended" || e.type === "action-activated")).at(-1);
    const spikeEvent=events.filter(e=>e.type==="traffic-spike-started"&&e.step<=inc.openedStep).at(-1);
    const workloadEvent=events.filter(e=>e.type==="workload-changed"&&e.step<=inc.openedStep).at(-1);
    const primary = inc.primaryComponent ?? "db";
    const constraint = primary === "db" ? opening.db : opening.instances!.find(a=>a.id===primary)!;
    const explanations = [
        inc.kind==="application-failure"?`At game second ${inc.openedStep}, a failed server had lost requests for three game seconds in a row, which opened the incident. Noticing the failure and moving traffic to a spare each take a few more game seconds.`:!opening.instances ? `At game second ${inc.openedStep}, the database received ${n(opening.db.demand)} operations/s but could handle ${n(opening.db.capacity)}. Three overloaded game seconds in a row opened the incident.` :
            `At game second ${inc.openedStep}, ${primary === "db" ? "the database" : primary.replace("app-","App ")} received ${n(constraint.demand)} ${primary==="db"?"operations/s":"requests/s"} but could handle ${n(constraint.capacity)}. Three overloaded game seconds in a row opened the incident.`,
        inc.kind==="application-failure"?(opening.instances?.some(a=>a.health==="failed"&&a.routed&&a.demand>0)?"Traffic did not grow. The failed server stopped doing work, but the load balancer still sent it its share of the traffic, so every request it received failed."
            :opening.reliability?.unroutable?"Traffic did not grow, but no healthy server was left receiving traffic, so admitted requests had nowhere to go."
            :"Traffic did not grow. The failed server stopped doing work, so the same traffic had less capacity to land on."):opening.spikes?.activePulse&&spikeEvent?`Traffic spike ${spikeEvent.data.pulse} began at game second ${spikeEvent.step} and raised incoming traffic to ${n(spikeEvent.data.to)} req/s.`:opening.data&&workloadEvent?`At game second ${workloadEvent.step}, the workload changed to ${String(workloadEvent.data.profile).replaceAll("-"," ")}. What the cache cannot answer goes to the database.`:events.some(e => e.type === "traffic-change") ? "Incoming traffic had just increased, which started the overload." :
            `The incident followed a change to admitted traffic or capacity at game second ${demandEvent?.step ?? start?.step}.`,
    ];
    const fault=currentFault(c);
    // Only a fault that was still unrestored during this episode explains it.
    if(fault?.startedStep!==null&&fault&&fault.startedStep<=c.step&&(fault.restoredStep===null||fault.restoredStep>=episodeStart)) {
        const name=(id:string)=>`App ${id.slice(4)}`;
        explanations.push(`${name(fault.targetId)} failed at game second ${fault.startedStep}. A failed server does no work, and requests already queued on it wait until it is restored. Health Checks only notice the failure and add no capacity; a spare helps only once traffic is routed to it.`);
        for(const e of events.filter(e=>e.step>=fault.startedStep!)) {
            if(e.type==="health-change-detected")explanations.push(`At game second ${e.step}, ${name(String(e.data.appId))} was detected ${e.data.detectedHealth} by ${e.data.source==="probe"?"Health Checks":"manual inspection"}. It took ${e.data.delay} game ${e.data.delay===1?"second":"seconds"} to notice.`);
            if(e.type==="failover-activated")explanations.push(`At game second ${e.step}, Automatic Failover moved traffic to the spare, ${name(String(e.data.appId))}.`);
            if(e.type==="failover-cancelled")explanations.push(`At game second ${e.step}, moving traffic to the spare was cancelled because the failed server came back, the spare changed or the routing changed.`);
            if(e.type==="instance-restored")explanations.push(`At game second ${e.step}, ${name(String(e.data.appId))} was restored ${e.data.source==="manual"?"by the requested restore action":"when the temporary fault expired"}. It gets traffic again only when routing includes it and it is seen as healthy.`);
        }
        const bypass=snapshots.find(m=>m.reliability&&m.step>=fault.startedStep!&&!m.reliability.effective.includes(fault.targetId)&&m.instances?.some(a=>a.id===fault.targetId&&a.health==="failed"));
        if(bypass) {
            const capacity=bypass.reliability!.healthyRoutedCapacity;
            explanations.push(`At game second ${bypass.step}, traffic stopped going to the failed server. The healthy servers receiving traffic could serve ${n(capacity)} req/s, and ${n(bypass.admitted)} req/s was admitted. ${bypass.admitted>capacity?"That was more than they could serve, so they stayed overloaded even though routing was correct.":"They could serve it all; queued work and the database decided how quickly service recovered."}`);
        }
        explanations.push(`At recovery, the healthy servers receiving traffic could serve ${n(c.snapshot.reliability?.healthyRoutedCapacity??0)} req/s. ${c.combinedStage?"Autoscaling counted only those servers during the growth wave":"Autoscaling was paused during the test"}; spare and failed servers still cost upkeep.`);
    }
    if(c.combinedStage) {
        for(const e of recent) {
            if(e.type==="scenario-started")explanations.push(`At game second ${e.step}, growth round ${Number(e.data.index)+1} (${e.data.template}) began: users rose to ${n(e.data.users)} and demand peaked at ${n(e.data.peak)} req/s.`);
            if(e.type==="scenario-pressure-ended")explanations.push(`At game second ${e.step}, the growth wave ended and demand returned to its usual ${n(e.data.baseline)} req/s.`);
            if(e.type==="promotion-started")explanations.push(`At game second ${e.step}, a promotion added ${n(e.data.increment)} req/s until game second ${e.data.endStep}.`);
            if(e.type==="promotion-ended")explanations.push(`At game second ${e.step}, the promotion ended and demand returned to its usual ${n(e.data.baseline)} req/s.`);
        }
        explanations.push("Registrations are a growth opportunity; only successful requests earn revenue.");
    }
    if(c.spikeStage) {
      for(const e of recent.filter(x=>["traffic-spike-started","traffic-spike-ended","autoscale-scale-out-decided","autoscaler-blocked","autoscale-instance-retired"].includes(x.type)))
        explanations.push([`Game second ${e.step}: ${SPIKE_EVENTS[e.type]}.`,e.data.reason?`${String(e.data.reason).charAt(0).toUpperCase()}${String(e.data.reason).slice(1)}.`:"",e.data.to?`Incoming demand ${n(e.data.to)} req/s.`:""].filter(Boolean).join(" "));
      explanations.push("Autoscaling still has to start a server and route traffic to it before it helps, and it adds no database capacity or cache hits.");
    }
    if(opening.data) {
        const w=opening.data;
        explanations.push(`The ${w.profile.replaceAll("-"," ")} workload was ${w.readShare/100}% reads and ${(10000-w.readShare)/100}% writes, and ${w.cacheableReadShare/100}% of its reads could be cached. Of ${n(w.logical)} requests of work, the cache answered ${n(w.hits)} and missed ${n(w.eligibleMisses)}; the database received ${n(w.databaseNewDemand)} operations/s.`);
        const last=c.snapshot.data!;
        explanations.push(`By recovery, the cache answered ${last.effectiveHitRateUsed/100}% of cacheable reads and was ${last.warmthAfterStep/100}% warm. Writes (${n(last.writes)}) and reads it cannot cache (${n(last.nonCacheableReads)}) always reach the database, which can handle ${n(c.dbCapacity)} operations/s. A cache lowers new database work; it does not clear work already queued.`);
    }
    const earlier = c.actions.filter(a => a.activatedStep !== null && a.activatedStep >= episodeStart && a.activatedStep < windowStart);
    if (earlier.length) explanations.push(`Earlier changes were already active when this incident began: ${[...new Set(earlier.map(a => ACTION_NAMES[a.type] ?? a.type))].join(", ")}.`);
    for (const action of c.actions.filter(a => a.requestedStep <= c.step && (a.activatedStep === null || a.activatedStep >= windowStart))) {
        const effect = events.find(e => e.type === "action-activated" && e.data.actionId === action.id);
        if (!effect) {
            if (action.activatedStep === null && action.cancelledStep===undefined)
                explanations.push(`${ACTION_NAMES[action.type]??action.type} is pending and has not contributed to recovery.`);
            continue;
        }
        const d = effect.data;
        const before = snapshots.find(m => m.step === effect.step - 1) ?? c.recent.find(m => m.step === effect.step - 1);
        const after = snapshots.find(m => m.step === effect.step) ?? c.recent.find(m => m.step === effect.step);
        const drainage = before && after && before.db.backlog > after.db.backlog
            ? `The database queue fell from ${n(before.db.backlog)} to ${n(after.db.backlog)} when it took effect (game second ${effect.step}).`
            : before?.db.backlog === 0
                ? "The database queue was already empty before it took effect, so it is not credited with clearing it."
                : "The database queue did not shrink when it took effect, so it is not credited with clearing it.";
        if (["health-checks","create-spare","reserve-spare","release-spare","failover","promote-spare","restore-app"].includes(action.type)) {
            const names: Record<string,string>={"health-checks":"Health Checks deployment","create-spare":"Spare application installation","reserve-spare":"Spare reservation","release-spare":"Spare release",failover:"Automatic Failover deployment","promote-spare":"Spare promotion","restore-app":"Application restoration"};
            explanations.push(`${names[action.type]} took effect at game second ${effect.step}. Taking effect is not proof of recovery; health, routing and the capacity of healthy servers decide that.`);
        }
        else if (Number(d.dbAfter) > Number(d.dbBefore))
            explanations.push(`Database capacity rose from ${n(d.dbBefore)} to ${n(d.dbAfter)} operations/s. ${drainage}`);
        else if (Number(d.admittedAfter) < Number(d.admittedBefore))
            explanations.push(`Admitted traffic fell from ${n(d.admittedBefore)} to ${n(d.admittedAfter)} requests/s; the rest was rejected. ${drainage}`);
        else if (action.type === "promotion")
            explanations.push(`Promotion activated at game second ${effect.step}, costing $${n(action.costCents/100)} and adding temporary demand. It brings more users, not more capacity.`);
        else if(action.type==="cache"||action.type==="cache-tuning")
            explanations.push(`${action.type === "cache" ? "Read Cache" : "Cache tuning"} took effect at game second ${effect.step}, aiming for ${Number(d.cacheTarget)/100}% of cacheable reads. It needs time to warm up and only helps reads it can cache; writes and other reads still reach the database.`);
        else if (action.type === "routing" || action.type === "scale-up")
            explanations.push(`${action.type === "routing" ? "Routing changed" : `Capacity changed for ${String(action.targetId).replace("app-","App ")}`} at game second ${effect.step}: the servers receiving traffic went from ${n(d.effectiveBefore)} to ${n(d.effectiveAfter)} req/s of capacity. ${d.measuredRelief ? "Without this change, the same game second would have had more queued work or slower responses, so it helped recovery." : "It made no measurable difference in that game second, so it is not credited with clearing queues."} Database capacity stayed at ${n(d.dbAfter)} operations/s.${opening.data?" More application capacity does not reduce database work, and can send the database more of it.":""}`);
        else if (Number(d.appAfter) > Number(d.appBefore))
            explanations.push(!opening.instances ? "A new server was installed, but neither routed capacity nor the database changed, so it did not relieve the overloaded database." : "A new server was installed but received no traffic, so routed capacity did not change and it did not relieve the overload.");
        else if (action.type === "deploy-lb")
            explanations.push("The load balancer was deployed, but traffic kept its old route until a routing change took effect.");
        else if(action.type==="deploy-autoscaler"||action.type==="retire-app")
            explanations.push(`${ACTION_NAMES[action.type]??action.type} took effect at game second ${effect.step}. Check its decisions and running cost; turning it on does not guarantee recovery.`);
        else
            explanations.push(`${ACTION_NAMES[action.type]??action.type} changed how much traffic is admitted, without adding database capacity.`);
    }
    if (events.some(e => e.type === "action-activated" && events.some(other => other !== e && other.type === "action-activated" && other.step === e.step)))
        explanations.push("Several changes took effect in the same game second, so the queue change cannot be credited to any one of them.");
    const latency=(ms:number)=>`${Math.round(ms)} ms`, from=start?.latencyMs??100;
    const latencyText=Math.round(from)===Math.round(c.snapshot.latencyMs)?`latency stayed at ${latency(from)}`:`latency went from ${latency(from)} to ${latency(c.snapshot.latencyMs)}`;
    explanations.push(!opening.instances ? `The database queue went from ${n(start?.db.backlog ?? 0)} to ${n(c.snapshot.db.backlog)} and ${latencyText}. Service counted as recovered after five healthy game seconds in a row.` : `The application queue went from ${n(start?.app.backlog ?? 0)} to ${n(c.snapshot.app.backlog)}, the database queue from ${n(start?.db.backlog ?? 0)} to ${n(c.snapshot.db.backlog)}, and ${latencyText}. Service counted as recovered after five healthy game seconds in a row. The game estimates latency from the longest server queue and the database queue.`);
    explanations.push(c.limit === null ? "All incoming traffic is admitted again. Check spare capacity before traffic grows further." : "The traffic limit is still on, and rejected requests earn no revenue. Check that capacity can take full traffic before removing it.");
    return {
        id: inc.id, openedStep: inc.openedStep, recoveredStep: c.step,
        snapshots, events, explanations, limited: c.limit !== null,
        setupCents: c.actions.filter(a => a.requestedStep >= episodeStart && a.requestedStep <= c.step).reduce((n, a) => n + a.costCents, 0)
    };
}
