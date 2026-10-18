import type { Page } from "@playwright/test";
import { expect, expectRoom, completeTutorial, declineIdleHint, reviewRecovery, savedGame, seedSave, tutorial } from "./fixtures";
import { applyAction, newGame } from "../src/sim";
import { advanceSteps } from "../src/sim/step";
import { dataCompany } from "../src/sim/__tests__/dataFixture";

/** Timed onboarding checks run separately from the full, native-frame walkthrough. */
export async function onboardingHintHoldJourney(page: Page, width: number, height: number) {
  const touch=width<900;
  await page.setViewportSize({width,height});await page.clock.install();
  await seedSave(page,newGame(),{tutorialDone:false,walkthroughStep:0});await page.goto("/");
  const choose=async(button:ReturnType<Page["getByRole"]>)=>touch?button.tap():button.click();
  await choose(page.getByRole("button",{name:"Continue company",exact:true}));await expectRoom(page);
  const card=tutorial(page),run=page.getByRole("button",{name:"Run",exact:true});
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  await page.clock.fastForward(30000);
  await expect(page.getByRole("dialog",{name:"Need a little help?"})).toBeHidden();
  await expect(run).toBeDisabled();await expect(run).not.toHaveClass(/campaign-guidance-cue/);
  expect((await savedGame(page)).campaign!.step).toBe(0);
}

export async function guidanceJourney(page: Page, width: number, height: number) {
  const touch=width<900;
  // Keep native scene frames while tapping all 21 interactive lessons. Running
  // Playwright's virtual frame loop here made each CI touch action cost ~5s.
  await page.setViewportSize({width,height});
  await seedSave(page,newGame(),{tutorialDone:false,walkthroughStep:0});await page.goto("/");
  const choose=async(button:ReturnType<Page["getByRole"]>)=>touch?button.tap():button.click();
  await choose(page.getByRole("button",{name:"Continue company",exact:true}));await expectRoom(page);
  const card=tutorial(page),run=page.getByRole("button",{name:"Run",exact:true});
  await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
  await completeTutorial(page,touch);await expect(card).toBeHidden();
  const before=await savedGame(page);
  expect(before.campaign!.step).toBe(1);expect(before.campaign!.cashCents).toBe(2000000);expect(before.campaign!.pending).toEqual([]);
  // Install before reloading, preserving the completed company's real save.
  // Only the attention checks below need controlled time.
  await page.clock.install();await page.reload();
  await choose(page.getByRole("button",{name:"Continue company",exact:true}));await expectRoom(page);
  await expect(card).toBeHidden();expect(await savedGame(page)).toEqual(before);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));await declineIdleHint(page);
  const hint=page.getByRole("button",{name:"Hint",exact:true});await choose(hint);
  await choose(page.getByRole("dialog",{name:"Here's a hint"}).getByRole("button",{name:"Got it"}));
  await run.focus();await page.clock.runFor(1);await expect(run).toHaveClass(/campaign-guidance-cue/);
  if(touch)expect(await run.evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  await page.screenshot({path:`test-results/development-b-run-${width}.png`});
  await choose(page.getByRole("button",{name:"View finances",exact:true}));
  const finance=page.getByRole("dialog",{name:"Company finances",exact:true});await expect(finance).toBeVisible();
  await expect(run).not.toHaveClass(/campaign-guidance-cue/);await choose(finance.getByRole("button",{name:"Close",exact:true}));
  await expect(run).not.toHaveClass(/campaign-guidance-cue/);
  const add=page.getByRole("button",{name:/Add server/});
  if(touch){await add.focus();await add.press("Enter");}else await add.click();
  const confirm=page.getByRole("button",{name:"Confirm",exact:true});await page.clock.runFor(1);
  await expect(confirm).toHaveClass(/campaign-guidance-cue/);await expect(confirm).toBeFocused();
  if(touch){await expect(add).toBeHidden();expect(await confirm.evaluate(el=>getComputedStyle(el).animationName)).toBe("none");}
  await page.screenshot({path:`test-results/development-b-confirm-${width}.png`});
  await choose(page.getByRole("button",{name:"Cancel",exact:true}));
  await expect.poll(async()=>{await page.clock.runFor(16);return add.evaluate(el=>document.activeElement===el);}).toBe(true);
  expect(await savedGame(page)).toEqual(before);
}

