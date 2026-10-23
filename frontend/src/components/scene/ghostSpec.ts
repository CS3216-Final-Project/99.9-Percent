import type { Action } from "@/sim";
import type { Campaign, Intervention, Routing, ScheduledAction } from "@/sim/campaignTypes";
import { DB_CABINET, POS, RACK, appSlot, dbSlot } from "./layout";
import { edgePath, IN_GATE, type FloorLayout, type P2 } from "./trafficLayout";

/**
 * A change the player is considering, or one already paid for and installing, reduced to what the room shows: the
 * intervention it is, and the server or routing it names.
 */
export interface Change { kind: Intervention; targetId?: string; routing?: Routing }

/** "add" is something new or bigger; "remove" is something that goes away or stops receiving traffic. */
export type GhostTone = "add" | "remove";
export type GhostPart =
  | { type: "rack"; x: number; z: number; w: number; d: number; h: number; tone: GhostTone }
  | { type: "cable"; points: P2[]; tone: GhostTone }
  /** The traffic limit, drawn as a firewall across the aisle between In and the gateway. */
  | { type: "wall"; x: number; z: number; tone: GhostTone }
  /** A ring on the floor: a repair, a health probe or a spare being set aside. */
  | { type: "pulse"; x: number; z: number; tone: GhostTone }
  /** Extra requests arriving at In, for a promotion. */
  | { type: "burst"; x: number; z: number };

/** The intervention a campaign action would schedule, or null for actions the room does not preview. */
export function changeOf(action: Action, c: Campaign): Change | null {
  switch (action.type) {
    case "add_server": return { kind: "add-app" };
    case "start_db_upgrade": return { kind: "upgrade-db" };
    case "set_traffic_limit": return { kind: action.enabled ? "limit" : "unlimit" };
    case "deploy_load_balancer": return { kind: "deploy-lb" };
    case "set_routing": return { kind: "routing", routing: { mode: action.mode, targets: action.targets } };
    case "deploy_cache": return { kind: "cache" };
    case "tune_cache": return { kind: "cache-tuning" };
    case "scale_up": return { kind: "scale-up", targetId: action.appId };
    case "deploy_autoscaler": return { kind: "deploy-autoscaler" };
    case "deploy_health_checks": return { kind: "health-checks" };
    case "install_spare": return { kind: "create-spare" };
    case "reserve_spare": return { kind: "reserve-spare", targetId: action.appId };
    case "release_spare": return { kind: "release-spare", targetId: c.reliabilityStage?.spareId ?? undefined };
    case "deploy_failover": return { kind: "failover", targetId: c.reliabilityStage?.spareId ?? undefined };
    case "restore_app": return { kind: "restore-app", targetId: action.appId };
    case "pick_launch_tech": return { kind: action.tech === "caching" ? "cache" : "deploy-autoscaler" };
    case "run_promotion": return { kind: "promotion" };
    default: return null;
  }
}

/** The same, for an action already scheduled. */
export function changeOfScheduled(a: ScheduledAction): Change {
  return { kind: a.type, ...(a.targetId ? { targetId: a.targetId } : {}), ...(a.routing ? { routing: a.routing } : {}) };
}

const LB = { w: 0.95, d: 1.05, h: 1.5 };
const CACHE = { w: 0.95, d: 1.05, h: 1.3 };

function slotOf(id: string | undefined, layout: FloorLayout) {
  const i = id ? layout.apps.indexOf(id) : -1;
  return i < 0 ? null : appSlot(i);
}

/**
 * What the room draws for a change, in floor coordinates: the rack it adds or grows, the cables it lays, the wall it
 * raises. `extraApps` counts servers already installing ahead of this one, so a second new server takes the next slot.
 */
