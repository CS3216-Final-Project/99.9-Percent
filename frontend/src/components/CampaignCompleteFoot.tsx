import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Callout } from "./ui";
import { useModeSwitch } from "./useModeSwitch";

/**
 * How a won Guided Mode ends: inspect the final company, export or start over, or carry on into Challenge Mode, which
 * finishing Stay Online has unlocked. The company is saved first; when it cannot be, switching asks before losing it.
 */
export function CampaignCompleteFoot() {
  const openView = useGame(s => s.openView);
  const { unsaved, switchTo } = useModeSwitch();
  const losing = unsaved === "classic";
  return <>
    {losing && <Callout compact tone="warn" icon="alert" kicker="Not saved" live="alert">This company could not be saved, so switching now loses it. Press "Switch and lose this company" again to switch anyway.</Callout>}
    <div className="modal-foot campaign-complete-foot">
      <button className="btn" onClick={() => openView("guidance")}><Icon name="eyes" size={16} />Inspect final company</button>
      <button className="btn" onClick={() => openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button>
      {/* The scorecard opens on this button, so Enter still held from the finale or the home screen must not press it. */}
      <button className={`btn ${losing ? "btn-danger" : "btn-primary"}`} data-autofocus onKeyDown={e => { if (e.repeat) e.preventDefault(); }} onClick={() => switchTo("classic")}>
        {losing ? "Switch and lose this company" : "Continue to Challenge Mode"}<Icon name="next" />
      </button>
    </div>
  </>;
}
