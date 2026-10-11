import { DATA_STRATEGY as D } from "./scenarios/dataStrategy";
import { APPLICATION_SCALING as P } from "./scenarios/applicationScaling";
import type { Branch, GameState, TechDef, TechId, TechStatus } from "./types";
import { BALANCE } from "./balance";

export const BRANCHES: { id: Branch; name: string; blurb: string }[] = [
  { id: "capacity", name: "Capacity", blurb: "Handle more traffic" },
  { id: "data", name: "Data", blurb: "Relieve database load" },
  { id: "reliability", name: "Reliability", blurb: "Survive failures" },
];

/**
 * Legacy definitions are kept for serialized tasks and completed upgrades.
 * TECH_ORDER below is the nine-node player-facing research tree.
 */
// Retain definitions for completed upgrades, tasks and releases in old saves.
const LEGACY_TECH = {
  promotions: {
    id: "promotions",
    name: "Launch Campaigns",
    branch: "growth",
    col: 0,
    row: 0,
    description: "Run big launch campaigns.",
    effects: ["Unlocks Launch campaign: +26% users, +38% traffic"],
    requires: [],
    cost: 3_000,
    effort: 2,
    upkeep: 0,
  },
  analytics: {
    id: "analytics",
    name: "Customer Analytics",
    branch: "growth",
    col: 1,
    row: 0,
    description: "Learn what customers want.",
    effects: ["+15% revenue per user", "Shows growth and churn rates"],
    requires: ["promotions"],
    cost: 6_000,
    effort: 3,
    upkeep: 300,
  },
  targeted: {
    id: "targeted",
    name: "Targeted Campaigns",
    branch: "growth",
    col: 2,
    row: 0,
    description: "Aim campaigns at the right people.",
    effects: ["Unlocks Targeted campaign: +20% users, only +10% traffic"],
    requires: ["analytics"],
    cost: 9_000,
    effort: 4,
    upkeep: 0,
  },

  larger_servers: {
    id: "larger_servers",
    name: "Larger Servers",
    branch: "capacity",
    col: 0,
    row: 1,
    description: "Bigger machines.",
    effects: ["+60% capacity per server", "+30% cost per server"],
    requires: [],
    cost: 5_000,
    effort: 2,
    upkeep: 0,
    upkeepNote: "+30% per server",
  },
  load_balancing: {
    id: "load_balancing",
    name: "Load Balancing",
    branch: "capacity",
    col: 1,
    row: 1,
    description: "Spread traffic evenly across servers.",
    effects: ["Server limit 3 to 12", "+12% capacity"],
    requires: ["larger_servers"],
    cost: 7_000,
    effort: 3,
    upkeep: 500,
  },
  autoscaling: {
    id: "autoscaling",
    name: "Autoscaling",
    branch: "capacity",
    col: 2,
    row: 1,
    description: "Add servers automatically at peak.",
    effects: ["Adds temporary servers above 80% load", "Pay only when they run"],
    requires: ["load_balancing", "monitoring"],
    cost: 12_000,
    effort: 5,
    upkeep: 300,
  },
  caching: {
    id: "caching",
    name: "Caching Layer",
    branch: "capacity",
    col: 0,
    row: 2,
    description: "Serve repeat requests from memory.",
    effects: ["-36% database load"],
    requires: [],
    cost: 6_000,
    effort: 4,
    upkeep: 400,
  },

  backups: {
    id: "backups",
    name: "Automated Backups",
    branch: "reliability",
    col: 0,
    row: 3,
    description: "Nightly database copies.",
    effects: ["A dead database is rebuilt with no data lost"],
    requires: [],
    cost: 3_000,
    effort: 2,
    upkeep: 200,
  },
  replicas: {
    id: "replicas",
    name: "Database Replica",
    branch: "reliability",
    col: 1,
    row: 3,
    description: "A live copy of the database.",
    effects: ["+35% database capacity", "Can take over if the primary dies"],
    requires: ["backups"],
    cost: 9_000,
    effort: 4,
    upkeep: 0,
    upkeepNote: "half the database cost",
  },
  auto_failover: {
    id: "auto_failover",
    name: "Automatic Failover",
    branch: "reliability",
    col: 2,
    row: 3,
    description: "Spares take over by themselves.",
    effects: ["Dead machines are replaced in seconds", "No incident, nobody paged"],
    requires: ["replicas", "health_checks"],
    cost: 10_000,
    effort: 5,
    upkeep: 300,
  },
  standby: {
    id: "standby",
    name: "Standby Server",
    branch: "reliability",
    col: 0,
    row: 4,
    description: "A spare server kept warm.",
    effects: ["Can take over a dead server", "Extra capacity in an overload"],
    requires: [],
    cost: 4_000,
    effort: 2,
    upkeep: 0,
    upkeepNote: "one server's cost",
  },
  health_checks: {
    id: "health_checks",
    name: "Health Checks",
    branch: "reliability",
    col: 1,
    row: 4,
    description: "Spot sick machines fast.",
    effects: ["With a load balancer, dead servers are replaced automatically", "Names the failing machine"],
    requires: ["monitoring"],
    cost: 3_000,
    effort: 2,
    upkeep: 0,
  },

  monitoring: {
    id: "monitoring",
    name: "Monitoring",
    branch: "engineering",
    col: 0,
    row: 5,
    description: "See what your system is doing.",
    effects: ["Exact load numbers and a forecast", "Investigate incidents 3x faster"],
    requires: [],
    cost: 4_000,
    effort: 3,
    upkeep: 300,
  },
  tracing: {
    id: "tracing",
    name: "Request Tracing",
    branch: "engineering",
    col: 1,
    row: 5,
    description: "Follow requests end to end.",
    effects: ["Flags the faulty equipment in incidents", "Near-instant investigation"],
    requires: ["monitoring"],
    cost: 7_000,
    effort: 4,
    upkeep: 300,
  },
  code_health: {
    id: "code_health",
    name: "Code Health",
    branch: "engineering",
    col: 0,
    row: 6,
    description: "Code review and tidy-up habits.",
    effects: ["Tech debt grows half as fast", "Debt paydown removes 20, not 14"],
    requires: [],
    cost: 2_000,
    effort: 3,
    upkeep: 0,
  },
  deploy_testing: {
    id: "deploy_testing",
    name: "Automated Testing",
    branch: "engineering",
    col: 1,
    row: 6,
    description: "Tests run on every change.",
    effects: ["Deploy risk nearly halved", "Testing takes half the time"],
    requires: ["code_health"],
    cost: 5_000,
    effort: 4,
    upkeep: 200,
  },
  safer_rollouts: {
    id: "safer_rollouts",
    name: "Canary Rollouts",
    branch: "engineering",
    col: 2,
    row: 6,
    description: "Try each release on a few users first.",
    effects: ["Bad releases roll back automatically", "No more regression incidents"],
    requires: ["deploy_testing", "standby"],
    cost: 9_000,
    effort: 5,
    upkeep: 200,
  },
} satisfies Partial<Record<TechId, TechDef>>;

