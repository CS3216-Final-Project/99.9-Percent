import type { Page } from "@playwright/test";
import { expect, expectRoom, savedGame, tutorial } from "./fixtures";

/** Cross-contribution regression: the Finance modal must coexist with the live spotlight walkthrough. */
export async function financeDuringWalkthrough(page:Page,touch=false) {
    await page.route("**/api/**",r=>r.abort());
    await page.goto("/");
    await page.getByRole("button",{name:"Start Guided Mode",exact:true}).click();
    await expectRoom(page);
    const card=tutorial(page),room=page.getByRole("main");
    await expect(card).toHaveAccessibleName("Tutorial, step 1 of 21");
    // Room inspections open diagnostic dialogs; return before following the next spotlight.
    for (const [equipment,step] of [["Servers",2],["Database",3]] as const) {
        const label=room.getByRole("button",{name:equipment,exact:true});
        if(touch)await label.tap();else await label.click();
        const inspection=page.getByRole("dialog",{name:`${equipment} inspected`,exact:true});
        await expect(inspection).toBeVisible();await expect(card).toBeHidden();
        await expect(inspection).toContainText(equipment==="Servers"?"Installed 1000 requests/s":"Database");
        const back=inspection.getByRole("button",{name:"Return to room",exact:true});
        if(touch)await back.tap();else await back.click();
        await expect(inspection).toBeHidden();
        await expect(label).toHaveAttribute("aria-pressed","true");
        await expect(card).toHaveAccessibleName(`Tutorial, step ${step} of 21`);
    }
    await card.getByRole("button",{name:"Next",exact:true}).click();
    await card.getByRole("button",{name:"Next",exact:true}).click();
    await expect(card).toHaveAccessibleName("Tutorial, step 5 of 21");
    const before=(await savedGame(page)).campaign;
    const entry=page.getByRole("button",{name:"View finances",exact:true});
    if(touch)await entry.tap();else await entry.click();
    const finance=page.getByRole("dialog",{name:"Company finances",exact:true});
    await expect(finance).toBeVisible();await expect(card).toBeHidden();
    await expect(finance).toContainText("$0.20");
    await page.screenshot({path:`test-results/integration-finance-${touch?"touch":"desktop"}.png`});
    await page.keyboard.press("p");
    if(touch)await finance.getByRole("button",{name:"Close",exact:true}).tap();else await page.keyboard.press("Escape");
    await expect(finance).toBeHidden();await expect(entry).toBeFocused();
    await expect(card).toHaveAccessibleName("Tutorial, step 5 of 21");
    expect((await savedGame(page)).campaign).toEqual(before);
    await card.getByRole("button",{name:"Next",exact:true}).click();
    await expect(card).toHaveAccessibleName("Tutorial, step 6 of 21");
    await card.getByRole("button",{name:"Skip",exact:true}).click();
    await expect(card).toBeHidden();
    expect((await savedGame(page)).campaign!.step).toBe(0);
}
