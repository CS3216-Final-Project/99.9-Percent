import {test,expect,expectRoom,savedGame} from "./fixtures";
for(const width of [1440,390])test.describe(`infrastructure introduction ${width}px`,()=>{
 test.use({viewport:{width,height:width<900?844:900},isMobile:width<900,hasTouch:width<900,edition:width<900?"phone":"desktop"});
 test("fresh introduction supports Hint, exploration, dismissal, halfway reload and Chapter 1",async({page, withoutRoom},info)=>{
  await withoutRoom();
  // Maya's welcome and Opening's message are dismissed along the way; software WebGL makes each dismissal slow.
  test.setTimeout(120_000);
  await page.route("**/api/**",r=>r.abort());await page.goto("/");
  await page.getByRole("button",{name:"Start Guided Mode",exact:true}).click();await expectRoom(page,30_000);
  const panel=page.getByRole("complementary",{name:"System metrics"}),gold=page.locator(".campaign-gold-attention");
  await expect(panel.getByRole("region",{name:"Introduction Progress"})).toContainText("0/4");
  await expect(panel.getByRole("button",{name:"Complete Introduction",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Run",exact:true})).toBeDisabled();
  await panel.getByRole("button",{name:"Monitoring",exact:true}).click();
  const wrong=page.getByRole("dialog",{name:"Monitoring inspected",exact:true});
  await wrong.getByRole("button",{name:"Close",exact:true}).click();
  await expect(panel.getByRole("region",{name:"Introduction Progress"})).toContainText("0/4");
  for(const [i,name] of ["Network","App Server","Database","Monitoring"].entries()) {
   await expect(gold).toHaveCount(1);await expect(gold).toHaveAccessibleName(name);await expect(gold).toBeInViewport({ratio:1});
   await page.getByRole("button",{name:"Hint",exact:true}).click();
   const hint=page.getByRole("dialog",{name:"Hint",exact:true});await expect(hint).toContainText(name==="App Server"?"App Servers":name);
   await hint.getByRole("button",{name:"Got it",exact:true}).click();await panel.getByRole("button",{name,exact:true}).click();
   const popup=page.locator(".component-inspection");await expect(popup).toBeVisible();await expect(gold).toHaveCount(0);
   await expect(popup.locator(".component-inspection-summary .inspection-scanner")).toBeVisible();
   await expect(popup.getByRole("button",{name:/Add server|Upgrade database|Limit to/})).toHaveCount(0);
   await popup.getByRole("button",{name:"Inspect details",exact:true}).click();
   await popup.getByRole("button",{name:"Got it",exact:true}).click();
   await expect(panel.getByRole("region",{name:"Introduction Progress"})).toContainText(`${i+1}/4`);
   if(i===1) {
    await page.screenshot({path:info.outputPath(`introduction-halfway-${width}.png`)});
    await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    await expect(panel.getByRole("region",{name:"Introduction Progress"})).toContainText("2/4");
    await panel.getByRole("button",{name:"Network",exact:true}).click();await page.locator(".component-inspection").getByRole("button",{name:"Got it",exact:true}).click();
    await expect(panel.getByRole("region",{name:"Introduction Progress"})).toContainText("2/4");
   }
  }
  const before=(await savedGame(page)).campaign!;expect(before.step).toBe(0);expect(before.incident).toBeNull();expect(before.reports).toHaveLength(0);
  await page.getByRole("button",{name:"Hint",exact:true}).click();await expect(page.getByRole("dialog",{name:"Hint",exact:true})).toContainText("Complete Introduction");
  await page.getByRole("dialog",{name:"Hint",exact:true}).getByRole("button",{name:"Got it",exact:true}).click();
  await panel.getByRole("button",{name:"Complete Introduction",exact:true}).click();
  await expect(page.getByLabel("Current chapter",{exact:true})).toHaveText("Opening");
  const after=(await savedGame(page)).campaign!;expect(after.runId).toBe(before.runId);expect(after.step).toBe(0);
  expect(after.cashCents).toBe(2000000);expect(after.apps[0].capacity).toBe(1000);expect(after.dbCapacity).toBe(600);
  expect(after.launchWeek).toBeUndefined();expect(after.completedIntroduction!.completed).toBe(true);expect(after.scaling).toBeNull();expect(after.openingMilestone).toBeNull();
  await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
  await expect(page.getByLabel("Current chapter",{exact:true})).toHaveText("Opening");
  const restored=(await savedGame(page)).campaign!;expect(restored.runId).toBe(after.runId);expect(restored.cashCents).toBe(2000000);expect(restored.dbCapacity).toBe(600);
  await page.getByRole("button",{name:"View chapters",exact:true}).click();
  const chapters=page.getByRole("dialog",{name:"Guided Mode chapters",exact:true});
  await expect(chapters.getByRole("listitem").filter({has:page.getByRole("heading",{name:"Opening",exact:true})})).toContainText("Current");
  await chapters.getByRole("button",{name:"Back to company",exact:true}).click();
  await expect(panel.getByRole("region",{name:"Introduction Progress"})).toHaveCount(0);
 });
 test.describe("welcome",()=>{
  test.use({reviewCompanyMessage:false});
  test("Maya welcomes a new company before the first spotlight, and Opening skips her greeting",async({page, withoutRoom},info)=>{await page.route("**/api/**",r=>r.abort());await page.goto("/");
  await withoutRoom();
   await page.getByRole("button",{name:"Start Guided Mode",exact:true}).click();await expectRoom(page);
   const message=page.getByRole("dialog",{name:"Company Message",exact:true}),gold=page.locator(".campaign-gold-attention");
   await expect(message).toContainText("Maya");await expect(message).toContainText("Welcome to your company!");
   await expect(gold).toHaveCount(0);
   await page.screenshot({path:info.outputPath(`introduction-welcome-${width}.png`)});
   while(await message.getByRole("button",{name:"Next",exact:true}).count())await message.getByRole("button",{name:"Next",exact:true}).click();
   await expect(message).toContainText("check out the machines you have");await expect(message).toContainText("Your mission:");
   await message.getByRole("button",{name:"Got it",exact:true}).click();
   await expect(message).toHaveCount(0);await expect(gold).toHaveAccessibleName("Network");
   await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
   await expect(gold).toHaveAccessibleName("Network");await expect(message).toHaveCount(0);
   const panel=page.getByRole("complementary",{name:"System metrics"});
   for(const name of ["Network","App Server","Database","Monitoring"]){await panel.getByRole("button",{name,exact:true}).click();await page.locator(".component-inspection").getByRole("button",{name:"Got it",exact:true}).click();}
   await panel.getByRole("button",{name:"Complete Introduction",exact:true}).click();
   // The chapter opens with a one-card tip pointing at the Hint button; dismiss it to reach the company message.
   await page.getByRole("dialog",{name:"Tip, step 1 of 1",exact:true}).getByRole("button",{name:"Got it",exact:true}).click();
   await expect(message).toContainText("Customers want our website to stay fast");await expect(message).not.toContainText("I'm Maya");
  });
 });
});
