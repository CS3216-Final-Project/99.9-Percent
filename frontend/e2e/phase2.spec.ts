import { test, expect, savedGame, seedSave } from "./fixtures";
import { applyAction, newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";

test("pending milestone reload keeps the company paused and awards it only once", async ({ page, withoutRoom }) => {
  await withoutRoom();
  const incident = advanceSteps(newGame(1, "pending-milestone"), 6).state;
  const response = applyAction(incident, { type: "start_db_upgrade" });
  if (!response.ok) throw Error(response.message);
  const review = advanceSteps(response.state, 30).state;
  await seedSave(page, review); await page.goto("/");
  await page.getByRole("button", { name: "Continue company" }).click();
  const report = page.getByRole("dialog", { name: "Incident postmortem" });
  await page.screenshot({ path: "test-results/phase2-report.png" });
  await report.getByRole("button", { name: "Continue company" }).click();
  const before = await savedGame(page);
  await page.reload(); await page.getByRole("button", { name: "Continue company" }).click();
  await expect(page.getByRole("dialog", { name: "First growth challenge handled" })).toBeVisible();
  expect(await savedGame(page)).toEqual(before);
  await page.getByRole("button", { name: "Continue to scaling and routing" }).click();
  const after = await savedGame(page);
  expect(after.campaign!.runId).toBe(before.campaign!.runId);
  expect(after.campaign!.step).toBe(before.campaign!.step);
  expect(after.campaign!.cashCents).toBe(before.campaign!.cashCents);
  expect(after.campaign!.trace.filter(e => e.type === "milestone-awarded")).toHaveLength(1);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.screenshot({ path: "test-results/phase2-history.png" });
});
