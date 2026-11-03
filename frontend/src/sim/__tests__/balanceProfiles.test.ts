// @vitest-environment node
import { describe, expect, it } from "vitest";
import { APP_PROFILE_CHOICES, BALANCE, buildReport } from "../index";
import { balanced, idle, promoOnly, runBot } from "./bots";

const SEEDS = [9999, 1, 2, 3, 4, 5, 6, 7, 8, 42, 1234, 2026];

describe.each(APP_PROFILE_CHOICES)("%s balance", (profile) => {
  const rows = (strategy: typeof balanced, skill: Parameters<typeof runBot>[2]) => SEEDS.map((seed) => {
    const r = buildReport(runBot(seed, strategy, skill, profile).state);
    return { seed, outcome: r.outcome, weeks: r.weeks, users: r.users, cash: Math.round(r.cash), incidents: r.incidents.total };
  });

  it("balanced play wins on most seeds, inside the campaign length", () => {
    const all = rows(balanced, "expert");
    console.log(profile, all.map((r) => `${r.seed}:${r.outcome[0]}${r.weeks}/${r.users}/${r.cash}/i${r.incidents}`).join(" "));
    const wins = all.filter((r) => r.outcome === "won");
    expect(wins.length).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.75));
    for (const w of wins) expect(w.weeks).toBeLessThanOrEqual(BALANCE.maxTurns);
  });

  it("doing nothing never wins, and growth without infrastructure rarely does", () => {
    expect(rows(idle, "ignore").every((r) => r.outcome !== "won")).toBe(true);
    expect(rows(promoOnly, "rate_limit").filter((r) => r.outcome === "won").length).toBeLessThanOrEqual(1);
  });
});
