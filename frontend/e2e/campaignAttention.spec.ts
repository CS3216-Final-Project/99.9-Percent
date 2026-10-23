import { test, expect, seedSave, savedGame, expectRoom, tutorial, setGameSpeed } from "./fixtures";
import type { Page } from "@playwright/test";
import { newGame, type GameState } from "../src/sim";
import { advanceSteps } from "../src/sim/step";
import { act, tick, spikeCompany, dataCompany, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import { reliabilityCompany, preparedReliability } from "../src/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "../src/sim/__tests__/combinedFixture";
import { dataCompany as enteredDataCompany } from "../src/sim/__tests__/dataFixture";

async function boot(page: Page, game: GameState) {
  await page.route("**/api/**", r => r.abort());
  await seedSave(page, game); await page.goto("/");
  await page.getByRole("button", { name: "Continue company", exact: true }).click();
  await expectRoom(page); await page.evaluate(() => document.fonts.ready);
}
async function idle(page: Page, milliseconds = 10_000) {
  test.slow(); // Ten virtual seconds render every animation frame on software WebGL.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.keyboard.press("Shift");
  await page.clock.runFor(milliseconds);
}
const gold = (page: Page) => page.locator(".campaign-gold-attention");

async function expectFullyVisibleGold(page: Page) {
  // IntersectionObserver rounds a fully-contained fractional popover to 0.999999344.
  // Check exact full-button bounds, every clipping ancestor and five hit-test points instead.
  await expect.poll(() => gold(page).evaluate(node => {
    const box=node.getBoundingClientRect();
    if (box.left < 5 || box.top < 5 || box.right > innerWidth-5 || box.bottom > innerHeight-5) return false;
    for(let parent=node.parentElement;parent;parent=parent.parentElement){
      const clip=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
      if(/auto|scroll|hidden|clip/.test(clip.overflowY) && (box.top<bounds.top || box.bottom>bounds.bottom)) return false;
      if(/auto|scroll|hidden|clip/.test(clip.overflowX) && (box.left<bounds.left || box.right>bounds.right)) return false;
    }
    return [[box.left+8,box.top+8],[box.right-8,box.top+8],[box.left+8,box.bottom-8],[box.right-8,box.bottom-8],[(box.left+box.right)/2,(box.top+box.bottom)/2]].every(([x,y])=>node.contains(document.elementFromPoint(x,y)));
  })).toBe(true);
}

const scaling = () => act(act(tick(act(tick(newGame(), 6), { type: "start_db_upgrade" }), 30), { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
test("guidance Chapter 4 baseline: Run advances a real qualifying observation", async ({ page, installClock }) => {
  await installClock(); const game = untilOffset(tick(act(spikeCompany(false), { type: "set_traffic_limit", enabled: true })), 68);
  await boot(page, game); const before = (await savedGame(page)).campaign!;
  await idle(page, 9999); await expect(gold(page)).toHaveCount(0);
  await page.clock.runFor(1); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Run");
  expect((await savedGame(page)).campaign!.step).toBe(before.step);
  await gold(page).click(); await page.clock.runFor(1000); await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).campaign!.spikeStage!.baselineStableSteps).toBe(before.spikeStage!.baselineStableSteps + 1);
});

test("guidance Chapter 4 investigation: Hint owns idle attention and transfers to the relevant action and Confirm", async ({ page, installClock }) => {
  await installClock(); let game = spikeCompany(false);
  game = tick(game, game.campaign!.spikeStage!.deadlines[0] - game.campaign!.step);
  await boot(page, game); const before = (await savedGame(page)).campaign!;
  await idle(page, 9999); await expect(gold(page)).toHaveCount(0);
  await page.clock.runFor(1); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Hint");
  await gold(page).click(); const card = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(card.locator("p")).toHaveCount(1); await expect(card).toContainText("Add a server, then connect it after installation");
  expect((await card.locator("p").innerText()).split(/\s+/).length).toBeLessThan(25);
  await card.getByRole("button", { name: "Got it", exact: true }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(/^Add server/);
  await gold(page).click(); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Confirm");
  expect((await savedGame(page)).campaign!.inputs).toEqual(before.inputs);
  expect((await savedGame(page)).campaign!.step).toBe(before.step);
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a => a.type === "add-app")).toBe(true);
});

for (const [chapter, company, expected] of [
  [1, newGame, "Run"], [2, scaling, "Hint"], [3, dataCompany, /^Next:/],
  [4, () => spikeCompany(false), "Hint"], [5, reliabilityCompany, "Start reliability test"], [6, combinedCompany, "Run"],
  ["2 accepted risk", () => act(scaling(), { type: "accept_scaling_risk" }), "Run"],
  ["3 workload", enteredDataCompany, "Run"],
] as const) test(`guidance Chapter ${chapter}: authoritative idle priority`, async ({ page, installClock }) => {
  await installClock(); await boot(page, company());
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toBeVisible();
  await idle(page, 9999); await expect(gold(page)).toHaveCount(0);
  await page.clock.runFor(1);
  if (expected) { await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(expected); }
  else await expect(gold(page)).toHaveCount(0);
});

test("guidance incident: ten idle seconds offer Hint without changing company state", async ({ page, installClock }, info) => {
  await installClock(); const game = advanceSteps(newGame(), 6).state; await boot(page, game);
  await idle(page); await expect(gold(page)).toHaveAccessibleName("Hint");
  await page.screenshot({ path: info.outputPath("hint-gold.png") });
  expect((await savedGame(page)).campaign!.inputs).toEqual(game.campaign!.inputs);
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});

test("guidance incident: short help targets the upgrade and preserves readings", async ({ page, installClock }, info) => {
  // Every step draws the room and two steps screenshot it, which takes about a minute under CI's software rendering.
  test.setTimeout(120_000);
  await installClock(); await boot(page, advanceSteps(newGame(), 6).state);
  const before = (await savedGame(page)).campaign!;
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Hint", exact: true });
  await expect(card).toContainText("Your database is overloaded"); await expect(card).toHaveAttribute("aria-modal", "false");
  await expect(card.locator("p")).toHaveCount(1); await expect(card.locator("input,fieldset,select")).toHaveCount(0);
  expect((await card.locator("p").innerText()).split(/\s+/).length).toBeLessThan(25);
  await page.screenshot({ path: info.outputPath("hint-card.png") });
  await card.getByRole("button", { name: "Got it" }).click();
  await expect(gold(page)).toHaveAccessibleName(/^Upgrade database/);
  await page.screenshot({ path: info.outputPath("database-gold.png") });
  expect((await savedGame(page)).campaign!.inputs).toEqual(before.inputs);
  expect((await savedGame(page)).campaign!.step).toBe(before.step);
  await page.getByRole("complementary",{name:"System metrics"}).getByRole("button",{name:"Database",exact:true}).click();
  await expect(gold(page)).toHaveAccessibleName(/^Upgrade database/);
  await expect(page.getByRole("region", { name: "Database readings" })).toBeVisible();
  await expect(page.getByRole("region", {name:"Database readings"})).toContainText("Capacity");
  await expect(page.getByRole("button",{name:/^Limit to 500/})).toBeEnabled();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(card).toContainText("Upgrade it to handle more requests");
  await card.getByRole("button", { name: "Got it" }).click();
  await expect(gold(page)).toHaveAccessibleName(/^Upgrade database/);
  await expect(page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Database", exact: true })).toHaveAttribute("aria-pressed", "true");
  await gold(page).click(); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Confirm");
  await page.getByRole("button",{name:"Cancel",exact:true}).click(); await expect(gold(page)).toHaveCount(0);
});

test("guidance accepted installation justifies Run after ten idle seconds", async ({ page, installClock }, info) => {
  await installClock();
  const pending = act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" });
  await boot(page, pending); await idle(page); await expect(gold(page)).toHaveAccessibleName("Run");
  await page.screenshot({ path: info.outputPath("run-gold.png") });
  expect((await savedGame(page)).campaign!.inputs).toEqual(pending.campaign!.inputs);
  expect((await savedGame(page)).campaign!.step).toBe(pending.campaign!.step);
});

test("guidance accepted installation activates through the public clock", async ({ page, installClock }) => {
  await installClock(); const pending = act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" });
  await boot(page, pending); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await page.getByRole("dialog", { name: "Hint", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
  await expect(gold(page)).toHaveAccessibleName("Run");
  await page.getByRole("button", { name: "Run", exact: true }).click(); await expect(gold(page)).toHaveCount(0);
  await page.clock.runFor(3000);
  expect((await savedGame(page)).campaign!.pending).toHaveLength(0);
  expect((await savedGame(page)).campaign!.actions.at(-1)!.activatedStep).not.toBeNull();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

function measuredRecoveryCompany() {
  let game = act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" });
  for (let i = 0; i < 30 && !game.campaign!.incident?.stableSteps; i++) game = tick(game);
  expect(game.campaign!.incident!.stableSteps).toBeGreaterThan(0);
  return game;
}
test("guidance measured incident recovery justifies Run after ten idle seconds", async ({ page, installClock }) => {
  await installClock(); const game = measuredRecoveryCompany(); await boot(page, game); await setGameSpeed(page, 2);
  await idle(page); await expect(gold(page)).toHaveAccessibleName("Run");
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});
test.describe("guidance measured recovery review", () => {
  test.use({ reviewRecoveryNotice: false });
  test("guidance measured incident recovery yields to the recovery notice and postmortem", async ({ page, installClock }) => {
    await installClock(); await boot(page, measuredRecoveryCompany()); await setGameSpeed(page, 2);
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await page.getByRole("dialog", { name: "Hint", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
    await expect(gold(page)).toHaveAccessibleName("Run");
    await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(2500);
    const notice = page.getByRole("dialog", { name: "System Recovered!", exact: true });
    await expect(notice).toBeVisible(); await expect(gold(page)).toHaveCount(0);
    await notice.getByRole("button", { name: "View Incident Report", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Incident postmortem", exact: true })).toBeVisible();
    await expect(gold(page)).toHaveCount(0);
  });
});

test("guidance pending postmortem retains priority through ten idle seconds", async ({ page, installClock }) => {
  await installClock();
  const game = tick(act(advanceSteps(newGame(), 6).state, { type: "start_db_upgrade" }), 30);
  expect(game.phase).toBe("review");
  await boot(page, game); await expect(page.getByRole("dialog", { name: "Incident postmortem" })).toBeVisible();
  await idle(page); await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).phase).toBe("review");
});

test("guidance free admission relief activates and exposes measured drainage without buying capacity", async ({ page, installClock }) => {
  await installClock();
  const game = act(advanceSteps(newGame(), 6).state, { type: "set_traffic_limit", enabled: true });
  await boot(page, game); await idle(page); await expect(gold(page)).toHaveAccessibleName("Run");
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const after = (await savedGame(page)).campaign!;
  expect(after.cashCents).toBe(game.campaign!.cashCents); expect(after.limit).toBe(500);
  expect(after.dbBacklog).toBeLessThan(game.campaign!.dbBacklog);
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Hint", exact: true })).toContainText("Your app is recovering");
  await page.getByRole("button", { name: "Got it", exact: true }).click(); await expect(gold(page)).toHaveAccessibleName("Run");
});

test("guidance queued reliability failover needs Run rather than another investigation", async ({ page, installClock }) => {
  await installClock();
  const game = tick(act(preparedReliability(), { type: "arm_reliability" }), 9);
  expect(game.campaign!.pending.some(a => a.type === "promote-spare")).toBe(true);
  await boot(page, game); await idle(page); await expect(gold(page)).toHaveAccessibleName("Run");
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.clock.runFor(1000);
  expect((await savedGame(page)).campaign!.reliabilityStage!.fault!.promoted).toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
});

test("guidance collapsed entry, keyboard tooltip and reduced motion", async ({ page, installClock }) => {
  await installClock(); await page.emulateMedia({ reducedMotion: "reduce" });
  await boot(page, advanceSteps(newGame(), 6).state);
  await page.getByRole("button", { name: "Hide equipment and actions" }).click();
  const hint = page.getByRole("button", { name: "Hint", exact: true });
  await hint.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("tooltip")).toContainText("Hint"); await expect(page.getByRole("tooltip")).toContainText("Need help? See what to try next.");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Hint", exact: true }).getByRole("button", { name: "Got it" }).click();
  await expect(gold(page)).toHaveAccessibleName("Equipment & actions");
  expect(await gold(page).evaluate(node => getComputedStyle(node).animationName)).toBe("none");
  await gold(page).click(); await expect(gold(page)).toHaveAccessibleName(/^Upgrade database/);
  await expect(page.getByRole("complementary", { name: "System metrics" }).getByRole("button", { name: "Database", exact: true })).toBeVisible();
});

test("guidance confirmation ownership suppresses both spotlights", async ({ page, installClock }) => {
  await installClock(); await boot(page, newGame());
  await page.getByRole("button", { name: /^Add server/ }).click();
  await expect(gold(page)).toHaveAccessibleName("Confirm");
  await idle(page); await expect(gold(page)).toHaveAccessibleName("Confirm");
  await page.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(gold(page)).toHaveCount(0);
});

test("guidance local modal ownership suppresses both spotlights", async ({ page, installClock }) => {
  await installClock(); await boot(page, newGame());
  await page.getByRole("button", { name: "View app health", exact: true }).click();
  await idle(page); await expect(gold(page)).toHaveCount(0);
});

test("guidance onboarding keeps the original header and owns all attention", async ({ page, installClock }) => {
  await installClock(); await seedSave(page, newGame(), { tutorialDone: false });
  await page.goto("/"); await page.getByRole("button", { name: "Continue company", exact: true }).click(); await expectRoom(page);
  await expect(tutorial(page)).toBeVisible(); await idle(page);
  await expect(page.getByRole("button", { name: "Hint", exact: true })).toHaveCount(0);
  await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).campaign!.step).toBe(0);
});

for (const limited of [false, true]) test(`guidance header preserves original indicators and dock at all widths, limited=${limited}`, async ({ page }, info) => {
  await boot(page, limited ? tick(act(newGame(), { type: "set_traffic_limit", enabled: true }), 1) : newGame());
  for (const width of [1440, 1366, 1100, 1024, 901, 900, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    const comparison = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".topbar")!, hint = header.querySelector<HTMLElement>(".campaign-hint")!;
      const read = () => ({
        height: header.getBoundingClientRect().height,
        cards: [...header.querySelectorAll<HTMLElement>(".stat")].map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, text: node.textContent, font: getComputedStyle(node).font, icons: node.querySelectorAll("svg").length })),
        globals: [...header.querySelectorAll<HTMLElement>(".music-btn,.menu-btn")].map(node => [node.offsetWidth, node.offsetHeight, getComputedStyle(node).font]),
        dock: document.querySelector(".bottombar")!.getBoundingClientRect().toJSON(),
      });
      const added = read();
      // Presentation-only baseline: the original CSS with the single addition absent.
      header.classList.remove("has-global-hint"); hint.style.display = "none";
      const original = read();
      header.classList.add("has-global-hint"); hint.style.removeProperty("display");
      return { added, original, overflow: header.scrollWidth > innerWidth };
    });
    expect(comparison.added).toEqual(comparison.original); expect(comparison.overflow).toBe(false);
    await expect(page.getByRole("button", { name: "Hint", exact: true })).toBeInViewport({ ratio: 1 });
    if ([1440, 390, 320].includes(width)) await page.screenshot({ path: info.outputPath(`header-${width}.png`) });
  }
  await page.getByRole("button", { name: "View finances", exact: true }).click(); await expect(page.getByRole("dialog", { name: "Company finances" })).toBeVisible();
});

