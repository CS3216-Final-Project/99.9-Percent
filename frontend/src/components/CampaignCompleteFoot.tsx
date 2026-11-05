import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Callout } from "./ui";
import { loseWording, useModeSwitch } from "./useModeSwitch";

/**
 * How a won Guided Mode ends: inspect the final company, export or start over, or carry on into Challenge Mode, which
 * finishing Stay Online has unlocked. The company is saved first; when it cannot be, switching asks before losing it.
 * `focus` opens the dialog on Continue to Challenge Mode, as the finale does; a scorecard reopened to be read does not.
 */
export function CampaignCompleteFoot({ focus = true }: { focus?: boolean }) {
  const openView = useGame(s => s.openView);
  const { unsaved, switchTo } = useModeSwitch();
  const losing = unsaved === "classic";
  const lose = loseWording("campaign");
  return <>
    {losing && <Callout compact tone="warn" icon="alert" kicker="Not saved" live="alert">{lose.warning()}</Callout>}
    <div className="modal-foot campaign-complete-foot">
      <button className="btn" onClick={() => openView("guidance")}><Icon name="eyes" size={16} />Inspect final company</button>
      <button className="btn" onClick={() => openView("menu")}><Icon name="refresh" size={16} />Export or start a new company</button>
      <button className={`btn ${losing ? "btn-danger" : "btn-primary"}`} data-autofocus={focus || undefined} onClick={e => switchTo("classic", e.currentTarget)}>
        {losing ? lose.button : "Continue to Challenge Mode"}<Icon name="next" />
      </button>
    </div>
  </>;
}
