import { completeTutorial, advanceCampaignStep, test, expect, savedGame } from "./fixtures";

test.beforeEach(async ({ withoutRoom }) => { await withoutRoom(); });
test("Campaign option comparison, confirmation, Run/Pause and pause-to-investigate use public controls", async ({page, installClock}) => {
 await installClock();
  await page.goto("/"); await page.getByRole("button",{name:"Start Guided Mode",exact:true}).click(); await completeTutorial(page);
  await expect(page.getByText("Effect & costs")).toHaveCount(0);
  await expect(page.getByText("Operating finances")).toHaveCount(0); await expect(page.getByLabel("Request dependencies")).toHaveCount(0);
  await page.getByRole("button",{name:/Add server/}).click(); const confirm=page.getByRole("region",{name:"Confirm Add server"});
  await expect(confirm).toContainText("Add App Server"); await expect(confirm).toContainText("Processes requests and accesses the Database.");
  await expect(confirm).toContainText("+$700 per 60 game seconds"); await expect(confirm).toContainText("$1,000");
  await expect(page.getByRole("complementary",{name:"System metrics"}).getByRole("region",{name:"Confirm Add server"})).toHaveCount(0);
  await expect(confirm.getByRole("button",{name:"Confirm"})).toBeFocused();
  await page.keyboard.press("Escape"); await expect(confirm).toBeHidden(); expect((await savedGame(page)).campaign!.apps).toHaveLength(1);
  const beforeAdvance=(await savedGame(page)).campaign!.step;
  await advanceCampaignStep(page);
  expect((await savedGame(page)).campaign!.step).toBe(beforeAdvance+1);
   await page.getByRole("button",{name:"Run",exact:true}).click(); await page.clock.runFor(1000);
  await expect(page.getByRole("button",{name:"Pause & inspect"})).toHaveCount(0); await page.getByRole("button",{name:"Pause",exact:true}).click(); const stopped=(await savedGame(page)).campaign!.step;
  await page.clock.runFor(3000); expect((await savedGame(page)).campaign!.step).toBe(stopped);
  await expect(page.getByRole("button",{name:"Run",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Tech",exact:true}).click(); await expect(page.getByRole("region",{name:"Tech tree"})).toContainText("Owned does not mean deployed");
  await page.getByRole("button",{name:"Close",exact:true}).click(); await page.clock.runFor(2000); expect((await savedGame(page)).campaign!.step).toBe(stopped);
});
