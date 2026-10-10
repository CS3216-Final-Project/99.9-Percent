import type { EquipmentId, EquipmentState, Postmortem, TechId } from "@/sim";
import type { IconName } from "./icons";

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
