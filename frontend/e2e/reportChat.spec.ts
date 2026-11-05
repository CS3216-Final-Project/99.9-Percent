import type { Locator, Page } from "@playwright/test";
import { test, expect, expectRoom, seedSave } from "./fixtures";
import { spikeCompany, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import type { GameState } from "../src/sim";

async function open(page: Page, game: GameState, dialogName: string, width: number) {
  await page.setViewportSize({ width, height: width < 400 ? 568 : 900 });
  // Every bubble is in place at once, rather than popping up while it is measured.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const dialog = page.getByRole("dialog", { name: dialogName, exact: true });
  await expect(dialog).toBeVisible(); await page.evaluate(async () => { await document.fonts.ready; });
  return dialog;
}
/** Each bubble's place in the chat's scrolling box, with its speaker's picture and how many lines its text takes. */
const bubbles = (dialog: Locator) => dialog.locator(":is(.campaign-incident-report, .report-lesson-summary) > section > :is(h3, p, dl)").evaluateAll(els => els.map(el => {
  const chat = el.closest(".campaign-incident-report")!, edge = chat.getBoundingClientRect(), box = el.getBoundingClientRect();
  const style = getComputedStyle(el), face = getComputedStyle(el, "::before"), inner = edge.left + chat.clientLeft;
  return { tag: el.tagName, left: box.left - inner, right: inner + chat.clientWidth - box.right, width: box.width, chat: chat.clientWidth,
    face: face.content === "none" ? null : face.backgroundImage, faceSize: parseFloat(face.width),
    lines: Math.round((box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parseFloat(style.borderTopWidth) * 2) / parseFloat(style.lineHeight)) };
}));

for (const width of [1440, 320]) test(`report chat: Sam asks a failed spike test's questions and the player answers at ${width}px`, async ({ page, installClock, withoutRoom }, info) => {
  await withoutRoom(); await installClock();
  // The failed test's debrief waits for the player, so the save reopens on it.
  const dialog = await open(page, untilOffset(spikeCompany(false, "read-heavy", 2), 68), "Spike 2 test failed", width);
  await expect(dialog.locator(".campaign-incident-report")).toHaveAttribute("data-speaker", "sam");
  const turns = await bubbles(dialog);
  expect(turns.map(b => b.tag)).toEqual(["H3", "DL", "P", "H3", "P", "H3", "P"]);
  for (const [i, b] of turns.entries()) {
    // Each picture fits the gutter on its side of the scrolling chat, so it is neither clipped nor over the text.
    const side = b.faceSize + 8;
    if (b.tag === "H3") { expect(b.face).toContain("/characters/sam.webp"); expect(b.right).toBeCloseTo(side, 0); }
    else { expect(b.left).toBeCloseTo(side, 0); expect(b.face === null).toBe(turns[i + 1]?.tag === "DL" || turns[i + 1]?.tag === "P"); }
    if (b.face && b.tag !== "H3") expect(b.face).toContain("/models/avatars/previews/");
  }
  await page.screenshot({ path: info.outputPath(`spike-debrief-${width}.png`) });
  // A chat without speakers keeps no empty gutters for pictures it does not show. A fresh copy is styled from scratch,
  // where Chromium leaves the bubbles' gutters stale when the attribute is only removed.
  await dialog.locator(".campaign-incident-report").evaluate(el => { const copy = el.cloneNode(true) as Element; copy.removeAttribute("data-speaker"); el.replaceWith(copy); });
  for (const b of await bubbles(dialog)) { expect(b.face).toBeNull(); expect(Math.round(b.tag === "H3" ? b.right : b.left)).toBe(0); }
});
