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
  let remember = "Compare each component's capacity with expected demand before more users arrive.";
  if (failed) {
    learned = "A failed server cannot process requests; a spare helps only when it receives traffic.";
    remember = "Keep enough routed capacity that the other servers can carry the traffic when one fails, and add Health Checks so a failed server is spotted sooner.";
  } else if (cache || db && opening?.data?.deployed) {
    learned = "A working cache can reduce repeated reads; writes and uncached reads still reach the database.";
    remember = "Deploy and warm the cache before demand peaks, and keep database capacity for writes and uncached reads.";
  } else if (app || installed || scaled || routing || automatic) {
    learned = "Installed servers help only when traffic reaches them; the database has its own capacity limit.";
    remember = automatic ? "Turn on autoscaling before the peak; new servers take a few game seconds to install and route."
      : "Route traffic to every server you pay for, and add capacity only where demand exceeds it.";
  } else if (eased) {
    learned = "Service can recover when temporary demand falls, without a new purchase.";
    remember = "Prepare capacity for the next peak before it arrives, not only for normal traffic.";
  } else if (upgraded) remember = "Upgrade the database before demand reaches its capacity, leaving room for growth.";
  if (report.limited) remember = "Add enough capacity to serve full demand, then remove the traffic limit; rejected requests earn no revenue.";
  return {
    wrong: failed ? "A server failed, reducing the capacity available to handle requests."
      : db && app ? "Both application and database work exceeded their recorded capacity, causing delays."
      : db ? "The database could not keep up with the work reaching it, causing delays."
      : app || opening && opening.app.demand > opening.app.capacity ? "Application work exceeded serving capacity, causing delays."
      : "An incident was recorded, but the retained evidence does not establish its original bottleneck.",
    changed: change, learned, remember,
    traffic: report.limited ? "Recovered with traffic limited" : "Recovered at full incoming demand",
    latencyMs: final?.latencyMs,
  };
}

/** A short list title naming what broke, read from the report's own opening evidence. */
export function incidentTitle(report: CampaignPostmortem) {
  const opening = report.snapshots.find(s => s.step === report.openedStep) ?? report.snapshots[0];
  const failed = opening?.instances?.find(a => a.health === "failed");
  if (failed) return `${failed.id.replace("app-", "App ")} failed`;
  if ((opening?.reliability?.failedDeliveries ?? 0) > 0) return "Server failure";
  const db = !!opening && opening.db.demand > opening.db.capacity;
  const app = !!opening && (opening.instances?.some(a => a.demand > a.capacity) || opening.app.demand > opening.app.capacity);
  return db && app ? "Application and Database overloaded" : db ? "Database overloaded" : app ? "Application overloaded" : "Service slowdown";
}

/** The first observation after a server failed: traffic admitted against what the healthy routed servers could serve. */
export function survivingCapacity(snapshots: Snapshot[]) {
  const m = snapshots.find(s => s.reliability && s.instances?.some(a => a.health === "failed"));
  return m ? { step: m.step, admitted: m.admitted, capacity: m.reliability!.healthyRoutedCapacity } : null;
}
