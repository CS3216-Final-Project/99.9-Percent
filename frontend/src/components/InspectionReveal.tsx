import { equipmentInfo } from "@/sim";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { EQUIPMENT_ICON, STATE_META } from "./presentation";
import { Modal } from "./ui";

/**
 * The diagnostic card an inspection started in the 3D room opens: the equipment's scanner on the left, the
 * reading on the right. It changes nothing about the selection — closing it returns to the same inspector.
 */
export default function InspectionReveal() {
  const inspection = useGame((s) => s.roomInspection);
  const game = useGame((s) => s.game);
  const dismiss = useGame((s) => s.dismissRoomInspection);
  if (!inspection) return null;
  const info = equipmentInfo(game, inspection.equipment);
  const state = STATE_META[info.state];
  // A Challenge Mode incident turns this click into a timed investigation, so the card says that instead.
  const investigating = !game.campaign && game.phase === "incident" && game.incident?.inspecting?.equipment === inspection.equipment;
  return (
    <Modal
      title={investigating ? `${info.name} investigation started` : `${info.name} inspected`}
      icon={{ kind: state.tone, name: EQUIPMENT_ICON[info.id] }}
      onClose={dismiss}
      className="inspection-reveal"
    >
      <div className="inspection-scan-layout">
        <div className="inspection-scanner" aria-hidden="true">
          <span className="inspection-scanner-rings" />
          <span className="inspection-sweep" />
          <Icon name={EQUIPMENT_ICON[info.id]} size={40} />
        </div>
        <div className="inspection-reading">
          <p className="inspection-status">
            <span className={`state state-${info.state}`}>
              <Icon name={state.icon} size={12} />
              {state.word}
            </span>
            {inspection.appId && <span className="inspection-instance">App {inspection.appId.slice(4)}</span>}
          </p>
          <p className="muted">{info.summary}</p>
          <p>{investigating ? "Evidence arrives here when the timed investigation completes; the inspector below tracks it." : info.about}</p>
        </div>
      </div>
      <div className="modal-foot">
        <span className="muted">The inspector keeps the details.</span>
        <button type="button" className="btn btn-primary" onClick={dismiss}>
          Return to room
        </button>
      </div>
    </Modal>
  );
}
