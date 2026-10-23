import { useState } from "react";
import { useGame } from "@/game/store";
import { Icon } from "@/components/icons";
import { Callout, Modal } from "@/components/ui";

/**
 * Shown once when the company finishes the last chapter the phone edition plays, in place of the desktop's offer to
 * enter the next chapter. The company keeps operating; Challenge Mode is now unlocked.
 */
export function PhoneCampaignComplete() {
  const dismiss = useGame((s) => s.dismissChapterComplete);
  const endOfGuided = useGame((s) => s.scope.endOfGuided);
  const [unsaved, setUnsaved] = useState(false);
  const playChallenge = () => {
    if (!useGame.getState().switchMode("classic", { discard: unsaved })) { setUnsaved(true); return; }
    dismiss();
  };
  return <Modal title="Phone campaign complete" icon={{ kind: "go", name: "goal" }} onClose={dismiss}>
    <p>Your added capacity and routing carried the growth wave. You have finished Guided Mode on your phone.</p>
    <p>{endOfGuided} Your company is saved in this browser and keeps operating here.</p>
    <p>Challenge Mode is now unlocked: grow a company week by week on your own.</p>
    {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved">This company could not be saved, so switching now loses it. Press "Switch and lose this company" again to switch anyway.</Callout>}
    <div className="modal-foot">
      <button className="btn btn-quiet" onClick={dismiss}>Keep operating</button>
      <button className={`btn ${unsaved ? "btn-danger" : "btn-primary"}`} onClick={playChallenge}>{unsaved ? "Switch and lose this company" : "Play Challenge Mode"}<Icon name="next" /></button>
    </div>
  </Modal>;
}
