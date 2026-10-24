import type { Page, TestInfo } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { act, tick, spikeCompany } from "../src/sim/__tests__/spikeFixtures";
import { combinedCompany, finishRound, finishedCompany } from "../src/sim/__tests__/combinedFixture";

export type ReportCase = "prevention" | "spikes" | "growth" | "completion";
function fixture(kind: ReportCase) {
  if (kind === "completion") return finishedCompany();
  if (kind === "growth") return finishRound(act(tick(combinedCompany(), 5), { type: "start_growth_wave" }));
  if (kind === "spikes") {
    let game = act(spikeCompany(false), { type: "set_traffic_limit", enabled: true });
    for (let i = 0; i < 100 && game.campaign!.spikeStage!.completedStep == null; i++) game = tick(game);
    expect(game.campaign!.spikeStage!.completedStep).not.toBeNull(); return game;
  }
  let game = tick(act(act(newGame(), { type: "set_traffic_limit", enabled: true }), { type: "start_db_upgrade" }), 4);
  game = act(act(game, { type: "incident_inspect", equipment: "app" }), { type: "incident_inspect", equipment: "db" });
  return tick(act(game, { type: "set_traffic_limit", enabled: false }), 5);
}
export async function campaignReportJourney(page: Page, info: TestInfo, kind: ReportCase, touch = false) {
  const game = fixture(kind);
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const title = { prevention: "Prevention review", spikes: "Spike response handled", growth: "Growth outcome", completion: "Final campaign review" }[kind];
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "How did you respond?", "What could be improved?", "Key takeaway"]);
  const details = dialog.locator("details");
  await expect(details).toHaveCount(1); await expect(details).not.toHaveAttribute("open");
  const button = dialog.getByRole("button", { name: kind === "completion" ? "Complete campaign" : kind === "spikes" ? "Stay in this chapter" : "Continue company", exact: true });
  await expect(button).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole("heading", { name: "What happened?", exact: true })).toBeInViewport();
  if (kind === "spikes") await expect(dialog.locator(".campaign-incident-report > section")).toContainText(["Both traffic spikes ended", "rejected"]);
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: info.outputPath(`${kind}-summary.png`) });
  const disclosure = dialog.getByText("View technical details", { exact: true });
  if (touch) await disclosure.tap(); else await disclosure.click();
  await expect(details).toHaveAttribute("open", "");
  await expect(button).toBeInViewport({ ratio: 1 });
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(details).not.toHaveAttribute("open");
  if (touch) await button.tap(); else await button.click();
  const after = await savedGame(page);
  expect(after.campaign!.runId).toBe(game.campaign!.runId);
  expect(after.campaign!.step).toBe(game.campaign!.step);
  expect(after.campaign!.cashCents).toBe(game.campaign!.cashCents);
  if (kind === "completion") expect(after.outcome).toBe("won");
  else if (kind === "growth") expect(after.campaign!.combinedStage!.completedRounds.at(-1)!.acknowledged).toBe(true);
  else if (kind === "spikes") expect(after.campaign!.spikeStage!.acknowledged).toBe(true);
  else expect(after.campaign!.openingPrevention!.outcome!.acknowledged).toBe(true);
}
