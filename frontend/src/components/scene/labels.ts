import * as THREE from "three";

const ndc = new THREE.Vector3();

/**
 * Where a point in the room appears on a canvas of this size, in pixels from its top-left corner, with the camera
 * exactly as it stands now.
 *
 * Moving a camera only changes its position and orientation. Its view matrix is refreshed when the renderer draws, so
 * until then `project` still answers for the previous frame. Refresh it first, or anything placed from this answer
 * trails the picture by a frame while the camera moves.
 */
export function screenPoint(point: THREE.Vector3, camera: THREE.Camera, width: number, height: number, out: THREE.Vector2): THREE.Vector2 {
  camera.updateMatrixWorld();
  ndc.copy(point).project(camera);
  return out.set((ndc.x * 0.5 + 0.5) * width, (-ndc.y * 0.5 + 0.5) * height);
}

/** Zoom, in pixels a metre, at and above which the overview shows labels at full size: the game opens here. */
export const LABEL_FULL_ZOOM = 30;
/** The smallest a clickable label may be drawn, in CSS pixels tall: WCAG 2.5.8's minimum pointer target. */
export const LABEL_MIN_PX = 24;

/**
 * How large the overview draws its labels at this zoom, as a share of their full size. Zoomed out past
 * LABEL_FULL_ZOOM they shrink in step with the room, so the markers of neighbouring machines stay apart instead
 * of piling up, until the shortest clickable label (`shortest` CSS pixels tall at full size) reaches LABEL_MIN_PX.
 */
export function zoomScale(zoom: number, shortest: number): number {
  const least = shortest > LABEL_MIN_PX ? LABEL_MIN_PX / shortest : 1;
  return THREE.MathUtils.clamp(zoom / LABEL_FULL_ZOOM, least, 1);
}

/** Pixels a label's marker tail reaches below its anchor point (the ::after triangle under the pill). */
export const LABEL_TAIL = 9;
/** Breathing room between two labels stacked on the same machine. */
export const LABEL_GAP = 4;

/** Where a label's marker naturally sits: its projected anchor's centre x and y, and the label's rendered size. */
export interface LabelSpot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Y positions that pack a row of anchored labels tightly downward so no two cover each other. Each label keeps
 * `spots[i].y + first` unless a label already placed horizontally overlaps it, in which case it drops just clear
 * of that label's tail. Checking real overlap, not a fixed pitch, keeps the stack compact however many machines
 * there are and however far apart their anchors already sit - labels whose marks never collide simply stay put.
 * Works for labels of mixed heights too (a status note or a load bar makes one taller than another).
 */
export function stackDown(spots: LabelSpot[], first = 0): number[] {
  const out = new Array<number>(spots.length);
  for (let i = 0; i < spots.length; i++) {
    let bottom = spots[i].y + first;
    for (let j = 0; j < i; j++) {
      if (Math.abs(spots[j].x - spots[i].x) < (spots[j].w + spots[i].w) / 2) {
        bottom = Math.max(bottom, out[j] + spots[i].h + LABEL_TAIL + LABEL_GAP);
      }
    }
    out[i] = bottom;
  }
  return out;
}

/**
 * Y positions that keep labels from covering each other, whatever placed them. `spots` carry each label's centre x,
 * bottom y and drawn size. Labels only ever rise: the lowest on screen keeps its place and each higher one that
 * would cover a label below it lifts just clear, by the tail and gap of `clearance`. Rising keeps every marker above
 * its machine and out from under a panel along the bottom, and a label lifts smoothly as a neighbour slides under it.
 * No label rises past `top`, the room's upper edge; one that would has nowhere clear to go and keeps to the edge.
 */
export function separate(spots: LabelSpot[], clearance = LABEL_TAIL + LABEL_GAP, top = -Infinity): number[] {
  const out = new Array<number>(spots.length);
  const order = spots.map((_, i) => i).sort((a, b) => spots[b].y - spots[a].y);
  order.forEach((i, k) => {
    const s = spots[i];
    const below = order.slice(0, k).filter((j) => Math.abs(spots[j].x - s.x) < (spots[j].w + s.w) / 2);
    // A hair of slack, so a height computed to touch a neighbour exactly is not lost to rounding.
    const free = (y: number) => below.every((j) => y - s.h >= out[j] + clearance - 1e-6 || y + clearance <= out[j] - spots[j].h + 1e-6);
    // The free heights nearest the label's own lie at it or just above a label it would meet; above the highest
    // of those there is always room.
    let best = s.y;
    if (!free(best)) {
      best = -Infinity;
      for (const j of below) {
        const y = out[j] - spots[j].h - clearance;
        if (y < s.y && y > best && free(y)) best = y;
      }
    }
    out[i] = Math.min(s.y, Math.max(best, top + s.h));
  });
  return out;
}

/** Same idea under a ceiling the labels must stay above: the last label sits at `ceiling`, each earlier one above it. */
export function stackUnder(heights: number[], ceiling: number): number[] {
  const out = new Array<number>(heights.length);
  if (heights.length) out[heights.length - 1] = ceiling;
  for (let i = heights.length - 2; i >= 0; i--) out[i] = out[i + 1] - heights[i + 1] - LABEL_TAIL - LABEL_GAP;
  return out;
}
