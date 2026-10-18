import type { Locator, Page } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave, reviewRecovery } from "./fixtures";
import { act, tick, combinedCompany } from "../src/sim/__tests__/combinedFixture";
import { newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

export async function chapterHintJourney(page: Page, width: number, height: number) {
  const choose = (button: Locator) => width < 900 ? button.tap() : button.click();
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: width < 900 ? "reduce" : "no-preference" });
  await page.clock.install();
  const game = tick(act(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const goal = page.getByLabel("Current objective");
  await expect(goal).toHaveText("Goal: Keep a growing company reliable while serving full demand.");
  const progress = page.getByRole("region", { name: "Final chapter progress" });
  await expect(progress).toContainText("0 / 3 reviewed"); await expect(progress).toContainText("2,000 / 50,000");
  await page.screenshot({ path: `test-results/final-b-chapter-${width}.png` });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const hint = page.getByRole("button", { name: "Hint", exact: true });
  await hint.focus(); await hint.press("Tab"); await hint.focus();
  const offer = page.getByRole("dialog", { name: "Need a little help?" });
  // The company is paused: this is a single inactivity timeout, not cumulative simulation ticks.
  // Jumping the idle interval avoids rendering 900 redundant WebGL frames per offer.
  await page.clock.fastForward(14999); await expect(offer).toBeHidden();
  await page.clock.runFor(1); await expect(offer).toBeVisible();
  if (width === 1440) {
    await expect(offer.getByRole("button", { name: "Close", exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab"); await expect(offer.getByRole("button", { name: "No, thanks" })).toBeFocused();
    await page.keyboard.press("Tab"); await expect(offer.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  }
  await page.screenshot({ path: `test-results/final-b-offer-${width}.png` });
  if (width === 1440 || width === 390) {
    await choose(offer.getByRole("button", { name: "No, thanks" })); await expect(offer).toBeHidden();
    await expect(hint).toBeFocused();
    await page.clock.fastForward(14999); await expect(offer).toBeHidden();
    await page.clock.runFor(1); await expect(offer).toBeHidden();
    await page.clock.fastForward(45000); await expect(offer).toBeHidden();
    await choose(hint);
  } else {
    await choose(offer.getByRole("button", { name: "Yes, show hint" }));
  }
  const details = page.getByRole("dialog", { name: "Here's a hint" });
  await expect(details).toContainText("Check your infrastructure capacity first");
  await page.screenshot({ path: `test-results/final-b-hint-${width}.png` });
  await choose(details.getByRole("button", { name: "Got it" })); await page.clock.runFor(1);
  const remove = page.getByRole("button", { name: /Remove traffic limit/ });
  await expect(remove).toBeInViewport();
  await expect(remove).toBeFocused();
  const clearance = await remove.evaluate(button => {
    const box = button.getBoundingClientRect(), panel = button.closest(".campaign-panel")!.getBoundingClientRect();
    return { top: box.top - panel.top, bottom: panel.bottom - box.bottom };
  });
  expect(clearance.top).toBeGreaterThanOrEqual(10); expect(clearance.bottom).toBeGreaterThanOrEqual(10);
  await expect(page.locator(".campaign-traffic-cue > .act")).toHaveCount(1);
  await expect(page.locator(".campaign-guidance-cue")).toHaveCount(0);
  await expect(remove).toHaveCSS("animation-name", width < 900 ? "none" : "campaign-guidance-glow");
  await expect(remove).toHaveCSS("outline-width", "4px");
  await page.screenshot({ path: `test-results/final-b-traffic-cue-${width}.png` });
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  const cash = page.getByRole("button", { name: "View finances", exact: true });
  await cash.click(); await expect(page.getByRole("dialog", { name: "Company finances" })).toBeVisible();
  await expect(page.locator(".campaign-traffic-cue")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click(); await page.clock.runFor(1);
  await expect(cash).toBeFocused();
  await expect(page.locator(".campaign-traffic-cue > .act")).toHaveCount(1);
  await choose(remove); await page.clock.runFor(1);
  await expect(page.locator(".campaign-traffic-cue")).toHaveCount(0);
  const confirm = page.getByRole("button", { name: "Confirm", exact: true });
  await expect(confirm).toHaveClass(/campaign-guidance-cue/); await confirm.click();
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(goal).toHaveText("Goal: Keep a growing company reliable while serving full demand.");
  await expect(progress).toContainText("Full traffic observed");
  expect((await savedGame(page)).campaign!.limit).toBeNull();
  await hint.click(); await expect(details).not.toContainText("remove the traffic limit");
  await details.getByRole("button", { name: "Got it" }).click();
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(goal).toHaveText("Goal: Keep a growing company reliable while serving full demand.");
  await expect(page.locator(".campaign-traffic-cue")).toHaveCount(0);
}

export async function recoveryVerificationJourney(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height }); await page.clock.install();
  let game = act(advanceSteps(newGame(), 7).state, { type: "set_traffic_limit", enabled: true });
  while (!game.campaign!.incident?.stableSteps) game = tick(game);
  expect(game.campaign!.incident!.stableSteps).toBe(1);
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1);
  const pause = page.getByRole("button", { name: "Pause", exact: true });
  await expect(pause).not.toHaveClass(/campaign-guidance-cue/);
  await expect(page.getByLabel("Current objective")).toHaveText("Goal: Understand how bottlenecks affect reliable service.");
  await expect(page.getByText("Checking recovery: 1/5 game seconds", { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/final-b-recovery-check-${width}.png` });
  await page.clock.runFor(4000); await reviewRecovery(page);
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await expect(report).toContainText("Full demand was not restored");
  for (const name of ["What happened?", "What did you change?", "What was the result?", "What should you learn?"]) await expect(report.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/final-b-postmortem-${width}.png` });
  await report.getByText("Complete incident event history", { exact: true }).click();
  await expect(report.locator("li").filter({ hasText: "incident-recovered" })).toHaveCount(1);
  await report.getByRole("button", { name: "Continue company", exact: true }).click();
  expect((await savedGame(page)).phase).toBe("management");
}
