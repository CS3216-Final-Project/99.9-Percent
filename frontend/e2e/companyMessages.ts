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
  // On narrow screens the dialogue box itself covers Run, so press a corner of the backdrop instead.
  const [x, y] = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest(".company-message") ? [8, 8] : [x, y], [box.x + box.width / 2, box.y + box.height / 2]);
  await page.mouse.click(x, y);
  await expect(card).toBeVisible(); await expect(run).toBeVisible();
  const dismiss = card.getByRole("button",{name:"Dismiss company message",exact:true});
  const next = card.getByRole("button",{name:"Next",exact:true});
  await expect(next).toBeFocused();
  await page.keyboard.press("Tab"); await expect(dismiss).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(next).toBeFocused();
  await page.keyboard.press("p"); await expect(card).toBeVisible(); await expect(run).toBeVisible();
  const [name, character] = [["Maya","maya"],["Alex","alex"],["Jordan","jordan"],["Sam","sam"],["Taylor","taylor"],["Alex","alex"]][chapter - 1];
  await expect(card.locator(".company-message-plate")).toContainText(name);
  const portrait = card.getByRole("img",{name:new RegExp(`^${name}, `)});
  await expect(portrait).toHaveAttribute("src",`/characters/${character}.webp`);
  await expect.poll(() => portrait.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth)).toBe(768);
  await expect(portrait).toBeInViewport({ratio:1});
  await expect(card).not.toContainText("Your mission:");
  await expect(card).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath(`company-message-chapter-${chapter}-first-line${touch?"-touch":""}.png`)});
  // Odd chapters read on with the keyboard, even chapters by pressing the dialogue box itself.
  const copy = card.locator(".company-message-copy");
  while (await next.count()) {
    const line = await copy.textContent();
    if (chapter % 2) await page.keyboard.press("Enter"); else await press(copy);
    await expect(copy).not.toHaveText(line!);
  }
  await expect(card.getByRole("button",{name:"Got it",exact:true})).toBeFocused();
  await expect(card).toContainText("Your mission:");
  await expect(card).toBeInViewport({ratio:1});
  await expect(card.getByRole("button",{name:"Got it",exact:true})).toBeInViewport({ratio:1});
  expect(await card.evaluate(el=>el.scrollWidth <= el.clientWidth)).toBe(true);
  await expect(page.getByRole("dialog",{name:/^Chapter [46]:/})).toHaveCount(0);
  const before = (await savedGame(page)).campaign!;
  await page.screenshot({path:info.outputPath(`company-message-chapter-${chapter}${touch?"-touch":""}.png`)});
  await press(card.getByRole("button", {name:chapter % 2 ? "Got it" : "Dismiss company message",exact:true}));
  await expect(card).toHaveCount(0);
  await expect(backdrop).toHaveCount(0); await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  if (chapter === 4 || chapter === 6) {
    const cue = page.getByRole("dialog",{name:new RegExp(`^Chapter ${chapter}:`)});
    await expect(cue).toBeVisible(); await expect(page.getByRole("dialog")).toHaveCount(1);
    await press(cue.getByRole("button",{name:"Got it",exact:true}));
  }
  expect((await savedGame(page)).campaign).toEqual(before);
  await page.reload(); await press(page.getByRole("button", {name:"Continue company",exact:true}));
  await expect(card).toHaveCount(0); expect((await savedGame(page)).campaign).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));
}
