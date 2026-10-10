import { TRAFFIC_SPIKES as T } from "./scenarios/trafficSpikes";
import { DATA_STRATEGY as D } from "./scenarios/dataStrategy";
import { APPLICATION_SCALING as S } from "./scenarios/applicationScaling";
import { OPENING_DB as Q } from "./scenarios/openingDatabaseIncident";
import { BALANCE, PROMOS } from "./balance";
import { has, TECH } from "./tech";
import type { EquipmentId, GameState, PromoId, Release, TechId, Warning } from "./types";

/* ------------------------------------------------------------------ */
/* Capacity                                                            */
/* ------------------------------------------------------------------ */

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function serverCapacity(s: GameState): number {
  if(s.campaign)return s.campaign.snapshot.app.capacity;
  return BALANCE.server.capacity * (has(s, "larger_servers") ? BALANCE.server.largeCapacityMult : 1);
}

export function serverUpkeep(s: GameState): number {
  if(s.campaign)return Q.appWeeklyCents/100;
  return Math.round(BALANCE.server.upkeep * (has(s, "larger_servers") ? BALANCE.server.largeUpkeepMult : 1));
}

export function maxServers(s: GameState): number {
  if(s.campaign)return Q.maxApps;
  return has(s, "load_balancing") ? BALANCE.server.maxWithLb : BALANCE.server.maxWithoutLb;
}

export function routableHosts(s: GameState): number {
  if(s.campaign)return s.campaign.apps.filter(a=>a.routed).length;
  return s.infra.appHosts.filter((h) => h.status !== "failed").length;
}

/** True when dead app servers are noticed and removed from rotation automatically. */
export function selfHealingFleet(s: GameState): boolean {
  return has(s, "load_balancing") && has(s, "health_checks");
}

export function appCapacity(s: GameState, tempServers = 0): number {
  if(s.campaign)return s.campaign.snapshot.app.capacity;
  const n = routableHosts(s) + tempServers;
  const balance = n > 1 && !has(s, "load_balancing") ? BALANCE.server.unbalancedPenalty : 1;
  return n * serverCapacity(s) * balance;
}

export function dbCapacity(s: GameState): number {
  if(s.campaign)return s.campaign.snapshot.db.capacity;
  if (s.infra.dbHost.status === "failed") return 0;
  const tier = BALANCE.db.tiers[s.infra.dbTier];
  return tier.capacity * (has(s, "replicas") ? BALANCE.db.replicaCapacityMult : 1);
}

/** Database queries generated per request that the app tier serves. */
export function dbLoadFactor(s: GameState): number {
  if(s.campaign)return 1;
  const reduction = has(s, "cache_tuning") ? BALANCE.db.tunedCacheReduction : BALANCE.db.cacheReduction;
  const eligibleReduction = Math.min(BALANCE.db.cacheEligibleShare, reduction);
  const warmth = clamp(s.cacheWarmth ?? 1, 0, 1);
  return BALANCE.db.queriesPerRequest * (has(s, "caching") ? 1 - eligibleReduction * warmth : 1);
}

export interface Utilisation {
  appCapacity: number;
  dbCapacity: number;
  appUtil: number;
  dbUtil: number;
  dbLoad: number;
  served: number;
}

export function utilisation(s: GameState, peakRps: number, tempServers = 0): Utilisation {
  if(s.campaign){const m=s.campaign.snapshot;return {appCapacity:m.app.capacity,dbCapacity:m.db.capacity,appUtil:m.app.demandRatio,dbUtil:m.db.demandRatio,dbLoad:m.db.demand,served:m.successful};}
  const appCap = appCapacity(s, tempServers);
  const dbCap = dbCapacity(s);
  const served = Math.min(peakRps, appCap);
  const dbLoad = served * dbLoadFactor(s);
  return {
    appCapacity: appCap,
    dbCapacity: dbCap,
    appUtil: appCap > 0 ? peakRps / appCap : 9,
    dbUtil: dbCap > 0 ? dbLoad / dbCap : 9,
    dbLoad,
    served,
  };
}

