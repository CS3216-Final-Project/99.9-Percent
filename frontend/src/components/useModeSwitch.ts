import { useLayoutEffect, useRef, useState } from "react";
import type { GameMode } from "@/game/persist";
import { useGame } from "@/game/store";

/**
 * Switch modes, asking before losing a run that could not be saved. `unsaved` names the mode whose switch a failed save
 * refused; switching to it again goes ahead without the save. A switch refused for another reason, such as a cloud
 * action in progress or a locked mode, has already said why, so it asks nothing and withdraws any earlier question:
 * the next switch tries to save again. `from`, the control pressed, is kept in view as the warning appears above it.
 */
export function useModeSwitch() {
  const [unsaved, setUnsaved] = useState<GameMode | null>(null);
  const pressed = useRef<HTMLElement | null>(null);
  // On a short phone the warning pushes the pressed button out of its scrolling dialog, where it must be pressed again.
  useLayoutEffect(() => { if (unsaved) pressed.current?.scrollIntoView?.({ block: "nearest" }); }, [unsaved]);
  const switchTo = (mode: GameMode, from?: HTMLElement) => {
    pressed.current = from ?? null;
    const s = useGame.getState();
    if (mode === s.mode || s.switchMode(mode, { discard: unsaved === mode })) {
      setUnsaved(null);
      return true;
    }
    setUnsaved(useGame.getState().canSwitchMode(mode) ? mode : null);
    return false;
  };
  return { unsaved, switchTo };
}
