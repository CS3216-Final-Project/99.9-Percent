import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { dataCompany } from "../src/sim/__tests__/dataFixture";
import { completedReliability } from "../src/sim/__tests__/combinedFixture";

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
  await expect(bar.getByLabel("Chapter progress")).toBeVisible();
  const before = await savedGame(page);
  await bar.getByRole("button", { name: "View chapters" }).click();
  const dialog = page.getByRole("dialog", { name: "Guided Mode chapters" });
  await expect(dialog.getByRole("listitem")).toHaveCount(6);
  await expect(dialog.getByRole("listitem").filter({ hasText: "Data Strategy" })).toContainText("Available next");
  await expect(dialog.getByRole("listitem").filter({ hasText: "Stay Online" })).toContainText("Locked");
  expect(await savedGame(page)).toEqual(before);
  await page.screenshot({ path: "test-results/campaign-chapters-overview.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await bar.getByRole("button", { name: "Next: Continue to data strategy", exact: true }).click();
  await expect(bar).toContainText("Chapter 3 of 6");
  await expect(bar.getByLabel("Current chapter", { exact: true })).toHaveText("Data Strategy");
  expect((await savedGame(page)).campaign!.runId).toBe(before.campaign!.runId);
  await page.getByRole("complementary", { name: "System metrics" }).evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(bar).toBeInViewport();
  await page.screenshot({ path: "test-results/campaign-chapters-desktop.png" });
});

test("chapter trail labels stay inside their steps beside the Next button", async ({ page }) => {
  await page.route("**/api/**", route => route.abort());
  await seedSave(page, completedReliability());
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const bar = page.getByRole("region", { name: "Guided Mode chapters" });
  await expect(bar.getByRole("button", { name: "Next: Continue to Grow the Company", exact: true })).toHaveText("Next");
  for (const width of [1101, 1180, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    // Each label must end before the next step, and the last one before the Next button.
    const collisions = await bar.evaluate(el => {
      const items = [...el.querySelectorAll(".chapter-trail li")];
      const limits = [...items.slice(1).map(li => li.getBoundingClientRect().left), el.querySelector(".chapter-actions")!.getBoundingClientRect().left];
      return items.filter((li, i) => li.lastElementChild!.getBoundingClientRect().right > limits[i]).map(li => li.textContent);
    });
    expect(collisions, `colliding labels at ${width}px`).toEqual([]);
  }
  await page.setViewportSize({ width: 1101, height: 900 });
  await bar.screenshot({ path: "test-results/campaign-chapters-next-1101.png" });
});
