import type { CampaignPostmortem, Snapshot, TraceEvent } from "@/sim/campaignTypes";

function increased(data: TraceEvent["data"], after: string, before: string) {
  const a = data[after], b = data[before];
  return typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b) && a > b;
}

/** A reading of the retained report, never the current company's later configuration. */
export function incidentLesson(report: CampaignPostmortem) {
  const opening = report.snapshots.find(s => s.step === report.openedStep) ?? report.snapshots[0];
  const final = report.snapshots.find(s => s.step === report.recoveredStep);
  const events = report.events.filter(e => e.step <= report.recoveredStep);
  const during = events.filter(e => e.step >= report.openedStep);
  const failed = (opening?.reliability?.failedDeliveries ?? 0) > 0 || !!opening?.instances?.some(a => a.health === "failed" && a.routed && a.demand > 0);
  const routedToFailed = !!opening && sentToFailed(opening) > 0;
  const db = !!opening && opening.db.demand > opening.db.capacity;
  const app = opening?.instances?.find(a => a.demand > a.capacity);
  const requested = new Map(events.filter(e => e.type === "action-requested").map(e => [e.data.actionId, e.data.type]));
  const activated = during.filter(e => e.type === "action-activated");
  const types = activated.map(e => requested.get(e.data.actionId));
  const upgraded = activated.some(e => increased(e.data, "dbAfter", "dbBefore"));
  const admission = activated.some(e => increased(e.data, "admittedBefore", "admittedAfter"));
  const cache = types.includes("cache") || types.includes("cache-tuning");
  const routing = types.includes("routing");
  const scaled = types.includes("scale-up");
  const installed = types.includes("add-app");
  const automatic = during.some(e => e.type === "autoscale-scale-out-decided");
  const restored = during.some(e => e.type === "instance-restored");
  const promoted = during.some(e => e.type === "failover-activated");
  const eased = during.some(e => ["traffic-spike-ended", "scenario-pressure-ended", "promotion-ended"].includes(e.type));
  const changes: string[] = [];
  if (restored) changes.push("a failed server was restored");
  if (promoted) changes.push("a spare server joined the traffic route");
  if (upgraded) changes.push("database capacity increased");
  if (admission) changes.push("less traffic was admitted");
  if (cache) changes.push("a cache change activated");
  if (routing) changes.push("traffic routing changed");
  if (scaled) changes.push("an application server gained capacity");
  if (installed) changes.push("another server was installed");
  if (eased) changes.push("temporary demand eased");
  const outcome = final && final.app.backlog === 0 && final.db.backlog === 0
    ? "The recorded queues were empty when recovery was confirmed."
    : "The engine confirmed sustained recovery; this does not isolate which change helped.";
  const alreadyServing = (opening?.app.processed ?? 0) > 0;
  const change = changes.length
    ? `Recorded changes: ${changes.slice(0, 3).join(", ")}${changes.length > 3 ? "; further changes are in the details" : ""}. ${outcome}`
    : `${activated.length ? "Infrastructure changes activated, but the retained evidence does not establish their effect." : alreadyServing ? "Previously installed capacity was already serving traffic; no new activation during the incident is recorded." : "No corrective activation during the incident is recorded."} ${outcome}`;
  let learned = "One overloaded component can slow down the whole app.";
  let remember = "Check each component's capacity before accepting more traffic.";
  if (failed) {
    learned = "A failed server cannot process requests; a spare helps only when it receives traffic.";
    remember = "Service recovery and repairing the failed server are separate checks; detection alone adds no capacity.";
  } else if (cache || db && opening?.data?.deployed) {
    learned = "A working cache can reduce repeated reads; writes and uncached reads still reach the database.";
    remember = "Research alone does not deploy a cache; check actual hits and database capacity.";
  } else if (app || installed || scaled || routing || automatic) {
    learned = "Installed servers help only when traffic reaches them; the database has its own capacity limit.";
    remember = automatic ? "Autoscaling still needs time to install and route servers, and adds running costs."
      : "More servers add running costs, including servers that are not receiving traffic.";
  } else if (eased) {
    learned = "Service can recover when temporary demand falls, without a new purchase.";
    remember = "Check capacity for the next traffic peak, as well as the quieter baseline.";
  } else if (upgraded) remember = "More database capacity adds ongoing costs; leave room for future traffic.";
  if (report.limited) remember = "The traffic limit is still active: rejected requests earn no revenue, and full demand has not been verified.";
  return {
    wrong: failed && routedToFailed ? "A server failed, but traffic was still routed to it, and every request it received failed."
      : failed ? "A server failed, reducing the capacity available to handle requests."
      : db && app ? "Both application and database work exceeded their recorded capacity, causing delays."
      : db ? "The database could not keep up with the work reaching it, causing delays."
      : app || opening && opening.app.demand > opening.app.capacity ? "Application work exceeded serving capacity, causing delays."
      : "An incident was recorded, but the retained evidence does not establish its original bottleneck.",
    changed: change, learned, remember,
    traffic: report.limited ? "Recovered with traffic limited" : "Recovered at full incoming demand",
    latencyMs: final?.latencyMs,
  };
}

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const app = (id: string) => id.replace("app-", "App ");

/** The incident's own readings: how long recovery took and the worst latency and error rate while it was open. */
export function incidentImpact(report: CampaignPostmortem) {
  const during = report.snapshots.filter(s => s.step >= report.openedStep && s.step <= report.recoveredStep);
  return {
    seconds: report.recoveredStep - report.openedStep,
    peakLatencyMs: during.length ? Math.max(...during.map(s => s.latencyMs)) : undefined,
    peakErrorRate: Math.max(0, ...during.map(s => s.serviceErrorRate ?? 0)),
  };
}
/** Errors carry the story once at least 1% of requests failed; otherwise the slowdown does. */
export const errorsLed = (impact: ReturnType<typeof incidentImpact>) => impact.peakErrorRate >= .01;

