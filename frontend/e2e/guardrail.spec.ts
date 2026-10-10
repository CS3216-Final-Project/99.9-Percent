import {test,expect,expectRoom,seedSave,savedGame} from "./fixtures";
import {spikeCompany,untilOffset,act} from "../src/sim/__tests__/spikeFixtures";
test("guardrail: pulses ended, pending observations, explicit recognition and reload",async({page})=>{
 const g=untilOffset(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),68);
 await page.route("**/api/**",r=>r.abort());await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 const guidance=page.getByRole("region",{name:"Progression requirements"});await expect(guidance).toContainText("Stable baseline observations: 1 / 5");await expect(guidance).toContainText("Autoscaling is optional");await expect(guidance.locator('[data-requirement="pulses"]')).toHaveAttribute("data-met","true");
 await page.screenshot({path:"test-results/guardrail-spikes.png",fullPage:true});
 for(let i=0;i<4;i++)await page.getByRole("button",{name:"Advance 1 step",exact:true}).click();
 const recognition=page.getByRole("dialog",{name:"Spike response handled"});await expect(recognition).toBeVisible();
 await recognition.getByRole("button",{name:"Close",exact:true}).click();await expect(guidance.getByRole("button",{name:"Review spike recognition"})).toBeVisible();expect((await savedGame(page)).campaign!.spikeStage!.acknowledged).toBe(false);
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(recognition).toBeVisible();
 await recognition.getByRole("button",{name:"Continue operating"}).click();await expect(guidance).toContainText("Stay Online is available through Continue to reliability");expect((await savedGame(page)).campaign!.runId).toBe(g.campaign!.runId);
});