export async function recoveryJourney(page: Page, width: number, height: number, limited: boolean, reloadFirst = false) {
  await page.setViewportSize({ width, height });
  let game = advanceSteps(newGame(1, `reward-${width}`), 7).state;
  const result = applyAction(game, limited ? { type: "set_traffic_limit", enabled: true } : { type: "start_db_upgrade" });
  if (!result.ok) throw Error(result.message);
  game = result.state;
  for (let n = 0; n < 20 && (game.campaign!.incident?.stableSteps ?? 0) < 4; n++) game = advanceSteps(game, 1).state;
  expect(game.phase).toBe("incident"); expect(game.campaign!.incident!.stableSteps).toBe(4);
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const celebration = page.getByRole("dialog", { name: "System Recovered!", exact: true });
  await expect(celebration).toBeVisible();
  await expect(celebration).toContainText("Service has stabilised again.");
  if (limited) await expect(celebration).toContainText("Some incoming requests are rejected.");
  const cta = celebration.getByRole("button", { name: "Review What Happened", exact: true });
  await expect(cta).toBeFocused(); await expect(cta).toBeInViewport();
  const before = await savedGame(page); expect(before.phase).toBe("review");
  await page.screenshot({ path: `test-results/development-b-recovery-${width}.png` });
  if (reloadFirst) {
    await page.reload(); await page.getByRole("button", { name: "Continue company", exact: true }).click();
    await expect(celebration).toBeHidden();
  } else await reviewRecovery(page);
  const postmortem = page.getByRole("dialog", { name: "Incident postmortem", exact: true });
  await expect(postmortem).toBeVisible(); expect(await savedGame(page)).toEqual(before);
  await expect(postmortem.getByRole("button", { name: "Continue company", exact: true })).toBeInViewport();
  await page.screenshot({ path: `test-results/development-b-postmortem-${width}.png` });
  await postmortem.getByRole("button", { name: "Continue company", exact: true }).click();
  expect((await savedGame(page)).phase).toBe("management");
}

async function prominent(page: Page, name: "Run" | "Pause" | "Confirm", reduced: boolean) {
  await page.clock.runFor(1);
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toHaveClass(/campaign-guidance-cue/);
  if (name === "Confirm") await expect.poll(async () => {
    await page.clock.runFor(16);
    return page.locator(".campaign-action-popover").evaluate(el => getComputedStyle(el).opacity);
  }).toBe("1");
  expect(await page.locator(".campaign-guidance-cue").count()).toBe(1);
  const style = await button.evaluate(el => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    return { outline: parseFloat(s.outlineWidth), glow: s.boxShadow, animation: s.animationName,
      repeat: s.animationIterationCount, duration: s.animationDuration,
      fits: r.left >= 8 && r.right <= innerWidth - 8 && r.top >= 8 && r.bottom <= innerHeight - 8 };
  });
  expect(style.outline).toBeGreaterThanOrEqual(3); expect(style.glow).not.toBe("none"); expect(style.fits).toBe(true);
  if (reduced) expect(style.animation).toBe("none");
  else { expect(style.animation).toBe("campaign-guidance-glow"); expect(style.repeat).toBe("infinite"); expect(style.duration).toBe("1.8s"); }
}

