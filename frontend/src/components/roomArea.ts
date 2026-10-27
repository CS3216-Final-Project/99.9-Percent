/** Space kept between the open area and the stage's edges or the panel. */
export const EDGE = 12;

/** A phone's guide strip, docked below its top strip over the room. */
const PHONE_COACH = ".tour-card.launch-tutorial, .tour[data-docked] .tour-card";

/** Where the room's open part starts below a phone's guide strip, in the stage's own pixels; the stage's top without one. */
function coachTop(stage: DOMRect): number {
  if (document.documentElement.dataset.edition !== "phone") return 0;
  const strip = document.querySelector(PHONE_COACH)?.getBoundingClientRect();
  return strip && strip.height > 0 && strip.top < stage.top + stage.height / 2 && strip.bottom > stage.top
    ? strip.bottom - stage.top + EDGE : 0;
}

/**
 * The part of the room the floating campaign panel leaves open, in the stage's own pixels from its top left: the
 * panel stands beside the room on a wide screen and below it on a narrow one. A phone's bottom sheet, which holds
 * either mode's panel under its handle, covers the room from its top edge, and a phone's guide strip covers its top.
 */
export function openRoomArea(stage: DOMRect): { top: number; right: number; bottom: number } {
  let right = stage.width - EDGE, bottom = stage.height - EDGE;
  const panel = [".phone-sheet", ".campaign-panel"].map((selector) => document.querySelector(selector)?.getBoundingClientRect()).find((box) => !!box && box.width > 0);
  if (panel) {
    if (panel.left - stage.left > stage.width * 0.4) right = Math.min(right, panel.left - stage.left - EDGE);
    else if (panel.top - stage.top > stage.height * 0.2) bottom = Math.min(bottom, panel.top - stage.top - EDGE);
  }
  return { top: Math.min(coachTop(stage), bottom), right, bottom };
}

/** Purchase cards also leave the navigation and room controls accessible. Coordinates are stage-relative. */
export function confirmationRoomArea(stage: DOMRect, sheet: boolean) {
  const viewport = window.visualViewport;
  const left = Math.max(EDGE, (viewport?.offsetLeft ?? 0) - stage.left + EDGE);
  const open = sheet ? {top:coachTop(stage),right:stage.width-EDGE,bottom:stage.height-EDGE} : openRoomArea(stage);
  const top = Math.max(EDGE, (viewport?.offsetTop ?? 0) - stage.top + EDGE, open.top);
  const right = Math.min(open.right, (viewport?.offsetLeft ?? 0)+(viewport?.width ?? window.innerWidth)-stage.left-EDGE);
  let bottom = Math.min(open.bottom, (viewport?.offsetTop ?? 0)+(viewport?.height ?? window.innerHeight)-stage.top-EDGE);
  const cardWidth = Math.min(sheet ? 420 : 320, right-left);
  const cardLeft = sheet ? (left+right-cardWidth)/2 : left;
  const cardRight = cardLeft+cardWidth;
  for (const node of document.querySelectorAll<HTMLElement>(".bottombar, .floor-menu, .camera-buttons, .walk-prompt, .phone-coach")) {
    // Closed disclosures can retain measurable descendant boxes, although none are painted.
    if (node.closest("details:not([open])") || !node.getClientRects().length || getComputedStyle(node).visibility==="hidden") continue;
    const box = node.getBoundingClientRect();
    if (box.right>stage.left+cardLeft && box.left<stage.left+cardRight && box.top>stage.top+top)
      bottom = Math.min(bottom,box.top-stage.top-EDGE);
  }
  return {left,top,right,bottom};
}
