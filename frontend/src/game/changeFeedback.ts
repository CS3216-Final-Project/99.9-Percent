import type { Campaign } from "@/sim/campaignTypes";
import { serverName } from "@/sim";
import { ACTION_NAMES } from "./reportEvents";

/** A reading across activation is evidence, not a claim that this action alone caused it. */
export function changeFeedback(c: Campaign) {
  const event = c.trace.findLast(e => e.type === "action-activated" && (!e.data.source || e.data.source === "player"));
  if (!event) return null;
  const action = c.actions.find(a => a.id === event.data.actionId);
  if (!action || action.activatedStep === null || action.cancelledStep != null) return null;
  const after = c.recent.find(m => m.step === action.activatedStep);
  const before = c.recent.find(m => m.step === action.activatedStep! - 1);
  const latest = c.snapshot;
  const target = action.targetId ? serverName(action.targetId) : "Server";
  const heading = action.type === "add-app" ? `${target} installed`
    : action.type === "upgrade-db" ? "Database upgraded"
    : action.type === "scale-up" ? `${target} scaled up`
    : action.type === "deploy-lb" ? "Load balancer installed"
    : action.type === "routing" ? "Routing updated"
    : action.type === "cache" ? "Read Cache deployed"
    : action.type === "cache-tuning" ? "Cache tuning active"
    : action.type === "limit" ? "Traffic limit active"
    : action.type === "unlimit" ? "Traffic limit removed"
    : `${ACTION_NAMES[action.type]} active`;
  const note = action.type === "add-app" ? `${target} installed. It needs a routing change before it receives new traffic.`
    : action.type === "deploy-lb" ? "Load balancer installed. Choose the servers in Network → Routing to share traffic."
    : action.type === "cache" || action.type === "cache-tuning" ? "Reads can now avoid database work. The cache warms as eligible reads are processed; writes still reach the database."
    : action.type === "routing" ? "Traffic now follows the selected routing. Balanced routing divides new traffic equally between its targets."
    : action.type === "upgrade-db" ? `Database capacity: ${Number(event.data.dbBefore).toLocaleString("en-US")} → ${Number(event.data.dbAfter).toLocaleString("en-US")} ops/s.`
    : action.type === "scale-up" ? `${target} capacity: ${event.data.capacityBefore} → ${event.data.capacityAfter} req/s. Database capacity is unchanged.`
    : action.type === "limit" ? "The limit protects admitted traffic by turning requests away. Rejected requests earn no revenue."
    : action.type === "unlimit" ? "The traffic limit is removed. All incoming demand can reach the application again."
    : "The change is active. Check service readings to see whether the company is stable.";
  return {
    id: event.id, step: event.step, title: ACTION_NAMES[action.type], heading, note, before, after,
    // Cache warmth is deliberately live; the activation comparison remains a recorded pair.
    cache: action.type === "cache" || action.type === "cache-tuning" ? latest.data : undefined,
    warning: after && after.db.demand > after.db.capacity ? "Database demand still exceeds its capacity at activation. More app capacity cannot expand the database."
      : after?.instances?.some(a => a.demand > a.capacity) ? "A server still receives more work than it can process at activation. Inspect routing and individual capacity."
      : null,
  };
}

/** One existing toast per newly observed player activation; no timer or save state of its own. */
export function changeActivity(before: Campaign, after: Campaign): string[] {
  const latest = changeFeedback(after);
  return latest && latest.id > (before.trace.at(-1)?.id ?? 0) ? [`${latest.heading}. ${latest.note}`] : [];
}
