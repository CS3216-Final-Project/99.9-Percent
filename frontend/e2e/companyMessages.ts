import type { Page, TestInfo } from "@playwright/test";
import { expect, expectRoom, savedGame, seedSave } from "./fixtures";
import { newGame } from "../src/sim";
import { act, spikeCompany } from "../src/sim/__tests__/spikeFixtures";
import { dataCompany } from "../src/sim/__tests__/dataFixture";
import { reliabilityCompany } from "../src/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "../src/sim/__tests__/combinedFixture";
import { recoveredOpening } from "../src/game/__fixtures__/openingOutcome";

export function companyMessageGame(chapter: number) {
  if (chapter === 1) return newGame(0, "story-opening");
  if (chapter === 2) return act(act(recoveredOpening(), {type:"acknowledge_review"}), {type:"acknowledge_milestone"});
  if (chapter === 3) return dataCompany();
  if (chapter === 4) return spikeCompany(false);
  if (chapter === 5) return reliabilityCompany();
  return combinedCompany();
}
export async function companyMessageJourney(page: Page, info: TestInfo, chapter: number, touch = false) {
  const game = companyMessageGame(chapter);
  const press = (control: ReturnType<Page["getByRole"]>) => touch ? control.tap() : control.click();
  await page.route("**/api/**", r => r.abort()); await seedSave(page, game); await page.goto("/");
  await press(page.getByRole("button", {name:"Continue company",exact:true})); await expectRoom(page);
  const card = page.getByRole("dialog", {name:"Company Message",exact:true});
  await expect(card).toBeVisible(); await expect(card).toHaveAttribute("aria-modal","true");
  const backdrop = page.locator(".company-message-backdrop");
  await expect(backdrop).toHaveCount(1); await expect(backdrop).toBeVisible();
  await expect(backdrop).toHaveCSS("background-color","rgba(14, 11, 30, 0.62)");
  await expect(backdrop).toHaveCSS("z-index","99");
  await expect(card).toHaveCSS("opacity","1");
  expect(await backdrop.evaluate(el => [[1,1],[innerWidth-1,1],[1,innerHeight-1],[innerWidth-1,innerHeight-1]].every(([x,y]) => document.elementFromPoint(x,y) === el))).toBe(true);
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  // Actual pointer input outside the card cannot reach the underlying transport
  // or dismiss the message. Keyboard navigation remains inside the card.
  const run = page.getByRole("button",{name:"Run",exact:true,includeHidden:true});
  const box = await run.boundingBox();
  if (!box) throw new Error("Expected existing Run Company control");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(card).toBeVisible(); await expect(run).toBeVisible();
  const dismiss = card.getByRole("button",{name:"Dismiss company message",exact:true});
  await expect(dismiss).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(card.getByRole("button",{name:"Got it",exact:true})).toBeFocused();
  await page.keyboard.press("Tab"); await expect(dismiss).toBeFocused();
  await page.keyboard.press("p"); await expect(card).toBeVisible(); await expect(run).toBeVisible();
  await expect(card).toContainText(["Maya", "Alex", "Jordan", "Sam", "Taylor", "Alex"][chapter - 1]);
  await expect(card).toContainText("Your mission:");
  await expect(card).toBeInViewport({ratio:1});
  await expect(card.getByRole("button",{name:"Got it",exact:true})).toBeInViewport({ratio:1});
  expect(await card.evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByRole("dialog",{name:/^Chapter [35]:/})).toHaveCount(0);
  const before = (await savedGame(page)).campaign!;
  await page.screenshot({path:info.outputPath(`company-message-chapter-${chapter}${touch?"-touch":""}.png`)});
  await press(card.getByRole("button", {name:chapter % 2 ? "Got it" : "Dismiss company message",exact:true}));
  await expect(card).toHaveCount(0);
  await expect(backdrop).toHaveCount(0); await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  if (chapter === 4 || chapter === 6) {
    const cue = page.getByRole("dialog",{name:new RegExp(`^Chapter ${chapter - 1}:`)});
    await expect(cue).toBeVisible(); await expect(page.getByRole("dialog")).toHaveCount(1);
    await press(cue.getByRole("button",{name:"Got it",exact:true}));
  }
  expect((await savedGame(page)).campaign).toEqual(before);
  await page.reload(); await press(page.getByRole("button", {name:"Continue company",exact:true}));
  await expect(card).toHaveCount(0); expect((await savedGame(page)).campaign).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
}
