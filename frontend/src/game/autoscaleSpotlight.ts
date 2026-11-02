import { serverName } from "@/sim";
import type { Campaign, TraceEvent } from "@/sim/campaignTypes";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";

/** How many game seconds an autoscaler move stays in the spotlight; the clock does not move while paused. */
export const SPOTLIGHT_SECONDS = 4;
export interface AutoscaleSpot {
  /** Unique per recorded move, so a dismissed callout stays dismissed. */
  key: string;
  /** The server the move is about, when it is still installed; otherwise the App Server equipment. */
  appId: string | null;
  title: string;
  message: string;
}
const num = (n: unknown) => Number(n).toLocaleString("en-US");

function describe(c: Campaign, t: TraceEvent): Omit<AutoscaleSpot, "key"> | null {
  const id = typeof t.data.targetId === "string" ? t.data.targetId : null, app = id ? serverName(id) : "a server";
  const installed = id && c.apps.some(a => a.id === id) ? id : null;
  switch (t.type) {
    case "autoscale-scale-out-decided": return { appId: installed, title: `Autoscaling is adding ${app}`,
      message: `Servers stayed above ${T.high / 100}% busy for ${T.highSteps} seconds. ${app} installs in ${T.provisionDelay} seconds, then joins routing ${T.routingDelay} second later.` };
    case "autoscale-scale-up-decided": return { appId: installed, title: `Autoscaling is upgrading ${app}`,
      message: `All ${T.maximum} server slots are in use, so it upgrades the busiest server it added. The upgrade finishes in ${P.appDelay} seconds.` };
    case "autoscale-scale-in-eligible": return { appId: installed, title: `Autoscaling is retiring ${app}`,
      message: `Servers stayed below ${T.low / 100}% busy for ${T.lowSteps} seconds, so it removes a server it added to cut running costs.` };
    case "autoscale-instance-retired": return { appId: null, title: `${app} retired`,
      message: `It no longer serves traffic or costs upkeep. Autoscaling waits ${T.cooldown} seconds before its next change.` };
    case "autoscale-retirement-cancelled": return { appId: installed, title: `Autoscaling kept ${app}`,
      message: "Load, queues or routing changed before it could retire the server safely, so the server stays." };
    case "action-activated": {
      if (t.data.source !== "autoscaler") return null;
      const type = c.actions.find(a => a.id === t.data.actionId)?.type;
      if (type === "add-app") return { appId: installed, title: `${app} installed`, message: `It joins routing in ${T.routingDelay} second; until then it serves no requests.` };
      if (type === "scale-up") return { appId: installed, title: `${app} upgraded`, message: `It now handles ${num(t.data.capacityAfter)} req/s.` };
      if (type === "routing") {
        const before: string[] = JSON.parse(String(t.data.routingBefore)).targets, after: string[] = JSON.parse(String(t.data.routingAfter)).targets;
        const joined = after.find(x => !before.includes(x));
        return joined ? { appId: c.apps.some(a => a.id === joined) ? joined : null, title: `${serverName(joined)} is serving`, message: `Routed capacity is now ${num(t.data.effectiveAfter)} req/s.` } : null;
      }
      return null;
    }
    default: return null;
  }
}

/** The autoscaler's most recent move, while it is fresh: the room points at it so capacity never changes unseen. */
export function autoscaleSpot(c: Campaign | null | undefined): AutoscaleSpot | null {
  if (!c?.spikeStage?.controller) return null;
  for (let i = c.trace.length - 1; i >= 0; i--) {
    const t = c.trace[i];
    if (c.step - t.step > SPOTLIGHT_SECONDS) return null;
    const spot = describe(c, t);
    if (spot) return { key: `${c.runId}:${t.id}`, ...spot };
  }
  return null;
}
