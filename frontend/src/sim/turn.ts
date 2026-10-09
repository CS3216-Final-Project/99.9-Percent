import { step, advanceSteps } from "./step";
import { BALANCE, PROMOS } from "./balance";
import {
  arpu,
  autoscaleServers,
  churnRate,
  clamp,
  costs,
  currentWarnings,
  freeEngineers,
  latencyFor,
  organicRate,
  promoUsers,
  selfHealingFleet,
  utilisation,
  velocity,
} from "./derive";
import { createIncident, tickIncident, type IncidentSeed } from "./incidents";
import { autoPostmortem, buildPostmortem } from "./postmortem";
import { releaseTitle } from "./releases";
import { pick, rand, randRange } from "./rng";
import { addAppHost, clone, logEvent, newId } from "./state";
import { has } from "./tech";
import type { GameState, Task } from "./types";

function money(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function num(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Engineering                                                         */
/* ------------------------------------------------------------------ */

function completeTask(s: GameState, task: Task): void {
  s.tasks = s.tasks.filter((t) => t.id !== task.id);
  const shipped = has(s, "code_health") ? BALANCE.debt.perShippedTaskWithCodeHealth : BALANCE.debt.perShippedTask;

  switch (task.kind) {
    case "tech":
    case "db_upgrade": {
      const kind = task.kind;
      s.releases.push({
        id: newId(s, "rel"),
        title: releaseTitle(kind, { techId: task.techId, dbTier: task.dbTier }),
        kind,
        techId: task.techId,
        dbTier: task.dbTier,
        size: task.effort,
        tested: false,
        needsFix: false,
        readyTurn: s.turn,
      });
      s.techDebt = clamp(s.techDebt + shipped, 0, 100);
      logEvent(s, "success", `${task.title} is built and waiting at Build & Deploy.`);
      break;
    }
    case "debt_paydown": {
      const amount = has(s, "code_health") ? BALANCE.debt.paydownAmountWithCodeHealth : BALANCE.debt.paydownAmount;
      s.techDebt = clamp(s.techDebt - amount, 0, 100);
      logEvent(s, "success", `Refactoring finished: technical debt fell by ${amount} to ${Math.round(s.techDebt)}.`);
      break;
    }
    case "test_release": {
      const rel = s.releases.find((r) => r.id === task.releaseId);
      if (rel) {
        rel.tested = true;
        logEvent(s, "success", `'${rel.title}' passed testing and is safe to deploy.`);
      }
      break;
    }
    case "fix_release": {
      const rel = s.releases.find((r) => r.id === task.releaseId);
      if (rel) {
        rel.needsFix = false;
        rel.tested = true;
        logEvent(s, "success", `'${rel.title}' has been fixed and retested. It can be deployed again.`);
      }
      break;
    }
    case "repair": {
      logEvent(
        s,
        "success",
        task.repairCode === "data_repair" ? "Lost customer data has been reconciled as far as possible." : "Emergency patches from the outage have been cleaned up.",
      );
      break;
    }
  }
}

function progressTasks(s: GameState): void {
  const v = velocity(s);
  for (const task of [...s.tasks]) {
    if (task.assigned <= 0) continue;
    task.progress = Math.min(task.effort, task.progress + task.assigned * v);
    if (task.progress >= task.effort - 1e-6) completeTask(s, task);
  }
}

/* ------------------------------------------------------------------ */
/* Hardware health                                                     */
/* ------------------------------------------------------------------ */

interface HostFailure {
  role: "app" | "db";
  hostId: string;
}

function resolveHostHealth(s: GameState): HostFailure | null {
  let failure: HostFailure | null = null;

  for (const h of s.infra.appHosts) {
    if (h.status === "degraded" && (h.degradedTurn ?? s.turn) < s.turn && !failure) {
      if (rand(s) < BALANCE.hosts.failChance) {
        h.status = "failed";
        failure = { role: "app", hostId: h.id };
      }
    }
  }
  const db = s.infra.dbHost;
  if (db.status === "degraded" && (db.degradedTurn ?? s.turn) < s.turn && !failure) {
    if (rand(s) < BALANCE.hosts.failChance) {
      db.status = "failed";
      failure = { role: "db", hostId: db.id };
    }
  }

  if (s.turn >= BALANCE.hosts.safeUntilTurn) {
    const u = utilisation(s, s.live.peakRps);
    const debtMult = 1 + s.techDebt / BALANCE.hosts.debtHazardDivisor;
    const anyDegraded = s.infra.appHosts.some((h) => h.status === "degraded") || db.status === "degraded";
    if (!anyDegraded && !failure) {
      const appHazard = BALANCE.hosts.appHazard * debtMult * (u.appUtil > 0.85 ? BALANCE.hosts.hotMultiplier : 1);
      const dbHazard = BALANCE.hosts.dbHazard * debtMult * (u.dbUtil > 0.85 ? BALANCE.hosts.hotMultiplier : 1);
      let marked = false;
      if (rand(s) < appHazard) {
        // The oldest machine in the fleet wears out first.
        const h = [...s.infra.appHosts].sort((a, b) => a.bornTurn - b.bornTurn)[0];
        if (h) {
          h.status = "degraded";
          h.degradedTurn = s.turn;
          marked = true;
          logEvent(s, "warning", `${h.id} has started logging hardware errors.`);
        }
      }
      if (!marked && db.status === "healthy" && rand(s) < dbHazard) {
        db.status = "degraded";
        db.degradedTurn = s.turn;
        logEvent(s, "warning", "The database primary has started logging hardware errors.");
      }
    }
  }

  return failure;
}

/** Handles a failure with whatever automation exists. Returns the failure if a human is needed. */
function absorbFailure(s: GameState, failure: HostFailure, notes: string[]): { unhandled: HostFailure | null; capacityNote?: string } {
  const A = BALANCE.incident.autoMitigatedMinutes;
  if (failure.role === "app") {
    if (has(s, "standby") && has(s, "auto_failover") && selfHealingFleet(s)) {
      s.infra.appHosts = s.infra.appHosts.filter((h) => h.id !== failure.hostId);
      const fresh = addAppHost(s);
      s.cash -= BALANCE.server.replaceCost;
      s.totals.downtimeMinutes += A;
      s.postmortems.push(
        autoPostmortem(
          s,
          "instance_failure",
          `App server ${failure.hostId} stopped responding.`,
          ["You had built a Standby Server and Automatic Failover."],
          `Health checks noticed within seconds and promoted the standby as ${fresh.id}. A replacement standby cost ${money(BALANCE.server.replaceCost)}.`,
          BALANCE.server.replaceCost,
        ),
      );
      const text = `${failure.hostId} died; the spare took over automatically. Total application capacity is unchanged.`;
      logEvent(s, "success", text);
      notes.push(text);
      return { unhandled: null };
    }
    if (selfHealingFleet(s)) {
      const text = `${failure.hostId} died; the load balancer stopped sending it traffic. Capacity is down one server this week.`;
      logEvent(s, "warning", text);
      notes.push(text);
      return { unhandled: null, capacityNote: `${failure.hostId} failed this week, removing one server's worth of capacity.` };
    }
    return { unhandled: failure };
  }

  if (has(s, "replicas") && has(s, "auto_failover")) {
    s.infra.dbHost = { id: "db-primary", status: "healthy", bornTurn: s.turn };
    s.cash -= BALANCE.db.replaceCost;
    s.totals.downtimeMinutes += A;
    s.postmortems.push(
      autoPostmortem(
        s,
        "instance_failure",
        "The database primary stopped responding.",
        ["You had built a Database Replica and Automatic Failover."],
        `The replica was promoted within seconds with no data lost. A new replica cost ${money(BALANCE.db.replaceCost)}.`,
        BALANCE.db.replaceCost,
      ),
    );
    const text = "The database primary died; the replica was promoted automatically. No customer impact.";
    logEvent(s, "success", text);
    notes.push(text);
    return { unhandled: null };
  }
  return { unhandled: failure };
}

/* ------------------------------------------------------------------ */
/* Week resolution                                                     */
/* ------------------------------------------------------------------ */

const SURGE_LABELS = [
  "A viral post about your product is spreading",
  "An industry award shortlist names you",
  "A large customer is rolling you out company-wide",
  "A well-known podcast recommends you",
] as const;

/**
 * Resolve the week that was just planned. If something breaks, the game drops
 * into an incident and the rest of the week is settled once it ends.
 */
export function advanceTurn(prev: GameState): GameState {
  if (prev.campaign) return prev.phase === "management" ? step(prev).state : prev;
  if (prev.phase !== "management") return prev;
  const s = clone(prev);
  const notes: string[] = [];
  const planningWarnings = currentWarnings(s).map((w) => w.code);
  const idleEngineers = freeEngineers(s);
  const usersAtStart = s.users;

  progressTasks(s);
  if (has(s, "caching")) {
    const warmup = has(s, "cache_tuning") ? BALANCE.db.tunedWarmupPerWeek : BALANCE.db.cacheWarmupPerWeek;
    s.cacheWarmth = clamp((s.cacheWarmth ?? 1) + warmup, 0, 1);
  }

  // Promotions and surges bring people in during the week, so they count toward this week's peak.
  let spike = 1;
  let gained = 0;
  for (const id of s.activePromos) {
    const n = promoUsers(s, id);
    gained += n;
    spike *= 1 + PROMOS[id].spike;
    notes.push(`${PROMOS[id].name} brought in ${num(n)} new users.`);
  }
  let surgeLabel: string | undefined;
  let surgeMult = 1;
  if (s.upcomingSurge && s.upcomingSurge.turn === s.turn) {
    const n = Math.round(s.users * s.upcomingSurge.users);
    gained += n;
    surgeMult = s.upcomingSurge.mult;
    surgeLabel = s.upcomingSurge.label;
    notes.push(`${surgeLabel}: ${num(n)} new users.`);
    logEvent(s, "info", `${surgeLabel}. Traffic jumped by about ${Math.round((surgeMult - 1) * 100)}%.`);
  }
  s.users += gained;

  const noise = 1 + rand(s) * BALANCE.trafficNoise;
  const peakRps = s.users * BALANCE.rpsPerUser * spike * surgeMult * noise;

  const failure = resolveHostHealth(s);
  let unhandled: HostFailure | null = null;
  let capacityNote: string | undefined;
  if (failure) {
    const r = absorbFailure(s, failure, notes);
    unhandled = r.unhandled;
    capacityNote = r.capacityNote;
  }

  const autoscaled = autoscaleServers(s, peakRps);
  if (autoscaled > 0) {
    notes.push(`Autoscaling ran ${autoscaled} temporary server${autoscaled === 1 ? "" : "s"} (${money(autoscaled * BALANCE.server.autoscaleUpkeep)}).`);
  }

  s.pendingTurn = {
    peakRps,
    tempServers: autoscaled,
    autoscaled,
    idleEngineers,
    promos: [...s.activePromos],
    promoUsers: gained,
    surgeLabel,
    surgeMult,
    usersAtStart,
    planningWarnings,
    notes,
  };

  const u = utilisation(s, peakRps, autoscaled);
  let seed: IncidentSeed | null = null;

  if (s.latentRegression) {
    seed = { type: "deploy_regression", peakRps, releaseId: s.latentRegression.releaseId, severityRoll: rand(s) };
  } else if (unhandled) {
    seed = { type: "instance_failure", peakRps, target: unhandled.role, hostId: unhandled.hostId };
  } else if (u.dbUtil > 1 || u.appUtil > 1) {
    const extra = capacityNote ? [capacityNote] : [];
    seed =
      u.dbUtil > u.appUtil
        ? { type: "db_saturation", peakRps, extraContributing: extra }
        : { type: "app_overload", peakRps, extraContributing: extra };
  }

  if (seed) {
    s.incident = createIncident(s, seed);
    s.phase = "incident";
    logEvent(s, "incident", `Incident: ${s.incident.title.toLowerCase()}.`);
    return s;
  }

  finishTurn(s);
  return s;
}

/** Settle money, growth and satisfaction for the week, then move to the next one. */
function finishTurn(s: GameState): void {
  const p = s.pendingTurn;
  if (!p) return;
  const inc = s.incident;
  const usersBefore = p.usersAtStart;

  if (inc) {
    s.users = Math.max(0, s.users - inc.damage.usersLost);
    s.cash -= inc.damage.revenueLost;
    s.satisfaction = clamp(s.satisfaction - inc.damage.satisfactionLost, 0, 100);
    s.totals.downtimeMinutes += inc.damage.downtimeMinutes;
    s.totals.incidents += 1;
    if (inc.dataLoss) {
      s.users *= 1 - BALANCE.incident.dataLossUsers;
      s.satisfaction = clamp(s.satisfaction - BALANCE.incident.dataLossSatisfaction, 0, 100);
      s.tasks.push({
        id: newId(s, "task"),
        kind: "repair",
        repairCode: "data_repair",
        title: "Repair: reconcile lost customer data",
        effort: 3,
        progress: 0,
        assigned: 0,
        startedTurn: s.turn,
        costPaid: 0,
      });
    }
    if (inc.status === "failed") {
      s.tasks.push({
        id: newId(s, "task"),
        kind: "repair",
        repairCode: "cleanup",
        title: "Repair: clean up emergency patches",
        effort: 2,
        progress: 0,
        assigned: 0,
        startedTurn: s.turn,
        costPaid: 0,
      });
    }
    const pm = buildPostmortem(s, inc);
    s.postmortems.push(pm);
    s.reviewId = pm.id;
    p.notes.push(
      `${pm.title}: ${Math.round(inc.damage.usersLost)} users lost, ${Math.round(inc.damage.downtimeMinutes)} minutes of downtime.`,
    );
  }
  s.latentRegression = null;

  // A self-healing fleet rebuilds dead servers during the week.
  if (selfHealingFleet(s)) {
    for (const h of [...s.infra.appHosts]) {
      if (h.status !== "failed") continue;
      s.infra.appHosts = s.infra.appHosts.filter((x) => x.id !== h.id);
      addAppHost(s);
      s.cash -= BALANCE.server.replaceCost;
      p.notes.push(`${h.id} was rebuilt automatically (${money(BALANCE.server.replaceCost)}).`);
    }
  }

  const peakU = utilisation(s, p.peakRps, p.tempServers);
  const overflow = Math.max(0, 1 - 1 / Math.max(peakU.appUtil, 1e-6), 1 - 1 / Math.max(peakU.dbUtil, 1e-6));
  const shed = Math.max(inc?.shed ?? 0, overflow);
  const sustainedError = shed * BALANCE.peakShare;
  s.totals.downtimeMinutes += sustainedError * BALANCE.minutesPerWeek;
  const incidentDown = (inc?.damage.downtimeMinutes ?? 0) / BALANCE.minutesPerWeek;
  const availability = clamp(1 - sustainedError - incidentDown, 0, 1);

  const revenue = s.users * arpu(s) * (1 - sustainedError);
  const c = costs(s, p.autoscaled);
  s.cash += revenue - c.total;
  s.totals.revenue += revenue;
  s.totals.costs += c.total;

  const worstUtil = Math.min(1, Math.max(peakU.appUtil, peakU.dbUtil));
  const latencyPenalty = clamp((worstUtil - 0.7) / 0.3, 0, 1) * BALANCE.growth.latencyPenaltyMax;
  const errorPenalty = Math.min(BALANCE.growth.errorPenaltyMax, sustainedError * BALANCE.growth.errorPenaltyMult);
  const repairPenalty = s.tasks.some((t) => t.repairCode === "data_repair") ? BALANCE.growth.dataRepairPenalty : 0;
  const target = BALANCE.growth.satisfactionCeiling - latencyPenalty - errorPenalty - repairPenalty;
  s.satisfaction = clamp(s.satisfaction + (target - s.satisfaction) * BALANCE.growth.satisfactionInertia, 0, 100);

  const organic = s.users * organicRate(s.satisfaction);
  const churn = s.users * churnRate(s.satisfaction);
  s.users = Math.max(0, Math.round(s.users + organic - churn));
  s.totals.peakUsers = Math.max(s.totals.peakUsers, s.users);

  let debt = has(s, "code_health") ? BALANCE.debt.perTurnWithCodeHealth : BALANCE.debt.perTurn;
  debt -= p.idleEngineers * BALANCE.debt.idleEngineerRelief;
  if (s.tasks.some((t) => t.repairCode === "cleanup")) debt += BALANCE.debt.cleanupPenaltyPerTurn;
  s.techDebt = clamp(s.techDebt + debt, 0, 100);

  for (const [i, m] of BALANCE.milestones.entries()) {
    if (s.users >= m.users && !s.milestonesHit.includes(i)) {
      s.milestonesHit.push(i);
      s.cash += m.cash;
      logEvent(s, "milestone", `Milestone: ${m.label}. Investors released ${money(m.cash)}.`);
      p.notes.push(`Milestone reached: ${m.label} (+${money(m.cash)} from investors).`);
    }
  }

  const latencyMs = latencyFor(Math.max(peakU.appUtil, peakU.dbUtil));
  s.history.push({
    turn: s.turn,
    users: s.users,
    cash: s.cash,
    revenue,
    costs: c.total,
    net: revenue - c.total,
    peakRps: p.peakRps,
    appUtil: peakU.appUtil,
    dbUtil: peakU.dbUtil,
    appCapacity: peakU.appCapacity,
    dbCapacity: peakU.dbCapacity,
    availability,
    latencyMs,
    satisfaction: s.satisfaction,
    techDebt: s.techDebt,
    servers: s.infra.appHosts.length,
    incident: inc?.type,
    warnings: p.planningWarnings,
  });
  s.live = {
    peakRps: p.peakRps,
    tempServers: p.autoscaled,
    latencyMs,
    errorRate: 1 - availability,
    availability,
    shed,
  };
  s.totals.weeks += 1;
  s.lastReport = {
    turn: s.turn,
    usersBefore,
    usersAfter: s.users,
    revenue,
    costs: c.total,
    net: revenue - c.total,
    notes: p.notes,
  };
  logEvent(
    s,
    "finance",
    `Week closed with ${num(s.users)} users (${s.users >= usersBefore ? "+" : ""}${num(s.users - usersBefore)}), revenue ${money(revenue)}, costs ${money(c.total)}.`,
  );

  if (s.cash < 0) {
    s.outcome = "bankrupt";
    logEvent(s, "incident", "The company has run out of cash.");
  } else if (s.users >= BALANCE.targetUsers) {
    s.outcome = "won";
    logEvent(s, "milestone", `You reached ${num(BALANCE.targetUsers)} users. The Series A is yours.`);
  } else if (s.turn >= BALANCE.maxTurns) {
    s.outcome = "deadline";
    logEvent(s, "info", "The Series A meeting arrived before you reached the target.");
  }

  // Set up the next week.
  if (s.upcomingSurge && s.upcomingSurge.turn <= s.turn) s.upcomingSurge = null;
  s.turn += 1;
  s.activePromos = [];
  s.pendingTurn = null;
  s.incident = null;

  if (!s.outcome && !s.upcomingSurge && s.turn >= BALANCE.surge.randomFromTurn - 1) {
    if (rand(s) < BALANCE.surge.randomChance) {
      s.upcomingSurge = {
        turn: s.turn + 1,
        mult: Math.round(randRange(s, 1.2, 1.45) * 100) / 100,
        users: Math.round(randRange(s, 0.05, 0.1) * 100) / 100,
        label: pick(s, SURGE_LABELS),
        scripted: false,
      };
      logEvent(s, "warning", `${s.upcomingSurge.label}. Expect a traffic surge in week ${s.upcomingSurge.turn}.`);
    }
  }

  s.phase = inc ? "review" : s.outcome ? "ended" : "management";
}

/** Advance the crisis clock. When the incident ends, the week is settled and the postmortem written. */
export function incidentTick(prev: GameState, dt: number): GameState {
  if (prev.campaign) return advanceSteps(prev, Math.floor(dt)).state;
  if (prev.phase !== "incident" || !prev.incident) return prev;
  const s = clone(prev);
  tickIncident(s, dt);
  if (s.incident && s.incident.status !== "active") finishTurn(s);
  return s;
}

export function acknowledgeReview(prev: GameState): GameState {
  if (prev.phase !== "review") return prev;
  const s = clone(prev);
  s.reviewId = null;
  s.phase = s.outcome ? "ended" : "management";
  return s;
}
