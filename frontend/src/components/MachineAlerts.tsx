import { deadMachines } from "@/sim";
import { inspectOrSelect, useGame } from "@/game/store";
import { Icon } from "./icons";
import "./MachineAlerts.css";

/**
 * Challenge Mode's only standing alerts: one red card per dead machine, at the room's left edge.
 * A card stays until the machine is replaced or recovered; pressing it inspects that equipment.
 */
export default function MachineAlerts() {
  const show = useGame((s) => s.started && !s.game.campaign);
  const game = useGame((s) => s.game);
  if (!show) return null;
  const dead = deadMachines(game);
  return (
    <section className="machine-alerts" aria-label="Machine alerts" aria-live="assertive">
      {dead.map((machine) => (
        <button type="button" key={machine.hostId} className="machine-alert" onClick={() => inspectOrSelect(machine.equipment)}>
          <Icon name="skull" size={20} />
          <span>
            <strong>{machine.equipment === "db" ? "Database machine is dead" : `Server ${machine.hostId} is dead`}</strong>
            <span>{machine.equipment === "db" ? "Inspect Database" : "Inspect Servers"}</span>
          </span>
        </button>
      ))}
    </section>
  );
}
