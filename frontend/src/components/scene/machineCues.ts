import type { EquipmentId, GameState, TechId } from "@/sim";
import type { ScheduledAction } from "@/sim/campaignTypes";
import { num } from "@/game/format";

export type MachineMotionKind = "grow" | "install" | "pulse";
export interface MachineCue {
  id: string;
  targets: string[];
  label: EquipmentId | string;
  kind: MachineMotionKind;
  badge: string;
  announcement: string;
}
export interface MachineCueState { game: GameState; generation: number; started: boolean }
export const MACHINE_POP_SECONDS = 1.6;

/** The accepted installation, not a claim that service recovered. */
function campaignCue(action: ScheduledAction, before: GameState, after: GameState): MachineCue {
  const c = after.campaign!, was = before.campaign!;
  const target = action.targetId ?? "app-1";
  const name = `Server ${target.split("-").at(-1)}`;
  const cue = (targets: string[], label: string, kind: MachineMotionKind, badge: string, announcement: string): MachineCue =>
    ({ id: `${c.runId}:${action.id}`, targets, label, kind, badge, announcement });
  switch (action.type) {
    case "upgrade-db": {
      const gain = c.dbCapacity - was.dbCapacity;
      return cue(["db"], "db", "grow", `+${num(gain)} ops/s`, `Database upgraded. Capacity ${num(was.dbCapacity)} to ${num(c.dbCapacity)} operations per second.`);
    }
    case "scale-up": {
      const from = was.apps.find(a => a.id === target)?.capacity ?? 0, to = c.apps.find(a => a.id === target)?.capacity ?? 0;
      return cue([target], target, "grow", `+${num(to - from)} req/s`, `${name} scaled up. Capacity ${num(from)} to ${num(to)} requests per second. Database capacity is unchanged.`);
    }
    case "add-app":
      return cue([target], target, "install", "Installed", `${name} installed. Route traffic to it before it can serve requests.`);
    case "create-spare": return cue([target], target, "install", "Spare ready", `${name} installed as an unrouted spare.`);
    case "cache": return cue(["cache"], "cache", "install", "Warming up", "Read Cache deployed. It warms as eligible reads arrive; writes still reach the database.");
    case "cache-tuning": return cue(["cache"], "cache", "grow", "Tuned", "Read Cache tuning active. Actual hits still depend on its warmth and workload.");
    case "deploy-lb": return cue(["lb"], "gateway", "install", "Installed", "Load balancer installed. Choose routing targets to share traffic.");
    case "routing": return cue(["gateway", ...(action.routing?.targets ?? [])], "gateway", "pulse", "Routing set", "Routing updated. Traffic follows the selected servers.");
    case "limit": return cue(["gateway"], "gateway", "pulse", "Limit on", "Traffic limit active. Rejected requests earn no revenue.");
    case "unlimit": return cue(["gateway"], "gateway", "pulse", "Limit off", "Traffic limit removed. Incoming demand can reach the application again.");
    case "deploy-autoscaler": return cue(["monitoring", "lb"], "monitoring", "pulse", "Autoscaler on", "Autoscaler deployed.");
    case "health-checks": return cue(["monitoring", ...c.apps.map(a => a.id)], "monitoring", "pulse", "Checks on", "Health checks deployed. Detection and restoration remain separate.");
    case "restore-app": return cue([target], target, "pulse", "Restored", `${name} restored. Service recovery still depends on demand and routing.`);
    case "reserve-spare": return cue([target], target, "pulse", "Spare", `${name} reserved as a spare.`);
    case "release-spare": return cue([target], target, "pulse", "Released", `${name} released from spare duty.`);
    case "failover": return cue(["gateway", target], "gateway", "pulse", "Failover on", "Automatic failover deployed.");
    case "promote-spare": return cue(["gateway", target], target, "pulse", "Promoted", `${name} promoted to receive traffic.`);
    case "retire-app": return cue(["monitoring"], "monitoring", "pulse", "Retired", `${name} retired.`);
  }
}

const TECH_MACHINE: Partial<Record<TechId, { id: EquipmentId | "lb"; label?: EquipmentId }>> = {
  load_balancing: { id: "lb", label: "gateway" }, caching: { id: "cache" }, replicas: { id: "replica" },
  backups: { id: "backup" }, standby: { id: "standby" }, monitoring: { id: "monitoring" },
  health_checks: { id: "monitoring" }, autoscaling: { id: "monitoring" },
};

/** Live transitions only: replacements, title screens, reloads and cancelled work are silent. */
export function machineCuesBetween(before: MachineCueState, after: MachineCueState): MachineCue[] {
  if (!before.started || !after.started || before.generation !== after.generation || before.game === after.game) return [];
  const was = before.game.campaign, c = after.game.campaign;
  if (was && c) {
    if (was.runId !== c.runId) return [];
    return c.actions.filter(a => a.activatedStep !== null && a.cancelledStep === undefined && (!a.source || a.source === "player") &&
      was.actions.some(old => old.id === a.id && old.activatedStep === null))
      .map(a => campaignCue(a, before.game, after.game));
  }
  if (was || c) return [];
  const a = before.game, b = after.game, cues: MachineCue[] = [];
  const add = (id: string, targets: string[], label: string, kind: MachineMotionKind, badge: string, announcement: string) =>
    cues.push({ id: `classic:${after.generation}:${b.turn}:${id}`, targets, label, kind, badge, announcement });
  if (b.infra.dbTier > a.infra.dbTier) add(`db-${b.infra.dbTier}`, ["db"], "db", "grow", "Upgraded", "Database upgraded.");
  b.infra.appHosts.forEach((host, i) => {
    if (!a.infra.appHosts.some(h => h.id === host.id)) add(host.id, [`app-${i + 1}`], "app", "install", "Installed", "Application server installed.");
  });
  for (const tech of b.techDone) {
    const machine = TECH_MACHINE[tech];
    if (machine && !a.techDone.includes(tech)) add(tech, [machine.id], machine.label ?? machine.id, "install", "Online", `${tech.replaceAll("_", " ")} online.`);
  }
  return cues;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
/** Floor-anchored squash, upward overshoot and settle; never changes the final hardware or collision bounds. */
export function machineScale(kind: MachineMotionKind, seconds: number, reduced: boolean): [number, number, number] {
  if (reduced || seconds < 0 || seconds >= MACHINE_POP_SECONDS) return [1, 1, 1];
  const keys = kind === "grow" ? [[0, 1, 1], [0.12, 1.08, 0.88], [0.4, 0.89, 1.34], [0.65, 0.94, 1.24], [1.05, 1.03, 0.96], [1.6, 1, 1]]
    : kind === "install" ? [[0, 0.7, 0.25], [0.38, 0.94, 1.2], [0.7, 1.04, 0.96], [1.6, 1, 1]]
    : [[0, 1, 1], [0.3, 1.04, 1.09], [0.65, 1, 1], [1.6, 1, 1]];
  const i = keys.findIndex(k => seconds <= k[0]);
  if (i <= 0) return [keys[0][1], keys[0][2], keys[0][1]];
  const a = keys[i - 1], b = keys[i], t = smooth((seconds - a[0]) / (b[0] - a[0]));
  const x = a[1] + (b[1] - a[1]) * t, y = a[2] + (b[2] - a[2]) * t;
  return [x, y, x];
}
