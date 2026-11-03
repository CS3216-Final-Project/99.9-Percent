import { BALANCE } from "./balance";
import { canKeepPlaying, clamp, uptime } from "./derive";
import { BRANCHES, completedTechIds, TECH, TECH_ORDER } from "./tech";
import type { Branch, GameState, Outcome } from "./types";

export interface EndReport {
  outcome: Outcome;
  /** The week the Series A was secured, whether the run ended there or played on; null if it never was. */
  seriesAWeek: number | null;
  /** A won run that can still carry on past its Series A. */
  canKeepPlaying: boolean;
  headline: string;
  summary: string;
  grade: "S" | "A" | "B" | "C" | "D";
  score: number;
  weeks: number;
  users: number;
  peakUsers: number;
  cash: number;
  totalRevenue: number;
  totalCosts: number;
  invested: number;
  uptime: number;
  /** "three nines" style label for the uptime figure. */
  nines: string;
  incidents: { total: number; resolved: number; mitigated: number; failed: number; automatic: number };
  techCount: number;
  techTotal: number;
  /** Which branch the player leaned on most, by completed nodes. */
  focus: { branch: Branch; name: string; count: number }[];
  hintsUsed: number;
  promosRun: number;
  releasesTested: number;
  releasesUntested: number;
  seed: number;
  takeaways: string[];
}

function ninesLabel(u: number): string {
  if (u >= 0.9999) return "four nines";
  if (u >= 0.999) return "three nines";
  if (u >= 0.99) return "two nines";
  if (u >= 0.9) return "one nine";
  return "below one nine";
}

export function buildReport(s: GameState): EndReport {
  const outcome: Outcome = s.outcome ?? "deadline";
  const up = uptime(s);
  const pms = s.postmortems;
  const incidents = {
    total: pms.length,
    resolved: pms.filter((p) => p.outcome === "resolved").length,
    mitigated: pms.filter((p) => p.outcome === "mitigated").length,
    failed: pms.filter((p) => p.outcome === "failed").length,
    automatic: pms.filter((p) => p.outcome === "auto_mitigated").length,
  };

  // A run that played on past its Series A keeps the credit for it, so continuing never costs the win.
  const seriesAWeek = s.seriesAWeek ?? (outcome === "won" ? s.totals.weeks : null);
  const progress = clamp(s.totals.peakUsers / BALANCE.targetUsers, 0, 1);
  // 98.5% scores nothing, 99.99% scores full marks.
  const uptimeScore = clamp((up - 0.985) / 0.0149, 0, 1);
  const speed = seriesAWeek !== null ? clamp((BALANCE.maxTurns - seriesAWeek) / 10, 0, 1) : 0;
  const solvency = outcome === "bankrupt" ? 0 : clamp(s.cash / 100_000, 0, 1);
  let score = Math.round(progress * 50 + uptimeScore * 25 + speed * 15 + solvency * 10);
  if (outcome === "bankrupt" && seriesAWeek === null) score = Math.min(score, 45);
  const grade: EndReport["grade"] =
    seriesAWeek !== null && score >= 88 && up >= 0.999 ? "S" : score >= 75 ? "A" : score >= 58 ? "B" : score >= 40 ? "C" : "D";

  const completed = completedTechIds(s);
  const focus = BRANCHES.map((b) => ({
    branch: b.id,
    name: b.name,
    count: completed.filter((t) => TECH[t].branch === b.id).length,
  })).sort((a, b) => b.count - a.count);

  const takeaways: string[] = [];
  if (incidents.failed > 0) {
    takeaways.push(`${incidents.failed} incident${incidents.failed === 1 ? "" : "s"} ran past 2 hours. Monitoring speeds up diagnosis.`);
  }
  if (incidents.mitigated > 0) {
    takeaways.push(`Rate limiting used ${incidents.mitigated} time${incidents.mitigated === 1 ? "" : "s"}. It buys time but costs uptime.`);
  }
  if (incidents.automatic > 0) {
    takeaways.push(`Automation absorbed ${incidents.automatic} failure${incidents.automatic === 1 ? "" : "s"}.`);
  }
  if (s.totals.releasesUntested > s.totals.releasesTested && pms.some((p) => p.type === "deploy_regression")) {
    takeaways.push("Untested releases broke production.");
  }
  if (s.techDebt >= 60) takeaways.push(`Tech debt ended at ${Math.round(s.techDebt)}, slowing engineers and raising risk.`);
  if (outcome === "bankrupt") takeaways.push("Cash ran out. Watch the weekly net under Cash.");
  if (outcome === "deadline") takeaways.push("Growth was too slow. Promote more, with capacity to match.");
  if (takeaways.length === 0) takeaways.push("A clean run.");

  const headline =
    outcome === "won" ? "Series A secured" : outcome === "bankrupt" ? "Out of cash" : "Out of time";
  const summary =
    outcome === "won"
      ? `${BALANCE.targetUsers.toLocaleString("en-US")} users in ${s.totals.weeks} weeks.`
      : outcome === "bankrupt" && s.seriesAWeek !== undefined
        ? `Series A in week ${s.seriesAWeek}, then out of cash in week ${s.totals.weeks} after peaking at ${s.totals.peakUsers.toLocaleString("en-US")} users.`
      : outcome === "bankrupt"
        ? `Bankrupt in week ${s.totals.weeks}, at ${s.totals.peakUsers.toLocaleString("en-US")} users.`
        : `${Math.round(s.users).toLocaleString("en-US")} of ${BALANCE.targetUsers.toLocaleString("en-US")} users by week ${s.totals.weeks}.`;

  return {
    outcome,
    seriesAWeek,
    canKeepPlaying: canKeepPlaying(s),
    headline,
    summary,
    grade,
    score,
    weeks: s.totals.weeks,
    users: Math.round(s.users),
    peakUsers: s.totals.peakUsers,
    cash: s.cash,
    totalRevenue: s.totals.revenue,
    totalCosts: s.totals.costs,
    invested: s.totals.invested,
    uptime: up,
    nines: ninesLabel(up),
    incidents,
    techCount: completed.length,
    techTotal: TECH_ORDER.length,
    focus,
    hintsUsed: s.totals.hintsUsed,
    promosRun: s.totals.promosRun,
    releasesTested: s.totals.releasesTested,
    releasesUntested: s.totals.releasesUntested,
    seed: s.seed,
    takeaways,
  };
}