/** Temporary servers autoscaling would add to keep peak utilisation near 75%. */
export function autoscaleServers(s: GameState, peakRps: number): number {
  if (!has(s, "autoscaling")) return 0;
  const base = routableHosts(s);
  if (base === 0) return 0;
  if (peakRps / appCapacity(s) <= 0.8) return 0;
  const needed = Math.ceil(peakRps / (serverCapacity(s) * 0.75)) - base;
  return clamp(needed, 0, base);
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export interface CostBreakdown {
  salaries: number;
  servers: number;
  database: number;
  redundancy: number;
  tooling: number;
  autoscale: number;
  total: number;
}

export function costs(s: GameState, tempServers = 0): CostBreakdown {
  if(s.campaign){const c=s.campaign,servers=c.apps.reduce((sum,a)=>sum+(a.tier==="large"?S.appWeeklyCents:Q.appWeeklyCents),0)/100,database=(c.dbCapacity===3000?D.dbWeeklyCents:c.dbCapacity===2000?S.dbWeeklyCents:c.upgraded?Q.upgradedDbWeeklyCents:Q.dbWeeklyCents)/100,redundancy=c.loadBalancer?S.lbWeeklyCents/100:0,salaries=Q.engineers*Q.salaryWeeklyCents/100;return {servers,database,salaries,redundancy,tooling:c.readCache?D.cacheWeeklyCents/100:0,autoscale:c.spikeStage?.controller?T.controllerWeeklyCents/100:0,total:servers+database+salaries+redundancy+(c.readCache?D.cacheWeeklyCents/100:0)+(c.spikeStage?.controller?T.controllerWeeklyCents/100:0)};}
  const salaries = s.engineers * BALANCE.engineer.salary;
  const servers = s.infra.appHosts.length * serverUpkeep(s);
  const dbUpkeep = BALANCE.db.tiers[s.infra.dbTier].upkeep;
  let redundancy = 0;
  if (has(s, "standby")) redundancy += serverUpkeep(s);
  if (has(s, "replicas")) redundancy += Math.round(dbUpkeep * BALANCE.db.replicaUpkeepShare);
  let tooling = 0;
  for (const id of s.techDone) if (id !== "monitoring") tooling += TECH[id].upkeep;
  const autoscale = tempServers * BALANCE.server.autoscaleUpkeep;
  return {
    salaries,
    servers,
    database: dbUpkeep,
    redundancy,
    tooling,
    autoscale,
    total: salaries + servers + dbUpkeep + redundancy + tooling + autoscale,
  };
}

export function arpu(s: GameState): number {
  return BALANCE.arpu * (has(s, "analytics") ? BALANCE.analyticsArpuBonus : 1);
}

export function weeklyRevenue(s: GameState): number {
  if(s.campaign)return s.campaign.ledger.successes*.2;
  return s.users * arpu(s);
}

/* ------------------------------------------------------------------ */
/* Engineering                                                         */
/* ------------------------------------------------------------------ */

/** Work one engineer completes per week; technical debt slows everyone down. */
export function velocity(s: GameState): number {
  for (const step of BALANCE.debt.velocitySteps) {
    if (s.techDebt >= step.debt) return step.speed;
  }
  return 1;
}

export function assignedEngineers(s: GameState): number {
  return s.tasks.reduce((sum, t) => sum + t.assigned, 0);
}

export function freeEngineers(s: GameState): number {
  return Math.max(0, s.engineers - assignedEngineers(s));
}

/** Weeks until a task finishes at its current staffing, or null if nobody is on it. */
export function taskEta(s: GameState, task: { effort: number; progress: number; assigned: number }): number | null {
  if (task.assigned <= 0) return null;
  return Math.max(1, Math.ceil((task.effort - task.progress) / (task.assigned * velocity(s)) - 1e-9));
}

export function baseReleaseRisk(size: number): number {
  if (size <= 2) return BALANCE.deploy.riskSmall;
  if (size <= 4) return BALANCE.deploy.riskMedium;
  return BALANCE.deploy.riskLarge;
}

/** Chance that deploying this release right now introduces a regression. */
export function releaseRisk(s: GameState, release: Pick<Release, "size" | "tested">): number {
  let risk = baseReleaseRisk(release.size) * (0.5 + s.techDebt / 60);
  if (release.tested) risk *= BALANCE.deploy.testedMult;
  if (has(s, "deploy_testing")) risk *= BALANCE.deploy.ciMult;
  return clamp(risk, 0.01, BALANCE.deploy.maxRisk);
}

export function testEffort(s: GameState, release: Pick<Release, "size">): number {
  const share = has(s, "deploy_testing") ? BALANCE.deploy.testEffortShareWithCi : BALANCE.deploy.testEffortShare;
  return Math.max(1, Math.round(release.size * share));
}

export function fixEffort(release: Pick<Release, "size">): number {
  return Math.max(1, Math.round(release.size * BALANCE.deploy.fixEffortShare));
}

/* ------------------------------------------------------------------ */
/* Promotions and traffic                                              */
/* ------------------------------------------------------------------ */

export function promoUsers(s: GameState, id: PromoId): number {
  const quality = clamp(s.satisfaction / 80, 0.5, 1.1);
  return Math.round(s.users * PROMOS[id].userGain * quality);
}

export function promoCost(s: GameState, id: PromoId): number {
  const def = PROMOS[id];
  const raw = Math.max(def.minCost, s.users * def.userGain * def.costPerUser);
  return Math.round(raw / 100) * 100;
}

export function promoCooldownLeft(s: GameState, id: PromoId): number {
  const until = s.promoCooldowns[id] ?? 0;
  return Math.max(0, until - s.turn);
}

export interface Forecast {
  users: number;
  peakLow: number;
  peakHigh: number;
  appLow: number;
  appHigh: number;
  dbLow: number;
  dbHigh: number;
  tempServers: number;
}

/** Expected peak for the week being planned, given promotions and surges already known. */
export function forecast(s: GameState): Forecast {
  if(s.campaign){const m=s.campaign.snapshot;return {users:s.users,peakLow:m.incoming,peakHigh:m.incoming,appLow:m.app.demandRatio,appHigh:m.app.demandRatio,dbLow:m.db.demandRatio,dbHigh:m.db.demandRatio,tempServers:0};}
  let users = s.users;
  let mult = 1;
  for (const id of s.activePromos) {
    users += promoUsers(s, id);
    mult *= 1 + PROMOS[id].spike;
  }
  if (s.upcomingSurge && s.upcomingSurge.turn === s.turn) {
    users += Math.round(s.users * s.upcomingSurge.users);
    mult *= s.upcomingSurge.mult;
  }
  const peakLow = users * BALANCE.rpsPerUser * mult;
  const peakHigh = peakLow * (1 + BALANCE.trafficNoise);
  const tempServers = autoscaleServers(s, peakHigh);
  const low = utilisation(s, peakLow, tempServers);
  const high = utilisation(s, peakHigh, tempServers);
  return {
    users,
    peakLow,
    peakHigh,
    appLow: low.appUtil,
    appHigh: high.appUtil,
    dbLow: low.dbUtil,
    dbHigh: high.dbUtil,
    tempServers,
  };
}

/** Rough load description shown when the player has no monitoring. */
export function loadBand(util: number): "Low" | "Moderate" | "High" | "Critical" {
  if (util >= 0.92) return "Critical";
  if (util >= 0.72) return "High";
  if (util >= 0.42) return "Moderate";
  return "Low";
}

/* ------------------------------------------------------------------ */
/* Growth                                                              */
/* ------------------------------------------------------------------ */

export function organicRate(satisfaction: number): number {
  return BALANCE.growth.organicRate * clamp((satisfaction - 40) / 40, 0, 1.25);
}

export function churnRate(satisfaction: number): number {
  return BALANCE.growth.baseChurn + Math.max(0, 70 - satisfaction) * BALANCE.growth.churnPerSatPoint;
}

/** Overall availability across the run, as a fraction (0.9995 = 99.95%). */
export function uptime(s: GameState): number {
  if(s.campaign){const c=s.campaign.cumulative;return c.successful+c.failed?c.successful/(c.successful+c.failed):1;}
  if (s.totals.weeks === 0) return 1;
  return clamp(1 - s.totals.downtimeMinutes / (s.totals.weeks * BALANCE.minutesPerWeek), 0, 1);
}

export function latencyFor(util: number): number {
  const u = clamp(util, 0, 1.6);
  return Math.round(90 * (1 + 5 * Math.pow(u, 6)));
}

/* ------------------------------------------------------------------ */
/* Snapshot used by the UI                                             */
/* ------------------------------------------------------------------ */

export interface Metrics extends Utilisation {
  peakRps: number;
  servers: number;
  routable: number;
  maxServers: number;
  perServer: number;
  revenue: number;
  costs: CostBreakdown;
  net: number;
  /** Weeks of cash left at the current burn; Infinity when profitable. */
  runway: number;
  velocity: number;
  freeEngineers: number;
  uptime: number;
  forecast: Forecast;
  hasMonitoring: boolean;
}

export function metrics(s: GameState): Metrics {
  const peakRps = s.live.peakRps;
  const u = utilisation(s, peakRps, 0);
  const c = costs(s);
  const revenue = weeklyRevenue(s);
  const net = revenue - c.total;
  return {
    ...u,
    peakRps,
    servers: s.infra.appHosts.length,
    routable: routableHosts(s),
    maxServers: maxServers(s),
    perServer: serverCapacity(s),
    revenue,
    costs: c,
    net,
    runway: net >= 0 ? Infinity : s.cash / -net,
    velocity: velocity(s),
    freeEngineers: freeEngineers(s),
    uptime: uptime(s),
    forecast: forecast(s),
    hasMonitoring: has(s, "monitoring"),
  };
}

/* ------------------------------------------------------------------ */
/* Warning signs                                                       */
/* ------------------------------------------------------------------ */

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/**
 * Warning signs for the week being planned. Preventable failures always show
 * up here first; monitoring decides how precise the wording is.
 */
export function currentWarnings(s: GameState): Warning[] {
  if(s.campaign)return [];
  const out: Warning[] = [];
  if (s.phase === "ended") return out;
  const m = metrics(s);
  const f = m.forecast;
  const precise = m.hasMonitoring;
  const range = (lo: number, hi: number) => `${pct(lo)}-${pct(hi)}`;
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  if (s.upcomingSurge && s.upcomingSurge.turn >= s.turn) {
    const when = s.upcomingSurge.turn === s.turn ? "this week" : `in week ${s.upcomingSurge.turn}`;
    out.push({
      code: "surge_incoming",
      level: "warn",
      equipment: "gateway",
      text: `Traffic surge ${when}: +${Math.round((s.upcomingSurge.mult - 1) * 100)}%`,
      detail: `${s.upcomingSurge.label}.`,
    });
  }

  const appDetail = "Above 100% the servers refuse requests and an incident starts.";
  const dbDetail = "Above 100% queries queue up and requests time out.";
  if (precise) {
    if (f.appHigh >= 0.85) {
      const over = f.appHigh >= 1;
      out.push({
        code: "app_hot",
        level: over ? "critical" : "warn",
        equipment: "app",
        text: `${over ? "Servers will overload" : "Servers near their limit"}: ${range(f.appLow, f.appHigh)}`,
        detail: appDetail,
      });
    }
    if (f.dbHigh >= 0.85) {
      const over = f.dbHigh >= 1;
      out.push({
        code: "db_hot",
        level: over ? "critical" : "warn",
        equipment: "db",
        text: `${over ? "Database will overload" : "Database near its limit"}: ${range(f.dbLow, f.dbHigh)}`,
        detail: dbDetail,
      });
    }
  } else {
    if (m.appUtil >= 0.72) {
      const hot = m.appUtil >= 0.9;
      out.push({
        code: "app_hot",
        level: hot ? "critical" : "warn",
        equipment: "app",
        text: hot ? "Servers almost overloaded last week" : "Servers were busy last week",
        detail: appDetail,
      });
    }
    if (m.dbUtil >= 0.72) {
      const hot = m.dbUtil >= 0.9;
      out.push({
        code: "db_hot",
        level: hot ? "critical" : "warn",
        equipment: "db",
        text: hot ? "Database almost overloaded last week" : "Database was busy last week",
        detail: dbDetail,
      });
    }
  }

  const named = precise || has(s, "health_checks");
  const faultDetail = "A machine showing faults has a 60% chance of dying each week.";
  for (const h of s.infra.appHosts) {
    if (h.status === "degraded") {
      out.push({
        code: "host_degraded",
        level: "warn",
        equipment: "app",
        text: named ? `${h.id} is failing. Replace it.` : "A server keeps rebooting. Replace it.",
        detail: faultDetail,
      });
    }
  }
  if (s.infra.dbHost.status === "degraded") {
    out.push({
      code: "host_degraded",
      level: "warn",
      equipment: "db",
      text: named ? "Database machine is failing. Replace it." : "Database machine keeps freezing. Replace it.",
      detail: faultDetail,
    });
  }

  if (s.techDebt >= 55) {
    out.push({
      code: "debt_high",
      level: s.techDebt >= 75 ? "critical" : "warn",
      equipment: "team",
      text: `Tech debt is high (${Math.round(s.techDebt)}/100)`,
      detail: "Untested deploys are far more likely to break, and engineers work slower.",
    });
  }

  if (m.net < 0 && m.runway < 4) {
    out.push({
      code: "runway_low",
      level: m.runway < 2 ? "critical" : "warn",
      text: `Cash runs out in ${count(Math.max(1, Math.floor(m.runway)), "week", "weeks")}`,
      detail: "You are spending more than you earn each week.",
    });
  }

  const waiting = s.releases.filter((r) => !r.needsFix && !s.tasks.some((t) => t.releaseId === r.id));
  if (waiting.length > 0) {
    out.push({
      code: "release_waiting",
      level: "notice",
      equipment: "deploy",
      text: `${count(waiting.length, "release", "releases")} ready to ship`,
    });
  }

  const unstaffed = s.tasks.filter((t) => t.assigned === 0);
  if (unstaffed.length > 0) {
    out.push({
      code: "unassigned_work",
      level: "notice",
      equipment: "team",
      text: `${count(unstaffed.length, "task needs", "tasks need")} engineers`,
    });
  } else if (m.freeEngineers > 0 && s.tasks.length === 0) {
    out.push({
      code: "idle_engineers",
      level: "notice",
      equipment: "team",
      text: `${count(m.freeEngineers, "engineer", "engineers")} idle`,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Equipment summaries for the facility view                           */
/* ------------------------------------------------------------------ */

export type EquipmentState = "ok" | "warn" | "critical" | "down" | "absent";

export interface EquipmentInfo {
  id: EquipmentId;
  name: string;
  built: boolean;
  state: EquipmentState;
  /** One-line metric summary shown on hover. */
  summary: string;
  /** What this piece of equipment does, in plain language. */
  about: string;
  /** Tech needed before it appears in the facility. */
  requires?: TechId;
}

function utilState(util: number): EquipmentState {
  if (util >= 1) return "critical";
  if (util >= 0.85) return "warn";
  return "ok";
}

function loadText(precise: boolean, util: number): string {
  return precise ? `${pct(util)} at peak` : `load ${loadBand(util).toLowerCase()}`;
}

export const EQUIPMENT_ORDER: EquipmentId[] = [
  "gateway",
  "app",
  "standby",
  "cache",
  "db",
  "replica",
  "backup",
  "monitoring",
  "deploy",
  "team",
  "growth",
];

export function equipmentInfo(s: GameState, id: EquipmentId): EquipmentInfo {
  if(s.campaign) {
    const m=s.campaign.snapshot, names:Partial<Record<EquipmentId,string>>={app:"Servers",db:"Database",gateway:"Network",monitoring:"Monitoring",team:"Team",deploy:"Deploy",growth:"Growth"};
    if(id==="cache") return {id,name:"Read Cache",built:!!s.campaign.readCache,state:s.campaign.readCache?"ok":"absent",
      summary:m.data?`${m.data.hits} hits; ${m.data.eligibleMisses} eligible misses; used hit rate ${m.data.effectiveHitRateUsed/100}%`:"No cache observation yet",
      about:"Only eligible reads can hit. Writes and old database backlog still require the database."};
    const built=["app","db","gateway","monitoring","team","deploy","growth"].includes(id);
    const component=id==="app"?m.app:id==="db"?m.db:null;
    return {id,name:names[id]??id,built,state:built?(component?utilState(component.demandRatio):"ok"):"absent",
      summary:component?`${component.demand}/${component.capacity} per second; backlog ${component.backlog}`:id==="gateway"?`${m.incoming} incoming; ${m.rejected} rejected`:id==="team"?"4 engineers":"Opening campaign",
      about:id==="app"?`Installed ${m.installedAppCapacity} requests/s; routed ${m.app.capacity} requests/s.`:"Inspect measured demand, capacity and backlog."};
  }
  const m = metrics(s);
  const precise = m.hasMonitoring;
  const optional = (name: string, about: string, requires: TechId, on: string): EquipmentInfo => {
    const built = has(s, requires);
    return { id, name, built, state: built ? "ok" : "absent", summary: built ? on : "not built", about, requires };
  };
  switch (id) {
    case "gateway":
      return {
        id,
        name: "Network",
        built: true,
        state: "ok",
        summary: precise
          ? `${Math.round(m.peakRps)} requests/s at peak`
          : `traffic ${m.peakRps > 600 ? "heavy" : m.peakRps > 200 ? "steady" : "light"}`,
        about: has(s, "load_balancing")
          ? "Traffic enters here and is spread across your servers."
          : "Customer traffic enters here.",
      };
    case "app": {
      const failed = s.infra.appHosts.some((h) => h.status === "failed");
      const degraded = s.infra.appHosts.some((h) => h.status === "degraded");
      let state = utilState(m.appUtil);
      if (degraded && state === "ok") state = "warn";
      if (failed) state = "critical";
      return {
        id,
        name: "Servers",
        built: true,
        state,
        summary: `${m.servers} server${m.servers === 1 ? "" : "s"}, ${loadText(precise, m.appUtil)}`,
        about: "Run your app. Every request passes through here.",
      };
    }
    case "standby":
      return optional("Standby", "A spare server, ready to take over.", "standby", "warm spare");
    case "cache":
      return optional(
        "Cache",
        "Answers repeat requests so the database does not have to.",
        "caching",
        `-${pct(1 - dbLoadFactor(s) / BALANCE.db.queriesPerRequest)} database load`,
      );
    case "db": {
      let state = utilState(m.dbUtil);
      if (s.infra.dbHost.status === "degraded" && state === "ok") state = "warn";
      if (s.infra.dbHost.status === "failed") state = "down";
      return {
        id,
        name: "Database",
        built: true,
        state,
        summary: `${BALANCE.db.tiers[s.infra.dbTier].name} tier, ${loadText(precise, m.dbUtil)}`,
        about: "Stores all customer data. If it is slow, everything is.",
      };
    }
    case "replica":
      return optional("Replica", "A live copy of the database that shares its load.", "replicas", "in sync");
    case "backup":
      return optional("Backups", "Nightly copies of the database.", "backups", "nightly copies");
    case "monitoring":
      return optional(
        "Monitoring",
        "Shows what the system is doing.",
        "monitoring",
        has(s, "tracing") ? "dashboards and traces" : "dashboards",
      );
    case "deploy": {
      const waiting = s.releases.length;
      return {
        id,
        name: "Deploy",
        built: true,
        state: waiting > 0 ? "warn" : "ok",
        summary: waiting > 0 ? `${waiting} ready to ship` : "nothing waiting",
        about: "Finished work ships from here.",
      };
    }
    case "team":
      return {
        id,
        name: "Team",
        built: true,
        state: s.techDebt >= 75 ? "critical" : s.techDebt >= 55 ? "warn" : "ok",
        summary: `${m.freeEngineers} of ${s.engineers} free, debt ${Math.round(s.techDebt)}`,
        about: "Your engineers build, test and fix.",
      };
    case "growth":
      return {
        id,
        name: "Growth",
        built: true,
        state: "ok",
        summary: s.activePromos.length > 0 ? "campaign running" : `satisfaction ${Math.round(s.satisfaction)}`,
        about: "Run promotions to bring in users.",
      };
  }
}
