import type { Page, TestInfo } from "@playwright/test";
import { expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { reliabilityOutcome } from "../src/game/__fixtures__/reliabilityOutcome";

export async function reliabilityClarity(page: Page, info: TestInfo, touch = false) {
  const game = reliabilityOutcome(true);
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const outcome = page.getByRole("dialog", { name: "Reliability outcome", exact: true });
  await expect(outcome.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "How did you respond?", "What could be improved?", "Key takeaway"]);
  await expect(outcome).toContainText("requested a free server restore");
  await expect(outcome.getByText("Application failure", { exact: true })).toBeHidden();
  await page.screenshot({ path: info.outputPath("reliability-summary.png") });
  const details = outcome.getByText("View Technical Details", { exact: true });
  if (touch) await details.tap(); else await details.click();
  await expect(outcome.getByText("Application failure", { exact: true })).toBeVisible();
  await expect(outcome.getByText("Company setup spending at completion", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(outcome.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "How did you respond?", "What could be improved?", "Key takeaway"]);
  const button = outcome.getByRole("button", { name: "Stay in this chapter", exact: true });
  if (touch) await button.tap(); else await button.click();
  const after = (await savedGame(page)).campaign!;
  expect(after.reliabilityStage!.acknowledged).toBe(true);
  expect(after.runId).toBe(game.campaign!.runId); expect(after.step).toBe(game.campaign!.step);
  expect(after.cashCents).toBe(game.campaign!.cashCents);
}
