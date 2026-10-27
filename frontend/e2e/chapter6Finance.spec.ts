import { closeInspection, followHintComponent, inspectEquipment } from "./componentInspection";
import { test, expect, savedGame, advanceCampaignStep } from "./fixtures";
import { recoverableFinancialCompany } from "../src/game/__fixtures__/chapter6Finance";
import { bootChapter6 } from "./chapter6Guidance";

test("Chapter 6 finances: low cash with paid-for capacity warns but still guides safe recovery", async ({ page, installClock }) => {
  await installClock(); const game = recoverableFinancialCompany(); await bootChapter6(page, game);
  await page.getByRole("dialog", { name: "Chapter 6: Prepare for full demand", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
  const guidance = page.getByRole("region", { name: "Campaign mission dashboard", exact: true });
  await expect(guidance).toContainText("Money at risk");
  await expect(guidance).not.toContainText("Capacity funding blocked");
  await inspectEquipment(page,"gateway");await closeInspection(page);
  await closeInspection(page); await page.getByRole("button", { name: "Hint", exact: true }).click();
  const hint = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(hint).toContainText("Remove the traffic limit");
  await hint.getByRole("button", { name: "Got it", exact: true }).click();
  const gold = page.locator(".campaign-gold-attention");
  await expect(gold).toHaveCount(1); await followHintComponent(page); await expect(gold).toHaveAccessibleName(/^Remove traffic limit/); await gold.click();
  await expect(gold).toHaveAccessibleName("Confirm"); await gold.click();
  await advanceCampaignStep(page, { seconds: 5, resumeClock: false });
  const after = await savedGame(page);
  expect(after.campaign!.limit).toBeNull();
  expect(after.campaign!.combinedStage!.readinessSteps).toBe(5);
  expect(after.campaign!.cashCents).toBe(game.campaign!.cashCents);
  expect(after.campaign!.incident).toBeNull();
  await expect(guidance).not.toContainText("At the current traffic limit");
});
