import { expectRoom, seedSave, test, expect } from "./fixtures";
import { applyAction, newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

// The server floor shows the recorded requests: what enters at In and what is served at Out.
test("the In and Out gates show this second's requests", async ({ page }) => {
  const game = advanceSteps(newGame(1), 7).state;
  const m = game.campaign!.snapshot;
  expect(m.successful).toBeLessThan(m.incoming);
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  const gateIn = page.getByLabel(/^In: /), gateOut = page.getByLabel(/^Out: /);
  await expect(gateIn).toHaveText(`In ${m.incoming.toLocaleString("en-US")}/s`);
  await expect(gateOut).toHaveText(`Out ${m.successful.toLocaleString("en-US")}/s`);
});

test("a traffic limit's turned-away requests show at In", async ({ page }) => {
  const r = applyAction(advanceSteps(newGame(1), 6).state, { type: "set_traffic_limit", enabled: true });
  if (!r.ok) throw Error(r.message);
  const game = advanceSteps(r.state, 3).state, m = game.campaign!.snapshot;
  expect(m.rejected).toBeGreaterThan(0);
  await seedSave(page, game);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page, 30_000);
  await expect(page.getByLabel(/^In: /)).toContainText(`${m.rejected.toLocaleString("en-US")}/s turned away`);
});
