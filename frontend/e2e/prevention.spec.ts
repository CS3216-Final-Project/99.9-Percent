import { completeTutorial, advanceCampaignStep, declineIdleHint, setGameSpeed } from "./fixtures";
import {test,expect,savedGame} from "./fixtures";

// These journeys exercise panels and persistence; room interaction has dedicated browser coverage.
test.beforeEach(async ({ withoutRoom }) => { await withoutRoom(); });

test("Opening prevention: fresh player, new observations and reloads keep Scaling locked without API",async({page, installClock})=>{
 await installClock();
 test.setTimeout(90000);await page.route("**/api/**",r=>r.abort());await page.goto("/");
 await page.getByRole("button",{name:"Start Guided Mode",exact:true}).click();await completeTutorial(page);
 const id=(await savedGame(page)).campaign!.runId;
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
 await declineIdleHint(page);
 await setGameSpeed(page,2);
 await page.getByRole("button",{name:/Limit to 500 requests\/s/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 await page.getByRole("button",{name:/Upgrade database/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 await advanceCampaignStep(page,{seconds:4-(await savedGame(page)).campaign!.step,resumeClock:false});
 let c=(await savedGame(page)).campaign!;expect(c.consumedEvents).toContain("opening-growth");expect(c.incident).toBeNull();expect(c.reports).toEqual([]);
 const guidance=page.getByRole("region",{name:"Guided Mode requirements"}),progress=page.getByRole("region",{name:"Opening prevention progress"});
 await expect(progress).toContainText("Stable service: 0 / 5");await expect(guidance.locator('[data-requirement="admission"]')).toHaveAttribute("data-met","false");
 await page.getByRole("button",{name:/Remove traffic limit/}).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
 await progress.getByRole("button",{name:"Inspect Application"}).click();await progress.getByRole("button",{name:"Inspect Database"}).click();
 await advanceCampaignStep(page,{seconds:2});
 await expect(progress).toContainText("Stable service: 2 / 5");await expect(guidance.locator('[data-requirement="admission"]')).toHaveAttribute("data-met","true");c=(await savedGame(page)).campaign!;
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);await expect(progress).toContainText("Stable service: 2 / 5");
 await advanceCampaignStep(page,{seconds:3});
 const outcome=page.getByRole("dialog",{name:"Prevention review"});await expect(outcome).toContainText("First growth prevented");
 c=(await savedGame(page)).campaign!;expect(c.openingRecovered).toBe(false);expect(c.reports).toEqual([]);expect(c.openingMilestone).toBeNull();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(outcome).toBeVisible();expect((await savedGame(page)).campaign).toEqual(c);
 await outcome.getByRole("button",{name:"Continue company",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"First growth challenge handled"})).toHaveCount(0);
 await expect(page.getByLabel("Current Guided Mode stage")).toHaveText("Opening");
 await expect(guidance).toContainText("Scaling requires a real recovered Opening incident");
 await expect(guidance.locator('[data-requirement="recovery"]')).toHaveAttribute("data-met","false");
 await expect(page.getByRole("button",{name:/^Next:/})).toHaveCount(0);
 await expect(page.getByRole("region",{name:"Scaling controls"})).toHaveCount(0);
 c=(await savedGame(page)).campaign!;expect(c.runId).toBe(id);expect(c.step).toBe(9);expect(c.openingRecovered).toBe(false);expect(c.scaling).toBeNull();expect(c.openingMilestone).toBeNull();expect(c.openingPrevention!.outcome!.acknowledged).toBe(true);
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);
});
