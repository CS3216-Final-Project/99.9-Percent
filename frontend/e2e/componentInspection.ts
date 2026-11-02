import type { Locator, Page } from "@playwright/test";
import { expect, savedGame } from "./fixtures";
import { applyAction, type GameState } from "../src/sim";

export type Component = "db" | "app" | "gateway" | "cache" | "monitoring";
const NAMES = { db: "Database", app: "App Server", gateway: "Network", cache: "Read Cache", monitoring: "Monitoring" };
const TITLES = { ...NAMES, app: "Servers" };
export const inspection = (page: Page) => page.locator(".component-inspection");
export const purchasePreview = (page: Page) => page.locator(".component-purchase, .campaign-action-popover");

export async function closeInspection(page: Page) {
  const quote=page.getByRole("dialog", {name:"Purchase preview",exact:true});
  if (await quote.isVisible()) await quote.getByRole("button",{name:"Cancel",exact:true}).click();
  const modal=inspection(page);
  if (await modal.isVisible()) await modal.getByRole("button",{name:"Close",exact:true}).click();
}

/** Only public controls: works when the rack is off-screen, on another floor or the sheet is folded. */
export async function inspectEquipment(page: Page, component: Component, details=false): Promise<Locator> {
  const modal=page.getByRole("dialog",{name:component==="app"?"App Servers":TITLES[component],exact:true});
  if (!await modal.isVisible()) {
    await closeInspection(page);
    const folded=page.locator('.panel-reopen, .phone-sheet-handle[aria-expanded="false"]');
    if (await folded.first().isVisible()) await folded.first().click();
    await page.locator(`.campaign-panel [data-tutorial="inspect-${component}"]`).click();
  }
  // Active chapter tutorials deliberately retain their existing in-panel controls/readings.
  const scope=await modal.isVisible()?modal:page.locator(".campaign-panel");
  if(details&&await modal.isVisible()) {
    for(let i=0;i<3&&await modal.locator('[data-inspection-back]').isVisible();i++)await modal.locator('[data-inspection-back]').click();
    const inspect=modal.getByRole("button",{name:"Inspect details",exact:true});if(await inspect.getAttribute("aria-expanded")==="false")await inspect.click();
  }
  await expect(scope).toBeVisible();
  return scope;
}

export function actionComponent(name:string|RegExp):Component {
  const label=typeof name==="string"?name:name.source;
  if (/database/i.test(label)) return "db";
  if (/cache/i.test(label)) return "cache";
  if (/health checks/i.test(label)) return "monitoring";
  if (/limit|routing|balanc|failover|All apps|App \d+ only/i.test(label)) return "gateway";
  return "app";
}

