import { test, expect, seedSave, savedGame, expectRoom } from "./fixtures";
import { reliabilityClarity } from "./reliabilityClarity";
import { reliabilityOutcome } from "../src/game/__fixtures__/reliabilityOutcome";
import { replayCampaign } from "../src/sim";
test("Chapter 5 clarity: short outcome, retained details and explicit acknowledgement", async ({ page, installClock }, info) => {
  await installClock(); await reliabilityClarity(page, info);
});

test("Chapter 5 clarity: incident report keeps its evidence and Continue company acknowledgement", async ({ page, installClock }) => {
  await installClock();
  const completed = reliabilityOutcome(), c = completed.campaign!, report = c.reports.at(-1)!;
  const game = replayCampaign(completed.seed, c.runId, c.inputs.filter(input => input.step < report.recoveredStep), report.recoveredStep, false, c.foundation);
  expect(game.phase).toBe("review");
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const dialog = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "Capacity after the failure", "How did you respond?", "What could be improved?", "Key takeaway"]);
  await expect(dialog.getByText("Incident window", { exact: true })).toBeHidden();
  await dialog.getByText("View Technical Details", { exact: true }).click();
  await expect(dialog.getByText("Incident window", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("table", { name: "Recorded incident evidence by game second", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue company", exact: true }).click();
  const after = await savedGame(page);
  expect(after.phase).toBe("management"); expect(after.campaign!.runId).toBe(c.runId);
  expect(after.campaign!.step).toBe(report.recoveredStep);
});
