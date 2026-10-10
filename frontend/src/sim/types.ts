/**
 * Core types for the 99.99% simulation.
 *
 * Everything in GameState is plain JSON so a run can be saved to localStorage,
 * restored after a refresh, and replayed deterministically from its seed.
 */

export const SAVE_VERSION = 1;

export type Phase = "management" | "incident" | "review" | "ended";

export type Branch = "capacity" | "data" | "reliability" | "growth" | "engineering";

export type TechId =
  | "larger_database"
  | "cache_tuning"
  | "promotions"
  | "analytics"
  | "targeted"
  | "larger_servers"
  | "load_balancing"
  | "autoscaling"
  | "caching"
  | "backups"
  | "replicas"
  | "standby"
  | "health_checks"
  | "auto_failover"
  | "monitoring"
  | "tracing"
  | "code_health"
  | "deploy_testing"
  | "safer_rollouts";

/** `ready` = built by engineers, waiting for the player to deploy or test it. */
export type TechStatus = "locked" | "available" | "in_progress" | "ready" | "done";

export interface TechDef {
  id: TechId;
  name: string;
  branch: Branch;
  /** Grid position in the tree view (column, row). */
  col: number;
  row: number;
  description: string;
  /** Plain-language list of what changes in the simulation. */
  effects: string[];
  requires: TechId[];
  cost: number;
  /** Engineer-weeks of work. */
  effort: number;
  /** Recurring weekly cost once deployed (some are computed, see `upkeepNote`). */
  upkeep: number;
  upkeepNote?: string;
}

export type PromoId = "social" | "launch" | "targeted";

export interface PromoDef {
  id: PromoId;
  name: string;
  description: string;
  /** Fraction of the current user base acquired. */
  userGain: number;
  /** Extra peak traffic for the week it runs (0.3 = +30%). */
  spike: number;
  minCost: number;
  costPerUser: number;
  cooldown: number;
  requires?: TechId;
  /** Operational promotions are revealed by growth, outside the research tree. */
  minUsers?: number;
}

export type EquipmentId =
  | "gateway"
  | "app"
  | "standby"
  | "cache"
  | "db"
  | "replica"
  | "backup"
  | "monitoring"
  | "deploy"
  | "team"
  | "growth";

export type HostStatus = "healthy" | "degraded" | "failed";

export interface Host {
  id: string;
  status: HostStatus;
  bornTurn: number;
  degradedTurn?: number;
}

export interface Infra {
  appHosts: Host[];
  nextHostNum: number;
  /** Index into DB_TIERS. */
  dbTier: number;
  dbHost: Host;
}

export type TaskKind = "tech" | "db_upgrade" | "debt_paydown" | "test_release" | "fix_release" | "repair";

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  /** Total engineer-weeks required. */
  effort: number;
  progress: number;
  /** Engineers currently assigned. */
  assigned: number;
  startedTurn: number;
  costPaid: number;
  techId?: TechId;
  releaseId?: string;
  dbTier?: number;
  repairCode?: "data_repair" | "cleanup";
}

/** A finished piece of engineering work waiting to go to production. */
export interface Release {
  id: string;
  title: string;
  kind: "tech" | "db_upgrade";
  techId?: TechId;
  dbTier?: number;
  /** Engineer-weeks that went into it; bigger changes are riskier. */
  size: number;
  tested: boolean;
  /** Rolled back after a regression: must be fixed before it can ship again. */
  needsFix: boolean;
  readyTurn: number;
}

export interface DeployRecord {
  releaseId: string;
  title: string;
  kind: "tech" | "db_upgrade";
  techId?: TechId;
  dbTier?: number;
  size: number;
  turn: number;
  tested: boolean;
  /** Regression probability at the moment of deployment. */
  risk: number;
  techDebtAtDeploy: number;
  regressed: boolean;
  rolledBack: boolean;
}

export type EventKind = "info" | "decision" | "warning" | "incident" | "success" | "finance" | "milestone";

export interface GameEvent {
  id: number;
  turn: number;
  kind: EventKind;
  text: string;
}

