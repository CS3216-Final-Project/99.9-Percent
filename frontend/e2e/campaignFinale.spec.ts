import type { Locator, Page, TestInfo } from "@playwright/test";
import { test, expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { reliabilityOutcome } from "../src/game/__fixtures__/reliabilityOutcome";

test.use({ reviewCampaignFinale: false, edition: "desktop" });
const CAST = [["Maya", "maya"], ["Jordan", "jordan"], ["Sam", "sam"], ["Taylor", "taylor"], ["Alex", "alex"]] as const;

async function finaleJourney(page: Page, info: TestInfo, touch: boolean) {
  test.setTimeout(180_000);
  const press = (control: ReturnType<Page["locator"]>) => touch ? control.tap() : control.click();
  await page.route("**/api/**", r => r.abort()); await seedSave(page, reliabilityOutcome()); await page.goto("/");
  await press(page.getByRole("button", { name: "Continue company", exact: true })); await expectRoom(page);
  // Stay Online is the last chapter: its outcome completes the campaign.
  await press(page.getByRole("dialog", { name: "Reliability outcome", exact: true }).getByRole("button", { name: "Complete campaign", exact: true }));
  const scene = page.getByRole("dialog", { name: "Campaign finale", exact: true }), scorecard = page.getByRole("dialog", { name: "Campaign complete", exact: true });
  await expect(scene).toBeVisible(); await expect(scene).toHaveAttribute("aria-modal", "true"); await expect(scorecard).toHaveCount(0);
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  expect((await savedGame(page)).outcome).toBe("won");
  const next = scene.getByRole("button", { name: "Next", exact: true }), copy = scene.locator(".dialogue-copy");
  await expect(next).toBeFocused();
  // Clicking or tapping through the scene reads on rather than highlighting its text.
  expect(await copy.evaluate(el => getComputedStyle(el).userSelect)).toBe("none");
  for (const [i, [name, id]] of CAST.entries()) {
    await expect(scene.locator(".dialogue-progress")).toHaveAttribute("aria-label", `Line ${i + 1} of ${CAST.length}`);
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
  await expect(scene.getByLabel("Campaign results")).toContainText("Incidents");
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
  // Finishing Guided Mode carries on into Challenge Mode, keeping the finished company saved.
  const challenge = scorecard.getByRole("button", { name: "Continue to Challenge Mode", exact: true });
  await challenge.scrollIntoViewIfNeeded(); await expect(challenge).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath(`campaign-complete-scorecard${touch ? "-touch" : ""}.png`) });
  await press(challenge);
  await expect(scorecard).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("classic");
  expect((await savedGame(page)).outcome).toBe("won");
}

test("campaign finale: every colleague celebrates, then the scorecard, and it never replays", async ({ page }, info) => {
  await finaleJourney(page, info, false);
});

/** Plays the stored company to its finale, with the room stubbed: these journeys are about the dialogs. */
async function openFinale(page: Page) {
  await page.route("**/api/**", r => r.abort()); await seedSave(page, reliabilityOutcome()); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.getByRole("dialog", { name: "Reliability outcome", exact: true }).getByRole("button", { name: "Complete campaign", exact: true }).click();
  const scene = page.getByRole("dialog", { name: "Campaign finale", exact: true });
  await expect(scene).toBeVisible();
  return { scene, scorecard: page.getByRole("dialog", { name: "Campaign complete", exact: true }) };
}

test("campaign finale: Enter held on its last line opens the scorecard without leaving Guided Mode", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const { scene, scorecard } = await openFinale(page);
  for (let line = 1; line < CAST.length; line++) await page.keyboard.press("Enter");
  await expect(scene.getByRole("button", { name: "See the scorecard", exact: true })).toBeFocused();
  // Holding the key repeats it on whatever has focus by then: the scorecard's Continue to Challenge Mode.
  for (let repeat = 0; repeat < 4; repeat++) await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(scene).toHaveCount(0); await expect(scorecard).toBeVisible();
  await expect(scorecard.getByRole("button", { name: "Continue to Challenge Mode", exact: true })).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).not.toBe("classic");
  // A fresh press is the player's choice and still carries on.
  await page.keyboard.press("Enter");
  await expect(scorecard).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("classic");
});

