import type { Page, TestInfo } from "@playwright/test";
import { expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { reliabilityOutcome } from "../src/game/__fixtures__/reliabilityOutcome";

export async function reliabilityClarity(page: Page, info: TestInfo, touch = false) {
  const game = reliabilityOutcome(true);
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const outcome = page.getByRole("dialog", { name: "Reliability outcome", exact: true });
  await expect(outcome.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "Capacity after the failure", "How did you respond?", "What could be improved?", "Key takeaway"]);
  await expect(outcome).toContainText("requested a free server restore");
  await expect(outcome.getByText("Application failure", { exact: true })).toBeHidden();
  await page.screenshot({ path: info.outputPath("reliability-summary.png") });
  if (!touch) {
    // Dragging across the chat highlights nothing. The same drag does select it once text selection is allowed again,
    // as it was before game text was made unselectable, so the gesture really spans text.
    const chat = (await outcome.locator(".campaign-incident-report").boundingBox())!;
    const drag = async () => {
      await page.evaluate(() => getSelection()?.removeAllRanges());
      await page.mouse.move(chat.x + chat.width * 0.3, chat.y + 30); await page.mouse.down();
      await page.mouse.move(chat.x + chat.width * 0.7, chat.y + Math.min(260, chat.height - 10), { steps: 10 }); await page.mouse.up();
      return page.evaluate(() => getSelection()?.toString().trim() ?? "");
    };
    const selectable = await page.addStyleTag({ content: "body { user-select: text !important; }" });
    expect(await drag()).not.toBe("");
    await page.screenshot({ path: info.outputPath("selection-allowed.png") });
    await selectable.evaluate(node => (node as Element).remove());
    expect(await drag()).toBe("");
    await page.screenshot({ path: info.outputPath("selection-blocked.png") });
  }
  // The disclosure slides open on a CSS transition and its contents stay content-visibility hidden until a frame runs
  // it; on CI the software-drawn room behind the dialog can hold off frames for seconds. Reduced motion opens it at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const details = outcome.getByText("View Technical Details", { exact: true });
  if (touch) await details.tap(); else await details.click();
  await expect(outcome.getByText("Application failure", { exact: true })).toBeVisible();
  await expect(outcome.getByText("Company setup spending at completion", { exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expect(outcome.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "Capacity after the failure", "How did you respond?", "What could be improved?", "Key takeaway"]);
  const button = outcome.getByRole("button", { name: "Stay in this chapter", exact: true });
  if (touch) await button.tap(); else await button.click();
  const after = (await savedGame(page)).campaign!;
  expect(after.reliabilityStage!.acknowledged).toBe(true);
  expect(after.runId).toBe(game.campaign!.runId); expect(after.step).toBe(game.campaign!.step);
  expect(after.cashCents).toBe(game.campaign!.cashCents);
}
