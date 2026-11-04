import { BALANCE, userGoal, type EquipmentId, type EquipmentState, type EventKind, type GameState, type Postmortem, type TechId } from "@/sim";
import { num } from "@/game/format";
import type { IconName } from "./icons";
import type { ConceptKind } from "./ui";

/*
 * Display vocabulary shared across the interface: which icon, word and tone
 * stands for each piece of equipment, upgrade, health state and incident outcome.
 */

export const EQUIPMENT_ICON: Record<EquipmentId, IconName> = {
  gateway: "network",
  app: "server",
  standby: "plug",
  cache: "bolt",
  db: "database",
  replica: "copy",
  backup: "save",
  monitoring: "monitor",
  deploy: "ship",
  team: "team",
  growth: "megaphone",
};

export const TECH_ICON: Partial<Record<TechId, IconName>> = {
  larger_servers: "scaleUp",
  load_balancing: "shuffle",
  autoscaling: "scale",
  larger_database: "database",
  caching: "bolt",
  cache_tuning: "sliders",
  health_checks: "checkbox",
  standby: "plug",
  auto_failover: "switch",
  monitoring: "monitor",
  analytics: "analytics",
  deploy_testing: "test",
  backups: "save",
  replicas: "copy",
};

export type Tone = "ok" | "warn" | "critical" | "muted";

/** The one vocabulary for equipment health: same word, icon and colour in the room, the panel and the tooltips. */
export const STATE_META: Record<EquipmentState, { word: string; icon: IconName; tone: Tone }> = {
  ok: { word: "Healthy", icon: "check", tone: "ok" },
  warn: { word: "Needs attention", icon: "alert", tone: "warn" },
  critical: { word: "Overloaded", icon: "fire", tone: "critical" },
  down: { word: "Down", icon: "skull", tone: "critical" },
  absent: { word: "Not built", icon: "plusBox", tone: "muted" },
};

/** A face for customer satisfaction: easier to read at a glance than a number. */
export function moodIcon(satisfaction: number): IconName {
  return satisfaction < 55 ? "frown" : satisfaction < 70 ? "meh" : "smile";
}

export function utilTone(util: number): "ok" | "warn" | "critical" {
  return util >= 1 ? "critical" : util >= 0.85 ? "warn" : "ok";
}

/** Demand as a share of capacity; any demand on zero capacity counts as over capacity. */
export const ratioOf = (demand: number, capacity: number) => capacity > 0 ? demand / capacity : demand > 0 ? Infinity : 0;

export const OUTCOME_LABEL: Record<Postmortem["outcome"], string> = {
  resolved: "Fixed",
  mitigated: "Contained",
  failed: "Not fixed in time",
  auto_mitigated: "Handled automatically",
};

export const OUTCOME_ICON: Record<Postmortem["outcome"], IconName> = {
  resolved: "check",
  mitigated: "alert",
  failed: "close",
  auto_mitigated: "robot",
};

export function outcomeTone(pm: Postmortem): "ok" | "warn" | "critical" {
  return pm.outcome === "failed" ? "critical" : pm.outcome === "mitigated" ? "warn" : "ok";
}

/** Challenge Mode's Users tooltip: the goal and its deadline, or past the Series A the next milestone with none. */
export function usersGoalTip(game: GameState): string {
  const goal = userGoal(game);
  const text = game.seriesAWeek === undefined
    ? `Your goal: ${num(BALANCE.targetUsers)} by week ${BALANCE.maxTurns}.`
    : goal === null
      ? `Series A secured in week ${game.seriesAWeek}, and every milestone passed. There is no deadline; keep growing.`
      : `Series A secured in week ${game.seriesAWeek}. Next goal: ${num(goal)} users, with no deadline.`;
  return `${text} Every user adds traffic.`;
}

/** Series colours, shared by both modes' history charts. */
/** A round upper bound for a chart axis: 1, 2 or 5 times a power of ten. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

export const CHART_COLORS = { users: "#1f8fe0", cash: "#d18f00", revenue: "#0f9f8f", costs: "#e46a00", db: "#7b4fe0", health: "#e0386a", mood: "#1aa35a", debt: "#c41d33" };

/** The icon tile for each kind of entry in the history feed. */
export const EVENT_STYLE: Record<EventKind, [ConceptKind, IconName]> = {
  info: ["muted", "info"],
  decision: ["users", "check"],
  warning: ["warn", "alert"],
  incident: ["critical", "incident"],
  success: ["ok", "party"],
  finance: ["cash", "cash"],
  milestone: ["go", "goal"],
};
