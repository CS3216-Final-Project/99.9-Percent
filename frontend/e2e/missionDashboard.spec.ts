import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { inspectEquipment, closeInspection } from "./componentInspection";
import { spikeCompany, act, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import { preparedReliability } from "../src/sim/__tests__/reliabilityFixture";
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