export const TECH: Record<TechId, TechDef> = {
  ...LEGACY_TECH,
  larger_servers: { ...LEGACY_TECH.larger_servers, name: "Scale Up", row: 0 },
  load_balancing: {
    ...LEGACY_TECH.load_balancing, name: "Scale Out + Load Balancing", row: 0,
    requires: [], description: "Distribute traffic across extra application instances.",
    effects: ["Server limit 3 to 12", "Removes uneven routing", "Add instances separately with Add server"],
  },
  autoscaling: { ...LEGACY_TECH.autoscaling, row: 0, requires: ["load_balancing"] },
  larger_database: {
    id: "larger_database", name: "Larger Database", branch: "data", col: 0, row: 1,
    description: "Increase database capacity at a higher running cost.",
    effects: ["Upgrade through Standard, Performance and Enterprise tiers", "Does not increase application capacity"],
    requires: [], cost: BALANCE.db.tiers[1].cost, effort: BALANCE.db.tiers[1].effort,
    upkeep: 0, upkeepNote: "depends on database tier",
  },
  caching: { ...LEGACY_TECH.caching, name: "Read Cache", branch: "data", col: 1, row: 1,
    effects: ["Up to 36% less database load after warm-up", "Only eligible reads are cached; writes still reach the database"] },
  cache_tuning: {
    id: "cache_tuning", name: "Cache Tuning", branch: "data", col: 2, row: 1,
    description: "Improve cache hit rate and warm the cache faster.",
    effects: ["Up to 50% less database load", "Warm-up takes one week instead of two", "+$200 weekly running cost"],
    requires: ["caching"], cost: 5_000, effort: 3, upkeep: 200,
  },
  health_checks: { ...LEGACY_TECH.health_checks, col: 0, row: 2, requires: [],
    effects: ["With load balancing, removes failed instances from routing", "Names the failing machine", "Cannot create replacement capacity"] },
  standby: { ...LEGACY_TECH.standby, name: "Spare Application Instance", col: 1, row: 2 },
  auto_failover: { ...LEGACY_TECH.auto_failover, col: 2, row: 2,
    requires: ["health_checks", "standby", "load_balancing"],
    description: "Route application traffic to your spare after an instance fails.",
    effects: ["Promotes the spare application instance", "Requires health checks and load balancing", "Does not fix database overload or create capacity"] },
};

