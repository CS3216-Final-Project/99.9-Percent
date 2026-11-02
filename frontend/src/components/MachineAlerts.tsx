import { useState } from "react";
import { currentWarnings, deadMachines, serverName } from "@/sim";
import { inspectOrSelect, useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { tipProps } from "./tips";
import "./MachineAlerts.css";

const WARNING_ICON: Record<string, IconName> = {
  surge_incoming: "revenue", app_hot: "server", db_hot: "database",
  host_degraded: "skull", debt_high: "debt", runway_low: "cash",
  release_waiting: "ship", unassigned_work: "wrench", idle_engineers: "team",
};

/**
 * Challenge Mode's standing alerts at the room's left edge: one red card per dead machine, then the week's
 * warning signs in a section the player can fold away. A dead-machine card stays until the machine is replaced
 * or recovered. Outside an incident pressing it inspects that equipment; during one it only reports, because
 * the incident panel's Find the cause owns the timed investigation.
 */
export default function MachineAlerts() {
  const show = useGame((s) => s.started && !s.game.campaign);
  const game = useGame((s) => s.game);
  const select = useGame((s) => s.select);
  const openView = useGame((s) => s.openView);
  const [warningsOpen, setWarningsOpen] = useState(true);
  if (!show) return null;
  const dead = deadMachines(game);
  const incident = game.phase === "incident";
  const warnings = game.phase === "management" ? currentWarnings(game).filter((w) => w.level !== "notice") : [];
  return (
    <section className="machine-alerts" aria-label="Machine alerts">
      <div className="machine-alert-list" aria-live="assertive">
        {dead.map((machine) => {
          const title = machine.equipment === "db" ? "Database machine is dead" : `${serverName(machine.hostId)} is dead`;
          const body = <>
            <Icon name="skull" size={20} />
            <span>
              <strong>{title}</strong>
              <span>{incident ? "Find the cause in the incident panel" : machine.equipment === "db" ? "Inspect Database" : "Inspect Servers"}</span>
            </span>
          </>;
          return incident
            ? <div key={machine.hostId} className="machine-alert" role="status">{body}</div>
            : <button type="button" key={machine.hostId} className="machine-alert" onClick={() => inspectOrSelect(machine.equipment)}>{body}</button>;
        })}
      </div>
      {warnings.length > 0 && (
        <details className="machine-warnings" open={warningsOpen} onToggle={(e) => setWarningsOpen(e.currentTarget.open)}>
          <summary>
            <Icon name="alert" size={18} />
            <strong>Warnings</strong>
            <span className="machine-warnings-count">{warnings.length}</span>
            <Icon name="down" size={16} className="machine-warnings-chevron" />
          </summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={w.code + i}>
                <button type="button" className={`machine-warning tone-${w.level}`} {...tipProps(w.detail)} onClick={() => w.equipment ? select(w.equipment) : openView("history")}>
                  <Icon name={WARNING_ICON[w.code] ?? "alert"} size={18} />
                  <span>{w.level === "critical" && <strong>Critical · </strong>}{w.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
