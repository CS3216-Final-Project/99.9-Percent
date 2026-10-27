import { infrastructureAction, purchasePreview, expectInspectionsOnly } from "./componentInspection";
import type { Page } from "@playwright/test";
import { expect, expectRoom, seedSave, savedGame } from "./fixtures";
import { newGame, type GameState } from "../src/sim";
import { tick } from "../src/sim/__tests__/spikeFixtures";

/** Checks complete rectangles and hit targets, not just partially visible elements. */
export async function usableCard(page:Page) {
    const card=purchasePreview(page);
    await expect.poll(()=>card.evaluate(el=>{
        const box=el.getBoundingClientRect(),stage=document.querySelector("main.stage")!.getBoundingClientRect();
        if(el.classList.contains("component-purchase")) {
            if(box.left<0||box.top<0||box.right>innerWidth||box.bottom>innerHeight)return false;
            if(Math.abs(box.left+box.width/2-innerWidth/2)>1)return false;
        } else {
            if(box.left<Math.max(0,stage.left)||box.top<Math.max(0,stage.top)||box.right>Math.min(innerWidth,stage.right)+1||box.bottom>Math.min(innerHeight,stage.bottom)+1)return false;
            if(innerWidth>900&&Math.abs(box.left-stage.left-12)>1)return false;
            for(const node of document.querySelectorAll<HTMLElement>(".campaign-panel,.bottombar,.floor-menu,.camera-buttons")){
                if(node.closest("details:not([open])")||getComputedStyle(node).visibility==="hidden"||!node.getClientRects().length)continue;
                const r=node.getBoundingClientRect();
                if(box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top)return false;
            }
        }
        for(const node of el.querySelectorAll<HTMLElement>(".campaign-purchase-footer button,.finance-warning")){
            const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            if(r.top<box.top || r.bottom>box.bottom+1 || !hit || !node.contains(hit))return false;
        }
        return true;
    })).toBe(true);
    await expect(card.getByRole("button",{name:"Confirm",exact:true})).toBeEnabled();
    await expect(card.getByRole("button",{name:"Cancel",exact:true})).toBeEnabled();
}

export async function keyboardDetails(page:Page) {
    const content=purchasePreview(page).getByRole("region",{name:"Purchase details",exact:true});
    await content.focus();await expect(content).toBeFocused();
    await content.press("End");
    // Integer dimensions can differ from fractional scrollTop by a pixel.
    // One current-boundary check also accepts the valid no-overflow case.
    await expect.poll(()=>content.evaluate(el=>Math.max(0,el.scrollHeight-el.clientHeight)-el.scrollTop)).toBeLessThanOrEqual(1);
    await usableCard(page);
    await content.press("Home");await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBe(0);
    await usableCard(page);
}

export async function purchaseLayout(page:Page,width:number,height:number,touch=false) {
    await page.setViewportSize({width,height});
    if(touch)await page.emulateMedia({reducedMotion:"reduce"});
    await page.route("**/api/**",r=>r.abort());
    await seedSave(page,tick(newGame(1,`purchase-layout-${width}`),60));
    await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    let before=await savedGame(page);
    const panel=page.getByRole("complementary",{name:"System metrics"});
    // Each component opens the same centered quote and its own equipment highlight.
    for(const [label,equipment] of [[/^Upgrade database/,"db"],[/^Limit to ~/,"gateway"]] as const){
        const action=await infrastructureAction(page,label);
        const beforeCancel=await savedGame(page);
        if(touch)await action.tap();else await action.click();
        await usableCard(page);
        await expect(page.locator(`.eq-label[data-eq="${equipment}"]`)).toHaveClass(/is-affected/);
        await purchasePreview(page).getByText("How it works",{exact:true}).click();
        await usableCard(page);
        await page.keyboard.press("Escape");await expect(action).toBeFocused();
        expect(await savedGame(page)).toEqual(beforeCancel);
    }
    const entry=(await infrastructureAction(page,/^Add server/));
    before=await savedGame(page);
    if(touch)await entry.tap();else await entry.click();
    const card=purchasePreview(page),confirm=card.getByRole("button",{name:"Confirm",exact:true});
    await expect(confirm).toBeFocused();
    await expect(card.getByText("Handle more traffic with another server.",{exact:true})).toBeVisible();
    await expect(card.getByText("Route traffic to this server after activation.",{exact:true})).toBeVisible();
    await expect(card.getByRole("note")).toBeVisible();
    await expect(page.locator('.eq-label[data-eq="app"]')).toHaveClass(/is-affected/);
    await expect(card.locator(".campaign-action-machine")).toBeHidden();
    await expect(page.getByRole("dialog",{name:"Purchase preview",exact:true})).toHaveAttribute("aria-modal","true");
    await usableCard(page);
    await page.screenshot({path:`test-results/purchase-${width}x${height}.png`});
    const summary=card.getByText("How it works",{exact:true});
    if(touch)await summary.tap();else {await summary.focus();await page.keyboard.press("Enter");}
    await expect(card.getByRole("region",{name:"Purchase details",exact:true})).toBeVisible();
    await usableCard(page);
    await page.screenshot({path:`test-results/purchase-${width}x${height}-expanded.png`});
    if(!touch){
        // A modal deliberately blocks the camera; resizing must still keep its footer usable.
        await expect.poll(()=>page.getByRole("main").evaluate(el=>{const b=el.getBoundingClientRect();return !el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));})).toBe(true);
        await page.setViewportSize({width:width===1440?1366:1440,height:width===1440?768:900});
        await usableCard(page);
        await page.setViewportSize({width:390,height:844});await expect(card).toHaveAttribute("aria-modal","true");
        await usableCard(page);
        await page.screenshot({path:`test-results/purchase-${width}-resized-touch.png`});
    }
    await keyboardDetails(page);
    const cancel=card.getByRole("button",{name:"Cancel",exact:true});
    if(touch)await cancel.tap();else await cancel.click();
    await expect(card).toBeHidden();await expect(panel).toBeVisible();await expect(entry).toBeFocused();
    expect(await savedGame(page)).toEqual(before);
    if(touch)await entry.tap();else await entry.click();
    await usableCard(page);
    if(touch)await card.getByRole("button",{name:"Confirm",exact:true}).tap();else await card.getByRole("button",{name:"Confirm",exact:true}).click();
    await expect(card).toBeHidden();
    expect((await savedGame(page)).campaign!.cashCents).toBe(before.campaign!.cashCents-100000);
    expect((await savedGame(page)).campaign!.pending.filter(a=>a.type==="add-app")).toHaveLength(1);
}

/** Real engine-generated later chapters exercise the same card without buying or advancing time. */
export async function purchaseActions(page:Page,game:GameState,actions:readonly (readonly [RegExp,string])[]) {
    await page.route("**/api/**",r=>r.abort());await seedSave(page,game);
    await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
    const before=await savedGame(page);
    for(const [label,equipment] of actions){
        const button=await infrastructureAction(page,label);
        await button.click();await usableCard(page);
        await expect(page.locator(`.eq-label[data-eq="${equipment}"]`)).toHaveClass(/is-affected/);
        await purchasePreview(page).getByText("How it works",{exact:true}).click();await usableCard(page);
        await purchasePreview(page).getByRole("button",{name:"Cancel",exact:true}).click();
        await expect(button).toBeFocused();
    }
    await expectInspectionsOnly(page,before);
}
