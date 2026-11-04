import { useState } from "react";
import type { GameMode } from "@/game/persist";
import { useGame } from "@/game/store";

/**
 * Switch modes, asking before losing a run that could not be saved. `unsaved` names the mode whose switch a failed save
 * refused; switching to it again goes ahead without the save. A switch refused for another reason, such as a cloud
 * action in progress or a locked mode, has already said why, so it asks nothing.
 */
export function useModeSwitch() {
  const [unsaved, setUnsaved] = useState<GameMode | null>(null);
  const switchTo = (mode: GameMode) => {
    const s = useGame.getState();
    if (mode === s.mode || s.switchMode(mode, { discard: unsaved === mode })) {
      setUnsaved(null);
      return true;
    }
    if (useGame.getState().canSwitchMode(mode)) setUnsaved(mode);
    return false;
  };
  return { unsaved, switchTo };
}
