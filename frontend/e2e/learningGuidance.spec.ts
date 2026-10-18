import {test,expect,seedSave,expectRoom,savedGame} from "./fixtures";
import {newGame} from "../src/sim";
import {advanceSteps} from "../src/sim/step";
import {act,tick,untilOffset} from "../src/sim/__tests__/spikeFixtures";
import {dataCompany} from "../src/sim/__tests__/dataFixture";
import {spikeCompany} from "../src/sim/__tests__/spikeFixtures";
import {reliabilityCompany,preparedReliability} from "../src/sim/__tests__/reliabilityFixture";
import {combinedCompany} from "../src/sim/__tests__/combinedFixture";

function scalingDecisionCompany(){
  let g=act(advanceSteps(newGame(),7).state,{type:"start_db_upgrade"});
  g=advanceSteps(g,30).state;
  return act(act(g,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
}

for(const [width,height] of [[1440,900],[1366,768],[390,844],[320,844]]){
  test(`Learning guidance: decision and manual Hint at ${width}`,async({page})=>{
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:width<900?"reduce":"no-preference"});
    await page.clock.install();
    const game=scalingDecisionCompany();
    await seedSave(page,game); await page.goto("/");
    await page.getByRole("button",{name:"Continue company",exact:true}).click(); await expectRoom(page);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    const overview=page.getByRole("region",{name:"System overview",exact:true});
    const hint=overview.getByRole("button",{name:"Hint",exact:true});
    await expect(hint).toBeEnabled();
    await hint.focus();
    await page.screenshot({path:`test-results/learning-manual-normal-${width}.png`});
    await page.clock.fastForward(11999);
    const risk=page.getByRole("button",{name:"Consider growth with current capacity",exact:true});
    await expect(risk).not.toHaveClass(/campaign-context-cue/);
    await page.clock.runFor(1);
    await expect(risk).not.toHaveClass(/campaign-context-cue/);
    await expect(page.getByRole("button",{name:"Run",exact:true})).not.toHaveClass(/campaign-guidance-cue/);
    await expect(hint).toHaveClass(/campaign-context-cue/);
    await expect(hint).toBeInViewport({ratio:1});
    await page.clock.fastForward(3000);
    const offer=page.getByRole("dialog",{name:"Need a little help?"});
    await expect(offer).toBeVisible();
    await expect(risk).not.toHaveClass(/campaign-context-cue/);
    await offer.getByRole("button",{name:"No, thanks"}).click();
    await page.clock.fastForward(12000);
    await expect(risk).not.toHaveClass(/campaign-context-cue/);
    await page.screenshot({path:`test-results/learning-growth-decision-${width}.png`});
    await hint.click();
    const dialog=page.getByRole("dialog",{name:"Here's a hint"});
    await expect(dialog).toContainText("Taking that risk is optional");
    await dialog.getByRole("button",{name:"Got it"}).click();
    await expect(risk).toHaveClass(/campaign-context-cue/);
    expect(await risk.evaluate(e=>getComputedStyle(e).animationName)).toBe(width<900?"none":"campaign-guidance-glow");
    await expect(risk).toBeInViewport({ratio:1});
    await risk.click();
    await expect(page.getByRole("button",{name:"Accept growth risk",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Keep preparing",exact:true}).click();
    expect((await savedGame(page)).campaign!.scalingConsent).toBeNull();
    await page.reload(); await page.getByRole("button",{name:"Continue company",exact:true}).click();
    await expect(hint).toBeEnabled();
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  });

  test(`Learning guidance: incident manual diagnostic at ${width}`,async({page})=>{
    await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:"reduce"});
    await page.clock.install();
    const game=advanceSteps(newGame(),7).state;
    await seedSave(page,game); await page.goto("/");
    await page.getByRole("button",{name:"Continue company",exact:true}).click(); await expectRoom(page);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    const incident=page.getByRole("region",{name:"Incident",exact:true});
    const hint=incident.getByRole("button",{name:"Hint",exact:true});
    await hint.scrollIntoViewIfNeeded();
    await page.screenshot({path:`test-results/learning-manual-incident-${width}.png`});
    await hint.click();
    await expect(page.getByRole("dialog",{name:"Here's a hint"})).toContainText("Compare database demand");
    await page.getByRole("button",{name:"Got it",exact:true}).click();
    const db=incident.getByRole("button",{name:"Database",exact:true});
    await expect(db).toHaveClass(/campaign-context-cue/); await expect(db).toBeInViewport();
    await page.clock.fastForward(30000);
    await expect(page.getByRole("dialog",{name:"Need a little help?"})).toBeHidden();
    await expect(page.getByRole("button",{name:"Run",exact:true})).not.toHaveClass(/campaign-guidance-cue/);
    await page.screenshot({path:`test-results/learning-incident-diagnostic-${width}.png`});
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  });
}

const confirmations=[
  {chapter:1,game:()=>newGame(),label:/Upgrade database/},
  {chapter:2,game:()=>scalingDecisionCompany(),label:/Scale up App 1/},
  {chapter:3,game:()=>dataCompany(),label:/Deploy Read Cache/},
  {chapter:4,game:()=>act(spikeCompany(false),{type:"unlock_autoscaling"}),label:/Deploy autoscaling/},
  {chapter:5,game:()=>act(reliabilityCompany(),{type:"unlock_reliability",tech:"health_checks"}),label:/Deploy Health Checks/},
  {chapter:6,game:()=>tick(act(combinedCompany(),{type:"set_traffic_limit",enabled:true})),label:/Remove traffic limit/},
];
for(const flow of confirmations){
  test(`Learning guidance: valid Confirm in chapter ${flow.chapter}`,async({page})=>{
    await page.clock.install(); await seedSave(page,flow.game()); await page.goto("/");
    await page.getByRole("button",{name:"Continue company",exact:true}).click(); await expectRoom(page);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    await expect(page.getByRole("region",{name:"System overview",exact:true}).getByRole("button",{name:"Hint",exact:true})).toBeEnabled();
    const before=await savedGame(page);
    await page.getByRole("button",{name:flow.label}).click(); await page.clock.runFor(1);
    const confirm=page.getByRole("button",{name:"Confirm",exact:true});
    await expect(confirm).toBeEnabled(); await expect(confirm).toHaveClass(/campaign-guidance-cue/);
    await expect.poll(async()=>{await page.clock.runFor(16);return page.locator(".campaign-action-popover").evaluate(e=>getComputedStyle(e).opacity);}).toBe("1");
    await page.screenshot({path:`test-results/learning-confirm-chapter-${flow.chapter}.png`});
    await page.clock.fastForward(20000); await expect(confirm).toHaveClass(/campaign-guidance-cue/);
    await expect(page.locator(".campaign-context-cue,.campaign-traffic-cue")).toHaveCount(0);
    await page.getByRole("button",{name:"Cancel",exact:true}).click();
    await expect(confirm).toBeHidden(); expect(await savedGame(page)).toEqual(before);
  });
}

function lastSpikeObservation(){
  let g=spikeCompany(false);
  g=tick(act(g,{type:"add_server"}),2);
  g=tick(act(g,{type:"scale_up",appId:"app-3"}),3);
  g=tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
  return untilOffset(g,71);
}
function lastReliabilityObservation(){
  let g=act(preparedReliability(),{type:"arm_reliability"});
  for(let i=0;i<100&&g.campaign!.reliabilityStage!.stableSteps!==4;i++){
    if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
    g=tick(g);
  }
  return g;
}
for(const width of [1440,390])for(const chapter of [4,5]){
  test(`Learning guidance: chapter ${chapter} final observation and evidence at ${width}`,async({page})=>{
    await page.setViewportSize({width,height:width===1440?900:844}); await page.clock.install();
    const game=chapter===4?lastSpikeObservation():lastReliabilityObservation();
    expect(chapter===4?game.campaign!.spikeStage!.baselineStableSteps:game.campaign!.reliabilityStage!.stableSteps).toBe(4);
    await seedSave(page,game);await page.goto("/");
    await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    const guidance=page.getByRole("region",{name:"Guided Mode guidance",exact:true});
    await expect(guidance).toContainText(chapter===4?"Stable baseline observations4 / 5":"Stable service: 4 / 5");
    await expect(guidance).not.toContainText("Run your company");
    await page.clock.fastForward(15000);
    const offer=page.getByRole("dialog",{name:"Need a little help?"});
    await expect(offer).toBeVisible();
    await offer.getByRole("button",{name:"No, thanks"}).click();
    await page.screenshot({path:`test-results/learning-chapter-${chapter}-stable-${width}.png`});
    await page.getByRole("button",{name:"Run",exact:true}).click();await page.clock.runFor(1);
    await expect(guidance).not.toContainText("Keep running");
    await expect(page.getByRole("button",{name:"Pause",exact:true})).not.toHaveClass(/campaign-guidance-cue/);
    await page.clock.runFor(1000);
    const outcome=page.getByRole("dialog",{name:chapter===4?"Spike response handled":"Reliability outcome",exact:true});
    await expect(outcome).toBeVisible();
    const evidence=outcome.getByText("Why did my system succeed?",{exact:true});
    await evidence.click();
    await expect(outcome).toContainText("recorded observations");
    await expect(outcome.getByRole("button",{name:"Continue operating",exact:true})).toHaveClass(/campaign-guidance-cue/);
    await page.screenshot({path:`test-results/learning-chapter-${chapter}-outcome-${width}.png`});
    const current=await savedGame(page);
    expect(chapter===4?current.campaign!.spikeStage!.acknowledged:current.campaign!.reliabilityStage!.acknowledged).toBe(false);
  });
}
