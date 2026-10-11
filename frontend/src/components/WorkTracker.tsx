import { useState } from "react";
import { taskEta } from "@/sim";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Meter } from "./ui";
import "./WorkTracker.css";

/** A room-side reference for weekly work; staffing and shipping stay in Team. */
export default function WorkTracker() {
  const game = useGame((s) => s.game);
  const openView = useGame((s) => s.openView);
  const [expanded, setExpanded] = useState(true);
  // Testing and fixing already appear as tasks; don't also call that release ready.
  const releases = game.releases.filter((r) => !game.tasks.some((t) => t.releaseId === r.id));
  const count = game.tasks.length + releases.length;
  const incident = game.phase === "incident";
  const locked = game.phase !== "management";

  return (
    <section className="work-tracker" aria-label="In progress">
      <button type="button" className="work-tracker-heading" aria-expanded={expanded} aria-controls="work-tracker-items" onClick={() => setExpanded(!expanded)}>
        <Icon name="wrench" size={18} />
        <strong>In progress</strong>
        <span className="badge">{count}</span>
        <Icon name={expanded ? "minus" : "plus"} size={14} />
      </button>
      {expanded && (
        <div id="work-tracker-items" className="work-tracker-items">
          {!count && <p className="work-tracker-notice">{locked ? "No active work." : "No active work. Choose an upgrade in Tech or a task in Team."}</p>}
          {incident && <p className="work-tracker-notice">Weekly work paused during incident</p>}
          {game.tasks.map((task) => {
            const eta = taskEta(game, task);
            return (
              <button type="button" className="work-tracker-item" key={task.id} disabled={locked} onClick={() => openView("engineers")} aria-label={`${task.title}: ${eta === null ? "needs engineers" : `${eta} ${eta === 1 ? "week" : "weeks"} left`}. Open Team`}>
                <span className="work-tracker-title"><Icon name={task.kind === "debt_paydown" ? "debt" : "wrench"} size={16} /><strong>{task.title}</strong></span>
                <Meter value={task.progress / task.effort} label={`${task.title} progress`} tone={eta === null ? "warn" : "accent"} />
                <span className="work-tracker-meta" aria-live="polite" aria-atomic="true">
                  <span className={eta === null ? "text-warn" : ""}><Icon name={eta === null ? "alert" : "latency"} size={12} />{eta === null ? "Needs engineers" : `${eta} wk left`}</span>
                  <span aria-label={`${task.assigned} engineers assigned`}><Icon name="team" size={12} />{task.assigned}</span>
                </span>
              </button>
            );
          })}
          {releases.map((release) => (
            <button type="button" className="work-tracker-item" key={release.id} disabled={locked} onClick={() => openView("engineers")} aria-label={`${release.title}: ${release.needsFix ? "needs repair" : "ready to ship"}. Open Team`}>
              <span className="work-tracker-title"><Icon name="ship" size={16} /><strong>{release.title}</strong></span>
              <span className={release.needsFix ? "text-warn" : "text-ok"}>{release.needsFix ? "Needs repair" : "Ready to ship"}<Icon name="next" size={14} /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
