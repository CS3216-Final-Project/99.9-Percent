import { useGame, type Speed } from "@/game/store";
import { DockMenu } from "./DockMenu";

export function TimeMenu({ automatic = false }: { automatic?: boolean }) {
  const speed = useGame(s => s.speed);
  const setSpeed = useGame(s => s.setSpeed);
  const running = useGame(s => s.running);
  const setRunning = useGame(s => s.setRunning);
  return <DockMenu className="time-menu" label={<span>{speed}×</span>}>
    <h3>Time controls</h3>
    <div className="speed" role="group" aria-label="Game speed">
      {([0.5, 1, 2] as Speed[]).map(value => <button type="button" key={value} className={speed === value ? "is-active" : ""} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}
    </div>
    {automatic && <button type="button" className="btn dock-auto" aria-pressed={running} aria-label={running ? "Stop auto-advance" : "Auto-advance weeks"} onClick={() => setRunning(!running)}>Auto-advance weeks <strong>{running ? "On" : "Off"}</strong></button>}
  </DockMenu>;
}
