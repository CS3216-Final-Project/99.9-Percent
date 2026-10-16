import { test, expect, expectRoom, seedSave, savedGame, chapterComplete, advanceCampaignStep } from "./fixtures";
import { dataCompany, finishingScaling } from "../src/sim/__tests__/dataFixture";
import { completedReliability } from "../src/sim/__tests__/combinedFixture";
import { newGame } from "../src/sim";
import { readyReliability, act, tick } from "../src/sim/__tests__/reliabilityFixture";
import { canEnterReliability } from "../src/sim/reliability";

test("chapter bar stays visible and follows the same company into Data Strategy", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, dataCompany("read-heavy", false));
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Guided Mode chapters" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const bar = page.getByRole("region", { name: "Guided Mode chapters" });
  await expect(bar).toContainText("Chapter 2 of 6");
  await expect(bar.getByLabel("Current chapter", { exact: true })).toHaveText("Scaling & Routing");
  await expect(bar.getByRole("list", { name: "Chapter progress" })).toHaveCount(0);
  await expect(bar.getByLabel("Current objective")).toContainText("Prepare the system for the next growth wave.");
  const before = await savedGame(page);
  await bar.getByRole("button", { name: "View chapters" }).press("Enter");
  const dialog = page.getByRole("dialog", { name: "Guided Mode chapters" });
  await expect(dialog.getByRole("listitem")).toHaveCount(6);
  await expect(dialog.getByRole("listitem").filter({ hasText: "Data Strategy" })).toContainText("Available next");
  await expect(dialog.getByRole("listitem").filter({ hasText: "Stay Online" })).toContainText("Locked");
  expect(await savedGame(page)).toEqual(before);
  await page.screenshot({ path: "test-results/campaign-chapters-overview.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(bar.getByRole("button", { name: "View chapters" })).toBeFocused();
  await bar.getByRole("button", { name: "Next: Continue to data strategy", exact: true }).press("Space");
  await expect(bar).toContainText("Chapter 3 of 6");
  await expect(bar.getByLabel("Current chapter", { exact: true })).toHaveText("Data Strategy");
  expect((await savedGame(page)).campaign!.runId).toBe(before.campaign!.runId);
  await page.getByRole("complementary", { name: "System metrics" }).evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(bar).toBeInViewport();
  await page.screenshot({ path: "test-results/campaign-chapters-desktop.png" });
});

test("disabled Next explains its actual readiness gate to keyboard users",async({page})=>{
  await page.route("**/api/**",route=>route.abort());
  const game=tick(act(readyReliability(),{type:"set_routing",mode:"balanced",targets:["app-1"]}),1);
  expect(game.phase).toBe("management");
  expect(canEnterReliability(game)).toBe(false);
  await seedSave(page,game);
  await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();
  await expectRoom(page);
  const bar=page.getByRole("region",{name:"Guided Mode chapters"});
  const next=bar.getByRole("button",{name:"Next: Continue to reliability"});
  await expect(next).toBeDisabled();
  await expect(next).toHaveAccessibleDescription(/stable baseline management and empty queues/);
  const reason=bar.getByText(/^Next unavailable:/);
  await reason.focus();
  await expect(reason).toBeFocused();
  await expect(reason).toBeInViewport();
});

test("compact chapter summary, objective and Next stay clear at desktop and laptop widths", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, completedReliability());
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const bar = page.getByRole("region", { name: "Guided Mode chapters" });
  await expect(bar.getByRole("button", { name: "Next: Continue to Grow the Company", exact: true })).toHaveText("Next");
  for (const [width,height] of [[1101,900],[1366,768],[1440,900]]) {
    await page.setViewportSize({ width, height });
    const collisions = await bar.evaluate(el => {
      const items = [".chapter-current", ".chapter-objective", ".chapter-actions"].map(selector => el.querySelector(selector)!.getBoundingClientRect());
      return items.slice(0,-1).filter((box,i) => box.right > items[i+1].left);
    });
    expect(collisions, `colliding labels at ${width}px`).toEqual([]);
    await expect(bar.getByLabel("Current objective")).toBeInViewport();
    await expect(bar.getByRole("button",{name:"View chapters"})).toBeInViewport();
    expect(await bar.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
    await page.screenshot({path:`test-results/clarity-after-${width}-next-true.png`});
  }
  await page.setViewportSize({ width: 1101, height: 900 });
  await bar.screenshot({ path: "test-results/campaign-chapters-next-1101.png" });
});

test("compact Opening bar leaves its goal and overview available without Next", async ({page}) => {
  await page.route("**/api/**",route=>route.abort());
  await seedSave(page,newGame());
  await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();
  await expectRoom(page);
  const bar=page.getByRole("region",{name:"Guided Mode chapters"});
  for(const [width,height] of [[1440,900],[1366,768]]) {
    await page.setViewportSize({width,height});
    await expect(bar.getByRole("button",{name:/^Next:/})).toHaveCount(0);
    await expect(bar.getByLabel("Current objective")).toHaveText("Goal: Observe demand and compare component evidence.");
    await expect(bar.getByRole("button",{name:"View chapters"})).toBeInViewport();
    await page.screenshot({path:`test-results/clarity-after-${width}-next-false.png`});
  }
});

test("finishing Scaling & Routing stops once to announce it and continues from the dialog", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.removeLocatorHandler(chapterComplete(page));
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, finishingScaling());
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(chapterComplete(page)).toHaveCount(0);
  await advanceCampaignStep(page);
  const dialog = chapterComplete(page);
  await expect(dialog).toHaveAccessibleName("Scaling & Routing complete");
  await expect(dialog).toContainText("Next: Data Strategy.");
  await page.screenshot({ path: "test-results/chapter-complete-scaling.png" });
  await dialog.getByRole("button", { name: "Continue to data strategy", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Current chapter", { exact: true })).toHaveText("Data Strategy");
  expect((await savedGame(page)).campaign!.dataStage).toBeTruthy();
});
