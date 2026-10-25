import type { Page, TestInfo } from "@playwright/test";
import { advanceCampaignStep, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame, type GameState } from "../src/sim";
import { act, tick } from "../src/sim/__tests__/spikeFixtures";

export function almostRecovered(limited = false): GameState {
  let g = act(tick(newGame(1, limited ? "notice-limit" : "notice-db"), 6), limited
    ? { type: "set_traffic_limit", enabled: true } : { type: "start_db_upgrade" });
  for (let i = 0; i < 100 && (g.campaign!.incident?.stableSteps ?? 0) < 4; i++) g = tick(g);
  expect(g.phase).toBe("incident"); expect(g.campaign!.incident!.stableSteps).toBe(4);
  return g;
}
export async function recoveryJourney(page: Page, info: TestInfo, touch = false, limited = false) {
  await page.route("**/api/**", r => r.abort());
  const game = almostRecovered(limited); await seedSave(page, game); await page.goto("/");
  const press = async (button: ReturnType<Page["getByRole"]>) => touch ? button.tap() : button.click();
  const reloadReview = async () => {
    // The engine is paused in review. Native scene frames must be allowed to initialize
    // the real room again; retaining a paused Playwright clock can strand its DOM labels.
    await page.clock.resume(); await page.reload();
    await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  };
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await expect(page.getByRole("dialog", { name: "System Recovered!" })).toHaveCount(0);
  await advanceCampaignStep(page, { resumeClock: false });
  const notice = page.getByRole("dialog", { name: "System Recovered!", exact: true });
  await expect(notice).toBeVisible(); await expect(notice).toContainText("Great work! Your app is running smoothly again.");
  const recovered = (await savedGame(page)); expect(recovered.phase).toBe("review"); expect(recovered.campaign!.reports.at(-1)!.id).toBe(game.campaign!.incident!.id);
  await expect(page.locator(".campaign-gold-attention")).toHaveCount(0);
  await expect(notice.getByRole("button", { name: "View Incident Report" })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(notice.getByRole("button", { name: "View Incident Report" })).toBeFocused();
  if (limited) await expect(notice).toContainText("some incoming requests are rejected");
  await page.screenshot({ path: info.outputPath("recovered.png") });
  if (limited) {
    // Reload directly from the first stage: its receipt must not acknowledge the engine review.
    await reloadReview();
    await expect(notice).toHaveCount(0);
  } else await press(notice.getByRole("button", { name: "View Incident Report" }));
  const report = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  await expect(report).toBeVisible(); await expect(report.getByRole("button", { name: "Continue company" })).toBeFocused();
  await expect(report.getByRole("heading", { name: "What happened?", exact: true })).toBeInViewport();
  await expect(report.locator(".report-metrics dt")).toHaveText([
    "Incident window", "Final response time", "Traffic status",
    ...(!limited ? ["Spending in this evidence window"] : []),
  ]);
  if (!limited) await expect(report.locator(".report-metrics dd").last()).toHaveText("$3,000.00");
  await expect(report.locator(".report-technical")).not.toHaveAttribute("open");
  await expect(report.getByText(limited ? /Recorded responses included a traffic limit/ : /Recorded responses included a database upgrade/)).toBeVisible();
  await expect(report.locator(".report-metrics")).toContainText(limited ? "Recovered with traffic limited" : "Recovered at full incoming demand");
  expect((await savedGame(page)).campaign!.inputs).toEqual(recovered.campaign!.inputs);
  await page.screenshot({ path: info.outputPath("postmortem.png") });
  const summary = report.locator("summary", { hasText: "View Technical Details" });
  await page.keyboard.press("Tab"); await expect(summary).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(report.getByRole("button", { name: "Continue company" })).toBeFocused();
  await press(summary); await expect(report.getByRole("table", { name: "Recorded incident evidence by game second", exact: true })).toBeVisible();
  for (const explanation of recovered.campaign!.reports.at(-1)!.explanations) await expect(report).toContainText(explanation);
  const recoveredReport = recovered.campaign!.reports.at(-1)!;
  const recoveryEvents = recoveredReport.events.filter(event => event.type === "recovery-streak");
  expect(recoveryEvents.length).toBeGreaterThan(0);
  await expect(report.locator(".report-events li").filter({ hasText: "Recovery progress" })).toHaveCount(recoveryEvents.length);
  await expect(report.locator(".report-events")).toContainText("Stable seconds 4 to 5");
  expect((await savedGame(page)).campaign!.reports.at(-1)!.events).toEqual(recoveredReport.events);
  expect(await report.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await reloadReview();
  await expect(notice).toHaveCount(0); await expect(report).toBeVisible();
  expect((await savedGame(page)).campaign!.inputs).toEqual(recovered.campaign!.inputs);
  expect((await savedGame(page)).campaign!.reports.at(-1)!.events).toEqual(recoveredReport.events);
  await press(report.getByRole("button", { name: "Continue company", exact: true }));
  await expect(page.getByRole("dialog", { name: "First growth challenge handled" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "First growth challenge handled" })).toContainText("You diagnosed an outage and restored your service.");
  await press(page.getByRole("button", { name: "Continue to Scaling & Routing", exact: true }));
  const after = (await savedGame(page)); expect(after.phase).toBe("management");
  expect(after.campaign!.runId).toBe(game.campaign!.runId); expect(after.campaign!.step).toBe(recovered.campaign!.step);
  expect(after.campaign!.cashCents).toBe(recovered.campaign!.cashCents);
  expect(after.campaign!.trace.filter(e => e.type === "review-acknowledged")).toHaveLength(1);
  await expect(notice).toHaveCount(0); await expect(report).toHaveCount(0);
  await press(page.getByRole("button", { name: "History", exact: true }));
  await press(page.getByRole("tab", { name: "Incidents (1)", exact: true }));
  await press(page.getByRole("button", { name: /Database overloaded.*Game seconds/ }));
  await expect(page.getByText("What happened?", { exact: true })).toBeVisible();
  await expect(notice).toHaveCount(0);
}
