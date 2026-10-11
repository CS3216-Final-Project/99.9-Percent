import {test,expect,expectRoom,savedGame} from "./fixtures";

test("Opening prevention: fresh player, new observations, reloads and same-company Scaling without API",async({page})=>{
 test.setTimeout(90000);await page.route("**/api/**",r=>r.abort());await page.goto("/");
 await page.getByRole("button",{name:"Try Prototype",exact:true}).click();await page.getByRole("button",{name:"Skip introduction"}).click();await expectRoom(page);
 const id=(await savedGame(page)).campaign!.runId;
 await page.getByRole("button",{name:/Limit to 500 requests\/s/}).click();
 await page.getByRole("button",{name:/Upgrade database/}).click();
 for(let i=0;i<4;i++)await page.getByRole("button",{name:"Advance step",exact:true}).click();
 let c=(await savedGame(page)).campaign!;expect(c.consumedEvents).toContain("opening-growth");expect(c.incident).toBeNull();expect(c.reports).toEqual([]);
 const guidance=page.getByRole("region",{name:"Campaign guidance"}),progress=page.getByRole("region",{name:"Opening prevention progress"});
 await expect(progress).toContainText("Stable service: 0 / 5");await expect(guidance.locator('[data-requirement="admission"]')).toHaveAttribute("data-met","false");
 await page.getByRole("button",{name:/Remove traffic limit/}).click();
 await progress.getByRole("button",{name:"Inspect Application"}).click();await progress.getByRole("button",{name:"Inspect Database"}).click();
 for(let i=0;i<2;i++)await page.getByRole("button",{name:"Advance step",exact:true}).click();
 await expect(progress).toContainText("Stable service: 2 / 5");await expect(guidance.locator('[data-requirement="admission"]')).toHaveAttribute("data-met","true");c=(await savedGame(page)).campaign!;
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);await expect(progress).toContainText("Stable service: 2 / 5");
 for(let i=0;i<3;i++)await page.getByRole("button",{name:"Advance step",exact:true}).click();
 const outcome=page.getByRole("dialog",{name:"Prevention review"});await expect(outcome).toContainText("First growth prevented");
 c=(await savedGame(page)).campaign!;expect(c.openingRecovered).toBe(false);expect(c.reports).toEqual([]);expect(c.openingMilestone).toBeNull();
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(outcome).toBeVisible();expect((await savedGame(page)).campaign).toEqual(c);
 await outcome.getByRole("button",{name:"Continue company",exact:true}).click();
 const milestone=page.getByRole("dialog",{name:"First growth challenge handled"});await expect(milestone).toContainText("without an incident");
 await milestone.getByRole("button",{name:"Continue operating",exact:true}).click();
 await expect(page.getByLabel("Current campaign stage")).toHaveText("Scaling & Routing");
 c=(await savedGame(page)).campaign!;expect(c.runId).toBe(id);expect(c.step).toBe(9);expect(c.openingRecovered).toBe(false);expect(c.scaling?.id).toBe("application-scaling");
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);
});
