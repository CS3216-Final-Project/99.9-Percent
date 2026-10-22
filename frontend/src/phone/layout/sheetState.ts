import { useSyncExternalStore } from "react";

/**
 * How far the phone's bottom sheet (System metrics and the other panels) is open:
 *
 * - `peek`: only its handle and headline show, and the room gets the screen
 * - `half`: about half of the space between the top strip and the dock
 * - `full`: the whole space between the top strip and the dock
 *
 * The sheet renders from this state and its handle changes it. Guides call `setSheetState` to open the sheet as far
 * as a lesson needs, without knowing how the sheet is drawn.
 */
export type SheetState = "peek" | "half" | "full";

let current: SheetState = "peek";
const listeners = new Set<() => void>();

export function getSheetState(): SheetState {
  return current;
}

export function setSheetState(next: SheetState) {
  if (next === current) return;
  current = next;
  listeners.forEach(listener => listener());
}

export function subscribeSheetState(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSheetState(): SheetState {
  return useSyncExternalStore(subscribeSheetState, getSheetState, getSheetState);
}

/** The states in opening order. */
export const SHEET_STATES: readonly SheetState[] = ["peek", "half", "full"];

/**
 * The state the sheet is drawn in: an incident keeps it at least half open, so the recovery readings and the
 * response buttons stay in reach whatever the player or a guide chose.
 */
export function shownSheetState(state: SheetState, incident: boolean): SheetState {
  return incident && state === "peek" ? "half" : state;
}

/** The selector of the sheet's handle: guides that restrict controls keep it usable. */
export const SHEET_HANDLE = ".phone-sheet-handle";
