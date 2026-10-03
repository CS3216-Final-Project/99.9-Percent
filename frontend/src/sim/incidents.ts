import { BALANCE, PROMOS } from "./balance";
import {
  clamp,
  equipmentInfo,
  maxServers,
  routableHosts,
  selfHealingFleet,
  serverCapacity,
  utilisation,
  weeklyRevenue,
} from "./derive";
import { revertDeploy, rollbackTarget } from "./releases";
import { addAppHost, logEvent, newId } from "./state";
import { has } from "./tech";
import type {
  ActiveIncident,
  AttemptOutcome,
  EquipmentId,
  EvidenceItem,
  GameState,
  IncidentCause,
  IncidentType,
  RecoveryId,
} from "./types";

const I = BALANCE.incident;

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function money(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** 0 = no tooling, 1 = monitoring, 2 = monitoring + tracing. */
export function monitoringLevel(s: GameState): 0 | 1 | 2 {
  if (!has(s, "monitoring")) return 0;
  return has(s, "tracing") ? 2 : 1;
}

export function inspectSeconds(s: GameState): number {
  const level = monitoringLevel(s);
  return level === 2 ? I.inspectSeconds.tracing : level === 1 ? I.inspectSeconds.monitoring : I.inspectSeconds.none;
}

/* ------------------------------------------------------------------ */
/* Severity                                                            */
/* ------------------------------------------------------------------ */

function overloadSeverity(util: number): number {
  return clamp((1 - 1 / util) * 1.6 + 0.08, 0.12, 0.9);
}

function saturationSeverity(util: number): number {
  return clamp((1 - 1 / util) * 1.8 + 0.12, 0.15, 0.92);
}

function effectivePeak(inc: ActiveIncident): number {
  return inc.cause.peakRps * (1 - inc.shed);
}

function tempServers(s: GameState): number {
  return s.pendingTurn?.tempServers ?? 0;
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export interface IncidentSeed {
  type: IncidentType;
  peakRps: number;
  target?: "app" | "db";
  hostId?: string;
  releaseId?: string;
  severityRoll?: number;
  extraContributing?: string[];
}

function contributingFactors(s: GameState, seed: IncidentSeed, cause: IncidentCause): string[] {
  const out: string[] = [...(seed.extraContributing ?? [])];
  const pending = s.pendingTurn;
  const warned = pending?.planningWarnings ?? [];
  const users = (n: number) => Math.round(n).toLocaleString("en-US");

  if (seed.type === "app_overload" || seed.type === "db_saturation") {
    for (const id of cause.promos) out.push(`${PROMOS[id].name} added +${pct(PROMOS[id].spike)} traffic.`);
    if (pending?.surgeLabel) out.push(`${pending.surgeLabel}: +${pct(pending.surgeMult - 1)} traffic.`);
  }

  if (seed.type === "app_overload") {
    if (warned.includes("app_hot")) out.push("A server capacity warning was showing. Not enough was added.");
    const since = s.lastCapacityTurn.app;
    const then = s.history.find((h) => h.turn === since);
    if (since < s.turn && then) {
      out.push(`Server capacity last grew in week ${since} (${users(then.users)} users then, ${users(s.users)} now).`);
    } else if (since <= 1 && s.turn > 1) {
      out.push("Server capacity had not grown since the start.");
    }
    if (!has(s, "load_balancing") && s.infra.appHosts.length >= maxServers(s)) {
      out.push(`At the ${maxServers(s)}-server limit (no load balancer).`);
    }
  }

  if (seed.type === "db_saturation") {
    if (warned.includes("db_hot")) out.push("A database capacity warning was showing.");
    if (!has(s, "caching")) out.push("No caching: every read hit the database.");
    out.push(
      s.lastCapacityTurn.db <= 1
        ? `Still on the ${BALANCE.db.tiers[s.infra.dbTier].name} database tier from the start.`
        : `Database capacity last grew in week ${s.lastCapacityTurn.db}.`,
    );
    if (s.lastCapacityTurn.app >= s.turn - 1 && s.lastCapacityTurn.app > 1) {
      out.push("More servers let more requests reach the database.");
    }
  }

  if (seed.type === "deploy_regression") {
    const rec = s.deploys.find((d) => d.releaseId === seed.releaseId);
    if (rec) {
      out.push(`'${rec.title}' shipped ${rec.tested ? "tested" : "untested"} in week ${rec.turn} (${pct(rec.risk)} risk).`);
      if (rec.techDebtAtDeploy >= 40) out.push(`Tech debt was ${Math.round(rec.techDebtAtDeploy)}, raising the risk.`);
      if (!has(s, "deploy_testing")) out.push("No automated tests to catch it.");
    }
  }

  if (seed.type === "instance_failure") {
    const host = seed.target === "db" ? s.infra.dbHost : s.infra.appHosts.find((h) => h.id === seed.hostId);
    if (host?.degradedTurn !== undefined && warned.includes("host_degraded")) {
      out.push(`${host.id} showed faults since week ${host.degradedTurn} and was not replaced.`);
    }
    if (s.techDebt >= 50) out.push(`High tech debt (${Math.round(s.techDebt)}) wears machines out faster.`);
    if (seed.target === "app") {
      if (!has(s, "standby")) out.push("No standby server to take over.");
      if (!selfHealingFleet(s)) out.push("No load balancer with health checks, so traffic kept going to the dead server.");
    } else {
      if (!has(s, "replicas")) out.push("No database replica to take over.");
      if (!has(s, "backups")) out.push("No backups, so data could not be restored.");
    }
  }

  return out;
}

export function createIncident(s: GameState, seed: IncidentSeed): ActiveIncident {
  const u = utilisation(s, seed.peakRps, tempServers(s));
  const roll = seed.severityRoll ?? 0.5;
  const rec = seed.releaseId ? s.deploys.find((d) => d.releaseId === seed.releaseId) : undefined;
  const n = Math.max(1, s.infra.appHosts.length);

  let severity = 0.3;
  let title = "";
  let symptoms: string[] = [];

  switch (seed.type) {
    case "app_overload":
      severity = overloadSeverity(u.appUtil);
      title = "Requests are being refused";
      symptoms = [`${pct(severity)} of requests refused`, "Pages that load are very slow"];
      break;
    case "db_saturation":
      severity = saturationSeverity(u.dbUtil);
      title = "Requests are timing out";
      symptoms = [`${pct(severity)} of requests time out`, "Saving and searching hang"];
      break;
    case "deploy_regression":
      severity = clamp(0.22 + roll * 0.3 + s.techDebt / 500, 0.2, 0.75);
      title = "Errors have jumped";
      symptoms = [`${pct(severity)} of requests return errors`, "Speed is normal; only some actions fail"];
      break;
    case "instance_failure":
      if (seed.target === "db") {
        severity = 0.9;
        title = "Almost everything is failing";
        symptoms = [`${pct(severity)} of requests fail`, "Anything that needs data breaks"];
      } else {
        severity = clamp(1 / n + (n > 1 ? 0.08 : 0), 0.15, 0.95);
        title = n === 1 ? "The site is down" : "Some requests fail";
        symptoms =
          n === 1
            ? ["Nearly every request fails", "It started suddenly; traffic is normal"]
            : [`About 1 in ${n} requests fails`, "Retrying usually works; it started suddenly"];
      }
      break;
  }

  const cause: IncidentCause = {
    peakRps: seed.peakRps,
    appCapacity: u.appCapacity,
    dbCapacity: u.dbCapacity,
    appUtil: u.appUtil,
    dbUtil: u.dbUtil,
    techDebt: s.techDebt,
    servers: s.infra.appHosts.length,
    dbTier: s.infra.dbTier,
    hostId: seed.hostId,
    target: seed.target,
    releaseId: seed.releaseId,
    releaseTitle: rec?.title,
    releaseTested: rec?.tested,
    releaseRisk: rec?.risk,
    surgeLabel: s.pendingTurn?.surgeLabel,
    promos: s.pendingTurn?.promos ?? [],
    contributing: [],
  };
  cause.contributing = contributingFactors(s, seed, cause);

  return {
    id: newId(s, "inc"),
    turn: s.turn,
    type: seed.type,
    title,
    symptoms,
    severity,
    initialSeverity: severity,
    elapsed: 0,
    maxDuration: I.maxDuration,
    status: "active",
    cause,
    evidence: [],
    inspecting: null,
    pending: null,
    attempts: [],
    hints: [],
    damage: { downtimeMinutes: 0, usersLost: 0, revenueLost: 0, satisfactionLost: 0, moneySpent: 0 },
    shed: 0,
    dataLoss: false,
    standbyUsed: false,
  };
}

/* ------------------------------------------------------------------ */
/* Symptoms on the facility floor                                      */
/* ------------------------------------------------------------------ */

/** Equipment showing symptoms. Not the same thing as the root cause. */
export function symptomaticEquipment(s: GameState): EquipmentId[] {
  const inc = s.incident;
  if (!inc) return [];
  if (monitoringLevel(s) === 0) return ["gateway", "app"];
  if (inc.type === "db_saturation" || (inc.type === "instance_failure" && inc.cause.target === "db")) {
    return ["gateway", "app", "db"];
  }
  return ["gateway", "app"];
}

/** Equipment that can be investigated during an incident. */
export function inspectable(s: GameState): EquipmentId[] {
  const all: EquipmentId[] = ["gateway", "app", "cache", "db", "replica", "standby", "backup", "monitoring", "deploy", "growth"];
  return all.filter((id) => equipmentInfo(s, id).built);
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

function rootEquipment(inc: ActiveIncident): EquipmentId {
  switch (inc.type) {
    case "app_overload":
      return "app";
    case "db_saturation":
      return "db";
    case "deploy_regression":
      return "deploy";
    case "instance_failure":
      return inc.cause.target === "db" ? "db" : "app";
  }
}

function buildEvidence(s: GameState, inc: ActiveIncident, equipment: EquipmentId): EvidenceItem {
  const level = monitoringLevel(s);
  const precise = level >= 1;
  const c = inc.cause;
  const u = utilisation(s, effectivePeak(inc), tempServers(s));
  const prev = s.history.length > 0 ? s.history[s.history.length - 1].peakRps : c.peakRps;
  const trafficUp = prev > 0 && c.peakRps / prev > 1.15;
  const dbDown = inc.type === "instance_failure" && c.target === "db";
  const appDown = inc.type === "instance_failure" && c.target !== "db";
  const name = equipmentInfo(s, equipment).name;
  let text = "";

  switch (equipment) {
    case "gateway":
      text = precise
        ? `Peak ${Math.round(c.peakRps)} requests/s (last week ${Math.round(prev)}). ${pct(inc.severity)} failing.`
        : trafficUp
          ? "Traffic is far above normal."
          : "Traffic looks normal.";
      break;
    case "app": {
      const n = s.infra.appHosts.length;
      if (inc.type === "app_overload") {
        text = precise
          ? `CPU 100% on all ${n}. Demand is ${pct(u.appUtil)} of capacity.`
          : "CPU is maxed out. Requests are queuing.";
      } else if (inc.type === "db_saturation") {
        text = precise
          ? `CPU ${pct(clamp(u.appUtil * 0.45, 0.1, 0.6))}. Every worker is waiting on the database.`
          : "Servers are mostly idle, yet requests hang.";
      } else if (inc.type === "deploy_regression") {
        text = precise
          ? `CPU ${pct(clamp(u.appUtil * 0.8, 0.1, 0.9))}. One error repeats, in code from the latest release.`
          : "Servers are fine. The same error repeats in the log.";
      } else if (appDown) {
        text = precise
          ? `${c.hostId}: no response. The others are healthy.${selfHealingFleet(s) ? "" : " Traffic still goes to it."}`
          : `${c.hostId} does not respond.${n > 1 ? " The others do." : ""}`;
      } else {
        text = precise ? "CPU 10%. Cannot connect to the database." : "Servers are fine but cannot get any data.";
      }
      break;
    }
    case "db":
      if (inc.type === "db_saturation") {
        text = precise ? `CPU 100%. Demand is ${pct(u.dbUtil)} of capacity.` : "Even a simple query takes seconds.";
      } else if (dbDown) {
        text = precise
          ? `Primary is DOWN.${has(s, "replicas") ? " The replica is healthy." : ""}`
          : "The database does not respond.";
      } else {
        text = precise ? `CPU ${pct(clamp(u.dbUtil * 0.9, 0.05, 0.95))}. Healthy.` : "Queries return instantly.";
      }
      break;
    case "cache":
      text = dbDown ? "Serving what it holds. Misses fail." : "Normal.";
      break;
    case "replica":
      text = dbDown ? "Healthy and fully up to date." : "In sync.";
      break;
    case "standby":
      text = inc.standbyUsed ? "In service." : "Idle and ready.";
      break;
    case "backup":
      text = "Last night's backup is good.";
      break;
    case "deploy": {
      const rec = rollbackTarget(s);
      if (!rec) {
        text = "No recent deploys.";
      } else {
        const when = rec.turn === s.turn ? "this week" : `week ${rec.turn}`;
        const culprit = inc.type === "deploy_regression" && rec.releaseId === c.releaseId;
        text = `Last deploy: '${rec.title}', ${when}, ${rec.tested ? "tested" : "untested"}. ${culprit ? "Errors began right after." : "No errors after it."}`;
      }
      break;
    }
    case "monitoring": {
      const alerts: string[] = ["edge errors"];
      if (inc.type === "app_overload") alerts.push("server CPU");
      if (inc.type === "db_saturation") alerts.push("response time", "database CPU");
      if (inc.type === "deploy_regression") alerts.push("error log volume");
      if (appDown) alerts.push(has(s, "health_checks") ? `${c.hostId} heartbeat` : "server errors");
      if (dbDown) alerts.push("database heartbeat");
      text = `Alerts: ${alerts.join(", ")}.`;
      if (level === 2) {
        const trace =
          inc.type === "app_overload"
            ? "requests are rejected at the servers."
            : inc.type === "db_saturation"
              ? "90% of the time is spent waiting on the database."
              : inc.type === "deploy_regression"
                ? "requests fail inside app code."
                : appDown
                  ? `requests to ${c.hostId} never return.`
                  : "every database call fails.";
        text += ` Trace: ${trace}`;
      }
      break;
    }
    case "growth": {
      const promos = c.promos.map((id) => `${PROMOS[id].name} (+${pct(PROMOS[id].spike)})`);
      text = promos.length > 0 ? `Running: ${promos.join(", ")}.` : c.surgeLabel ? `No campaigns. ${c.surgeLabel}.` : "No campaigns running.";
      break;
    }
    case "team":
      text = `Standing by. Tech debt ${Math.round(s.techDebt)}.`;
      break;
  }

  return { equipment, title: name, text, anomalous: level === 2 && equipment === rootEquipment(inc), at: inc.elapsed };
}

/* ------------------------------------------------------------------ */
/* Recovery options                                                    */
/* ------------------------------------------------------------------ */

export interface RecoveryOption {
  id: RecoveryId;
  label: string;
  description: string;
  cost: number;
  costNote?: string;
  seconds: number;
  secondsNote?: string;
  enabled: boolean;
  reason?: string;
}

function scaleOutCount(s: GameState, inc: ActiveIncident): number {
  const room = maxServers(s) - s.infra.appHosts.length;
  if (room <= 0) return 0;
  const n = routableHosts(s) + tempServers(s);
  const balance = n + 1 > 1 && !has(s, "load_balancing") ? BALANCE.server.unbalancedPenalty : 1;
  const needed = Math.ceil(effectivePeak(inc) / (serverCapacity(s) * balance * 0.8)) - n;
  return clamp(needed, 1, room);
}

function emergencyDbCost(s: GameState): { cost: number; tier: number; viaRelease: boolean } | null {
  const tier = s.infra.dbTier + 1;
  if (tier >= BALANCE.db.tiers.length) return null;
  if (s.releases.some((r) => r.kind === "db_upgrade" && r.dbTier === tier && !r.needsFix)) {
    return { cost: 0, tier, viaRelease: true };
  }
  const task = s.tasks.find((t) => t.kind === "db_upgrade" && t.dbTier === tier);
  const full = Math.round(BALANCE.db.tiers[tier].cost * I.emergencyCostMult);
  return { cost: Math.max(0, full - (task?.costPaid ?? 0)), tier, viaRelease: false };
}

export function recoveryOptions(s: GameState): RecoveryOption[] {
  const inc = s.incident;
  if (!inc) return [];
  const busy = inc.pending !== null;
  const out: RecoveryOption[] = [];
  const A = I.actionSeconds;

  const guard = (opt: RecoveryOption): RecoveryOption => {
    if (opt.enabled && busy) return { ...opt, enabled: false, reason: "Another action is running." };
    if (opt.enabled && opt.cost > s.cash) return { ...opt, enabled: false, reason: `Needs ${money(opt.cost)}.` };
    return opt;
  };

  const count = scaleOutCount(s, inc);
  const perServer = Math.round(BALANCE.server.setupCost * I.emergencyCostMult);
  out.push(
    guard({
      id: "scale_out",
      label: count > 1 ? `Add ${count} servers` : "Add a server",
      description: "More server capacity, right now. They stay on the bill.",
      cost: Math.max(1, count) * perServer,
      seconds: A.scale_out,
      enabled: count > 0,
      reason: count > 0 ? undefined : has(s, "load_balancing") ? "At the 12-server limit." : "At the 3-server limit (needs Load Balancing).",
    }),
  );

  const db = emergencyDbCost(s);
  out.push(
    guard({
      id: "db_upgrade",
      label: "Upgrade database",
      description: db?.viaRelease
        ? "Rush the finished upgrade into production."
        : `Move to ${db ? BALANCE.db.tiers[db.tier].name : "the next tier"} now, at emergency price. Adds tech debt.`,
      cost: db?.cost ?? 0,
      seconds: A.db_upgrade,
      enabled: db !== null,
      reason: db ? undefined : "Already on the largest tier.",
    }),
  );

  const target = rollbackTarget(s);
  out.push(
    guard({
      id: "rollback",
      label: target ? `Roll back '${target.title}'` : "Roll back last deploy",
      description: "Undo the latest release. Its benefit goes away.",
      cost: 0,
      seconds: has(s, "safer_rollouts") ? A.rollbackSafe : A.rollback,
      enabled: target !== null,
      reason: target ? undefined : "No deploy in the last 2 weeks.",
    }),
  );

  const spare = has(s, "standby") || has(s, "replicas");
  out.push(
    guard({
      id: "failover",
      label: "Switch to spare",
      description: "Put the standby server or database replica into service.",
      cost: 0,
      seconds: A.failover,
      enabled: spare && !(inc.standbyUsed && !has(s, "replicas")),
      reason: spare ? (inc.standbyUsed ? "The standby is already in use." : undefined) : "No standby or replica.",
    }),
  );

  out.push(
    guard({
      id: "rate_limit",
      label: "Rate limit",
      description: "Turn some requests away so the rest get through. Temporary.",
      cost: 0,
      seconds: A.rate_limit,
      enabled: inc.shed === 0,
      reason: inc.shed === 0 ? undefined : "Already on.",
    }),
  );

  out.push(
    guard({
      id: "replace_instance",
      label: "Replace dead machine",
      description: "Check every machine and rebuild any that is dead. A dead database is restored from backup if you have one.",
      cost: 0,
      costNote: `${money(BALANCE.server.replaceCost * I.emergencyCostMult)}+`,
      seconds: A.replace_none,
      secondsNote: `${A.replace_none}-${A.replace_db}s`,
      enabled: true,
    }),
  );

  out.push(
    guard({
      id: "restart",
      label: "Restart servers",
      description: "Turn it off and on again.",
      cost: 0,
      seconds: A.restart,
      enabled: true,
    }),
  );

  return out;
}

/* ------------------------------------------------------------------ */
/* Player actions during an incident                                   */
/* ------------------------------------------------------------------ */

export function startInspect(s: GameState, equipment: EquipmentId): string | null {
  const inc = s.incident;
  if (!inc || inc.status !== "active") return "There is no active incident.";
  if (!inspectable(s).includes(equipment)) return "There is nothing to investigate there.";
  if (inc.inspecting) return "Your team is already investigating something.";
  if (inc.evidence.some((e) => e.equipment === equipment)) return "You already have evidence from there.";
  const total = inspectSeconds(s);
  inc.inspecting = { equipment, remaining: total, total };
  return null;
}

function failedHost(s: GameState): { role: "app" | "db"; id: string } | null {
  if (s.infra.dbHost.status === "failed") return { role: "db", id: s.infra.dbHost.id };
  const h = s.infra.appHosts.find((x) => x.status === "failed");
  return h ? { role: "app", id: h.id } : null;
}

export function startRecovery(s: GameState, id: RecoveryId): string | null {
  const inc = s.incident;
  if (!inc || inc.status !== "active") return "There is no active incident.";
  const opt = recoveryOptions(s).find((o) => o.id === id);
  if (!opt) return "Unknown action.";
  if (!opt.enabled) return opt.reason ?? "That action is not available.";

  let seconds = opt.seconds;
  if (id === "replace_instance") {
    const dead = failedHost(s);
    const A = I.actionSeconds;
    seconds = !dead ? A.replace_none : dead.role === "app" ? A.replace_app : has(s, "backups") ? A.replace_db_backup : A.replace_db;
  }
  if (opt.cost > 0) {
    s.cash -= opt.cost;
    inc.damage.moneySpent += opt.cost;
  }
  inc.pending = { id, remaining: seconds, total: seconds, cost: opt.cost, startedAt: inc.elapsed };
  return null;
}

export function requestHint(s: GameState): string | null {
  const inc = s.incident;
  if (!inc || inc.status !== "active") return "There is no active incident.";
  if (inc.hints.length >= 2) return "No more hints for this incident.";
  s.totals.hintsUsed += 1;
  if (inc.hints.length === 0) {
    inc.hints.push(`Look at: ${equipmentInfo(s, rootEquipment(inc)).name}.`);
    return null;
  }
  const options = recoveryOptions({ ...s, incident: { ...inc, pending: null } });
  const usable = (id: RecoveryId) => options.find((o) => o.id === id)?.enabled ?? false;
  let best: RecoveryId;
  switch (inc.type) {
    case "app_overload":
      best = usable("scale_out") ? "scale_out" : "rate_limit";
      break;
    case "db_saturation":
      best = usable("db_upgrade") ? "db_upgrade" : "rate_limit";
      break;
    case "deploy_regression":
      best = "rollback";
      break;
    case "instance_failure": {
      const spare = inc.cause.target === "db" ? has(s, "replicas") : has(s, "standby");
      best = spare ? "failover" : "replace_instance";
      break;
    }
  }
  const label = options.find((o) => o.id === best)?.label ?? best;
  inc.hints.push(`Try: ${label}.`);
  return null;
}

/* ------------------------------------------------------------------ */
/* Resolving a recovery action                                         */
/* ------------------------------------------------------------------ */

function finishAttempt(_s: GameState, inc: ActiveIncident, label: string, outcome: AttemptOutcome, note: string): void {
  const p = inc.pending;
  if (!p) return;
  inc.attempts.push({ id: p.id, label, startedAt: p.startedAt, finishedAt: inc.elapsed, cost: p.cost, outcome, note });
  inc.pending = null;
  if (outcome === "fixed") inc.status = "resolved";
  if (outcome === "mitigated") inc.status = "mitigated";
}

/** Re-evaluate a load incident after capacity or load changed. Returns true if it is over. */
function reassessLoad(s: GameState, inc: ActiveIncident): boolean {
  const u = utilisation(s, effectivePeak(inc), tempServers(s));
  if (inc.type === "app_overload") {
    if (u.appUtil <= 1) return true;
    inc.severity = Math.min(inc.severity, overloadSeverity(u.appUtil));
  } else if (inc.type === "db_saturation") {
    if (u.dbUtil <= 1) return true;
    inc.severity = Math.min(inc.severity, saturationSeverity(u.dbUtil));
  }
  return false;
}

function replaceAppHost(s: GameState, hostId: string): string {
  s.infra.appHosts = s.infra.appHosts.filter((h) => h.id !== hostId);
  return addAppHost(s).id;
}

function completeRecovery(s: GameState, inc: ActiveIncident): void {
  const p = inc.pending;
  if (!p) return;
  const appDown = inc.type === "instance_failure" && inc.cause.target !== "db";
  const dbDown = inc.type === "instance_failure" && inc.cause.target === "db";

  switch (p.id) {
    case "scale_out": {
      const count = Math.max(1, Math.round(p.cost / Math.round(BALANCE.server.setupCost * I.emergencyCostMult)));
      for (let i = 0; i < count; i++) addAppHost(s);
      s.totals.serversAdded += count;
      s.lastCapacityTurn.app = s.turn;
      const label = `Scaled out by ${count} app server${count === 1 ? "" : "s"}`;
      if (inc.type === "app_overload") {
        if (reassessLoad(s, inc)) {
          finishAttempt(s, inc, label, "fixed", "Capacity now covers demand.");
        } else {
          finishAttempt(
            s,
            inc,
            label,
            "partial",
            `Helped, but demand still exceeds capacity${s.infra.appHosts.length >= maxServers(s) ? " and you are at the server limit" : ""}.`,
          );
        }
      } else if (inc.type === "db_saturation") {
        finishAttempt(s, inc, label, "no_effect", "The database is the bottleneck, not the servers.");
      } else if (inc.type === "deploy_regression") {
        finishAttempt(s, inc, label, "no_effect", "New servers run the same broken code.");
      } else if (appDown) {
        inc.severity = clamp(1 / s.infra.appHosts.length, 0.05, inc.severity);
        finishAttempt(s, inc, label, "partial", "Helped a little. Traffic still goes to the dead server.");
      } else {
        finishAttempt(s, inc, label, "no_effect", "Servers were not the problem.");
      }
      break;
    }

    case "db_upgrade": {
      const tier = s.infra.dbTier + 1;
      const label = `Emergency database upgrade to ${BALANCE.db.tiers[tier]?.name ?? "next tier"}`;
      if (dbDown) {
        finishAttempt(s, inc, label, "no_effect", "A database that is down cannot be upgraded.");
        s.cash += p.cost;
        inc.damage.moneySpent -= p.cost;
        break;
      }
      const release = s.releases.find((r) => r.kind === "db_upgrade" && r.dbTier === tier);
      if (release) s.releases = s.releases.filter((r) => r.id !== release.id);
      s.tasks = s.tasks.filter((t) => !(t.kind === "db_upgrade" && t.dbTier === tier) && t.releaseId !== release?.id);
      s.infra.dbTier = tier;
      s.lastCapacityTurn.db = s.turn;
      s.techDebt = clamp(s.techDebt + BALANCE.debt.emergencyChange, 0, 100);
      if (inc.type === "db_saturation") {
        if (reassessLoad(s, inc)) {
          finishAttempt(s, inc, label, "fixed", "The bigger tier handles the load.");
        } else {
          finishAttempt(s, inc, label, "partial", "Helped, but demand still exceeds capacity.");
        }
      } else {
        finishAttempt(s, inc, label, "no_effect", "The database was fine. You keep the bigger tier and its bill.");
      }
      break;
    }

    case "rollback": {
      const rec = rollbackTarget(s);
      if (!rec) {
        finishAttempt(s, inc, "Rollback", "no_effect", "Nothing to roll back.");
        break;
      }
      const culprit = inc.type === "deploy_regression" && rec.releaseId === inc.cause.releaseId;
      revertDeploy(s, rec, culprit);
      const label = `Rolled back '${rec.title}'`;
      if (culprit) {
        finishAttempt(s, inc, label, "fixed", "The broken release is gone. It needs a fix before it ships again.");
      } else if (inc.type === "deploy_regression") {
        finishAttempt(s, inc, label, "no_effect", "Wrong release. Its benefit is gone until you redeploy.");
      } else {
        finishAttempt(s, inc, label, "no_effect", "The release was not the cause. Its benefit is gone until you redeploy.");
        // Undoing capacity can make a load incident worse.
        if (inc.type === "app_overload" || inc.type === "db_saturation") {
          const u = utilisation(s, effectivePeak(inc), tempServers(s));
          inc.severity = Math.max(
            inc.severity,
            inc.type === "app_overload" ? overloadSeverity(u.appUtil) : saturationSeverity(u.dbUtil),
          );
        }
      }
      break;
    }

    case "failover": {
      if (appDown && has(s, "standby")) {
        const newId = replaceAppHost(s, inc.cause.hostId ?? "");
        s.cash -= BALANCE.server.replaceCost;
        inc.damage.moneySpent += BALANCE.server.replaceCost;
        finishAttempt(s, inc, "Failed over to the standby server", "fixed", `The standby took over as ${newId}. A new standby cost ${money(BALANCE.server.replaceCost)}.`);
      } else if (dbDown && has(s, "replicas")) {
        s.infra.dbHost = { id: "db-primary", status: "healthy", bornTurn: s.turn };
        s.cash -= BALANCE.db.replaceCost;
        inc.damage.moneySpent += BALANCE.db.replaceCost;
        finishAttempt(s, inc, "Failed over to the database replica", "fixed", `The replica took over with no data lost. A new replica cost ${money(BALANCE.db.replaceCost)}.`);
      } else if (inc.type === "app_overload" && has(s, "standby") && !inc.standbyUsed && s.pendingTurn) {
        inc.standbyUsed = true;
        s.pendingTurn.tempServers += 1;
        if (reassessLoad(s, inc)) {
          finishAttempt(s, inc, "Brought the standby server into rotation", "fixed", "The standby covered this week's peak.");
        } else {
          finishAttempt(s, inc, "Brought the standby server into rotation", "partial", "Helped, but not enough.");
        }
      } else if (dbDown) {
        finishAttempt(s, inc, "Attempted failover", "no_effect", "The standby is a server. It cannot replace the database.");
      } else if (appDown) {
        finishAttempt(s, inc, "Attempted failover", "no_effect", "The replica is a database. It cannot replace a server.");
      } else {
        finishAttempt(s, inc, "Attempted failover", "no_effect", "Nothing had failed, so the spare had nothing to replace.");
      }
      break;
    }

    case "rate_limit": {
      if (inc.type === "app_overload" || inc.type === "db_saturation") {
        const u = utilisation(s, inc.cause.peakRps, tempServers(s));
        const util = inc.type === "app_overload" ? u.appUtil : u.dbUtil;
        inc.shed = clamp(1 - 0.92 / util, 0.05, 0.8);
        finishAttempt(
          s,
          inc,
          "Enabled rate limiting",
          "mitigated",
          `${pct(inc.shed)} of requests are turned away so the rest work. Capacity is unchanged.`,
        );
      } else if (inc.type === "deploy_regression") {
        finishAttempt(s, inc, "Enabled rate limiting", "no_effect", "The same share of requests still hit the bug.");
      } else {
        finishAttempt(s, inc, "Enabled rate limiting", "no_effect", "Load was not the problem.");
      }
      break;
    }

    case "replace_instance": {
      const dead = failedHost(s);
      if (!dead) {
        finishAttempt(s, inc, "Probed every machine", "no_effect", "Every machine responded. Nothing to replace.");
        break;
      }
      if (dead.role === "app") {
        const cost = Math.round(BALANCE.server.replaceCost * I.emergencyCostMult);
        s.cash -= cost;
        inc.damage.moneySpent += cost;
        p.cost = cost;
        const fresh = replaceAppHost(s, dead.id);
        const cured = appDown || (inc.type === "app_overload" && reassessLoad(s, inc));
        finishAttempt(s, inc, `Replaced ${dead.id}`, cured ? "fixed" : "partial", `${dead.id} was dead. ${fresh} replaced it.`);
      } else {
        const cost = Math.round(BALANCE.db.replaceCost * I.emergencyCostMult);
        s.cash -= cost;
        inc.damage.moneySpent += cost;
        p.cost = cost;
        s.infra.dbHost = { id: "db-primary", status: "healthy", bornTurn: s.turn };
        if (has(s, "backups")) {
          finishAttempt(s, inc, "Rebuilt the database from backup", "fixed", "Rebuilt from last night's backup. No data lost.");
        } else {
          inc.dataLoss = true;
          finishAttempt(s, inc, "Rebuilt the database from scratch", "fixed", "Rebuilt, but with no backups the recent data is gone.");
        }
      }
      break;
    }

    case "restart": {
      finishAttempt(
        s,
        inc,
        "Restarted the app servers",
        "no_effect",
        appDown ? "The dead server did not come back." : "The same errors came straight back.",
      );
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* The crisis clock                                                    */
/* ------------------------------------------------------------------ */

function accrue(s: GameState, inc: ActiveIncident, minutes: number, severity: number): void {
  const hours = minutes / 60;
  inc.damage.downtimeMinutes += severity * minutes;
  inc.damage.usersLost += s.users * severity * I.userLossPerHour * hours;
  inc.damage.revenueLost += weeklyRevenue(s) * severity * I.refundPerHour * hours;
  inc.damage.satisfactionLost += severity * I.satLossPerHour * hours;
}

/** Nobody fixed it in time: the outage drags on and resolves itself the hard way. */
function failIncident(s: GameState, inc: ActiveIncident): void {
  inc.status = "failed";
  inc.pending = null;
  inc.inspecting = null;
  accrue(s, inc, I.failureExtraMinutes, inc.severity * I.failureExtraSeverity);

  if (inc.type === "app_overload" || inc.type === "db_saturation") {
    const u = utilisation(s, inc.cause.peakRps, tempServers(s));
    const util = inc.type === "app_overload" ? u.appUtil : u.dbUtil;
    inc.shed = Math.max(inc.shed, clamp(1 - 0.92 / util, 0.05, 0.8));
  } else if (inc.type === "deploy_regression") {
    const rec = s.deploys.find((d) => d.releaseId === inc.cause.releaseId && !d.rolledBack);
    if (rec) revertDeploy(s, rec, true);
    s.latentRegression = null;
  } else {
    const dead = failedHost(s);
    if (dead?.role === "app") {
      const cost = Math.round(BALANCE.server.replaceCost * I.emergencyCostMult);
      s.cash -= cost;
      inc.damage.moneySpent += cost;
      replaceAppHost(s, dead.id);
    } else if (dead?.role === "db") {
      const cost = Math.round(BALANCE.db.replaceCost * I.emergencyCostMult);
      s.cash -= cost;
      inc.damage.moneySpent += cost;
      s.infra.dbHost = { id: "db-primary", status: "healthy", bornTurn: s.turn };
      if (!has(s, "backups")) inc.dataLoss = true;
    }
  }
}

/**
 * Advance the incident clock by `dt` seconds. Damage accrues for as long as the
 * incident is active, so slow diagnosis and wrong fixes cost customers.
 */
export function tickIncident(s: GameState, dt: number): void {
  const inc = s.incident;
  if (!inc || inc.status !== "active") return;
  let remaining = Math.max(0, dt);
  while (remaining > 1e-9 && inc.status === "active") {
    const step = Math.min(0.25, remaining);
    remaining -= step;
    inc.elapsed += step;
    accrue(s, inc, step, inc.severity);

    if (inc.inspecting) {
      inc.inspecting.remaining -= step;
      if (inc.inspecting.remaining <= 1e-9) {
        inc.evidence.push(buildEvidence(s, inc, inc.inspecting.equipment));
        inc.inspecting = null;
      }
    }
    if (inc.pending) {
      inc.pending.remaining -= step;
      if (inc.pending.remaining <= 1e-9) completeRecovery(s, inc);
    }
    if (inc.status === "active" && inc.elapsed >= inc.maxDuration) failIncident(s, inc);
  }
  if (inc.status !== "active") {
    logEvent(
      s,
      inc.status === "failed" ? "incident" : "success",
      inc.status === "resolved"
        ? `Incident resolved after ${Math.round(inc.elapsed)} minutes.`
        : inc.status === "mitigated"
          ? `Incident mitigated with rate limiting after ${Math.round(inc.elapsed)} minutes.`
          : "The incident was not resolved in time and dragged on for hours.",
    );
  }
}
