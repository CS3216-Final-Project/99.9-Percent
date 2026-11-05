import { useLayoutEffect } from "react";
import { useGame } from "@/game/store";

/** Withdraw a toast saying the company could not be saved. */
export function withdrawUnsavedToast() {
  const { toast, dismissToast } = useGame.getState();
  if (toast?.unsaved) dismissToast();
}

/**
 * While `shown`, the caller's own warning that the company is not saved is the one message saying so: a toast saying it
 * again, from a later autosave for example, is withdrawn, as it would repeat the warning and cover or move the dialog's
 * actions. The caller withdraws the toast of the failed save that shows the warning in the same event, so it is never
 * drawn.
 */
export function useUnsavedWarning(shown: boolean) {
  useLayoutEffect(() => {
    if (!shown) return;
    withdrawUnsavedToast();
    return useGame.subscribe(withdrawUnsavedToast);
  }, [shown]);
}
