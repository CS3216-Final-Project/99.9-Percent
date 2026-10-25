import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { companyMessageJourney } from "./companyMessages";
import { recoveredOpening } from "../src/game/__fixtures__/openingOutcome";
import { newGame } from "../src/sim";
import { act } from "../src/sim/__tests__/spikeFixtures";
import { inspectEquipment, closeInspection } from "./componentInspection";

test.use({reviewCompanyMessage:false,reviewRecoveryNotice:false});
test("Maya appears in fresh and replayed Chapter 0 while the Campaign save stays intact",async({page})=>{
  await page.route("**/api/**",r=>r.abort());
  await seedSave(page,act(newGame(1,"maya-introduction",2),{type:"begin_introduction"}));
  await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  const story=page.getByRole("dialog",{name:"Company Message",exact:true});
  await expect(story.getByRole("img",{name:/^Maya,/})).toBeVisible();
  const first=await story.locator(".dialogue-copy").textContent();
  await story.getByRole("button",{name:"Dismiss company message",exact:true}).click();
  for(const equipment of ["gateway","app","db","monitoring"] as const){await inspectEquipment(page,equipment);await closeInspection(page);}
  await page.getByRole("button",{name:"Complete Introduction",exact:true}).click();
  await story.getByRole("button",{name:"Dismiss company message",exact:true}).click();
  const original=await savedGame(page);
  await page.getByRole("button",{name:"View chapters",exact:true}).click();
  await page.getByRole("button",{name:"Replay Launch Week",exact:true}).click();
  await expect(story.getByRole("img",{name:/^Maya,/})).toBeVisible();
  await expect(story.locator(".dialogue-copy")).toHaveText(first!);
  expect(await savedGame(page)).toEqual(original);
  await story.getByRole("button",{name:"Dismiss company message",exact:true}).click();
  await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await expect(story).toHaveCount(0);
  await page.getByRole("button",{name:"View chapters",exact:true}).click();
  await page.getByRole("button",{name:"Exit practice",exact:true}).click();
  expect(await savedGame(page)).toEqual(original);
  await expect(page.getByLabel("Current chapter",{exact:true})).toHaveText("Opening");
});
for (const chapter of [1,2,3,4,5,6]) test(`company message: Chapter ${chapter} sender, dismissal and reload`, async ({page}, info) => {
  await companyMessageJourney(page, info, chapter);
});

test("company message: review and recognition take priority, then actual Chapter 2 entry introduces Alex", async ({page}) => {
  await page.route("**/api/**", r=>r.abort()); await seedSave(page,recoveredOpening()); await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click(); await expectRoom(page);
  const story=page.getByRole("dialog",{name:"Company Message",exact:true});
  await expect(story).toHaveCount(0);
  await page.getByRole("button",{name:"View Incident Report",exact:true}).click(); await expect(story).toHaveCount(0);
  await page.getByRole("dialog",{name:"Incident postmortem"}).getByRole("button",{name:"Continue company",exact:true}).click();
  await expect(story).toHaveCount(0);
  await page.getByRole("button",{name:"Continue to Scaling & Routing",exact:true}).click();
  await expect(story).toContainText("Alex"); await expect(story).toContainText("CEO");
  expect((await savedGame(page)).campaign!.scaling).not.toBeNull();
});

test("company message: reload before dismissal still deduplicates the shown introduction", async ({page}) => {
  await page.route("**/api/**",r=>r.abort()); await seedSave(page,newGame()); await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click(); await expectRoom(page);
  await expect(page.getByRole("dialog",{name:"Company Message"})).toBeVisible();
  const before=(await savedGame(page)).campaign;
  await page.reload(); await page.getByRole("button",{name:"Continue company",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Company Message"})).toHaveCount(0);
  expect((await savedGame(page)).campaign).toEqual(before);
});