export type WarningCode =
  | "app_hot"
  | "db_hot"
  | "host_degraded"
  | "debt_high"
  | "runway_low"
  | "surge_incoming"
  | "rate_limited"
  | "release_waiting"
  | "idle_engineers"
  | "unassigned_work";

export interface Warning {
  code: WarningCode;
  level: "notice" | "warn" | "critical";
  /** A few words, shown on screen. */
  text: string;
  /** One plain sentence of explanation, shown on hover or focus. */
  detail?: string;
  equipment?: EquipmentId;
}

export type IncidentType = "app_overload" | "db_saturation" | "deploy_regression" | "instance_failure";

export type RecoveryId =
  | "scale_out"
  | "db_upgrade"
  | "rollback"
  | "failover"
  | "rate_limit"
  | "replace_instance"
  | "restart";

export type IncidentStatus = "active" | "resolved" | "mitigated" | "failed";

export interface EvidenceItem {
  equipment: EquipmentId;
  title: string;
  text: string;
  /** Only surfaced when the player has tooling good enough to flag anomalies. */
  anomalous: boolean;
  at: number;
}

export type AttemptOutcome = "fixed" | "mitigated" | "partial" | "no_effect";

export interface ActionAttempt {
  id: RecoveryId;
  label: string;
  startedAt: number;
  finishedAt: number;
  cost: number;
  outcome: AttemptOutcome;
  note: string;
}

export interface IncidentDamage {
  /** Severity-weighted minutes of outage. */
  downtimeMinutes: number;
  usersLost: number;
  revenueLost: number;
  satisfactionLost: number;
  moneySpent: number;
}

/** Facts captured when the incident started, used to write the postmortem. */
export interface IncidentCause {
  peakRps: number;
  appCapacity: number;
  dbCapacity: number;
  appUtil: number;
  dbUtil: number;
  techDebt: number;
  servers: number;
  dbTier: number;
  hostId?: string;
  target?: "app" | "db";
  releaseId?: string;
  releaseTitle?: string;
  releaseTested?: boolean;
  releaseRisk?: number;
  surgeLabel?: string;
  promos: PromoId[];
  /** Decisions and conditions that contributed, as factual sentences. */
  contributing: string[];
}

export interface ActiveIncident {
  id: string;
  turn: number;
  type: IncidentType;
  title: string;
  symptoms: string[];
  severity: number;
  initialSeverity: number;
  /** Seconds on the incident clock. One second represents one minute of outage. */
  elapsed: number;
  maxDuration: number;
  status: IncidentStatus;
  cause: IncidentCause;
  evidence: EvidenceItem[];
  inspecting: { equipment: EquipmentId; remaining: number; total: number } | null;
  pending: { id: RecoveryId; remaining: number; total: number; cost: number; startedAt: number } | null;
  attempts: ActionAttempt[];
  hints: string[];
  damage: IncidentDamage;
  /** Fraction of peak traffic being shed by rate limiting. */
  shed: number;
  dataLoss: boolean;
  /** The standby server has been pulled into rotation for this incident. */
  standbyUsed: boolean;
}

export type PostmortemOutcome = "resolved" | "mitigated" | "failed" | "auto_mitigated";

export interface Postmortem {
  id: string;
  turn: number;
  type: IncidentType;
  title: string;
  outcome: PostmortemOutcome;
  whatFailed: string;
  contributing: string[];
  response: string[];
  whyOutcome: string;
  prevention: string[];
  impact: IncidentDamage & { durationSeconds: number; hintsUsed: number };
}

export interface TurnRecord {
  turn: number;
  users: number;
  cash: number;
  revenue: number;
  costs: number;
  net: number;
  peakRps: number;
  appUtil: number;
  dbUtil: number;
  appCapacity: number;
  dbCapacity: number;
  availability: number;
  latencyMs: number;
  satisfaction: number;
  techDebt: number;
  servers: number;
  incident?: IncidentType;
  warnings: WarningCode[];
}

export interface Surge {
  turn: number;
  /** Peak traffic multiplier for that week. */
  mult: number;
  /** Fraction of extra users gained. */
  users: number;
  label: string;
  scripted: boolean;
}

