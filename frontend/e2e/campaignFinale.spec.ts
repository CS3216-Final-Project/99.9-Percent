import type { Page, TestInfo } from "@playwright/test";
import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { finishedCompany } from "../src/sim/__tests__/combinedFixture";

test.use({ reviewCampaignFinale: false, edition: "desktop" });
const CAST = [["Maya", "maya"], ["Jordan", "jordan"], ["Sam", "sam"], ["Taylor", "taylor"], ["Alex", "alex"]] as const;

async function finaleJourney(page: Page, info: TestInfo, touch: boolean) {
  test.setTimeout(180_000);
  const press = (control: ReturnType<Page["locator"]>) => touch ? control.tap() : control.click();
  await page.route("**/api/**", r => r.abort()); await seedSave(page, finishedCompany()); await page.goto("/");
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  await press(page.getByRole("button", { name: "Complete campaign", exact: true }));
  const scene = page.getByRole("dialog", { name: "Campaign finale", exact: true }), scorecard = page.getByRole("dialog", { name: "Campaign complete", exact: true });
  await expect(scene).toBeVisible(); await expect(scene).toHaveAttribute("aria-modal", "true"); await expect(scorecard).toHaveCount(0);
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  expect((await savedGame(page)).outcome).toBe("won");
  const next = scene.getByRole("button", { name: "Next", exact: true }), copy = scene.locator(".dialogue-copy");
  await expect(next).toBeFocused();
  for (const [i, [name, id]] of CAST.entries()) {
    await expect(scene.locator(".dialogue-plate")).toContainText(name);
    const portrait = scene.getByRole("img", { name: new RegExp(`^${name}, `) });
    await expect(portrait).toHaveAttribute("src", `/characters/${id}-celebrating.webp`);
    await expect.poll(() => portrait.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth)).toBe(768);
    await expect(scene).toBeInViewport({ ratio: 1 });
    if (i === 0) await page.screenshot({ path: info.outputPath(`campaign-finale-maya${touch ? "-touch" : ""}.png`) });
    if (i === CAST.length - 1) break;
    await expect(scene.getByLabel("Campaign results")).toHaveCount(0);
    // Desktop reads on with the keyboard, touch by tapping the dialogue box.
    if (touch) await press(copy); else await page.keyboard.press("Enter");
  }
  await expect(scene.getByLabel("Campaign results")).toContainText("50,000");
  const end = scene.getByRole("button", { name: "See the scorecard", exact: true });
  await expect(end).toBeFocused(); await expect(end).toBeInViewport({ ratio: 1 });
  expect(await scene.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`campaign-finale-alex${touch ? "-touch" : ""}.png`) });
  await press(end);
  await expect(scene).toHaveCount(0); await expect(scorecard).toBeVisible();
  await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  await page.reload(); await press(page.getByRole("button", { name: "See how it ended", exact: true }));
  await expect(scorecard).toBeVisible(); await expect(scene).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}

test("campaign finale: every colleague celebrates, then the scorecard, and it never replays", async ({ page }, info) => {
  await finaleJourney(page, info, false);
});

test.describe("on touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("campaign finale: reads on by tapping the dialogue at 390px", async ({ page }, info) => {
    await finaleJourney(page, info, true);
  });
});
