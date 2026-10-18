import { useEffect, useRef, useState } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Modal } from "./ui";

/** Exit is immediate only after the current progress has been saved successfully. */
export function useMenuExit() {
  const saveNow = useGame(s => s.saveNow);
  const endSession = useGame(s => s.endSession);
  const [confirm, setConfirm] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const exitButton = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (wasConfirming.current && !confirm) exitButton.current?.focus();
    wasConfirming.current = confirm;
  }, [confirm]);

  const exit = () => {
    if (saveNow(true)) endSession();
    else { setRetryFailed(false); setConfirm(true); }
  };
  const dialog = confirm ? <Modal title="Exit without saving?" className="modal-menu modal-exit" icon={{ kind: "warn", name: "alert" }} onClose={() => setConfirm(false)}>
    <p>Your latest progress could not be fully saved. Retry saving before you leave, or choose Exit without saving.</p>
    {retryFailed && <p role="alert">Saving still failed. Cancel to keep playing or export a backup from Menu → Saves.</p>}
    <div className="menu-actions">
      <button type="button" className="btn" onClick={() => setConfirm(false)}>Cancel</button>
      <button type="button" className="btn btn-primary" onClick={() => {
        if (saveNow(true)) endSession();
        else setRetryFailed(true);
      }}><Icon name="save" size={20} />Save and exit</button>
      <button type="button" className="btn btn-danger" onClick={endSession}><Icon name="logout" size={20} />Exit without saving</button>
    </div>
  </Modal> : null;
  return { exit, exitButton, dialog };
}
