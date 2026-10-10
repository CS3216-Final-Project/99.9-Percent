import {
  advanceTurn,
  applyAction,
  BALANCE,
  forecast,
  freeEngineers,
  has,
  incidentTick,
  metrics,
  newLegacyGame,
  PROMO_ORDER,
  recoveryOptions,
  releaseRisk,
  TECH,
  techStatus,
  type Action,
  type GameState,
  type RecoveryId,
  type TechId,
} from "../index";

/** Scripted players used to check that the game is winnable, losable and balanced. */

export type IncidentSkill = "ignore" | "rate_limit" | "expert";

export function act(s: GameState, action: Action): GameState {
  const r = applyAction(s, action);
  return r.ok ? r.state : s;
}

function bestAction(s: GameState): RecoveryId {
  const inc = s.incident!;
  const usable = (id: RecoveryId) => recoveryOptions(s).find((o) => o.id === id)?.enabled ?? false;
  switch (inc.type) {
    case "app_overload":
      return usable("scale_out") ? "scale_out" : usable("failover") ? "failover" : "rate_limit";
    case "db_saturation":
      return usable("db_upgrade") ? "db_upgrade" : "rate_limit";
    case "deploy_regression":
      return "rollback";
    case "instance_failure": {
      const spare = inc.cause.target === "db" ? has(s, "replicas") : has(s, "standby");
      return spare ? "failover" : "replace_instance";
    }
  }
}

export function handleIncident(start: GameState, skill: IncidentSkill): GameState {
  let s = start;
  let guard = 0;
  if (skill !== "ignore") s = incidentTick(s, skill === "expert" ? 20 : 12);
  while (s.phase === "incident" && guard++ < 400) {
    if (skill !== "ignore" && s.incident && !s.incident.pending) {
      const id: RecoveryId = skill === "rate_limit" ? "rate_limit" : bestAction(s);
      const r = applyAction(s, { type: "incident_action", recovery: id });
      if (r.ok) s = r.state;
      else if (skill === "expert") {
        const fallback = applyAction(s, { type: "incident_action", recovery: "rate_limit" });
        if (fallback.ok) s = fallback.state;
      }
    }
    s = incidentTick(s, 2);
  }
  if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
  return s;
}

export type Strategy = (s: GameState) => GameState;

export const idle: Strategy = (s) => s;

/** Chases growth and ignores infrastructure entirely. */
export const promoOnly: Strategy = (start) => {
  let s = start;
  for (const r of s.releases) s = act(s, { type: "deploy_release", releaseId: r.id });
  for (const t of s.tasks) s = act(s, { type: "assign_engineers", taskId: t.id, count: 3 });
  for (const p of PROMO_ORDER) s = act(s, { type: "launch_promotion", promo: p });
  return s;
};

const BUILD_ORDER: TechId[] = [
  "larger_servers",
  "caching",
  "load_balancing",
  "cache_tuning",
  "standby",
  "health_checks",
  "autoscaling",
  "auto_failover",
];

/** A sensible player: keeps capacity ahead of demand, tests releases, grows steadily. */
export const balanced: Strategy = (start) => {
  let s = start;

  // Ship or test finished work.
  for (const r of [...s.releases]) {
    if (r.needsFix) continue;
    if (r.tested || releaseRisk(s, r) < 0.12) s = act(s, { type: "deploy_release", releaseId: r.id });
    else if (!s.tasks.some((t) => t.releaseId === r.id)) s = act(s, { type: "test_release", releaseId: r.id });
  }

  // Replace failing hardware.
  for (const h of s.infra.appHosts) {
    if (h.status !== "healthy") s = act(s, { type: "replace_host", hostId: h.id });
  }
  if (s.infra.dbHost.status !== "healthy") s = act(s, { type: "replace_host", hostId: s.infra.dbHost.id });

  // Promotions, when there is a cash cushion.
  const reserve = 12_000;
  for (const p of PROMO_ORDER) {
    if (s.cash > reserve + 8_000) s = act(s, { type: "launch_promotion", promo: p });
  }

  // Capacity ahead of demand.
  let guard = 0;
  while (forecast(s).appHigh > 0.82 && guard++ < 12) {
    const next = act(s, { type: "add_server" });
    if (next === s) break;
    s = next;
  }
  if (forecast(s).dbHigh > 0.75) s = act(s, { type: "start_db_upgrade" });

  // Hire once the company can afford it.
  if (metrics(s).net > 6_000 && s.engineers < 6 && s.cash > 40_000) s = act(s, { type: "hire_engineer" });

  // Engineering queue.
  if (s.techDebt > 45) s = act(s, { type: "start_debt_paydown" });
  for (const id of BUILD_ORDER) {
    if (freeEngineers(s) <= 0 || s.tasks.length >= 3) break;
    if (techStatus(s, id) === "available" && s.cash > TECH[id].cost + reserve) {
      s = act(s, { type: "start_tech", tech: id });
    }
  }
  // Staff tasks: repairs and tests first.
  const order = [...s.tasks].sort((a, b) => {
    const rank = (k: string) => (k === "fix_release" || k === "repair" ? 0 : k === "test_release" ? 1 : k === "db_upgrade" ? 2 : 3);
    return rank(a.kind) - rank(b.kind);
  });
  for (const t of order) s = act(s, { type: "assign_engineers", taskId: t.id, count: 0 });
  for (const t of order) {
    const want = Math.min(BALANCE.engineer.maxPerTask, freeEngineers(s), t.kind === "test_release" ? 1 : 2);
    if (want > 0) s = act(s, { type: "assign_engineers", taskId: t.id, count: want });
  }
  for (const t of order) {
    const cur = s.tasks.find((x) => x.id === t.id);
    if (cur && freeEngineers(s) > 0 && cur.assigned < BALANCE.engineer.maxPerTask) {
      s = act(s, { type: "assign_engineers", taskId: t.id, count: cur.assigned + 1 });
    }
  }
  return s;
};

export interface RunResult {
  state: GameState;
  turns: number;
}

export function runBot(seed: number, strategy: Strategy, skill: IncidentSkill): RunResult {
  let s = newLegacyGame(seed);
  let guard = 0;
  while (s.phase !== "ended" && guard++ < 200) {
    if (s.phase === "management") {
      s = strategy(s);
      s = advanceTurn(s);
    }
    if (s.phase === "incident") s = handleIncident(s, skill);
    if (s.phase === "review") s = act(s, { type: "acknowledge_review" });
  }
  return { state: s, turns: s.totals.weeks };
}
