import { infrastructureAction, inspectEquipment, closeInspection } from "./componentInspection";
import { test, expect, seedSave, savedGame } from "./fixtures";
import { newGame } from "../src/sim";
import { tick } from "../src/sim/__tests__/spikeFixtures";

// These journeys exercise panels and persistence; room interaction has dedicated browser coverage.
test.beforeEach(async ({ withoutRoom }) => { await withoutRoom(); });

test("finance explains actual accounting, purchase risk and accessible unavailable actions",async({page})=>{
    await page.route("**/api/**",r=>r.abort());
    await seedSave(page,tick(newGame(1,"finance-browser"),60));
    await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();
    const before=await savedGame(page);
    await page.getByRole("button",{name:"View finances"}).click();
    const finance=page.getByRole("dialog",{name:"Company finances"});
    await expect(finance).toContainText("$0.20");await expect(finance).toContainText("not yet received");
    await expect(finance).toContainText("Last period's result does not include purchases.");
    await finance.getByText("Advanced details",{exact:true}).click();await finance.getByText("Detailed running costs",{exact:true}).click();await expect(finance.getByRole("table")).toContainText("Employee salaries");
    await page.screenshot({path:"test-results/finance-desktop.png"});
    await finance.getByText("How estimates work",{exact:true}).click();
    await finance.getByText(/This is a budget estimate, not a bankruptcy deadline/).scrollIntoViewIfNeeded();
    await expect(finance.getByText(/This is a budget estimate, not a bankruptcy deadline/)).toBeInViewport();
    await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"View finances"})).toBeFocused();
    expect((await savedGame(page)).campaign).toEqual(before.campaign);
    const add=await infrastructureAction(page,/Add server/),beforePurchase=await savedGame(page);await add.click();
    const confirmation=page.getByRole("region",{name:"Confirm Add server"});
    await expect(confirmation).toContainText("Upkeep");await expect(confirmation).toContainText("Warning:");
    await confirmation.getByRole("button",{name:"Cancel"}).click();expect(await savedGame(page)).toEqual(beforePurchase);
    await (await infrastructureAction(page,/Add server/)).click();await page.getByRole("button",{name:"Confirm",exact:true}).click();
    expect((await savedGame(page)).campaign!.cashCents).toBe(before.campaign!.cashCents-100000);
    await infrastructureAction(page,/Add server/);
    const reason=page.locator('.component-inspection .campaign-action-card').filter({has:page.getByRole('button',{name:/Add server/})}).locator('.campaign-action-reason');
    await expect(reason).toContainText("deployment is already pending");await reason.focus();await expect(reason).toBeFocused();
    await closeInspection(page);
    const app=page.locator('.campaign-panel .chip').filter({hasText:/^App Server$/});
    // Scrolling first: a scroll while the hover delay runs closes the tip, as it should for a real pointer.
    await app.scrollIntoViewIfNeeded();await app.hover();
    await expect(page.getByRole("tooltip")).toHaveText("Handles customer requests and uses the Database for data.");
    await app.click();
    await inspectEquipment(page,"app",true);
    const evidence=page.locator('.component-inspection .campaign-evidence');
    await evidence.getByText("About Servers",{exact:true}).click();
    await expect(evidence).toContainText("Scale Up makes one existing");
});


test("Cash card supports keyboard access without enlarging neighbouring status cards",async({page})=>{
    await seedSave(page,newGame(1,"finance-keyboard"));
    await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();
    const cash=page.getByRole("button",{name:"View finances",exact:true});
    const users=page.locator(".stat-users");
    const cashBox=(await cash.boundingBox())!,usersBox=(await users.boundingBox())!;
    expect(cashBox.height).toBe(usersBox.height);expect(Math.abs(cashBox.width-usersBox.width)).toBeLessThan(2);
    expect(await cash.locator("button, [tabindex]").count()).toBe(0);
    const before=(await savedGame(page)).campaign;
    await cash.focus();await page.keyboard.press("Enter");
    const finance=page.getByRole("dialog",{name:"Company finances"});
    await expect(finance.getByText("Advanced details",{exact:true})).toBeVisible();
    await expect(finance.getByText("Costs waiting to be paid",{exact:true})).toBeHidden();
    await page.keyboard.press("Tab");await expect(finance.getByText("Advanced details",{exact:true})).toBeFocused();
    await page.keyboard.press("Enter");await expect(finance.getByText("Costs waiting to be paid",{exact:true})).toBeVisible();
    await page.keyboard.press("Enter");await expect(finance.getByText("Costs waiting to be paid",{exact:true})).toBeHidden();
    await page.screenshot({path:"test-results/finance-refinement-desktop.png"});
    await page.keyboard.press("Escape");await expect(cash).toBeFocused();
    await page.keyboard.press("Space");await expect(finance).toBeVisible();
    await finance.getByRole("button",{name:"Close",exact:true}).click();
    expect((await savedGame(page)).campaign).toEqual(before);
});
