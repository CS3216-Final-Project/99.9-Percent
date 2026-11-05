import { useLayoutEffect, useRef, useState } from "react";
import type { GameMode } from "@/game/persist";
import { useGame } from "@/game/store";
import { useUnsavedWarning, withdrawUnsavedToast } from "./unsavedWarning";

/** What leaving a mode loses: Guided Mode keeps a company and Challenge Mode a run, as New company and New game say. */
export const SAVE_NOUN: Record<GameMode, "company" | "run"> = { campaign: "company", classic: "run" };

/**
 * The red button and warning shown once a failed save has refused a switch away from `from`, the loaded mode. Every
 * control that switches modes takes its words from here, so they name the same thing. `subject` and `then` let a
 * caller say whose save it was and where else to go.
 */
export function loseWording(from: GameMode) {
  const noun = SAVE_NOUN[from], button = `Switch and lose this ${noun}`;
  const warning = (subject = `This ${noun}`, then = "") =>
    `${subject} could not be saved, so switching now loses it. Press "${button}" again to switch anyway${then}.`;
  return { noun, button, warning };
}

/**
 * Switch modes, asking before losing a run that could not be saved. `unsaved` names the mode whose switch a failed save
 * refused; switching to it again goes ahead without the save. A switch refused for another reason, such as a cloud
 * action in progress or a locked mode, has already said why, so it asks nothing and withdraws any earlier question:
 * the next switch tries to save again. So does a later save that succeeds, an autosave or Save now: the run is no
 * longer at risk, and the next switch saves it first. A failed autosave asks nothing by itself; only a pressed switch
 * does. `from`, the control pressed, is kept in view as the warning appears above it.
 * While the warning shows, no toast repeats that the run is not saved.
 */
export function useModeSwitch() {
  const [unsaved, setUnsaved] = useState<GameMode | null>(null);
  // A refused switch always leaves the latest save failed, so a successful save since then withdraws the question.
  const saved = useGame((s) => s.saveStatus === "saved");
  if (unsaved && saved) setUnsaved(null);
  const pressed = useRef<HTMLElement | null>(null);
  // On a short phone the warning pushes the pressed button out of its scrolling dialog, where it must be pressed again.
  useLayoutEffect(() => { if (unsaved) pressed.current?.scrollIntoView?.({ block: "nearest" }); }, [unsaved]);
  useUnsavedWarning(!!unsaved);
  const switchTo = (mode: GameMode, from?: HTMLElement) => {
    pressed.current = from ?? null;
    const s = useGame.getState();
    if (mode === s.mode || s.switchMode(mode, { discard: unsaved === mode && s.saveStatus !== "saved" })) {
      setUnsaved(null);
      return true;
    }
    const ask = useGame.getState().canSwitchMode(mode) ? mode : null;
    if (ask) withdrawUnsavedToast();
    setUnsaved(ask);
    return false;
  };
  return { unsaved, switchTo };
}
