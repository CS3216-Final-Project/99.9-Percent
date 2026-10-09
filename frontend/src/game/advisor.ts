import {
  BALANCE,
  currentWarnings,
  has,
  metrics,
  PROMOS,
  promoCooldownLeft,
  promoCost,
  TECH,
  TECH_ORDER,
  techStatus,
  type GameState,
  type PromoId,
  type TechId,
} from "@/sim";
import { useGame } from "./store";

/**
 * The single "Next" prompt. It turns the game's own warning signs and state
 * into one suggested move with a button, so a new player always has something
 * sensible to do. It never reveals more than the player's tooling can see.
 */
export interface NextMove {
  text: string;
  tone: "go" | "warn" | "critical";
  cta?: { label: string; price?: number; run: () => void };
}

const store = () => useGame.getState();

function openTech(id: TechId): NextMove["cta"] {
  return { label: TECH[id].name, run: () => store().focusTech(id) };
}

export function nextMove(g: GameState): NextMove {
  if(g.campaign)return {text:"Compare demand, capacity and unfinished work. Which measurement changed?",tone:g.phase==="incident"?"warn":"go"};
  const m = metrics(g);
  const warnings = currentWarnings(g);
  const find = (code: string) => warnings.find((w) => w.code === code);

  const addServer: NextMove["cta"] =
    m.servers < m.maxServers
      ? { label: "Add server", price: BALANCE.server.setupCost, run: () => store().act({ type: "add_server" }) }
      : has(g, "load_balancing")
        ? undefined
        : openTech("load_balancing");

  const dbBusy = g.tasks.some((t) => t.kind === "db_upgrade") || g.releases.some((r) => r.kind === "db_upgrade");
  const nextTier = BALANCE.db.tiers[g.infra.dbTier + 1];
  const dbCta: NextMove["cta"] = dbBusy
    ? { label: "See progress", run: () => store().openView("engineers") }
    : nextTier
      ? { label: "Upgrade", price: nextTier.cost, run: () => store().act({ type: "start_db_upgrade" }) }
      : techStatus(g, "caching") === "available"
        ? openTech("caching")
        : undefined;

  const app = find("app_hot");
  const db = find("db_hot");
  if (app?.level === "critical") return { text: app.text, tone: "critical", cta: addServer };
  if (db?.level === "critical") return { text: db.text, tone: "critical", cta: dbCta };

  const sickServer = g.infra.appHosts.find((h) => h.status === "degraded");
  if (sickServer) {
    return {
      text: m.hasMonitoring || has(g, "health_checks") ? `${sickServer.id} is failing` : "A server is failing",
      tone: "warn",
      cta: { label: "Replace", price: BALANCE.server.replaceCost, run: () => store().act({ type: "replace_host", hostId: sickServer.id }) },
    };
  }
  if (g.infra.dbHost.status === "degraded") {
    return {
      text: "Database machine is failing",
      tone: "warn",
      cta: { label: "Replace", price: BALANCE.db.replaceCost, run: () => store().act({ type: "replace_host", hostId: g.infra.dbHost.id }) },
    };
  }

  // A known surge is coming and the servers were already fairly busy.
  const surge = g.upcomingSurge;
  if (surge && surge.turn - g.turn <= 1 && addServer?.price) {
    const projected = m.hasMonitoring && surge.turn === g.turn ? m.forecast.appHigh : m.appUtil * surge.mult * 1.12;
    if (projected >= 0.85) {
      return { text: `Surge ${surge.turn === g.turn ? "this week" : "next week"}: add a server`, tone: "warn", cta: addServer };
    }
  }

  const release = g.releases.find((r) => !r.needsFix && !g.tasks.some((t) => t.releaseId === r.id));
  if (release) return { text: `${release.title} is built`, tone: "go", cta: { label: "Ship or test", run: () => store().select("deploy") } };

  if (find("unassigned_work")) {
    return { text: "A task needs engineers", tone: "warn", cta: { label: "Assign", run: () => store().openView("engineers") } };
  }

  if (app) return { text: app.text, tone: "warn", cta: addServer };
  if (db) return { text: db.text, tone: "warn", cta: dbCta };

  const reserve = 8_000;
  if (m.freeEngineers > 0 && g.tasks.length < 3 && TECH_ORDER.some((id) => techStatus(g, id) === "available" && TECH[id].cost <= g.cash - reserve)) {
    return {
      text: `${m.freeEngineers} engineer${m.freeEngineers === 1 ? "" : "s"} idle`,
      tone: "go",
      cta: { label: "Pick an upgrade", run: () => store().openView("tech") },
    };
  }

  // Suggest a promotion only when the servers have room for the extra traffic.
  const order: PromoId[] = ["targeted", "launch", "social"];
  for (const id of order) {
    const def = PROMOS[id];
    if (def.minUsers && Math.max(g.users, g.totals.peakUsers) < def.minUsers) continue;
    if (def.requires && !has(g, def.requires)) continue;
    if (g.activePromos.includes(id) || promoCooldownLeft(g, id) > 0) continue;
    const cost = promoCost(g, id);
    const load = (m.hasMonitoring ? m.forecast.appHigh : m.appUtil * 1.12) * (1 + def.spike);
    if (cost > g.cash - reserve || load >= 0.95) continue;
    return { text: "Bring in more users", tone: "go", cta: { label: def.name, price: cost, run: () => store().act({ type: "launch_promotion", promo: id }) } };
  }

  if (find("debt_high") && !g.tasks.some((t) => t.kind === "debt_paydown")) {
    return { text: "Tech debt is high", tone: "warn", cta: { label: "Pay it down", run: () => store().act({ type: "start_debt_paydown" }) } };
  }

  const runway = find("runway_low");
  if (runway) return { text: runway.text, tone: "critical" };

  return { text: "All set", tone: "go", cta: { label: "Next week", run: () => store().advance() } };
}
