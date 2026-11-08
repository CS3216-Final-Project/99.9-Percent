import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { inspectEquipment, closeInspection } from "./componentInspection";
import type { Page } from "@playwright/test";
import { spikeCompany, act, tick, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import { preparedReliability, reliabilityCompany } from "../src/sim/__tests__/reliabilityFixture";
import { reliabilityOutcome } from "../src/game/__fixtures__/reliabilityOutcome";
import type { GameState } from "../src/sim";
import { campaignGuidance } from "../src/game/campaignGuidance";

for(const [chapter,width] of [[4,1440],[5,1440],[5,390],[5,320]] as const) {
  test(`mission dashboard: Chapter ${chapter} at ${width}px shows the chapter checklist, equipment and reload`,async({page,installClock},info)=>{
    await installClock();await page.setViewportSize({width,height:width<900?844:900});
    const game=chapter===4?untilOffset(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),28):preparedReliability();
    await page.route("**/api/**",route=>route.abort());await seedSave(page,game);await page.goto("/");
    await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
    const cue=page.getByRole("dialog",{name:/^Chapter 4:/});
    if(await cue.isVisible())await cue.getByRole("button",{name:"Got it",exact:true}).click();
    const panel=page.getByRole("complementary",{name:"System metrics"});
    const checklist=panel.getByRole("region",{name:"Guided Mode requirements",exact:true});
    await expect(checklist).toBeVisible();
    await expect(panel.getByRole("region",{name:"Next step",exact:true})).toBeVisible();
    await expect(panel.getByText("Controller evidence and costs")).toHaveCount(0);
    await expect(panel.getByText("View all requirements",{exact:true})).toHaveCount(0);
    await expect(panel.getByRole("region",{name:"Current unmet condition",exact:true})).toHaveCount(0);
    const model=campaignGuidance(game);
    await expect(checklist.getByRole("heading",{level:3})).toHaveText(`${model.stage} · ${model.completed.length}/${model.requirements.length}`);
    await expect(checklist.locator("[data-requirement]")).toHaveCount(model.requirements.length);
    for(const r of model.requirements) {
      const row=checklist.locator(`[data-requirement="${r.id}"]`);
      await expect(row).toBeVisible();await expect(row).toHaveAttribute("data-met",String(r.met));await expect(row).toContainText(r.label);
    }
    await checklist.scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`mission-${chapter}-${width}.png`)});
    for(const equipment of ["db","app","gateway","cache","monitoring"] as const) {
      const popup=await inspectEquipment(page,equipment);await expect(popup).toBeInViewport({ratio:1});await closeInspection(page);
    }
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
    await page.clock.resume();await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    await expect(panel.locator(".mission-stage")).toHaveText(chapter===4?"Between spikes":"Preparation");
    await expect(checklist.locator("[data-requirement]")).toHaveCount(campaignGuidance(game).requirements.length);
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  });
}

/** Stay Online's armed test has failed a server and opened an incident. */
function failing() {
  let game=act(reliabilityCompany(),{type:"arm_reliability"});
  for(let i=0;i<400&&!game.campaign!.incident;i++)game=tick(game);
  return tick(game);
}
/** Chapter 4's first announced pulse is under way. */
function spiking() {
  const game=spikeCompany(false);
  return tick(game,game.campaign!.spikeStage!.deadlines[0]-game.campaign!.step+2);
}
async function open(page:Page,game:GameState,width:number) {
  await page.setViewportSize({width,height:width<900?844:900});await page.emulateMedia({reducedMotion:"reduce"});
  await page.route("**/api/**",route=>route.abort());await seedSave(page,game);await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  const cue=page.getByRole("dialog",{name:/^Chapter 4:/});
  if(await cue.isVisible())await cue.getByRole("button",{name:"Got it",exact:true}).click();
  return page.getByRole("complementary",{name:"System metrics"});
}
for(const width of [1440,390,320]) {
  for(const [moment,company] of [["Stay Online's failure",failing],["a traffic spike",spiking]] as const)
    test(`mission dashboard at ${width}px: ${moment} gives one instruction, under Next step`,async({page,withoutRoom},info)=>{
      await withoutRoom();const game=company(),model=campaignGuidance(game);
      // The chapter is waiting on the run, which the checklist once said again above Next step.
      expect(model.waiting).not.toBeNull();
      const panel=await open(page,game,width),next=panel.getByRole("region",{name:"Next step",exact:true});
      await expect(next.locator("p")).not.toHaveText("");
      await expect(panel.getByText(model.waiting!,{exact:true})).toHaveCount(0);
      await expect(panel.getByRole("region",{name:"Guided Mode requirements",exact:true}).getByRole("status")).toHaveCount(0);
      await next.scrollIntoViewIfNeeded();
      await page.screenshot({path:info.outputPath(`mission-${game.campaign!.reliabilityStage?"failure":"spike"}-${width}.png`)});
    });
  test(`mission dashboard at ${width}px: a completed campaign says only how to look back`,async({page,withoutRoom},info)=>{
    await withoutRoom();await open(page,reliabilityOutcome(),width);
    await page.getByRole("dialog",{name:"Reliability outcome",exact:true}).getByRole("button",{name:"Complete campaign",exact:true}).click();
    await page.getByRole("dialog",{name:"Campaign complete",exact:true}).getByRole("button",{name:"Inspect final company",exact:true}).click();
    const panel=page.getByRole("complementary",{name:"System metrics"}),checklist=panel.getByRole("region",{name:"Guided Mode requirements",exact:true});
    await expect(checklist.locator(".mission-stage")).toHaveText("Campaign complete");
    // Stay Online's purchase advice and a second "Campaign complete" note no longer apply to a finished company.
    await expect(panel.getByText("Reliability purchases are optional",{exact:false})).toHaveCount(0);
    await expect(checklist.getByRole("note")).toHaveCount(0);
    const next=panel.getByRole("region",{name:"Next step",exact:true});
    await expect(next.locator("p")).toHaveText("Review the scorecard before starting another company.");
    await next.scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`mission-complete-${width}.png`)});
  });
}