/** Reach an existing action without purchasing, choosing a route, or advancing game time. */
export async function infrastructureAction(page:Page,name:string|RegExp,component=actionComponent(name)):Promise<Locator> {
  // Chapter 0/practice and active chapter guides keep the original purchase controls.
  const legacy=page.locator(".campaign-panel").getByRole("button",{name,exact:typeof name==="string"});
  if(await legacy.isVisible()) return legacy;
  const scope=await inspectEquipment(page,component);
  const label=typeof name==="string"?name:name.source;
  if(component==="monitoring") { const details=scope.getByRole("button",{name:"Inspect details",exact:true});if(await details.getAttribute("aria-expanded")==="false")await details.click(); }
  if(component==="app") {
    const view=/autoscal/i.test(label)?"autoscaling":/Scale up|Restore|Reserve|Release|Install spare/i.test(label)?"server":"overview";
    if(view==="server") {
      const id=label.match(/App (\d+)/)?.[1];
      const target=id?scope.locator(`[data-guidance-app="app-${id}"]`):/Release spare/i.test(label)?scope.locator('[data-guidance-app]').filter({hasText:"Standby spare"}).first():scope.locator('[data-guidance-app]').first();
      if(!await scope.getByRole("button",{name,exact:typeof name==="string"}).isVisible()) {
        for(let i=0;i<3&&await scope.locator('[data-inspection-back]').isVisible();i++)await scope.locator('[data-inspection-back]').click();
        await scope.getByRole("button",{name:"Server management",exact:true}).click();
        await target.click();
      }
    } else if(await scope.locator('.inspection-subview').getAttribute('data-inspection-view')!==view) {
      for(let i=0;i<3&&await scope.locator('[data-inspection-back]').isVisible();i++)await scope.locator('[data-inspection-back]').click();
      if(view==="autoscaling") {await scope.getByRole("button",{name:"Server management",exact:true}).click();await scope.locator('[data-inspection-entry="autoscaling"]').click();}
    }
  }
  if(component==="gateway") {
    const view=/failover|balanc|routing|All apps|App \d+ only/i.test(label)?"management":"overview";
    if(await scope.locator('.inspection-subview').getAttribute('data-inspection-view')!==view) {
      for(let i=0;i<2&&await scope.locator('[data-inspection-back]').isVisible();i++)await scope.locator('[data-inspection-back]').click();
      if(view!=="overview") await scope.locator('[data-inspection-entry="management"]').click();
    }
  }
  const action=scope.getByRole("button",{name,exact:typeof name==="string"});
  await expect(action).toBeVisible();
  return action;
}

/** Open the gateway's management view, where the "Send traffic to" checkboxes live. */
export async function openGatewayManagement(page:Page,scope?:Locator):Promise<Locator> {
  const panel=scope??await inspectEquipment(page,"gateway");
  if(await panel.locator('.inspection-subview').getAttribute('data-inspection-view')!=="management") {
    for(let i=0;i<2&&await panel.locator('[data-inspection-back]').isVisible();i++)await panel.locator('[data-inspection-back]').click();
    await panel.locator('[data-inspection-entry="management"]').click();
  }
  return panel;
}

/**
 * Route every app: tick each unchecked "Send traffic to" checkbox in the gateway management view.
 * Each pick queues a routing change that activates on the next game second, so `advance` (a caller
 * that delivers one game second, e.g. `advanceCampaignStep`) runs between picks - the fieldset is
 * disabled while a routing change is pending.
 */
export async function routeAllApps(page:Page,scope?:Locator,advance?:()=>Promise<void>):Promise<Locator> {
  const panel=await openGatewayManagement(page,scope);
  for(let i=0;i<8;i++) {
    const next=panel.locator(".route-check[aria-checked='false']").first();
    if(await next.count()===0)break;
    await next.click();
    if(!advance)break;
    await advance();
  }
  return panel;
}

/** Follow only inspection navigation; the caller still checks/clicks the actual recommended action. */
export async function followHintComponent(page:Page) {
  const gold=page.locator(".campaign-gold-attention");
  await expect(gold).toHaveCount(1);
  for(let step=0;step<5;step++) {
    if(await gold.evaluate(el=>el.matches('[data-tutorial^="inspect-"], [data-guidance-app], [data-inspection-entry], [data-inspection-back], summary'))) {
      await gold.click();await expect(inspection(page)).toBeVisible();await expect(gold).toHaveCount(1);
    } else break;
  }
}

/** Explicit inspections may record evidence; all other company state must remain exactly unchanged. */
export async function expectInspectionsOnly(page:Page,before:GameState) {
  const after=await savedGame(page), prior=before.campaign!;
  expect(after.campaign!.inputs.slice(0,prior.inputs.length)).toEqual(prior.inputs);
  let expected=before;
  for(const input of after.campaign!.inputs.slice(prior.inputs.length)) {
    expect(input.action.type).toBe("incident_inspect");expect(input.step).toBe(prior.step);
    const result=applyAction(expected,input.action);
    expect(result.ok).toBe(true);if(!result.ok)throw Error(result.message);expected=result.state;
  }
  expect(after).toEqual(expected);
}
