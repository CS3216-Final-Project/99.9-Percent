import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { companyMessageJourney } from "./companyMessages";
import { recoveredOpening } from "../src/game/__fixtures__/openingOutcome";
import { newGame } from "../src/sim";

test.use({reviewCompanyMessage:false,reviewRecoveryNotice:false});
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
  await page.getByRole("button",{name:"Continue operating",exact:true}).click();
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