test("campaign complete: the scorecard reopened from the final company still continues to Challenge Mode", async ({ page, withoutRoom }, info) => {
  await withoutRoom();
  const { scene, scorecard } = await openFinale(page);
  await scene.getByRole("button", { name: "Skip to the scorecard", exact: true }).click();
  await scorecard.getByRole("button", { name: "Inspect final company", exact: true }).click();
  await expect(scorecard).toHaveCount(0);
  const view = page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "View run scorecard", exact: true });
  const reopened = page.getByRole("dialog", { name: "Company scorecard", exact: true });
  await view.click();
  // Reopened to be read, it opens on Close rather than on the way into Challenge Mode.
  await expect(reopened.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  // Inspect final company goes back to the inspection the scorecard was opened from.
  await reopened.getByRole("button", { name: "Inspect final company", exact: true }).click();
  await expect(reopened).toHaveCount(0); await expect(view).toBeVisible();
  await view.click();
  const challenge = reopened.getByRole("button", { name: "Continue to Challenge Mode", exact: true });
  await challenge.scrollIntoViewIfNeeded(); await expect(challenge).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath("company-scorecard-reopened.png") });
  await challenge.click();
  await expect(reopened).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("nn.mode.v1"))).toBe("classic");
  expect((await savedGame(page)).outcome).toBe("won");
});

test("campaign complete: Enter held on View run scorecard opens the scorecard once and leaves it open", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const { scene, scorecard } = await openFinale(page);
  await scene.getByRole("button", { name: "Skip to the scorecard", exact: true }).click();
  await scorecard.getByRole("button", { name: "Inspect final company", exact: true }).click();
  const view = page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "View run scorecard", exact: true });
  const reopened = page.getByRole("dialog", { name: "Company scorecard", exact: true });
  // Count every time the dialog appears, and every keydown the browser delivers with whether it repeats.
  await page.evaluate(() => {
    const w = window as unknown as { opened: number; repeats: boolean[] };
    w.opened = 0; w.repeats = [];
    new MutationObserver(records => {
      const card = '[role="dialog"][aria-label="Company scorecard"]';
      for (const r of records) for (const n of r.addedNodes) if (n instanceof Element && (n.matches(card) || n.querySelector(card))) w.opened++;
    }).observe(document.body, { childList: true, subtree: true });
    addEventListener("keydown", e => { if (e.key === "Enter") w.repeats.push(e.repeat); }, true);
  });
  await view.focus();
  for (let repeat = 0; repeat < 6; repeat++) await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  expect(await page.evaluate(() => (window as unknown as { repeats: boolean[] }).repeats)).toEqual([false, true, true, true, true, true]);
  // The repeats land on the dialog's Close: they must neither close it nor, through the restored focus, reopen it.
  await expect(reopened).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { opened: number }).opened)).toBe(1);
  // A fresh press is the player's choice and still closes it.
  await page.keyboard.press("Enter");
  await expect(reopened).toHaveCount(0); await expect(view).toBeFocused();
});

/** WCAG contrast of an element's text on its own background, both opaque. */
const contrast = (target: Locator) => target.evaluate(el => {
  const luminance = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(v => Number(v) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const style = getComputedStyle(el), [a, b] = [luminance(style.color), luminance(style.backgroundColor)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
});

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) test(`campaign complete at ${size.width}px: a company that cannot be saved is announced, keeps its actions in view and asks before it is lost`, async ({ page, withoutRoom }, info) => {
  await withoutRoom(); await page.setViewportSize(size); await page.emulateMedia({ reducedMotion: "reduce" });
  const { scene, scorecard } = await openFinale(page);
  await scene.getByRole("button", { name: "Skip to the scorecard", exact: true }).click();
  // The browser's storage fills up after the finished company was saved.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); }; });
  await scorecard.getByRole("button", { name: "Continue to Challenge Mode", exact: true }).click();
  const lose = scorecard.getByRole("button", { name: "Switch and lose this company", exact: true });
  await expect(scorecard.getByRole("alert").filter({ hasText: "This company could not be saved" })).toBeVisible();
  const actions = scorecard.locator(".campaign-complete-foot > .btn");
  await expect(actions).toHaveCount(3);
  for (const action of await actions.all()) await expect(action).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  // The pointer that pressed it is still over the red button: its white label stays readable hovered, at rest and pressed.
  const { x, y, width, height } = (await lose.boundingBox())!;
  await page.mouse.move(x + width / 2, y + height / 2);
  expect(await contrast(lose)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: info.outputPath(`campaign-complete-unsaved-${size.width}.png`) });
  await page.mouse.down(); expect(await contrast(lose)).toBeGreaterThanOrEqual(4.5);
  await page.mouse.move(0, 0); await page.mouse.up(); expect(await contrast(lose)).toBeGreaterThanOrEqual(4.5);
  await lose.click();
  await expect(scorecard).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("nn.mode.v1"))).not.toBe("classic");
  await expect(page.getByRole("button", { name: "Skip", exact: true })).toBeVisible();
});

test.describe("on touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("campaign finale: reads on by tapping the dialogue at 390px", async ({ page }, info) => {
    await finaleJourney(page, info, true);
  });
});
