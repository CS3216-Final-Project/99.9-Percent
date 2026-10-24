import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { inspectEquipment, closeInspection } from "./componentInspection";
import { spikeCompany, act, untilOffset } from "../src/sim/__tests__/spikeFixtures";
import { preparedReliability } from "../src/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "../src/sim/__tests__/combinedFixture";
import { campaignGuidance } from "../src/game/campaignGuidance";

for(const [chapter,width] of [[4,1440],[5,1440],[6,390],[6,320]] as const) {
  test(`mission dashboard: Chapter ${chapter} at ${width}px keeps exact requirements, equipment and reload`,async({page,installClock},info)=>{
    await installClock();await page.setViewportSize({width,height:width<900?844:900});
    const game=chapter===4?untilOffset(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),28):chapter===5?preparedReliability():combinedCompany();
    await page.route("**/api/**",route=>route.abort());await seedSave(page,game);await page.goto("/");
    await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
    const cue=page.getByRole("dialog",{name:/^Chapter [46]:/});
    if(await cue.isVisible())await cue.getByRole("button",{name:"Got it",exact:true}).click();
    const panel=page.getByRole("complementary",{name:"System metrics"});
    await expect(panel.getByRole("region",{name:"Chapter Progress",exact:true})).toBeVisible();
    await expect(panel.getByRole("region",{name:"Current unmet condition",exact:true})).toBeVisible();
    await expect(panel.getByRole("region",{name:"Next step",exact:true})).toBeVisible();
    await expect(panel.getByText("Controller evidence and costs")).toHaveCount(0);
    const details=panel.locator(".mission-requirements");await expect(details).not.toHaveAttribute("open","");
    await details.getByText("View all requirements",{exact:true}).click();
    const model=campaignGuidance(game);
    for(const r of [...model.requirements,...model.finalGoals]) {
      const row=details.locator(`[data-requirement="${r.id}"]`);
      await expect(row).toHaveAttribute("data-met",String(r.met));await expect(row).toContainText(r.label);
    }
    await details.getByText("View all requirements",{exact:true}).click();
    await panel.getByRole("region",{name:"Chapter Progress",exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`mission-${chapter}-${width}.png`)});
    for(const equipment of ["db","app","gateway","cache","monitoring"] as const) {
      const popup=await inspectEquipment(page,equipment);await expect(popup).toBeInViewport({ratio:1});await closeInspection(page);
    }
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
    await page.clock.resume();await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    await expect(panel.locator(".mission-stage")).toHaveText(chapter===4?"Between spikes":chapter===5?"Preparation":"Prepare for full demand");
    await expect(details).not.toHaveAttribute("open","");
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  });
}
