import { test, expect, expectRoom, savedGame } from "./fixtures";
test("inspects evidence and advances a physical step on touch", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try Prototype", exact: true }).tap(); await page.getByRole("button",{name:"Skip introduction"}).tap();
  await expectRoom(page);
  await page.screenshot({ path: "test-results/phase1-mobile.png" });
  await page.getByRole("button", { name: "Inspect metrics · free" }).tap();
  await page.getByRole("button", { name: "Advance step" }).tap();
  expect((await savedGame(page)).campaign!.step).toBe(1);
  await page.getByRole("button", { name: "History", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Campaign history" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("selects scaling instances through room and evidence on touch",async({page})=>{
 const {newGame,applyAction}=await import("../src/sim");
 const {advanceSteps}=await import("../src/sim/step");
 const {seedSave}=await import("./fixtures");
 let g=advanceSteps(newGame(),6).state;
 const act=(a:Parameters<typeof applyAction>[1])=>{const r=applyAction(g,a);if(!r.ok)throw Error(r.message);g=r.state;};
 act({type:"start_db_upgrade"});g=advanceSteps(g,30).state;
 act({type:"acknowledge_review"});act({type:"acknowledge_milestone"});act({type:"add_server"});g=advanceSteps(g,2).state;
 await seedSave(page,g);await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).tap();await expectRoom(page);
 await page.getByRole("main").getByRole("button",{name:"App 2",exact:true}).tap();
 await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 2:/})).toHaveAttribute("aria-pressed","true");
 await page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 1:/}).tap();
 await expect(page.getByRole("main").getByRole("button",{name:"App 1",exact:true})).toHaveAttribute("aria-pressed","true");
 await page.screenshot({path:"test-results/phase3-mobile.png"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
