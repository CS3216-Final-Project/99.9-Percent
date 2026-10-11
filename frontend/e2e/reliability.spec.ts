import {test,expect,seedSave,savedGame,expectRoom} from "./fixtures";
import {readyReliability,preparedReliability,act,tick} from "../src/sim/__tests__/reliabilityFixture";
import type {Page} from "@playwright/test";
async function boot(page:Page,g:ReturnType<typeof readyReliability>){await page.route("**/api/**",r=>r.abort());await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);}
async function advance(page:Page,n:number){for(let i=0;i<n;i++)await page.getByRole("button",{name:"Advance step",exact:true}).click();}
test("reliability: same-company entry, nine-node ownership and explicit research",async({page})=>{
 await boot(page,readyReliability());const before=(await savedGame(page)).campaign!;await page.getByRole("button",{name:"Continue to reliability",exact:true}).click();await expect(page.getByLabel("Current campaign stage")).toHaveText("Stay Online");await page.getByRole("banner").getByRole("button",{name:"Technology tree",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Technology tree"});await expect(dialog.locator("[data-tech]")).toHaveCount(9);await expect(dialog.getByRole("button",{name:"Larger Database: Owned",exact:true})).toBeVisible();await dialog.getByRole("button",{name:"Health Checks: Available",exact:true}).click();await dialog.getByRole("button",{name:"Unlock Health Checks · 1 research point",exact:true}).click();await expect(dialog.getByRole("button",{name:"Health Checks: Owned",exact:true})).toBeVisible();const after=(await savedGame(page)).campaign!;expect(after.runId).toBe(before.runId);expect(after.cashCents).toBe(before.cashCents);expect(after.step).toBe(before.step);await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign!.reliabilityStage!.owned).toContain("health_checks");
});
test("reliability: manual restoration, measured report, outcome and paused reload without API",async({page})=>{
 test.setTimeout(120000);await boot(page,act(readyReliability(),{type:"enter_reliability"}));await page.clock.install();await page.getByRole("button",{name:"Start reliability test",exact:true}).click();await advance(page,8);await expect(page.getByRole("region",{name:"Stay Online"})).toContainText("failed");const f=(await savedGame(page)).campaign!.reliabilityStage!.fault!;await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign!.reliabilityStage!.fault).toEqual(f);await page.getByRole("button",{name:"Run",exact:true}).click();await page.clock.runFor(2000);await page.getByRole("button",{name:"Pause",exact:true}).click();await page.getByRole("button",{name:`Restore App ${f.targetId.slice(4)} · free · 3 steps`,exact:true}).click();await page.getByRole("button",{name:"Run",exact:true}).click();await page.clock.runFor(12000);await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible();await page.getByRole("button",{name:"Continue company",exact:true}).click();await advance(page,5);await expect(page.getByRole("dialog",{name:"Reliability outcome"})).toBeVisible();await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expect(page.getByRole("dialog",{name:"Reliability outcome"})).toBeVisible();await page.getByRole("button",{name:"Continue operating",exact:true}).click();expect((await savedGame(page)).campaign!.reliabilityStage!.acknowledged).toBe(true);
});
test("reliability: one-step detection and delayed real spare promotion",async({page})=>{
 await boot(page,preparedReliability());await page.getByRole("button",{name:"Start reliability test",exact:true}).click();await advance(page,8);let c=(await savedGame(page)).campaign!;expect(c.apps[1].health).toBe("failed");expect(c.apps[1].detectedHealth).toBe("healthy");await advance(page,1);c=(await savedGame(page)).campaign!;expect(c.apps[1].detectedHealth).toBe("unhealthy");expect(c.pending.some(a=>a.type==="promote-spare")).toBe(true);await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await advance(page,1);c=(await savedGame(page)).campaign!;expect(c.routing.targets).toEqual(["app-1","app-3"]);expect(c.apps).toHaveLength(3);await expect(page.getByRole("region",{name:"Stay Online"})).toContainText("3,200 /");
});

test("reliability: inspection and effective recipients remain clear on narrow touch screens",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await boot(page,tick(act(preparedReliability(),{type:"arm_reliability"}),9));
 const panel=page.getByRole("region",{name:"Stay Online"});
 await panel.getByRole("button",{name:"Inspect App 2 health · free",exact:true}).click();
 const instances=page.getByRole("region",{name:"Application instances"});
 await expect(instances.getByRole("button",{name:/App 2: Installed - not receiving traffic/})).toHaveAttribute("aria-pressed","true");
 await expect(panel).toContainText("detected unhealthy");
 await expect(page.getByRole("button",{name:"Restore App 2 · free · 3 steps",exact:true})).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole("button",{name:"Menu",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Menu"}).getByRole("tab",{name:/Graphics/})).toBeVisible();
});