for (const width of [1440, 1366]) test(`action guidance nested DB purchase and immediate Confirm at ${width}px`, async ({ page, installClock }, info) => {
  await installClock(); await page.setViewportSize({width,height:900});
  await boot(page, advanceSteps(newGame(), 6).state);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.getByRole("button", {name:"Hide equipment and actions"}).click();
  await page.getByRole("button", {name:"Hint",exact:true}).click();
  const card=page.getByRole("dialog",{name:"Hint",exact:true});
  await card.getByRole("button",{name:"Got it", exact:true}).click();
  await expect(gold(page)).toHaveAccessibleName("Equipment & actions");
  await gold(page).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(/^Upgrade database/);
  await expect(gold(page)).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath("upgrade-target.png")});
  await gold(page).focus(); await page.keyboard.press("Enter");
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Confirm");
  await expectFullyVisibleGold(page);
  await expect(page.getByRole("region",{name:"Purchase preview"})).toContainText("Cash after");
  await page.screenshot({path:info.outputPath("confirm-target.png")});
  await page.getByRole("button",{name:"Cancel",exact:true}).click(); await expect(gold(page)).toHaveCount(0);
  await page.getByRole("button",{name:/^Upgrade database/}).click(); await expect(gold(page)).toHaveAccessibleName("Confirm");
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="upgrade-db")).toBe(true);
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  await expect(card).toContainText("change is being installed");
  await card.getByRole("button",{name:"Got it", exact:true}).click(); await expect(gold(page)).toHaveAccessibleName("Run");
});