export const TECH_ORDER: TechId[] = [
  "larger_servers", "load_balancing", "autoscaling",
  "larger_database", "caching", "cache_tuning",
  "health_checks", "standby", "auto_failover",
];

export function isResearchTech(id: TechId): boolean {
  return TECH_ORDER.includes(id);
}

export function completedTechIds(state: GameState): TechId[] {
  return TECH_ORDER.filter((id) => id === "larger_database" ? state.infra.dbTier > 0 : has(state, id));
}

export function has(state: Pick<GameState, "techDone" | "campaign">, tech: TechId): boolean {
  if(state.campaign)return (tech==="caching"&&!!state.campaign.readCache)||(tech==="cache_tuning"&&!!state.campaign.readCache?.tuned)||tech==="monitoring" || (tech==="load_balancing"&&state.campaign.loadBalancer) || (tech==="larger_servers"&&state.campaign.apps.some(a=>a.tier==="large"));
  // Metrics and alerts are baseline tools, including when resuming an old save.
  if (tech === "monitoring") return true;
  return state.techDone.includes(tech);
}

export function techStatus(state: GameState, id: TechId): TechStatus {
  if(state.campaign) {
    if(!["larger_database","larger_servers","load_balancing",...(state.campaign.dataStage?["caching","cache_tuning"]:[])].includes(id))return "locked";
    if(id==="larger_database")return state.campaign.dbCapacity>=(state.campaign.dataStage?D.dbCapacity:P.dbCapacity)?"done":"available";
    if(id==="cache_tuning"&&!state.campaign.readCache)return "locked";
    return has(state,id)?"done":state.campaign.openingMilestone?.acknowledged?"available":"locked";
  }
  if (id === "larger_database") {
    if (state.releases.some((r) => r.kind === "db_upgrade")) return "ready";
    if (state.tasks.some((t) => t.kind === "db_upgrade")) return "in_progress";
    return state.infra.dbTier > 0 ? "done" : "available";
  }
  if (has(state, id)) return "done";
  if (state.releases.some((r) => r.techId === id)) return "ready";
  if (state.tasks.some((t) => t.kind === "tech" && t.techId === id)) return "in_progress";
  if (!isResearchTech(id)) return "locked";
  const def = TECH[id];
  return def.requires.every((r) => has(state, r)) ? "available" : "locked";
}

export function missingPrerequisites(state: GameState, id: TechId): TechId[] {
  return TECH[id].requires.filter((r) => !has(state, r));
}
