import { test, expect, expectRoom, savedGame } from "./fixtures";
import { preventedOpening } from "../src/game/__fixtures__/openingOutcome";
import { DEFAULT_META, CHAPTER_TOURS } from "../src/game/persist";
import { makeEnvelope } from "../src/game/saveEnvelope";

test("Opening legacy prevention: later history survives and recognition unlocks Scaling at 320px", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/**", r => r.abort());
  const base = makeEnvelope(preventedOpening());
  // Historical v7 input-only save: prevention was acknowledged, then the old
  // engine allowed more real time and an additional server without recognition.
  const old = { ...base, step: 20, inputs: [...base.inputs,
    { step: 9, action: { type: "acknowledge_prevention_review" } },
    { step: 13, action: { type: "add_server" } }] };
  await page.addInitScript(({ save, meta }) => {
    if (localStorage.getItem("nn.campaign.save.v1") === null) {
      localStorage.setItem("nn.campaign.save.v1", save);
      localStorage.setItem("nn.campaign.meta.v1", JSON.stringify(meta));
    }
  }, { save: JSON.stringify(old), meta: { ...DEFAULT_META, tutorialDone: true, incidentGuideDone: true, chapterTours: [...CHAPTER_TOURS], runsStarted: 1 } });
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  const recognition = page.getByRole("dialog", { name: "First growth challenge handled" });
  await expect(recognition).toContainText("You spotted the bottleneck early and prevented an outage.");
  await expect(page.locator(".campaign-gold-attention")).toHaveCount(0);
  await expect(recognition.locator("details")).toHaveCount(1);
  await expect(recognition.locator("details")).not.toHaveAttribute("open");
  await page.screenshot({path:info.outputPath("prevention-recognition-320.png")});
  await recognition.getByText("View technical details", { exact: true }).click();
  await expect(recognition.locator("details")).toHaveAttribute("open", "");
  const before = (await savedGame(page)).campaign!;
  expect(before.step).toBe(20); expect(before.apps).toHaveLength(2);
  expect(before.openingMilestone!.acknowledged).toBe(false); expect(before.scaling).toBeNull();
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  expect((await savedGame(page)).campaign).toEqual(before);
  await expect(recognition.locator("details")).not.toHaveAttribute("open");
  await recognition.getByRole("button", { name: "Continue to Scaling & Routing", exact: true }).click();
  await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Scaling & Routing");
  const after = (await savedGame(page)).campaign!;
  expect(after.scaling).not.toBeNull(); expect(after.reports).toEqual([]); expect(after.openingRecovered).toBe(false);
  expect(after.step).toBe(before.step); expect(after.cashCents).toBe(before.cashCents); expect(after.apps).toEqual(before.apps);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  expect((await savedGame(page)).campaign).toEqual(after);
});
