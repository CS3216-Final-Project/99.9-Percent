import type { Locator, Page } from "@playwright/test";
import { test, expect, seedSave, savedGame, expectRoom, chooseAppProfile } from "./fixtures";
import { reliabilityClarity } from "./reliabilityClarity";
import { reliabilityOutcome } from "../src/game/__fixtures__/reliabilityOutcome";
import { newGame, replayCampaign } from "../src/sim";
test("Chapter 5 clarity: short outcome, retained details and explicit acknowledgement", async ({ page, installClock }, info) => {
  await installClock(); await reliabilityClarity(page, info);
});

test("game text is not selectable: dragging across a report highlights nothing", async ({ page, installClock, withoutRoom }, info) => {
  // Selection is the page's own behaviour; the software-drawn room only slows every pointer move and screenshot.
  await withoutRoom(); await installClock();
  // Every chat bubble is in place at once, rather than popping up one by one under the drag.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/**", route => route.abort()); await seedSave(page, reliabilityOutcome(true)); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const outcome = page.getByRole("dialog", { name: "Reliability outcome", exact: true });
  await expect(outcome.getByRole("heading", { level: 3 })).toHaveCount(5);
  const chat = (await outcome.locator(".campaign-incident-report").boundingBox())!;
  const drag = async () => {
    await page.evaluate(() => getSelection()?.removeAllRanges());
    await page.mouse.move(chat.x + chat.width * 0.3, chat.y + 30); await page.mouse.down();
    await page.mouse.move(chat.x + chat.width * 0.7, chat.y + Math.min(260, chat.height - 10), { steps: 2 }); await page.mouse.up();
    return page.evaluate(() => getSelection()?.toString().trim() ?? "");
  };
  // The same drag selects the chat once text selection is allowed again, as it was before game text was made
  // unselectable, so the gesture really spans text.
  const selectable = await page.addStyleTag({ content: "body { user-select: text !important; }" });
  expect(await drag()).not.toBe("");
  await page.screenshot({ path: info.outputPath("selection-allowed.png") });
  await selectable.evaluate(node => (node as Element).remove());
  expect(await drag()).toBe("");
  await page.screenshot({ path: info.outputPath("selection-blocked.png") });
  await expect(outcome).toBeVisible();
  // The run ID and seed are what a player copies into a bug report, so the scorecard keeps them selectable.
  await outcome.getByRole("button", { name: "Complete campaign", exact: true }).click();
  const scorecard = page.getByRole("dialog", { name: "Campaign complete", exact: true }).getByRole("region", { name: "Run scorecard" });
  await scorecard.getByText("View Technical Details", { exact: true }).click();
  const { runId, seed } = (await savedGame(page)).campaign!.scorecard!;
  for (const id of [runId, String(seed)]) {
    const value = scorecard.getByText(id, { exact: true });
    await value.scrollIntoViewIfNeeded();
    const box = (await value.boundingBox())!;
    await page.evaluate(() => getSelection()?.removeAllRanges());
    await page.mouse.move(box.x + 1, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2, { steps: 2 }); await page.mouse.up();
    expect(await page.evaluate(() => getSelection()?.toString())).toBe(id);
  }
  await page.screenshot({ path: info.outputPath("selection-seed.png") });
});

test("the playtest session ID stays selectable for a facilitator's bug report", async ({ page, installClock, withoutRoom }, info) => {
  await withoutRoom(); await installClock();
  await page.route("**/api/**", route => route.abort()); await seedSave(page, newGame(1, "session-copy")); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menu", exact: true });
  await menu.getByRole("tab", { name: "Playtest", exact: true }).click();
  await menu.getByText("Playtest observer notes", { exact: true }).click();
  const notes = menu.getByText(/^Session: /);
  await expect(notes).toBeVisible();
  const id = /^Session: (\S+) · /.exec(await notes.textContent() ?? "")?.[1] ?? "";
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  await notes.scrollIntoViewIfNeeded();
  // Drag from the first character of the ID to its last, wherever the line draws it.
  const box = await notes.evaluate((el, id) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(id);
      if (at < 0) continue;
      const range = document.createRange(); range.setStart(node, at); range.setEnd(node, at + id.length);
      const r = range.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return null;
  }, id);
  expect(box).not.toBeNull();
  await page.evaluate(() => getSelection()?.removeAllRanges());
  await page.mouse.move(box!.x + 1, box!.y + box!.height / 2); await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 1, box!.y + box!.height / 2, { steps: 2 }); await page.mouse.up();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(id);
  await notes.screenshot({ path: info.outputPath("session-id.png") });
  // One double-click takes the whole ID, not one hyphen-separated part of it.
  await expectSelects(page, notes.locator("code").first(), id, "dblclick");
  // What the facilitator types still selects word by word.
  const typed = menu.getByRole("textbox", { name: "Exact facilitator intervention" });
  await typed.fill("paused the run"); await typed.dblclick({ position: { x: 8, y: 10 } });
  expect(await typed.evaluate(el => { const t = el as HTMLTextAreaElement; return t.value.slice(t.selectionStart, t.selectionEnd); })).toBe("paused");
});

