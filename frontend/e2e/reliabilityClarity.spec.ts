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
  // The capacity summary joins the chat: its heading is Taylor's question on the right, its readings and story the
  // player's answers on the left, and every bubble enters in reading order.
  const bubbles = dialog.locator(".campaign-incident-report section > :is(h3, p, dl)");
  const turns = await bubbles.evaluateAll(els => els.map(el => {
    const box = el.getBoundingClientRect(), row = el.parentElement!.getBoundingClientRect(), face = getComputedStyle(el, "::before");
    return { tag: el.tagName, left: box.left - row.left, right: row.right - box.right, share: box.width / row.width, face: face.content === "none" ? null : face.backgroundImage, delay: Number(el.getAnimations()[0]?.effect?.getTiming().delay ?? -1) };
  }));
  for (const [i, b] of turns.entries()) {
    if (i) expect(b.delay).toBeGreaterThan(turns[i - 1].delay);
    expect(b.share).toBeLessThanOrEqual(0.75);
    if (b.tag === "H3") { expect(b.right).toBeLessThan(b.left); expect(b.face).toContain("/characters/taylor.webp"); }
    else expect(b.left).toBeLessThan(b.right);
  }
  // A run of answers shows the player's avatar once, beside its last bubble.
  for (const [i, b] of turns.entries()) if (b.tag !== "H3") {
    if (turns[i + 1] && turns[i + 1].tag !== "H3") expect(b.face).toBeNull();
    else expect(b.face).toContain("/models/avatars/previews/fox.png");
  }
  expect(turns.some(b => b.tag === "DL")).toBe(true);
  // Continue company is the dialog's only action and sits on the right.
  const foot = await dialog.locator(".modal-foot").boundingBox(), go = await dialog.getByRole("button", { name: "Continue company", exact: true }).boundingBox();
  expect(Math.round(foot!.x + foot!.width - (go!.x + go!.width))).toBe(0);
  // The rest reads the evidence, not the motion. The disclosure slides open on a CSS transition, and until a frame
  // runs it its contents stay content-visibility hidden; on CI the software-drawn room behind the dialog has held off
  // frames for 9 s. Reduced motion opens it at once.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog.getByText("Incident window", { exact: true })).toBeHidden();
  await dialog.getByText("View Technical Details", { exact: true }).click();
  await expect(dialog.getByText("Incident window", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("slider", { name: "Incident timeline, game second", exact: true })).toBeVisible();
  await expect(dialog.getByRole("table", { name: "Recorded incident evidence by game second", exact: true })).toBeAttached();
  await dialog.getByRole("button", { name: "Continue company", exact: true }).click();
  const after = await savedGame(page);
  expect(after.phase).toBe("management"); expect(after.campaign!.runId).toBe(c.runId);
  expect(after.campaign!.step).toBe(report.recoveredStep);
});
