import { test, expect, seedSave, savedGame, advanceCampaignStep } from "./fixtures";
import { applyAction, newGame, type Action, type GameState } from "../src/sim";
import { INTRODUCTION_COMPONENTS } from "../src/sim/introduction";

function decide(game: GameState, action: Action) {
  const result=applyAction(game,action);
  if(!result.ok)throw Error(result.message);
  return result.state;
}

// CI covers the handoff itself through public controls; introduction.spec.ts explores every component.
test("introduction hands off to Opening Run, service readings, database upgrade, Confirm and pending Run",async({page,installClock,withoutRoom},info)=>{
  // This journey follows DOM shortcuts and clock controls; visual proof covers the real room.
  await withoutRoom();
  await installClock();
  await page.route("**/api/**",route=>route.abort());
  let game=decide(newGame(7,"opening-guidance-browser",2),{type:"begin_introduction"});
  for(const equipment of INTRODUCTION_COMPONENTS) {
    game=decide(decide(game,{type:"incident_inspect",equipment}),{type:"acknowledge_introduction",equipment});
  }
  await seedSave(page,game);
  await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();
  await expect(page.getByRole("button",{name:"Complete Introduction",exact:true})).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  const panel=page.getByRole("complementary",{name:"System metrics"});
  await expect(panel.getByRole("region",{name:"Introduction Progress"})).toContainText("4/4");
  await panel.getByRole("button",{name:"Complete Introduction",exact:true}).click();
  await expect(page.getByLabel("Current chapter",{exact:true})).toHaveText("Opening");
  const opening=(await savedGame(page)).campaign!;
  expect(opening.completedIntroduction?.completed).toBe(true);
  expect(opening.step).toBe(0);
  expect(opening.runId).toBe(game.campaign!.runId);
  // The chapter opens with a one-card tip pointing at the Hint button; dismiss it to reach the guided step.
  await page.getByRole("dialog",{name:"Tip, step 1 of 1",exact:true}).getByRole("button",{name:"Got it",exact:true}).click();
  const coach=page.getByRole("region",{name:"Chapter 1 guide",exact:true});
  const spotlight=page.locator('[data-spotlight="true"]');
  await expect(coach.getByRole("heading",{name:"Run, then observe",exact:true})).toBeVisible();
  await expect(spotlight).toHaveCount(1);
  await expect(spotlight).toHaveAccessibleName("Run");
  await advanceCampaignStep(page,{seconds:1,resumeClock:false});
  await expect(coach.getByRole("heading",{name:"Watch your service",exact:true})).toBeVisible();
  await expect(coach).toContainText("Latency: response time. Errors: failed requests. Backlog: waiting work.");
  await expect(panel.locator(".incident-symptoms")).toHaveAttribute("data-spotlight","true");
  await expect(spotlight).toHaveCount(1);
  const beforeExplanation=await savedGame(page);
  await coach.getByRole("button",{name:"Next",exact:true}).click();
  expect(await savedGame(page)).toEqual(beforeExplanation);
  await advanceCampaignStep(page,{seconds:5,resumeClock:false});
  expect((await savedGame(page)).campaign!.step).toBe(6);
  expect((await savedGame(page)).campaign!.incident?.primaryComponent).toBe("db");
  await expect(spotlight).toHaveCount(1);
  await expect(spotlight).toHaveAccessibleName("Database");
  await spotlight.click();
  const database=page.getByRole("dialog",{name:"Database inspected",exact:true});
  await expect(database).toBeVisible();
  await expect(coach.getByRole("heading",{name:"Read the metrics",exact:true})).toBeVisible();
  await expect(database.locator(".component-inspection-summary")).toHaveAttribute("data-spotlight","true");
  await expect(coach).toContainText("Database demand is above its capacity");
  await coach.getByRole("button",{name:"Next",exact:true}).click();
  await expect(spotlight).toHaveCount(1);
  await expect(spotlight).toHaveAccessibleName("Upgrade database");
  await expect(spotlight).toBeEnabled();
  await expect(spotlight).toBeInViewport({ratio:1});
  await page.screenshot({path:info.outputPath("opening-upgrade-guidance.png")});
  await spotlight.click();
  const quote=page.getByRole("dialog",{name:"Purchase preview",exact:true});
  await expect(quote).toBeVisible();
  await expect(coach).toHaveCount(0);
  await expect(page.locator(".campaign-gold-attention")).toHaveAccessibleName("Confirm");
  const beforePurchase=(await savedGame(page)).campaign!;
  await quote.getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(database).toHaveCount(0);
  const pending=(await savedGame(page)).campaign!;
  expect(pending.step).toBe(beforePurchase.step);
  expect(pending.pending.some(action=>action.type==="upgrade-db")).toBe(true);
  expect(pending.cashCents).toBeLessThan(beforePurchase.cashCents);
  await expect(coach.getByRole("heading",{name:"Installing",exact:true})).toBeVisible();
  await expect(spotlight).toHaveCount(1);
  await expect(spotlight).toHaveAccessibleName("Run");
  await page.screenshot({path:info.outputPath("opening-pending-run.png")});
});
