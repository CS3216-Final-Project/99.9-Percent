import {test,expect,seedSave,expectRoom,savedGame} from "./fixtures";
import {newGame} from "../src/sim";
import {advanceSteps} from "../src/sim/step";
import {act,tick,spikeCompany,untilOffset} from "../src/sim/__tests__/spikeFixtures";
import {dataCompany} from "../src/sim/__tests__/dataFixture";
import {reliabilityCompany} from "../src/sim/__tests__/reliabilityFixture";
import {combinedCompany} from "../src/sim/__tests__/combinedFixture";
import type {GameState} from "../src/sim";
import type {Page} from "@playwright/test";

async function enter(page:Page,game:GameState){
  await page.clock.install();await seedSave(page,game);await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
}

test("Automatic Hint: paused Opening database incident offers help",async({page})=>{
  await page.clock.install();
  const game=advanceSteps(newGame(),7).state;
  expect(game.phase).toBe("incident");
  await seedSave(page,game);await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
  await page.getByRole("region",{name:"Incident",exact:true}).getByRole("button",{name:"Hint",exact:true}).focus();
  await page.clock.fastForward(15000);
  await expect(page.getByRole("dialog",{name:"Need a little help?",exact:true})).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});

for(const [width,height] of [[1440,900],[1366,768],[390,844],[320,844]])for(const incident of [true,false]){
  test(`Automatic Hint: ${incident?"Incident":"System overview"} attention and modal at ${width}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:width<900?"reduce":"no-preference"});
    const game=incident?advanceSteps(newGame(),7).state:tick(act(combinedCompany(),{type:"set_traffic_limit",enabled:true}));
    await enter(page,game);
    const panel=page.getByRole("region",{name:incident?"Incident":"System overview",exact:true});
    const hint=panel.getByRole("button",{name:"Hint",exact:true});await hint.focus();await hint.press("Tab");
    // Disclosure remains open: reading it receives a fresh interval, never an indefinite veto.
    if(incident)await panel.getByText("Full system evidence",{exact:true}).click();
    await page.clock.fastForward(9999);await expect(hint).not.toHaveClass(/campaign-context-cue/);
    await page.clock.runFor(1);await expect(hint).toHaveClass(/campaign-context-cue/);
    await expect(hint).toBeInViewport({ratio:1});
    const style=await hint.evaluate(e=>({outline:parseFloat(getComputedStyle(e).outlineWidth),glow:getComputedStyle(e).boxShadow,animation:getComputedStyle(e).animationName}));
    expect(style.outline).toBeGreaterThanOrEqual(4);expect(style.glow).not.toBe("none");
    expect(style.animation).toBe(width<900?"none":"campaign-guidance-glow");
    await expect(page.getByRole("button",{name:"Run",exact:true})).not.toHaveClass(/campaign-guidance-cue/);
    await page.screenshot({path:`../test-results/automatic-hints/hint-${incident?"incident":"normal"}-${width}.png`});
    await page.clock.fastForward(4999);const offer=page.getByRole("dialog",{name:"Need a little help?",exact:true});await expect(offer).toBeHidden();
    await page.clock.runFor(1);await expect(offer).toBeVisible();
    await expect(hint).not.toHaveClass(/campaign-context-cue/);
    const box=await offer.boundingBox();expect(box).not.toBeNull();
    expect(Math.abs(box!.x+box!.width/2-width/2)).toBeLessThan(2);
    expect(Math.abs(box!.y+box!.height/2-height/2)).toBeLessThan(2);
    await expect(offer).toBeInViewport({ratio:1});
    await expect(offer.getByRole("button",{name:"Yes, show hint"})).toBeInViewport({ratio:1});
    await expect(offer.getByRole("button",{name:"No, thanks"})).toBeInViewport({ratio:1});
    await page.screenshot({path:`../test-results/automatic-hints/offer-${incident?"incident":"normal"}-${width}.png`});
    await offer.getByRole("button",{name:"No, thanks"}).click();await page.clock.fastForward(60000);
    await expect(offer).toBeHidden();await expect(hint).not.toHaveClass(/campaign-context-cue/);
    await hint.focus();await hint.press("Enter");
    const details=page.getByRole("dialog",{name:"Here's a hint",exact:true});
    await expect(details).toContainText(incident?"Compare database demand":"traffic limit is restricting customers");
    await details.getByRole("button",{name:"Got it",exact:true}).click();
    await page.clock.runFor(1); // Deliver the existing zero-delay traffic attention timer.
    const target=incident?panel.getByRole("button",{name:"Database",exact:true}):page.getByRole("button",{name:/Remove traffic limit/});
    await expect(target).toBeInViewport({ratio:1});
    if(incident)await expect(target).toHaveClass(/campaign-context-cue/);
    else await expect(page.locator(".campaign-traffic-cue")).toHaveCount(1);
    await page.screenshot({path:`../test-results/automatic-hints/accepted-${incident?"incident":"normal"}-${width}.png`});
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
    await expect(page.getByRole("button",{name:"Run",exact:true})).toBeVisible();
  });
}

function scalingDecision(){
  let g=act(advanceSteps(newGame(),7).state,{type:"start_db_upgrade"});
  g=advanceSteps(g,30).state;return act(act(g,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
}
const chapters=[
  {chapter:2,game:scalingDecision,text:"Taking that risk is optional",target:"risk"},
  {chapter:3,game:()=>tick(dataCompany(),8),text:"database",target:"db"},
  {chapter:4,game:()=>untilOffset(spikeCompany(false),8),text:"application",target:"app"},
  {chapter:5,game:()=>tick(act(reliabilityCompany(),{type:"arm_reliability"}),8),text:"health",target:"app"},
  {chapter:6,game:()=>tick(act(combinedCompany(),{type:"set_traffic_limit",enabled:true})),text:"traffic limit",target:"traffic"},
];
for(const flow of chapters)test(`Automatic Hint: chapter ${flow.chapter} contextual offer`,async({page})=>{
  const game=flow.game();await enter(page,game);
  await page.getByRole("button",{name:"Hint",exact:true}).focus();
  await page.clock.fastForward(15000);
  const offer=page.getByRole("dialog",{name:"Need a little help?",exact:true});await expect(offer).toBeVisible();
  await offer.getByRole("button",{name:"Yes, show hint"}).click();
  const details=page.getByRole("dialog",{name:"Here's a hint",exact:true});await expect(details).toContainText(flow.text);
  await details.getByRole("button",{name:"Got it"}).click();
  if(flow.target!=="traffic")await expect(page.locator(`[data-guidance="${flow.target}"]`).first()).toHaveClass(/campaign-context-cue/);
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});

test("Automatic Hint: active investigation and Finance postpone incident help",async({page})=>{
  const game=advanceSteps(newGame(),7).state;await enter(page,game);
  const panel=page.getByRole("region",{name:"Incident",exact:true});
  const offer=page.getByRole("dialog",{name:"Need a little help?",exact:true});
  await panel.getByRole("button",{name:"Database",exact:true}).focus();
  for(let i=0;i<3;i++){
    await page.clock.fastForward(14000);await panel.getByRole("button",{name:"Database",exact:true}).click();await expect(offer).toBeHidden();
  }
  await page.getByRole("button",{name:"View finances",exact:true}).click();
  await page.clock.fastForward(30000);await expect(offer).toBeHidden();
  await page.getByRole("dialog",{name:"Company finances"}).getByRole("button",{name:"Close",exact:true}).click();
  await page.clock.fastForward(14999);await expect(offer).toBeHidden();await page.clock.runFor(1);await expect(offer).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});

test("Automatic Hint: storage warning is independent of incident assistance",async({page})=>{
  const game=advanceSteps(newGame(),7).state;await enter(page,game);
  await page.getByRole("button",{name:"Menu",exact:true}).click();
  const menu=page.getByRole("dialog",{name:"Menu",exact:true});
  await menu.getByRole("button",{name:"Save now",exact:true}).click();
  await expect(page.getByText("Saved",{exact:true})).toBeVisible();
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  // Deliberately refuse browser writes, using the same failure the persistence layer catches.
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException("Test: writes denied","SecurityError");};});
  await menu.getByRole("button",{name:"Save now",exact:true}).click();
  await expect(page.getByText("Could not save: browser storage is unavailable.",{exact:true})).toBeVisible();
  await menu.getByRole("button",{name:"Close",exact:true}).click();
  await page.getByRole("button",{name:"Hint",exact:true}).focus();await page.clock.fastForward(15000);
  await expect(page.getByRole("dialog",{name:"Need a little help?",exact:true})).toBeVisible();
});

for(const ready of [false,true])test(`Automatic Hint: growth-wave registrations, ready=${ready}`,async({page})=>{
  const game=ready?tick(combinedCompany(),5):combinedCompany();await enter(page,game);
  const hint=page.getByRole("button",{name:"Hint",exact:true});await hint.focus();await page.clock.fastForward(15000);
  const offer=page.getByRole("dialog",{name:"Need a little help?",exact:true});await expect(offer).toBeVisible();
  await offer.getByRole("button",{name:"Yes, show hint"}).click();
  const details=page.getByRole("dialog",{name:"Here's a hint",exact:true});
  await expect(details).toContainText(ready?"Growth waves bring registered users":"Registered users increase when that wave begins");
  await expect(details).toContainText(ready?"Promotions are optional":"promotions are optional");
  await details.getByRole("button",{name:"Got it"}).click();await page.clock.runFor(1);
  if(ready)await expect(page.locator('[data-guidance="progression"]')).toHaveClass(/campaign-context-cue/);
  else await expect(page.getByRole("button",{name:"Run",exact:true})).toHaveClass(/campaign-guidance-cue/);
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});


test("Automatic Hint: resumed incident permits help while unfinished Chapter 0 stays hidden", async ({page}) => {
  await page.clock.install();
  const game = advanceSteps(newGame(), 7).state;
  await seedSave(page, game, {tutorialDone:false, walkthroughStep:7});
  await page.goto("/");
  await page.getByRole("button", {name:"Continue company", exact:true}).click();
  await expectRoom(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()+1000));
  await expect(page.getByRole("dialog", {name:/^Tutorial, step/})).toBeHidden();
  const hint = page.getByRole("region", {name:"Incident", exact:true}).getByRole("button", {name:"Hint", exact:true});
  await expect(hint).toBeEnabled();
  await hint.focus(); await page.clock.fastForward(15000);
  const offer = page.getByRole("dialog", {name:"Need a little help?", exact:true});
  await expect(offer).toBeInViewport({ratio:1});
  await offer.getByRole("button", {name:"No, thanks", exact:true}).click();
  await hint.click();
  await expect(page.getByRole("dialog", {name:"Here's a hint", exact:true})).toContainText("Compare database demand");
  expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("nn.campaign.meta.v1")!).walkthroughStep)).toBe(7);
});
