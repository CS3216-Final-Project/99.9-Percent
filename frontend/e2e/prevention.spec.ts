import { advanceCampaignStep, setGameSpeed, seedSave, openPanelTab } from "./fixtures";
import {test,expect,savedGame} from "./fixtures";

// This journey checks prevention rules through the panel and dialogs; other journeys check the 3D room, whose software
// rendering on CI can starve the page of frames for seconds at a time.
test("Opening prevention: fresh player verifies prevention and explicitly unlocks Scaling without API",async({page, installClock, withoutRoom})=>{
 await withoutRoom();await installClock();
 test.setTimeout(90000);await page.route("**/api/**",r=>r.abort());
 const {newGame}=await import("../src/sim");await seedSave(page,newGame(1,"prevention",1));await page.goto("/");
 await page.getByRole("button",{name:"Continue company",exact:true}).click();
 const id=(await savedGame(page)).campaign!.runId;
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
 await setGameSpeed(page,2);
 await openPanelTab(page, "Actions");
 await page.getByRole("button",{name:/Limit to 500 requests\/s/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 await page.getByRole("button",{name:/Upgrade database/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 await advanceCampaignStep(page,{seconds:4-(await savedGame(page)).campaign!.step,resumeClock:false});
 let c=(await savedGame(page)).campaign!;expect(c.consumedEvents).toContain("opening-growth");expect(c.incident).toBeNull();expect(c.reports).toEqual([]);
 const guidance=page.getByRole("region",{name:"Guided Mode requirements"}),progress=page.getByRole("region",{name:"Opening prevention progress"});
 await expect(progress).toContainText("Stable service: 0 / 5");await expect(guidance.locator('[data-requirement="admission"]')).toHaveAttribute("data-met","false");
 await openPanelTab(page, "Actions");
 await page.getByRole("button",{name:/Remove traffic limit/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 await progress.getByRole("button",{name:"Inspect Application"}).click();await progress.getByRole("button",{name:"Inspect Database"}).click();
 await advanceCampaignStep(page,{seconds:2});
 await expect(progress).toContainText("Stable service: 2 / 5");await expect(guidance.locator('[data-requirement="company-checks"]')).toHaveAttribute("data-met","true");c=(await savedGame(page)).campaign!;
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);await expect(progress).toContainText("Stable service: 2 / 5");
 await advanceCampaignStep(page,{seconds:3});
 const outcome=page.getByRole("dialog",{name:"Prevention review"});await expect(outcome).toContainText("First growth prevented");
 c=(await savedGame(page)).campaign!;expect(c.openingRecovered).toBe(false);expect(c.reports).toEqual([]);expect(c.openingMilestone).toBeNull();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(outcome).toBeVisible();expect((await savedGame(page)).campaign).toEqual(c);
 await outcome.getByRole("button",{name:"Continue company",exact:true}).click();
 const recognition=page.getByRole("dialog",{name:"First growth challenge handled"});
 await expect(recognition).toContainText("You spotted the bottleneck early and prevented an outage.");
 await expect(recognition.locator("details")).toHaveCount(1);await expect(recognition.locator("details")).not.toHaveAttribute("open");
 await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Opening");
 await expect(guidance.locator('[data-requirement="recovery"]')).toHaveAttribute("data-met","true");
 await expect(page.getByRole("region",{name:"Scaling controls"})).toHaveCount(0);
 c=(await savedGame(page)).campaign!;expect(c.runId).toBe(id);expect(c.step).toBe(9);expect(c.openingRecovered).toBe(false);expect(c.scaling).toBeNull();expect(c.openingMilestone!.acknowledged).toBe(false);expect(c.openingPrevention!.outcome!.acknowledged).toBe(true);
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);
 await expect(recognition).toContainText("You spotted the bottleneck early and prevented an outage.");
 await recognition.getByRole("button",{name:"Continue operating",exact:true}).click();
 await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Scaling & Routing");
 const entered=(await savedGame(page)).campaign!;
 expect(entered.scaling).not.toBeNull();expect(entered.step).toBe(c.step);expect(entered.cashCents).toBe(c.cashCents);expect(entered.reports).toEqual([]);
});