test("action guidance routing disclosure transfers to All apps without applying it automatically", async ({page,installClock}) => {
  await installClock(); const game=tick(act(dataCompany(),{type:"set_routing",mode:"single",targets:["app-1"]}),2);
  await boot(page,game); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  const card=page.getByRole("dialog",{name:"Hint",exact:true});
  await card.getByRole("button",{name:"Got it", exact:true}).click();
  await expect(gold(page)).toHaveText(/Configure routing/);
  await gold(page).click(); await expect(gold(page)).toHaveAccessibleName("All apps");
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toBeInViewport({ratio:1});
  expect((await savedGame(page)).campaign!.routing.targets).toEqual(["app-1"]);
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="routing")).toBe(true);
});

test("action guidance selects the overloaded App 3 before its exact scaling control", async ({page,installClock}) => {
  await installClock();
  let game=tick(act(spikeCompany(false),{type:"add_server"}),2);
  game=tick(act(game,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}),1);
  game=tick(game,game.campaign!.spikeStage!.deadlines[0]-game.campaign!.step);
  await boot(page,game); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  const card=page.getByRole("dialog",{name:"Hint",exact:true});
  await card.getByRole("button",{name:"Got it", exact:true}).click();
  await expect(gold(page)).toHaveAccessibleName("App Server"); await gold(page).click();
  await expect(gold(page)).toHaveAccessibleName(/^App 3:/); await gold(page).click();
  await expect(gold(page)).toHaveAccessibleName(/^Scale up App 3/); await expect(gold(page)).toBeInViewport({ratio:1});
  await gold(page).click(); await expect(gold(page)).toHaveAccessibleName("Confirm");
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="scale-up" && a.targetId==="app-3")).toBe(true);
});

