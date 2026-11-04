import { useState } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Callout } from "./ui";

/**
 * How a won Guided Mode ends: inspect the final company, export or start over, or carry on into Challenge Mode, which
 * finishing Stay Online has unlocked. The company is saved first; when it cannot be, switching asks before losing it.
 */
export function CampaignCompleteFoot() {
  const { openView, switchMode } = useGame();
  const [unsaved, setUnsaved] = useState(false);
  return <>
    {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved">This company could not be saved, so switching now loses it. Press "Switch and lose this company" again to switch anyway.</Callout>}
    <div className="modal-foot campaign-complete-foot">
      <button className="btn" onClick={() => openView("guidance")}><Icon name="eyes" size={16} />Inspect final company</button>
      <button className="btn" onClick={() => openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button>
      <button className={`btn ${unsaved ? "btn-danger" : "btn-primary"}`} data-autofocus onClick={() => { if (!switchMode("classic", { discard: unsaved })) setUnsaved(true); }}>
        {unsaved ? "Switch and lose this company" : "Continue to Challenge Mode"}<Icon name="next" />
      </button>
    </div>
  </>;
}
