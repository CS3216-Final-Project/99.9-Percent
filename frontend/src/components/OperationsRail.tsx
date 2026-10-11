import { useState } from "react";
import { currentWarnings } from "@/sim";
import { nextMove } from "@/game/advisor";
import { moneyFull } from "@/game/format";
import { useGame } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { BASICS_STEPS } from "./Tutorial";
import { tipProps } from "./tips";
import WorkTracker from "./WorkTracker";
import "./OperationsRail.css";

const WARNING_ICON: Record<string, IconName> = {
  surge_incoming: "revenue", app_hot: "server", db_hot: "database",
  host_degraded: "skull", debt_high: "debt", runway_low: "cash",
  release_waiting: "ship", unassigned_work: "wrench", idle_engineers: "team",
};

/** Persistent company information occupies its own space beside the room. */
export default function OperationsRail() {
  const game = useGame((s) => s.game);
  const tour = useGame((s) => s.tour);
  const select = useGame((s) => s.select);
  const openView = useGame((s) => s.openView);
  const [expanded, setExpanded] = useState(false);
  const isExpanded = expanded || (tour?.track === "basics" && tour.step >= BASICS_STEPS - 1);
  const management = game.phase === "management";
  const showAdvice = management && !(tour?.track === "basics" && tour.step < BASICS_STEPS - 1);
  const move = nextMove(game);
  const alerts = currentWarnings(game).filter((w) => w.level !== "notice" && w.text !== move.text).slice(0, 2);
  const workCount = game.tasks.length + game.releases.filter((r) => !game.tasks.some((t) => t.releaseId === r.id)).length;

  return (
    <aside className={`operations-rail${isExpanded ? " is-expanded" : ""}`} aria-label="Operations">
      <h2 className="operations-title"><Icon name="wrench" size={20} />Operations</h2>
      <button type="button" className="operations-toggle" aria-expanded={isExpanded} aria-controls="operations-body" onClick={() => setExpanded(!expanded)}>
        <Icon name="wrench" size={18} />
        <strong>Operations</strong>
        <span>{workCount} {workCount === 1 ? "task" : "tasks"}{management && alerts.length > 0 ? ` · ${alerts.length} ${alerts.length === 1 ? "warning" : "warnings"}` : ""}</span>
        <Icon name={isExpanded ? "minus" : "plus"} size={16} />
      </button>
      <div className="operations-body" id="operations-body">
        {showAdvice && (
          <section className={`operations-section next-chip tone-${move.tone}`} aria-label="Next move">
            <h3><Icon name="robot" size={18} />Next move</h3>
            <p>{move.text}</p>
            {move.cta && (
              <button type="button" className="btn btn-primary btn-small" onClick={move.cta.run}>
                {move.cta.label}
                {move.cta.price !== undefined && <span className="price"><Icon name="cash" size={12} />{moneyFull(move.cta.price)}</span>}
              </button>
            )}
          </section>
        )}
        {showAdvice && (
          <section className="operations-section" aria-label="Warnings">
            <h3><Icon name="alert" size={18} />Warnings</h3>
            {alerts.length === 0 ? <p className="operations-empty">No warnings right now.</p> : alerts.map((w, i) => (
              <button type="button" key={w.code + i} className={`operations-warning tone-${w.level}`} {...tipProps(w.detail)} onClick={() => w.equipment ? select(w.equipment) : openView("history")}>
                <Icon name={WARNING_ICON[w.code] ?? "alert"} size={18} />
                <span>{w.level === "critical" && <strong>Critical · </strong>}{w.text}</span>
                <Icon name="next" size={14} />
              </button>
            ))}
          </section>
        )}
        {!management && <p className="operations-section operations-empty">{game.phase === "incident" ? "Resolve the incident to resume weekly work." : game.phase === "review" ? "Review the incident report to continue." : "This run has ended."}</p>}
        <WorkTracker />
      </div>
    </aside>
  );
}