/** Selects a code chip as a player would and expects exactly its value. */
async function expectSelects(page: Page, chip: Locator, value: string, gesture: "click" | "dblclick" | "triple") {
  await chip.scrollIntoViewIfNeeded();
  await page.evaluate(() => getSelection()?.removeAllRanges());
  const box = (await chip.boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (gesture === "triple") await page.mouse.click(x, y, { clickCount: 3 }); else if (gesture === "dblclick") await page.mouse.dblclick(x, y); else await page.mouse.click(x, y);
  expect(await page.evaluate(() => getSelection()?.toString()), `${gesture} on ${value}`).toBe(value);
}

test("a code chip copies whole: a click takes the full run ID or seed, and the two never run together", async ({ page, installClock, withoutRoom }, info) => {
  await withoutRoom(); await installClock();
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Real run IDs are UUIDs, whose hyphens split a double-clicked word.
  const runId = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b", game = reliabilityOutcome(true); game.campaign!.runId = runId;
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.getByRole("dialog", { name: "Reliability outcome", exact: true }).getByRole("button", { name: "Complete campaign", exact: true }).click();
  const scorecard = page.getByRole("dialog", { name: "Campaign complete", exact: true }).getByRole("region", { name: "Run scorecard" });
  await scorecard.getByText("View Technical Details", { exact: true }).click();
  const card = (await savedGame(page)).campaign!.scorecard!, seed = String(card.seed);
  expect(card.runId).toBe(runId);
  const run = scorecard.locator("code", { hasText: runId }), seedChip = scorecard.locator("code", { hasText: new RegExp(`^${seed}$`) });
  for (const gesture of ["click", "dblclick", "triple"] as const) {
    await expectSelects(page, run, runId, gesture);
    await expectSelects(page, seedChip, seed, gesture);
  }
  // Copied together, the run ID and seed stay apart: each is a row of its own, so laid-out text puts them on separate
  // lines. (Where a mouse drag across both ends differs between Linux and macOS Chromium, so it is not the measure.)
  const lines = (await run.locator("xpath=ancestor::dl[1]").innerText()).split("\n").map(line => line.trim());
  expect(lines).toContain(runId);
  expect(lines).toContain(seed);
  await run.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("scorecard-ids.png") });
});

test("Challenge Mode's menu seed copies whole on a click", async ({ page, withoutRoom }) => {
  await withoutRoom();
  await page.route("**/api/**", route => route.abort()); await seedSave(page, newGame(1, "seed-copy"), { challengeUnlocked: true }); await page.goto("/");
  await page.getByRole("button", { name: "Start Challenge Mode", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await chooseAppProfile(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const seed = page.getByRole("dialog", { name: "Menu", exact: true }).locator(".menu-seed code");
  const value = (await seed.textContent())!;
  expect(value).toMatch(/^\d+$/);
  for (const gesture of ["click", "dblclick", "triple"] as const) await expectSelects(page, seed, value, gesture);
});

test("Chapter 5 clarity: incident report keeps its evidence and Continue company acknowledgement", async ({ page, installClock, withoutRoom }, info) => {
  // The journey reads the report and History; the software-drawn room behind them only slows every frame.
  await withoutRoom(); await installClock();
  const completed = reliabilityOutcome(), c = completed.campaign!, report = c.reports.at(-1)!;
  const game = replayCampaign(completed.seed, c.runId, c.inputs.filter(input => input.step < report.recoveredStep), report.recoveredStep, false, c.foundation);
  expect(game.phase).toBe("review");
  await page.route("**/api/**", route => route.abort()); await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  const dialog = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["What happened?", "Capacity after the failure", "How did you respond?", "What could be improved?", "Key takeaway"]);
  // The capacity summary joins the chat: its heading is Taylor's question on the right, its readings and story the
  // player's answers on the left, and every bubble enters in reading order. The evidence in the closed Technical
  // Details is not part of the chat.
  const bubbles = dialog.locator(":is(.campaign-incident-report, .report-lesson-summary) > section > :is(h3, p, dl)");
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
  // A Stay Online incident shows its per-second table, not the timeline: only the table's per-server rows and Routing
  // column show that the route kept feeding the failed server.
  await expect(dialog.getByRole("slider")).toHaveCount(0);
  const evidence = dialog.getByRole("region", { name: "Recorded incident evidence", exact: true });
  await expect(evidence.getByRole("table", { name: "Recorded incident evidence by game second", exact: true })).toBeVisible();
  await expect(evidence.getByRole("columnheader", { name: "Routing", exact: true })).toBeVisible();
  await expect(evidence.getByText("Server 3: 800 / 0 · 0 (failed)", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "What happened, second by second", exact: true })).toBeVisible();
  await expect(dialog.getByRole("list", { name: "Recorded events", exact: true }).getByRole("listitem").first()).toBeVisible();
  await evidence.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("stay-online-evidence.png") });
  await dialog.getByRole("button", { name: "Continue company", exact: true }).click();
  const after = await savedGame(page);
  expect(after.phase).toBe("management"); expect(after.campaign!.runId).toBe(c.runId);
  expect(after.campaign!.step).toBe(report.recoveredStep);
  // The company's Opening incident, read from History during Stay Online, keeps its timeline.
  const opening = game.campaign!.reports[0];
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("tab", { name: "Incidents (2)", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`Game seconds ${opening.openedStep}-${opening.recoveredStep}`) }).click();
  const history = page.getByRole("region", { name: "Incident report", exact: true });
  await history.getByText("View Technical Details", { exact: true }).click();
  await expect(history.getByRole("slider", { name: "Incident timeline, game second", exact: true })).toBeVisible();
  await expect(history.getByRole("region", { name: "Recorded incident evidence", exact: true })).toHaveCount(0);
});