for (const [label,company] of [
  ["Add server",newGame], ["Deploy Read Cache",enteredDataCompany],
  ["Unlock autoscaling",()=>spikeCompany(false)], ["Deploy Health Checks",()=>act(reliabilityCompany(),{type:"unlock_reliability",tech:"health_checks"})],
] as const) test(`action confirmation shared immediate gold: ${label}`,async ({page,installClock})=>{
  await installClock(); await boot(page,company());
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  const control=page.getByRole("button",{name:new RegExp(`^${label}`)}); await control.click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Confirm");
  await expectFullyVisibleGold(page);
  await page.getByRole("button",{name:"Cancel",exact:true}).click(); await expect(gold(page)).toHaveCount(0);
});

for (const [name,company] of [
  ["Start next growth wave",()=>tick(combinedCompany(),5)],
  ["Start reliability test",reliabilityCompany],
] as const) test(`action guidance mandatory control: ${name}`,async ({page,installClock})=>{
  await installClock(); await boot(page,company());
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  await page.getByRole("dialog",{name:"Hint",exact:true}).getByRole("button",{name:"Got it"}).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(new RegExp(`^${name}`,"i"));
  await expect(gold(page)).toBeInViewport({ratio:1});
});

test("action guidance restoration uses the existing free direct action",async ({page,installClock})=>{
  await installClock(); const game=tick(act(reliabilityCompany(),{type:"arm_reliability"}),8);
  await boot(page,game); await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  const card=page.getByRole("dialog",{name:"Hint",exact:true});
  await card.getByRole("button",{name:"Got it", exact:true}).click();
  await expect(gold(page)).toHaveAccessibleName(/^Restore App/); await expect(gold(page)).toBeInViewport({ratio:1});
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Confirm",exact:true})).toHaveCount(0);
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="restore-app")).toBe(true);
});

