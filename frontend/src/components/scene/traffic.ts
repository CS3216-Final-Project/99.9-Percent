import type { Campaign } from "@/sim/campaignTypes";

/** A machine on the request path. App servers use their instance ids ("app-1"). */
export type TrafficNode = "in" | "gateway" | "cache" | "db" | "out" | string;
export type TrafficKind = "flow" | "served" | "turned";
export interface TrafficEdge { from: TrafficNode; to: TrafficNode; rate: number; kind: TrafficKind }
export interface TrafficDrop { at: TrafficNode; rate: number; tone?: "dropped" | "turned" }
export interface TrafficQueue { at: TrafficNode; backlog: number; capacity: number }
export interface TrafficModel {
  inRate: number;
  outRate: number;
  turned: number;
  dropped: number;
  edges: TrafficEdge[];
  /** Requests failed this second, placed on the machine that lost them, or at In while that machine is unexamined. */
  drops: TrafficDrop[];
  queues: TrafficQueue[];
  /** Installed app servers that receive no traffic. */
  dimmed: string[];
  /** True while an incident hides at least one machine's failures behind the door. */
  hidden: boolean;
}

/** Components the player has inspected since the current incident opened. */
export function inspectedSinceIncident(c: Campaign): Set<string> {
  const inc = c.incident;
  if (!inc) return new Set();
  const seen = new Set<string>();
  for (const e of c.trace) if (e.type === "inspection" && e.step >= inc.openedStep && typeof e.data.component === "string") seen.add(e.data.component);
  return seen;
}

/**
 * Where this second's requests went, read from the recorded snapshot only. During an incident a machine's drops
 * and queue stay at the door until the player inspects that kind of machine, so the room never names the culprit.
 */
export function trafficModel(c: Campaign, inspected = inspectedSinceIncident(c)): TrafficModel {
  const m = c.snapshot, instances = m.instances ?? [];
  const hide = (component: "app" | "db") => !!c.incident && !inspected.has(component);
  const edges: TrafficEdge[] = [], drops: TrafficDrop[] = [], queues: TrafficQueue[] = [];
  const drop = (at: TrafficNode, rate: number, component: "app" | "db" | null) => {
    if (rate > 0) drops.push({ at: component && hide(component) ? "in" : at, rate });
  };
  if (m.admitted > 0) edges.push({ from: "in", to: "gateway", rate: m.admitted, kind: "flow" });
  if (m.rejected > 0) edges.push({ from: "in", to: "gateway", rate: m.rejected, kind: "turned" });
  // A limit spilling customers at the door is a real loss, not a rounding error: show the orange burst at In.
  if (m.rejected > 0) drops.push({ at: "in", rate: m.rejected, tone: "turned" });
  const hits = m.data?.hits ?? 0;
  const processed = m.app.processed;
  for (const x of instances) {
    if (x.routed && x.demand > 0) edges.push({ from: "gateway", to: x.id, rate: x.demand, kind: "flow" });
    // Split each server's finished work between the cache and the database in proportion to the totals.
    if (processed > 0 && x.processed > 0) {
      const toCache = Math.round(x.processed * hits / processed);
      if (x.processed - toCache > 0) edges.push({ from: x.id, to: "db", rate: x.processed - toCache, kind: "flow" });
      if (toCache > 0) edges.push({ from: x.id, to: "cache", rate: toCache, kind: "flow" });
    }
    drop(x.id, x.failed, "app");
    if (!hide("app") && x.backlog > 0) queues.push({ at: x.id, backlog: x.backlog, capacity: x.capacity });
  }
  // Admitted traffic with no server to go to is lost at the gateway.
  const unroutable = m.app.failed - instances.reduce((n, x) => n + x.failed, 0);
  drop("gateway", unroutable, "app");
  drop("db", m.db.failed, "db");
  if (!hide("db") && m.db.backlog > 0) queues.push({ at: "db", backlog: m.db.backlog, capacity: m.db.capacity });
  if (m.db.processed > 0) edges.push({ from: "db", to: "out", rate: m.db.processed, kind: "served" });
  if (hits > 0) edges.push({ from: "cache", to: "out", rate: hits, kind: "served" });
  return {
    inRate: m.incoming, outRate: m.successful, turned: m.rejected, dropped: m.failed, edges, drops, queues,
    dimmed: c.apps.filter(a => !instances.some(x => x.id === a.id && x.routed) && a.health !== "failed").map(a => a.id),
    hidden: !!c.incident && (hide("app") || hide("db")),
  };
}