/** Ordinary paused play, including a later chapter, without a walkthrough telling the player to Run. */
export async function ordinaryRunJourney(page: Page, width: number, height: number) {
  const reduced = width < 900;
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.clock.install();
  const game = width === 1366 || width === 320 ? dataCompany() : newGame();
  await seedSave(page, game); await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  const run = page.getByRole("button", { name: "Run", exact: true });
  await run.focus(); await page.keyboard.press("Tab"); await run.focus();
  await expect(run).not.toHaveClass(/campaign-guidance-cue/);
  await page.screenshot({ path: `test-results/spotlight-run-normal-${width}.png` });
  await page.clock.fastForward(9999); await expect(run).not.toHaveClass(/campaign-guidance-cue/);
  await page.clock.runFor(1); await expect(run).not.toHaveClass(/campaign-guidance-cue/);
  const hint=page.getByRole("button",{name:"Hint",exact:true});
  await expect(hint).toHaveClass(/campaign-context-cue/);
  await hint.press("Enter");
  await page.getByRole("dialog",{name:"Here's a hint"}).getByRole("button",{name:"Got it"}).click();
  await page.clock.runFor(1); await prominent(page, "Run", reduced);
  await page.screenshot({ path: `test-results/spotlight-run-active-${width}.png` });
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  await page.keyboard.press("Tab"); await expect(hint).not.toHaveClass(/campaign-context-cue/);
  // A blocking Finance modal cancels the idle cue without advancing the company.
  await page.getByRole("button", { name: "View finances", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Company finances" })).toBeVisible();
  await expect(page.locator(".campaign-guidance-cue")).toHaveCount(0);
}

/** An engine-generated state immediately before a later incident, so the live transition keeps running. */
export async function incidentAttentionJourney(page: Page, width: number, height: number) {
  const reduced = width < 900;
  await page.setViewportSize({ width, height }); await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.clock.install();
  let game = dataCompany();
  for (let i = 0; i < 30; i++) {
    const next = advanceSteps(game, 1).state;
    if (next.phase === "incident") break;
    game = next;
  }
  expect(game.phase).toBe("management"); expect(advanceSteps(game, 1).state.phase).toBe("incident");
  await seedSave(page, game); await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).phase).toBe("incident");
  await prominent(page, "Pause", reduced);
  await page.screenshot({ path: `test-results/spotlight-pause-active-${width}.png` });
  // Freeze only the browser clock after witnessing the real running incident. Quote checks below then cannot
  // accidentally accrue another operating second and correctly become unreviewed while testing attention priority.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".campaign-guidance-cue")).toHaveCount(0);
  const before = await savedGame(page);
  // Data Strategy already has its allowed two App Servers; preview an available chapter action.
  const purchase = page.getByRole("button", { name: /Deploy Read Cache/ });
  await expect(purchase).toBeEnabled(); await purchase.focus(); await purchase.press("Enter");
  const confirm = page.getByRole("button", { name: "Confirm", exact: true });
  await prominent(page, "Confirm", reduced); await expect(confirm).toBeFocused();
  await page.screenshot({ path: `test-results/spotlight-confirm-active-${width}.png` });
  await confirm.press("Tab"); await prominent(page, "Confirm", reduced);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("region", { name: "History", exact: true })).toBeVisible();
  await expect(confirm).not.toHaveClass(/campaign-guidance-cue/);
  await page.getByRole("button", { name: "Close", exact: true }).click(); await prominent(page, "Confirm", reduced);
  // Running the same incident takes attention back from the valid quote to Pause.
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await prominent(page, "Pause", reduced); await expect(confirm).not.toHaveClass(/campaign-guidance-cue/);
  await page.screenshot({ path: `test-results/spotlight-confirm-normal-${width}.png` });
  await page.getByRole("button", { name: "Pause", exact: true }).click(); await prominent(page, "Confirm", reduced);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirm).toBeHidden(); await expect(page.locator(".campaign-guidance-cue")).toHaveCount(0);
  // Capture actual settled compositor frames. The company stays paused, so resuming browser rendering cannot
  // accrue another operating second; a frozen WebGL clock can otherwise retain old inspector pixels in captures.
  await page.clock.resume();
  await purchase.focus(); await purchase.press("Enter");
  await expect(confirm).toHaveClass(/campaign-guidance-cue/);
  await expect(page.locator(".campaign-action-popover")).toHaveCSS("opacity", "1");
  if (reduced) await expect(purchase).toBeHidden();
  await confirm.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: `test-results/spotlight-confirm-active-${width}.png` });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await savedGame(page)).campaign!.cashCents).toBe(before.campaign!.cashCents);
}
