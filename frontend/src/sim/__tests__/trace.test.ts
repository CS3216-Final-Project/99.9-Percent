// @vitest-environment node
import process from "node:process";
import { describe, it } from "vitest";
import { runBot, balanced, promoOnly, idle } from "./bots";

/**
 * Prints a week-by-week trace of a scripted run. Useful when rebalancing:
 *   TRACE=balanced npx vitest run src/sim/__tests__/trace.test.ts
 */
const which = process.env.TRACE;

describe.skipIf(!which)("trace", () => {
  it("prints a run", () => {
    const seed = Number(process.env.SEED ?? 9999);
    const { state } =
      which === "promo" ? runBot(seed, promoOnly, "rate_limit") : which === "idle" ? runBot(seed, idle, "ignore") : runBot(seed, balanced, "expert");
    const lines = state.history.map(
      (h) =>
        `wk ${String(h.turn).padStart(2)} users ${String(h.users).padStart(6)} cash ${String(Math.round(h.cash)).padStart(7)} rev ${String(Math.round(h.revenue)).padStart(6)} cost ${String(Math.round(h.costs)).padStart(6)} app ${(h.appUtil * 100).toFixed(0).padStart(3)}% db ${(h.dbUtil * 100).toFixed(0).padStart(3)}% srv ${String(h.servers).padStart(2)} sat ${h.satisfaction.toFixed(0)} debt ${h.techDebt.toFixed(0)} ${h.incident ?? ""}`,
    );
    console.log(lines.join("\n"));
    console.log(`outcome ${state.outcome} tech ${state.techDone.join(",")}`);
    console.log(state.log.filter((e) => e.kind === "decision" || e.kind === "incident" || e.kind === "milestone").map((e) => `  [${e.turn}] ${e.text}`).join("\n"));
  });
});
