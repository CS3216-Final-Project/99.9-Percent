import { advanceCampaignStep } from "./fixtures";
import {test,expect,expectRoom,seedSave,savedGame} from "./fixtures";
import {spikeCompany,untilOffset,act} from "../src/sim/__tests__/spikeFixtures";
test("guardrail: pulses ended, pending observations, explicit recognition and reload",async({page, installClock})=>{
 await installClock();
 const g=untilOffset(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),68);
 await page.route("**/api/**",r=>r.abort());await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 const guidance=page.getByRole("region",{name:"Guided Mode requirements"});await guidance.locator("summary").click();
 await expect(guidance).toContainText("Stable baseline observations: 1 / 5");await expect(guidance).toContainText("Autoscaling is optional");await expect(guidance.locator('[data-requirement="pulses"]')).toHaveAttribute("data-met","true");
 await advanceCampaignStep(page,{seconds:4});
 const recognition=page.getByRole("dialog",{name:"Spike response handled"});await expect(recognition).toBeVisible();expect((await savedGame(page)).campaign!.spikeStage!.acknowledged).toBe(false);
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(recognition).toBeVisible();
 await recognition.getByRole("button",{name:"Continue operating"}).click();await guidance.locator("summary").click();await expect(guidance).toContainText("Stay Online is available through Next in the chapter bar");expect((await savedGame(page)).campaign!.runId).toBe(g.campaign!.runId);
});