export function ghostParts(change: Change, c: Campaign, layout: FloorLayout, extraApps = 0): GhostPart[] {
  const parts: GhostPart[] = [];
  const rack = (p: { x: number; z: number } | null, size: { w: number; d: number; h: number }, tone: GhostTone = "add") => {
    if (p) parts.push({ type: "rack", x: p.x, z: p.z, ...size, tone });
  };
  const route = (id: string, l: FloorLayout = layout, tone: GhostTone = "add") => {
    const points = edgePath({ from: "gateway", to: id }, l);
    if (points) parts.push({ type: "cable", points, tone });
  };
  const pulse = (id: string | undefined, tone: GhostTone = "add") => {
    const p = slotOf(id, layout);
    if (p) parts.push({ type: "pulse", x: p.x, z: p.z, tone });
  };
  const routed = c.apps.filter(a => a.routed).map(a => a.id);
  switch (change.kind) {
    case "add-app":
    case "create-spare": {
      const i = layout.apps.length + extraApps, id = `ghost-${i}`;
      rack(appSlot(i), RACK);
      // A new server arrives unrouted; with a load balancer the cable it will be able to take is shown dashed.
      if (change.kind === "add-app" && c.loadBalancer) route(id, { ...layout, apps: [...layout.apps, ...Array.from({ length: extraApps }, (_, k) => `pending-${k}`), id] });
      break;
    }
    case "deploy-lb":
      rack(POS.loadBalancer, LB);
      for (const a of c.apps) if (a.role !== "spare") route(a.id);
      break;
    case "routing": {
      const targets = change.routing?.targets ?? [];
      for (const id of targets) route(id);
      for (const id of routed) if (!targets.includes(id)) route(id, layout, "remove");
      break;
    }
    case "upgrade-db":
      rack(dbSlot(Math.max(1, layout.dbCabinets)), DB_CABINET);
      break;
    case "limit":
    case "unlimit":
      parts.push({ type: "wall", x: (IN_GATE.x + POS.gateway.x) / 2, z: IN_GATE.z, tone: change.kind === "limit" ? "add" : "remove" });
      break;
    case "cache": {
      rack(POS.cache, CACHE);
      const from = layout.apps.find(id => routed.includes(id)) ?? layout.apps[0];
      const points = from ? edgePath({ from, to: "cache" }, layout) : null;
      if (points) parts.push({ type: "cable", points, tone: "add" });
      break;
    }
    case "cache-tuning":
      rack(POS.cache, { ...CACHE, h: 1.9 });
      break;
    case "scale-up":
      rack(slotOf(change.targetId, layout), { w: RACK.w + 0.15, d: RACK.d + 0.1, h: RACK.h + 0.55 });
      break;
    case "deploy-autoscaler":
      // A small controller beside the load balancer, and the servers it may add and remove, dashed.
      rack({ x: POS.loadBalancer.x, z: POS.loadBalancer.z + 1.35 }, { w: 0.7, d: 0.7, h: 0.9 });
      rack(appSlot(layout.apps.length), RACK);
      rack(appSlot(layout.apps.length + 1), RACK);
      break;
    case "retire-app": {
      const p = slotOf(change.targetId, layout);
      rack(p, RACK, "remove");
      if (change.targetId && routed.includes(change.targetId)) route(change.targetId, layout, "remove");
      break;
    }
    case "health-checks":
      for (const id of routed) pulse(id);
      rack({ x: POS.monitoring.x, z: POS.monitoring.z + 0.7 }, { w: 0.6, d: 0.5, h: 0.6 });
      break;
    case "reserve-spare":
      pulse(change.targetId);
      if (change.targetId && routed.includes(change.targetId)) route(change.targetId, layout, "remove");
      break;
    case "release-spare":
      pulse(change.targetId);
      break;
    case "failover":
    case "promote-spare":
      // Traffic moves from the failed server to the spare.
      if (change.targetId) route(change.targetId);
      for (const a of c.apps) if (a.health === "failed" && routed.includes(a.id)) route(a.id, layout, "remove");
      break;
    case "restore-app":
      pulse(change.targetId);
      break;
    case "promotion":
      parts.push({ type: "burst", x: IN_GATE.x, z: IN_GATE.z });
      break;
  }
  return parts;
}

/** Every change that is paid for but not yet active, each with how far along its installation is (0 to 1). */
export function installing(c: Campaign): { action: ScheduledAction; progress: number; extraApps: number }[] {
  let apps = 0;
  return c.pending.filter(a => a.cancelledStep === undefined).map(action => {
    const span = Math.max(1, action.activationStep - action.requestedStep);
    const extraApps = apps;
    if (action.type === "add-app" || action.type === "create-spare") apps++;
    return { action, progress: Math.min(1, Math.max(0, (c.step - action.requestedStep) / span)), extraApps };
  });
}