/** Values carried from the start of a week's resolution to its end (across an incident). */
export interface PendingTurn {
  peakRps: number;
  /** Extra servers in rotation this week only (autoscaling, or the standby pressed into service). */
  tempServers: number;
  /** How many of those are billed on-demand autoscaling servers. */
  autoscaled: number;
  /** Engineers with no task this week; they do upkeep that slows debt growth. */
  idleEngineers: number;
  promos: PromoId[];
  promoUsers: number;
  surgeLabel?: string;
  surgeMult: number;
  usersAtStart: number;
  /** Warning signs that were showing while the player planned this week. */
  planningWarnings: WarningCode[];
  notes: string[];
}

export interface LiveStats {
  /** Peak requests per second seen last week. */
  peakRps: number;
  tempServers: number;
  latencyMs: number;
  errorRate: number;
  availability: number;
  shed: number;
}

export interface WeekReport {
  turn: number;
  usersBefore: number;
  usersAfter: number;
  revenue: number;
  costs: number;
  net: number;
  notes: string[];
}

export type Outcome = "won" | "bankrupt" | "deadline";

export interface Totals {
  revenue: number;
  costs: number;
  invested: number;
  downtimeMinutes: number;
  weeks: number;
  peakUsers: number;
  hintsUsed: number;
  incidents: number;
  promosRun: number;
  serversAdded: number;
  releasesTested: number;
  releasesUntested: number;
}

export interface GameState {
  campaign?: import("./campaignTypes").Campaign;
  version: number;
  seed: number;
  rngState: number;
  /** The week currently being planned (1-based). */
  turn: number;
  phase: Phase;
  outcome: Outcome | null;

  cash: number;
  users: number;
  /** 0-100. */
  satisfaction: number;
  /** 0-100. */
  techDebt: number;
  engineers: number;

  infra: Infra;
  /** Cache warm-up, 0–1. Missing in legacy saves means already warm. */
  cacheWarmth?: number;
  techDone: TechId[];
  tasks: Task[];
  releases: Release[];
  deploys: DeployRecord[];
  latentRegression: { releaseId: string } | null;
  /** Week in which app and database capacity were last increased. */
  lastCapacityTurn: { app: number; db: number };

  activePromos: PromoId[];
  promoCooldowns: Partial<Record<PromoId, number>>;
  upcomingSurge: Surge | null;
  milestonesHit: number[];

  incident: ActiveIncident | null;
  pendingTurn: PendingTurn | null;
  reviewId: string | null;
  postmortems: Postmortem[];

  live: LiveStats;
  lastReport: WeekReport | null;
  history: TurnRecord[];
  log: GameEvent[];
  nextId: number;
  totals: Totals;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: "enter_scaling" }
  | { type: "scale_up"; appId: string }
  | { type: "deploy_load_balancer" }
  | { type: "set_routing"; mode: "single" | "balanced"; targets: string[] }
  | { type: "set_traffic_limit"; enabled: boolean }
  | { type: "launch_promotion"; promo: PromoId }
  | { type: "add_server" }
  | { type: "remove_server" }
  | { type: "replace_host"; hostId: string }
  | { type: "start_tech"; tech: TechId }
  | { type: "start_db_upgrade" }
  | { type: "start_debt_paydown" }
  | { type: "assign_engineers"; taskId: string; count: number }
  | { type: "cancel_task"; taskId: string }
  | { type: "hire_engineer" }
  | { type: "deploy_release"; releaseId: string }
  | { type: "test_release"; releaseId: string }
  | { type: "incident_inspect"; equipment: EquipmentId; appId?: string }
  | { type: "incident_action"; recovery: RecoveryId }
  | { type: "incident_hint" }
  | { type: "acknowledge_review" }
  | { type: "acknowledge_milestone"; enterScaling?: boolean };

export type FailureReason =
  | "wrong_phase"
  | "insufficient_funds"
  | "prerequisites"
  | "already_done"
  | "limit_reached"
  | "no_engineers"
  | "not_found"
  | "cooldown"
  | "busy"
  | "invalid";

export type ActionResult =
  | { ok: true; state: GameState; message?: string }
  | { ok: false; reason: FailureReason; message: string };
