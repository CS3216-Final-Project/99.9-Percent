/** Space kept between the open area and the stage's edges or the panel. */
export const EDGE = 12;

/**
 * The part of the room the floating campaign panel leaves open, in the stage's own pixels from its top left: the
 * panel stands beside the room on a wide screen and below it on a narrow one.
 */
export function openRoomArea(stage: DOMRect): { right: number; bottom: number } {
  let right = stage.width - EDGE, bottom = stage.height - EDGE;
  const panel = document.querySelector(".campaign-panel")?.getBoundingClientRect();
  if (panel && panel.width > 0) {
    if (panel.left - stage.left > stage.width * 0.4) right = Math.min(right, panel.left - stage.left - EDGE);
    else if (panel.top - stage.top > stage.height * 0.2) bottom = Math.min(bottom, panel.top - stage.top - EDGE);
  }
  return { right, bottom };
}

/** Purchase cards also leave the navigation and room controls accessible. Coordinates are stage-relative. */
export function confirmationRoomArea(stage: DOMRect, sheet: boolean) {
  const viewport = window.visualViewport;
  const left = Math.max(EDGE, (viewport?.offsetLeft ?? 0) - stage.left + EDGE);
  const top = Math.max(EDGE, (viewport?.offsetTop ?? 0) - stage.top + EDGE);
  const open = sheet ? {right:stage.width-EDGE,bottom:stage.height-EDGE} : openRoomArea(stage);
  const right = Math.min(open.right, (viewport?.offsetLeft ?? 0)+(viewport?.width ?? window.innerWidth)-stage.left-EDGE);
  let bottom = Math.min(open.bottom, (viewport?.offsetTop ?? 0)+(viewport?.height ?? window.innerHeight)-stage.top-EDGE);
  const cardWidth = Math.min(sheet ? 420 : 320, right-left);
  const cardLeft = sheet ? (left+right-cardWidth)/2 : left;
  const cardRight = cardLeft+cardWidth;
  for (const node of document.querySelectorAll<HTMLElement>(".bottombar, .floor-menu, .camera-buttons, .walk-prompt")) {
    // Closed disclosures can retain measurable descendant boxes, although none are painted.
    if (node.closest("details:not([open])") || !node.getClientRects().length || getComputedStyle(node).visibility==="hidden") continue;
    const box = node.getBoundingClientRect();
    if (box.right>stage.left+cardLeft && box.left<stage.left+cardRight && box.top>stage.top+top)
      bottom = Math.min(bottom,box.top-stage.top-EDGE);
  }
  return {left,top,right,bottom};
}
