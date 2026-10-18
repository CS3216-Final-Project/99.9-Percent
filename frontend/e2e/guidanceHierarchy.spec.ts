import {test,expect,seedSave,expectRoom,savedGame} from "./fixtures";
import {newGame,type GameState} from "../src/sim";
import {advanceSteps} from "../src/sim/step";
import {act,tick,spikeCompany} from "../src/sim/__tests__/spikeFixtures";
import {dataCompany} from "../src/sim/__tests__/dataFixture";
import {preparedReliability} from "../src/sim/__tests__/reliabilityFixture";
import {combinedCompany} from "../src/sim/__tests__/combinedFixture";

function scalingDecision(){
 let game=act(advanceSteps(newGame(),7).state,{type:"start_db_upgrade"});
 game=advanceSteps(game,30).state;return act(act(game,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});
}
const flows=[
 {chapter:1,game:()=>newGame(),goal:"Understand how bottlenecks affect reliable service.",hint:"Run your company"},
 {chapter:2,game:scalingDecision,goal:"Understand how server capacity and routing work together.",hint:"Taking that risk is optional"},
 {chapter:3,game:()=>dataCompany(),goal:"Understand how workloads and caching affect database demand.",hint:"Run your company"},
 {chapter:4,game:()=>spikeCompany(false),goal:"Keep your company reliable during sudden traffic spikes.",hint:"Run your company to observe the first traffic spike"},
 {chapter:5,game:()=>preparedReliability(),goal:"Keep service available when application servers fail.",hint:"start the reliability test"},
 {chapter:6,game:()=>tick(act(combinedCompany(),{type:"set_traffic_limit",enabled:true})),goal:"Keep a growing company reliable while serving full demand.",hint:"Your traffic limit is restricting customers"},
];
for(const flow of flows)test(`Guidance hierarchy: chapter ${flow.chapter} objective, facts and requested advice`,async({page})=>{
 const game=flow.game();await page.clock.install();await seedSave(page,game);await page.goto("/");
 await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const goal=page.getByLabel("Current objective"),guide=page.getByRole("region",{name:"Guided Mode guidance",exact:true});
 await expect(goal).toHaveText(`Goal: ${flow.goal}`);
 await expect(guide).toContainText("Current situation:");await expect(guide).not.toContainText(flow.goal);
 await expect(guide).not.toContainText(flow.hint);await expect(guide).not.toContainText("Next required step:");
 if(flow.chapter===5){
   await expect(page.getByRole("button",{name:"Start reliability test",exact:true})).toBeEnabled();
   await expect(page.getByRole("region",{name:"Reliability requirements"})).toContainText("Stable service: 0 / 5");
 }
 await page.screenshot({path:`../test-results/guidance-hierarchy/chapter-${flow.chapter}-facts.png`});
 const hint=page.getByRole("button",{name:"Hint",exact:true});await hint.focus();await page.clock.fastForward(10000);
 await expect(page.getByRole("button",{name:"Run",exact:true})).not.toHaveClass(/campaign-guidance-cue/);
 await hint.press("Enter");
 const dialog=page.getByRole("dialog",{name:"Here's a hint",exact:true});await expect(dialog).toContainText(flow.hint);
 await page.screenshot({path:`../test-results/guidance-hierarchy/chapter-${flow.chapter}-hint.png`});
 await dialog.getByRole("button",{name:"Got it"}).click();await page.clock.runFor(1);
 if([1,3,4].includes(flow.chapter))await expect(page.getByRole("button",{name:"Run",exact:true})).toHaveClass(/campaign-guidance-cue/);
 await expect(goal).toHaveText(`Goal: ${flow.goal}`);
 expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});

for(const width of [1366,390,320])test(`Guidance hierarchy: Chapter 4 invitation and No at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===1366?768:844});await page.clock.install();
 const game=spikeCompany(false);await seedSave(page,game);await page.goto("/");
 await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const goal=page.getByLabel("Current objective"),guide=page.getByRole("region",{name:"Guided Mode guidance",exact:true});
 await expect(goal).toHaveText("Goal: Keep your company reliable during sudden traffic spikes.");
 await expect(page.getByLabel("Spike progress")).toContainText("Traffic pulses completed0 / 2");
 await expect(page.getByLabel("Spike progress")).toContainText("Stable baseline observations0 / 5");
 await expect(guide).not.toContainText("Run your company");
 const hint=page.getByRole("button",{name:"Hint",exact:true});await hint.focus();await page.clock.fastForward(10000);
 await expect(hint).toHaveClass(/campaign-context-cue/);await expect(hint).toBeInViewport({ratio:1});
 await expect(page.getByRole("button",{name:"Run",exact:true})).not.toHaveClass(/campaign-guidance-cue/);
 await page.screenshot({path:`../test-results/guidance-hierarchy/chapter-4-facts-${width}.png`});
 await page.clock.fastForward(5000);
 const offer=page.getByRole("dialog",{name:"Need a little help?",exact:true});await expect(offer).toBeInViewport({ratio:1});
 await offer.getByRole("button",{name:"No, thanks"}).click();await page.clock.fastForward(60000);
 await expect(offer).toBeHidden();await expect(hint).not.toHaveClass(/campaign-context-cue/);
 await hint.press("Enter");const details=page.getByRole("dialog",{name:"Here's a hint"});
 await expect(details).toContainText("Run your company to observe the first traffic spike");
 await details.getByRole("button",{name:"Got it"}).click();await page.clock.runFor(1);
 await expect(page.getByRole("button",{name:"Run",exact:true})).toHaveClass(/campaign-guidance-cue/);
 await page.screenshot({path:`../test-results/guidance-hierarchy/chapter-4-requested-${width}.png`});
 expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});

for(const chapter of [1,5])test(`Guidance hierarchy: chapter ${chapter} incident facts remain visible`,async({page})=>{
 const game:GameState=chapter===1?advanceSteps(newGame(),7).state:tick(act(preparedReliability(),{type:"arm_reliability"}),8);
 await page.clock.install();await seedSave(page,game);await page.goto("/");
 await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const panel=page.getByRole("complementary",{name:"System metrics"});
 if(chapter===1){await expect(panel).toContainText("Checking recovery: 0/5 game seconds");await expect(panel).not.toContainText("Compare database demand");}
 else {
   const target=game.campaign!.reliabilityStage!.fault!.targetId;
   expect(game.campaign!.apps.find(app=>app.id===target)!.health).toBe("failed");
   await expect(panel).toContainText(`${target.replace("app-","App ")} failed.`);
   await expect(panel).not.toContainText("Inspect health, surviving capacity and routing");
 }
 await page.getByRole("button",{name:"Hint",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Here's a hint"})).toContainText(chapter===1?"Compare database demand":"health");
 expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
});
