import { test, expect, seedSave, savedGame, advanceCampaignStep } from "./fixtures";
import { launchCompany } from "../src/sim/__tests__/scalingLaunchFixture";
import { infrastructureAction } from "./componentInspection";

for (const phone of [false, true]) {
  test.describe(phone ? "phone launch" : "desktop launch", () => {
    test.use(phone ? { edition: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { edition: "desktop" });
    test("prepare, decline, launch, and resume the saved countdown", async ({ page, withoutRoom, installClock }) => {
      await withoutRoom(); await installClock();
      await seedSave(page, launchCompany());
      await page.goto("/");
      await page.getByRole("button", { name: "Continue company", exact: true }).click();
      const opportunity = page.getByRole("region", { name: "Growth launch opportunity" });
      if (phone) {
        const handle = page.locator('.phone-sheet-handle[aria-expanded="false"]');
        if (await handle.isVisible()) await handle.click();
      }
      await expect(opportunity).toContainText("$7,200 more revenue/week");
      await opportunity.getByRole("button", { name: "Review launch" }).click();
      const review = page.getByRole("dialog", { name: "Launch growth campaign?", exact: true });
      await expect(review).toContainText("1,000 req/s");
      await expect(review).toContainText("cannot be cancelled");
      await page.screenshot({ path: `test-results/player-launch-${phone ? "phone" : "desktop"}.png` });
      await review.getByRole("button", { name: "Keep preparing" }).click();
      expect((await savedGame(page)).campaign!.scaling!.dueStep).toBeNull();
      await advanceCampaignStep(page, { seconds: 5, resumeClock: false });
      expect((await savedGame(page)).campaign!.incomingRate).toBe(800);
      await opportunity.getByRole("button", { name: "Review launch" }).click();
      await review.getByRole("button", { name: "Launch campaign", exact: true }).click();
      const deadline = (await savedGame(page)).campaign!.scaling!.dueStep;
      await advanceCampaignStep(page, { seconds: 2, resumeClock: false });
      // The simulation is paused; let the phone shell finish its lazy loading on reload.
      await page.clock.resume();
      await page.reload();
      await page.getByRole("button", { name: "Continue company", exact: true }).click();
      expect((await savedGame(page)).campaign!.scaling!.dueStep).toBe(deadline);
      expect((await savedGame(page)).campaign!.incomingRate).toBe(800);
      await expect(page.getByRole("button", { name: "Run", exact: true })).toBeVisible();
      await advanceCampaignStep(page, { seconds: 1, resumeClock: false });
      expect((await savedGame(page)).campaign!.incomingRate).toBe(1400);
    });
  });
}

test("explains an unrouted purchase as soon as the server activates", async ({ page, withoutRoom, installClock }) => {
  await withoutRoom(); await installClock();
  await seedSave(page, launchCompany());
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await (await infrastructureAction(page, /Add server/)).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await advanceCampaignStep(page, { seconds: 2, resumeClock: false });
  const feedback = page.getByRole("region", { name: "Latest infrastructure change" });
  await expect(feedback).toContainText("needs a routing change");
  expect((await savedGame(page)).campaign!.snapshot.instances!.find(a => a.id === "app-2")!.demand).toBe(0);
  await feedback.getByText(/Observed across activation/).click();
  await expect(feedback.locator("details")).toHaveJSProperty("open", true);
  // Complete the disclosure’s CSS transition while the simulation stays paused.
  await page.clock.runFor(300);
  await expect(feedback.getByText("800 → 800 /s", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/player-change-feedback.png" });
});
