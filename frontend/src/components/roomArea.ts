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