/**
 * "What happened?" as one cause-and-effect chain in the simulation's own numbers: what changed, which component
 * could not keep up, and what the player saw. Falls back to the plain lesson when the evidence was not retained.
 */
export function incidentCause(report: CampaignPostmortem) {
  const lesson = incidentLesson(report);
  const o = report.snapshots.find(s => s.step === report.openedStep);
  if (!o) return lesson.wrong;
  const impact = incidentImpact(report);
  const effect = errorsLed(impact) ? `up to ${Math.round(impact.peakErrorRate * 100)}% of requests failed`
    : impact.peakLatencyMs !== undefined ? `response time peaked at ${num(impact.peakLatencyMs)} ms` : "requests slowed down";
  const before = report.events.filter(e => e.step <= report.openedStep);
  const rise = before.filter(e => e.type === "traffic-change" && Number(e.data.to) > Number(e.data.from)).at(-1);
  const spike = before.filter(e => e.type === "traffic-spike-started").at(-1);
  const trigger = spike && (!rise || spike.step > rise.step) ? `A traffic spike raised incoming traffic to ${num(Number(spike.data.to))} req/s at game second ${spike.step}. `
    : rise ? `Traffic rose from ${num(Number(rise.data.from))} to ${num(Number(rise.data.to))} req/s at game second ${rise.step}. ` : "";
  const failed = o.instances?.find(a => a.health === "failed");
  if (failed) {
    const started = before.filter(e => e.type === "reliability-failure-started").at(-1);
    const name = app(failed.id), at = started ? ` at game second ${started.step}` : "";
    const toFailed = sentToFailed(o);
    return toFailed > 0 ? `${name} failed${at}. The load balancer kept sending it ${num(toFailed)} req/s, and every one of those requests failed, so ${effect}.`
      : `${name} failed${at}, leaving less capacity to serve requests, so ${effect}.`;
  }
  const db = o.db.demand > o.db.capacity;
  const server = o.instances?.find(a => a.demand > a.capacity);
  const servers = server ? `${app(server.id)} received ${num(server.demand)} req/s but could serve ${num(server.capacity)} req/s`
    : o.app.demand > o.app.capacity ? `Your application servers received ${num(o.app.demand)} req/s but could serve ${num(o.app.capacity)} req/s` : "";
  const database = `your database had ${num(o.db.demand)} operations per second of work but could handle ${num(o.db.capacity)}`;
  if (db && servers) return `${trigger}${servers}, and ${database}, so work queued up and ${effect}.`;
  if (db) return `${trigger}${database.charAt(0).toUpperCase()}${database.slice(1)}, so work queued up and ${effect}.`;
  if (servers) return `${trigger}${servers}, so requests queued up and ${effect}.`;
  return lesson.wrong;
}

/** A short list title naming what broke, read from the report's own opening evidence. */
export function incidentTitle(report: CampaignPostmortem) {
  const opening = report.snapshots.find(s => s.step === report.openedStep) ?? report.snapshots[0];
  const failed = opening?.instances?.find(a => a.health === "failed" && a.routed && a.demand > 0);
  if (failed) return `${failed.id.replace("app-", "App ")} failed`;
  if ((opening?.reliability?.failedDeliveries ?? 0) > 0) return "Server failure";
  const db = !!opening && opening.db.demand > opening.db.capacity;
  const app = !!opening && (opening.instances?.some(a => a.demand > a.capacity) || opening.app.demand > opening.app.capacity);
  return db && app ? "Application and Database overloaded" : db ? "Database overloaded" : app ? "Application overloaded" : "Service slowdown";
}

/** Admitted traffic the route still sent to failed servers in one observation; a failed server does no work, so all of it errors. */
export function sentToFailed(m: Snapshot) {
  if (m.instances) return m.instances.filter(a => a.health === "failed" && a.routed).reduce((n, a) => n + a.demand, 0);
  return Math.max(0, (m.reliability?.failedDeliveries ?? 0) - (m.reliability?.unroutable ?? 0));
}

/**
 * The first observation after a server failed: traffic admitted, the share the route still sent to failed servers,
 * and what the healthy routed servers could serve. When traffic reached a failed server, it also finds the first later
 * observation where it stopped, and whether the server was taken out of the route or restored.
 */
export function survivingCapacity(snapshots: Snapshot[]) {
  const i = snapshots.findIndex(s => s.reliability && s.instances?.some(a => a.health === "failed"));
  if (i < 0) return null;
  const m = snapshots[i], failed = m.instances!.filter(a => a.health === "failed").map(a => a.id), toFailed = sentToFailed(m);
  const after = toFailed > 0 ? snapshots.slice(i + 1).find(s => s.reliability && failed.every(id => s.instances?.some(a => a.id === id)) && sentToFailed(s) === 0) : undefined;
  const restored = !!after && failed.every(id => after.instances?.find(a => a.id === id)?.health !== "failed");
  return {
    step: m.step, admitted: m.admitted, capacity: m.reliability!.healthyRoutedCapacity, failed, toFailed,
    stopped: after ? { step: after.step, by: restored ? "restored" as const : "rerouted" as const, admitted: after.admitted, capacity: after.reliability!.healthyRoutedCapacity } : null,
  };
}
export type SurvivingCapacity = NonNullable<ReturnType<typeof survivingCapacity>>;
