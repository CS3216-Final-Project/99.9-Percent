import { test, expect, expectRoom, seedSave, savedGame } from "./fixtures";
import type { Page } from "@playwright/test";
import type { GameState } from "../src/sim";
import { OPENING_DB as Q } from "../src/sim/scenarios/openingDatabaseIncident";
import { finishingScaling } from "../src/sim/__tests__/dataFixture";
import { spikeCompany, act, tick } from "../src/sim/__tests__/spikeFixtures";
import { preparedReliability } from "../src/sim/__tests__/reliabilityFixture";
import { inspectEquipment, closeInspection } from "./componentInspection";

async function boot(page:Page,game:GameState) {
  await page.route("**/api/**",r=>r.abort());await seedSave(page,game);await page.goto("/");
  await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+60_000));
  const cue=page.getByRole("dialog",{name:/^Chapter [46]:/});
  if(await cue.isVisible())await cue.getByRole("button",{name:"Got it",exact:true}).click();
}
for(const width of [1440,390,320]) test.describe(`component management ${width}px`,()=>{
  test.use({viewport:{width,height:width<900?844:900},hasTouch:width<900,isMobile:width<900,edition:"desktop"});
  test("initial inspections share the Database hierarchy and keep details off the first screen",async({page,installClock},info)=>{
    await installClock();const game=preparedReliability();await boot(page,game);
    let referenceWidth=0;
    for(const component of ["db","app","gateway","monitoring"] as const) {
      const popup=await inspectEquipment(page,component);
      const summary=popup.locator(".component-inspection-summary");
      await expect(summary.locator(".inspection-scanner")).toBeVisible();
      await expect(summary.locator(".inspection-status")).toBeVisible();
      await expect(summary.locator(".component-inspection-metric")).not.toBeEmpty();
      await expect(popup.getByRole("button",{name:"Inspect details",exact:true})).toHaveAttribute("aria-expanded","false");
      await expect(popup.locator('[data-guidance-app], .campaign-evidence')).toHaveCount(0);
      const bounds=await popup.boundingBox();expect(bounds).not.toBeNull();
      if(component==="db")referenceWidth=bounds!.width;else expect(bounds!.width).toBe(referenceWidth);
      expect(await popup.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
      if(component==="app"||component==="gateway") {
        const rows=await popup.locator(".component-inspection-controls button").evaluateAll(nodes=>{
          const heights=new Map<number,number[]>();
          for(const node of nodes) { const box=node.getBoundingClientRect();heights.set(box.top,[...(heights.get(box.top)??[]),box.height]); }
          return [...heights.values()];
        });
        for(const heights of rows)expect(Math.max(...heights)-Math.min(...heights)).toBeLessThanOrEqual(1);
      }
      expect(await popup.locator(".modal-body").evaluate(node=>node.scrollHeight<=node.clientHeight)).toBe(true);
      await page.screenshot({path:info.outputPath(`${component}-overview-${width}.png`)});
      await popup.getByRole("button",{name:"Inspect details",exact:true}).click();
      await expect(popup.getByRole("region",{name:component==="app"?"Servers readings":component==="db"?"Database readings":component==="gateway"?"Network readings":"Monitoring readings"})).toBeVisible();
      if(component==="monitoring")await expect(popup.getByRole("button",{name:"Deploy Health Checks",exact:true})).toBeVisible();
      await closeInspection(page);
    }
  });
  test("fleet, focused server and Network subviews keep valid quotes, keyboard focus and Back",async({page,installClock},info)=>{
    await installClock();const game=tick(finishingScaling(),3);await boot(page,game);
    const popup=await inspectEquipment(page,"app");await expect(popup).toHaveAccessibleName("App Servers");
    await expect(popup.locator('[data-guidance-app]')).toHaveCount(0);
    await expect(popup.getByRole("button",{name:/Scale up App/})).toHaveCount(0);
    expect(game.campaign!.apps.length).toBe(Q.maxApps);
    await expect(popup.getByRole("button",{name:"Add server",exact:true})).toBeDisabled();
    await expect(popup.locator(".campaign-action-reason").first()).toHaveText("Two application instances are already installed.");
    await expect(popup).toBeInViewport({ratio:1});await page.screenshot({path:info.outputPath(`fleet-${width}.png`)});
    await popup.getByRole("button",{name:"Server management",exact:true}).click();
    const heading=popup.getByRole("heading",{name:"Server management",exact:true});
    await expect(heading).toHaveCSS("background-color","rgb(232, 225, 237)");
    await expect(heading.locator("svg")).toBeVisible();
    const counts=popup.getByLabel("Server counts").locator(".row");
    await expect(counts).toHaveCount(3);
    for(const [i,color] of ["rgb(232, 225, 237)","rgb(215, 238, 224)","rgb(220, 234, 246)"].entries()) {
      await expect(counts.nth(i)).toHaveCSS("background-color",color);
      await expect(counts.nth(i)).toHaveCSS("text-align","center");
      await expect(counts.nth(i).locator("dd")).toHaveCSS("text-align","center");
    }
    await expect(popup.locator(".inspection-autoscaling-info")).toBeVisible();
    await expect(popup.locator(".inspection-autoscaling-info")).toHaveCSS("background-color","rgb(220, 234, 246)");
    await expect(popup.locator('[data-inspection-view="management"] > .more')).not.toHaveAttribute("open");
    expect(await popup.locator(".modal-body").evaluate(node=>node.scrollHeight<=node.clientHeight)).toBe(true);
    await page.screenshot({path:info.outputPath(`server-management-${width}.png`)});
    await popup.locator('[data-guidance-app="app-2"]').click();
    await expect(popup.getByRole("heading",{name:"App 2",exact:true})).toBeVisible();
    await expect(popup.getByRole("button",{name:"Add server",exact:true})).toHaveCount(0);
    await popup.getByRole("button",{name:"Scale up App 2",exact:true}).click();
    const quote=page.getByRole("dialog",{name:"Purchase preview",exact:true});
    const before=await savedGame(page);await expect(quote.getByRole("button",{name:"Confirm",exact:true})).toBeEnabled();
    await expect(page.locator('.campaign-gold-attention')).toHaveAccessibleName("Confirm");
    await quote.getByRole("button",{name:"Cancel",exact:true}).focus();await page.keyboard.press("Tab");
    expect(await quote.evaluate(node=>node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");await expect(popup.getByRole("button",{name:"Scale up App 2",exact:true})).toBeFocused();
    expect(await savedGame(page)).toEqual(before);
    await page.screenshot({path:info.outputPath(`server-${width}.png`)});
    await popup.getByRole("button",{name:"Back to Server management",exact:true}).click();
    await expect(popup.locator('[data-guidance-app]')).toHaveCount(game.campaign!.apps.length);
    await closeInspection(page);const network=await inspectEquipment(page,"gateway");
    await expect(network.getByText(/Configure routing/)).toHaveCount(0);
    await network.getByRole("button",{name:"Network management",exact:true}).click();
    await expect(network.getByRole("button",{name:"Deploy load balancing",exact:true})).toBeEnabled();
    await network.getByRole("button",{name:"Deploy load balancing",exact:true}).click();
    await quote.getByRole("button",{name:"Cancel",exact:true}).click();
    await network.getByText(/Configure routing/).click();
    await expect(network.getByRole("button",{name:"All apps",exact:true})).toBeDisabled();
    await expect(network.getByText("Deploy load balancing before configuring routing.")).toBeVisible();
    await page.screenshot({path:info.outputPath(`routing-${width}.png`)});
    expect((await savedGame(page)).campaign!.step).toBe(game.campaign!.step);
  });
});

test("autoscaling management: unlock, valid deployment, pending Run and deployed configuration",async({page,installClock},info)=>{
  await installClock();await boot(page,spikeCompany(false));const popup=await inspectEquipment(page,"app");
  await popup.getByRole("button",{name:"Server management",exact:true}).click();
  await popup.getByRole("button",{name:"Autoscaling",exact:true}).click();
  await expect(popup).toContainText("Controller: Locked");
  await expect(popup.getByRole("button",{name:"Deploy autoscaling",exact:true})).toBeDisabled();
  await popup.getByRole("button",{name:"Unlock autoscaling",exact:true}).click();
  await page.getByRole("dialog",{name:"Purchase preview",exact:true}).getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(popup).toContainText("Controller: Available");
  await popup.getByText("Technical Details",{exact:true}).click();await expect(popup).toContainText("Scale out above 80% for 3 game seconds");
  await page.screenshot({path:info.outputPath("autoscaling.png")});
  await popup.getByRole("button",{name:"Deploy autoscaling",exact:true}).click();
  await page.getByRole("dialog",{name:"Purchase preview",exact:true}).getByRole("button",{name:"Confirm",exact:true}).click();
  await expect(popup).toHaveCount(0);expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="deploy-autoscaler")).toBe(true);
  await page.getByRole("button",{name:"Hint",exact:true}).click();await page.getByRole("dialog",{name:"Hint",exact:true}).getByRole("button",{name:"Got it",exact:true}).click();
  const gold=page.locator('.campaign-gold-attention');await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName("Run");
  await gold.click();await page.clock.runFor(2000);await page.getByRole("button",{name:"Pause",exact:true}).click();
  await inspectEquipment(page,"app");await popup.getByRole("button",{name:"Server management",exact:true}).click();await popup.getByRole("button",{name:"Autoscaling",exact:true}).click();
  await expect(popup).toContainText("Controller: Deployed");await popup.getByRole("button",{name:"Disable autoscaling",exact:true}).click();
  expect((await savedGame(page)).campaign!.spikeStage!.controller!.enabled).toBe(false);
});

test("failed server management: Hint visits its card, queues free restoration, then guides pending Run",async({page,installClock})=>{
  await installClock();const game=tick(act(preparedReliability(),{type:"arm_reliability"}),8);await boot(page,game);
  const id=game.campaign!.reliabilityStage!.fault!.targetId,gold=page.locator('.campaign-gold-attention');
  await page.getByRole("button",{name:"Hint",exact:true}).click();await page.getByRole("dialog",{name:"Hint",exact:true}).getByRole("button",{name:"Got it",exact:true}).click();
  await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName("App Server");await gold.click();
  await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName("Server management");await gold.click();
  await expect(gold).toHaveCount(1);await expect(gold).toHaveAttribute("data-guidance-app",id);await gold.click();
  await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName(new RegExp(`^Restore App ${id.slice(4)}`));await gold.click();
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="restore-app")).toBe(false);
  await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName("Confirm");await gold.click();
  expect((await savedGame(page)).campaign!.pending.some(a=>a.type==="restore-app"&&a.targetId===id)).toBe(true);
  await expect(page.getByRole("dialog",{name:"App Servers",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Hint",exact:true}).click();await page.getByRole("dialog",{name:"Hint",exact:true}).getByRole("button",{name:"Got it",exact:true}).click();
  await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName("Run");
});
