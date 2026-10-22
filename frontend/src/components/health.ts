import { metrics, type GameState } from "@/sim";
import type { IconName } from "./icons";

/** The run's health word, tone and icon, as the top bar shows them. */
export function healthOf(game: GameState): { word: string; tone: "ok" | "warn" | "critical"; icon: IconName } {
  if (game.phase === "incident") return { word: "Incident", tone: "critical", icon: "incident" };
  const m = metrics(game);
  const worst = Math.max(m.appUtil, m.dbUtil);
  const faults = game.infra.dbHost.status !== "healthy" || game.infra.appHosts.some((h) => h.status !== "healthy");
  if (worst >= 1 || game.live.shed > 0) return { word: "Degraded", tone: "critical", icon: "fire" };
  if (worst >= 0.85 || faults) return { word: "At risk", tone: "warn", icon: "alert" };
  return { word: "Healthy", tone: "ok", icon: "health" };
}
