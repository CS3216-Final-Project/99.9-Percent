import { test, expect, expectRoom, seedSave, savedGame, advanceCampaignStep } from "./fixtures";
import { applyAction, newGame, type Action, type GameState } from "../src/sim";
import { INTRODUCTION_COMPONENTS } from "../src/sim/introduction";

function decide(game: GameState, action: Action) {
  const result = applyAction(game, action);
  if (!result.ok) throw Error(result.message);
  return result.state;
}

/**
 * How far the In gate's label sits from the middle of the part of the room the side panel leaves open, in pixels:
 * that middle is where the camera centres what it is asked to look at (see components/roomArea.ts).
 */
async function gateOffset(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const stage = document.querySelector("main canvas")!.getBoundingClientRect();
    const panel = document.querySelector(".campaign-panel")?.getBoundingClientRect();
    const right = panel && panel.width > 0 && panel.left - stage.left > stage.width * 0.4 ? panel.left : stage.right;
    const gate = document.querySelector(".gate-in")!.getBoundingClientRect();
    return Math.hypot(gate.left + gate.width / 2 - (stage.left + right) / 2, gate.top + gate.height / 2 - (stage.top + stage.bottom) / 2);
  });
}

test("the Opening's first Run looks at the In gate and announces the growth until it arrives", async ({ page, installClock }, info) => {
  // The camera eases a share of the way each frame, so software rendering takes a while to settle.
  test.slow();
  await installClock();
  await page.route("**/api/**", route => route.abort());
  let game = decide(newGame(7, "opening-traffic-browser", 2), { type: "begin_introduction" });
  for (const equipment of INTRODUCTION_COMPONENTS) game = decide(decide(game, { type: "incident_inspect", equipment }), { type: "acknowledge_introduction", equipment });
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  // Finish the introduction the way a player does, so the Opening begins exactly as it does for them.
  await page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Complete Introduction", exact: true }).click();
  await expect(page.getByLabel("Current chapter", { exact: true })).toHaveText("Opening");
  await page.getByRole("dialog", { name: "Tip, step 1 of 1", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();

  const gate = page.locator(".gate-in");
  await expect(gate).not.toHaveClass(/is-cued/);
  const before = await gateOffset(page);

  await advanceCampaignStep(page, { seconds: 1 });
  await expect(gate).toHaveClass(/is-cued/);
  await expect(gate).toHaveAccessibleName("In: 300 requests per second. More customers are arriving. Requests are about to climb.");
  // The view comes to the gate from wherever it was looking. It frames the gate's foot on the floor, so the label
  // above it lands near, not on, the middle of the open room; it must end up far closer than it started.
  await expect.poll(() => gateOffset(page), { timeout: 45_000 }).toBeLessThan(before * 0.75);
  await expect(gate).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: info.outputPath("opening-traffic-rising.png") });

  await advanceCampaignStep(page, { seconds: 3 });
  await expect(gate).toHaveAccessibleName("In: 800 requests per second. Requests climbed. Watch where the extra work goes.");
  expect((await savedGame(page)).campaign!.step).toBe(4);
  await page.screenshot({ path: info.outputPath("opening-traffic-risen.png") });
});