for (const [chapter,label,company] of [[2,"Upgrade database",scaling],[6,"Add server",combinedCompany]] as const)
  test(`action confirmation chapter ${chapter}: ${label}`,async ({page,installClock})=>{
    await installClock(); await boot(page,company());
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
    await page.getByRole("button",{name:new RegExp(`^${label}`)}).click();
    await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Confirm");
    await page.getByRole("button",{name:"Cancel",exact:true}).click(); await expect(gold(page)).toHaveCount(0);
  });

test("action guidance preparation: required risk choice retains ownership and never accepts itself",async ({page,installClock})=>{
  await installClock(); await boot(page,scaling());
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  await page.getByRole("dialog",{name:"Hint",exact:true}).getByRole("button",{name:"Accept risk"}).click();
  await expect(gold(page)).toHaveAccessibleName("Consider growth with current capacity");
  await gold(page).click(); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Accept growth risk");
  await expect(page.getByRole("button",{name:"Accept growth risk",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Keep preparing",exact:true}).click();
  expect((await savedGame(page)).campaign!.scalingConsent).not.toBe(true);
});

for(const [chapter,company,target] of [
  [1,newGame,"Run"],[2,scaling,"Upgrade database"],
  [3,enteredDataCompany,"Run"],[4,()=>spikeCompany(false),"App Server"],
  [5,reliabilityCompany,"Start reliability test"],[6,combinedCompany,"Run"],
] as const) test(`simple Hint Chapter ${chapter}: one explanation and valid next choices`,async ({page,installClock},info)=>{
  await installClock(); await boot(page,company());
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  const before=(await savedGame(page)).campaign!.inputs;
  await page.getByRole("button",{name:"Hint",exact:true}).click();
  const card=page.getByRole("dialog",{name:"Hint",exact:true});
  await expect(card.locator("p")).toHaveCount(1); await expect(card.locator("input,fieldset,select")).toHaveCount(0);
  expect((await card.locator("p").innerText()).split(/\s+/).length).toBeLessThan(25);
  await expect(card.getByRole("button")).toHaveCount(chapter === 2 ? 3 : 2); // Chapter 2 offers both valid strategies
  await expect(card.getByRole("button",{name:chapter === 2 ? "Upgrade database" : "Got it", exact:true})).toBeEnabled();
  await page.screenshot({path:info.outputPath(`chapter-${chapter}-hint.png`)});
  await card.getByRole("button",{name:chapter === 2 ? "Upgrade database" : "Got it", exact:true}).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(new RegExp(`^${target}`,"i"));
  expect((await savedGame(page)).campaign!.inputs).toEqual(before);
});

// These journeys use the same real-time idle clock as Run and Hint, never a chapter timer.
test('progression choice: opening the growth explanation never accepts risk', async ({ page, installClock }, info) => {
  await installClock(); await boot(page, scaling());
  const before = (await savedGame(page)).campaign!;
  await idle(page, 9999); await expect(gold(page)).toHaveCount(0);
  await page.clock.runFor(1); await expect(gold(page)).toHaveCount(1);
  await expect(gold(page)).toHaveAccessibleName('Hint');
  await gold(page).click();
  await page.getByRole('dialog', { name: 'Hint', exact: true }).getByRole('button', { name: 'Accept risk', exact: true }).click();
  await expect(gold(page)).toHaveAccessibleName('Consider growth with current capacity');
  await page.screenshot({ path: info.outputPath('growth-readiness-gold.png') });
  await gold(page).click(); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName('Accept growth risk');
  await expect(page.getByRole('button', { name: 'Accept growth risk', exact: true })).toBeVisible();
  expect((await savedGame(page)).campaign!.inputs).toEqual(before.inputs);
  await page.getByRole('button', { name: /^Upgrade database/ }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName('Confirm');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName('Accept growth risk');
  await page.getByRole('button', { name: 'Keep preparing', exact: true }).click();
  await expect(gold(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Upgrade database/ })).toBeEnabled();
  expect((await savedGame(page)).campaign!.scalingConsent).toBeFalsy();
});

test('progression choice: actual database preparation replaces the risk spotlight with Run', async ({ page, installClock }) => {
  await installClock(); await boot(page, scaling());
  // Keep scene frames frozen while making paused decisions, as in other public purchase journeys.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  const hint = page.getByRole('dialog', { name: 'Hint', exact: true });
  await expect(hint.locator('p')).toHaveText('Your database may struggle when more users arrive. Upgrade it to prepare, or accept the risk and continue.');
  await hint.getByRole('button', { name: 'Upgrade database', exact: true }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName(/^Upgrade database/);
  await gold(page).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName('Confirm');
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Step 1 game second', exact: true }).click();
  await page.getByRole('button', { name: 'Step 1 game second', exact: true }).click();
  await page.getByRole('button', { name: 'Step 1 game second', exact: true }).click();
  expect((await savedGame(page)).campaign!.dbCapacity).toBe(2000);
  await idle(page); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName('Run');
  expect((await savedGame(page)).campaign!.scalingConsent).toBeFalsy();
});

test("Chapter 2 chosen risk: only the real confirmation records consent", async ({ page, installClock }) => {
  await installClock(); await boot(page, scaling());
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 60_000));
  const before = (await savedGame(page)).campaign!;
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await page.getByRole("dialog", { name: "Hint", exact: true }).getByRole("button", { name: "Accept risk", exact: true }).click();
  await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Consider growth with current capacity");
  await gold(page).click(); await expect(gold(page)).toHaveCount(1); await expect(gold(page)).toHaveAccessibleName("Accept growth risk");
  expect((await savedGame(page)).campaign!.inputs).toEqual(before.inputs);
  await gold(page).click(); await expect(gold(page)).toHaveCount(0);
  const after = (await savedGame(page)).campaign!;
  expect(after.scalingConsent).toEqual({ policyVersion: 1, acceptedStep: before.step });
  expect(after.dbCapacity).toBe(before.dbCapacity); expect(after.cashCents).toBe(before.cashCents);
});
