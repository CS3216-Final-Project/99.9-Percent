import { useState } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Modal } from "./ui";

/** The Launch Week cold open: a letter on the desk before the first requests arrive. */
export default function LaunchIntro() {
  const { game } = useGame();
  const [seen, setSeen] = useState(() => {
    const runId = useGame.getState().game.campaign?.runId;
    try { return !!runId && localStorage.getItem(`99.99.launch-doors:${runId}`) === "1"; } catch { return false; }
  });
  const c = game.campaign;
  // A practice replay is a launchWeek company too: the letter belongs to the replayed week.
  if (!c?.launchWeek || c.step !== 0 || game.phase !== "management" || c.launchWeek.doorsOpened || seen) return null;
  return <Modal title="Launch week" icon={{ kind: "go", name: "goal" }}>
    <p>Your service opens today. Launch traffic arrives through the week, and the database will be the first thing to feel it.</p>
    <p>Keep requests served: every requests per second served earns revenue. Your uptime at the end is the score.</p>
    <div className="modal-foot"><button className="btn btn-primary" onClick={() => { setSeen(true); useGame.getState().openLaunchDoors(); }}>Open the doors<Icon name="next" /></button></div>
  </Modal>;
}
