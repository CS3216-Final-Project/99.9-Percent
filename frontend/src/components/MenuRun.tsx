import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { Concept, type ConceptKind } from "./ui";

export interface MenuRunStat {
  icon: IconName;
  kind: ConceptKind;
  label: string;
  value: ReactNode;
}

/**
 * What stays above the menu's tabs in both modes: the run at a glance, whether it is saved,
 * and the way back to it.
 */
export function MenuRun({ title, saved, stats, note, onResume }: { title: string; saved: boolean; stats: MenuRunStat[]; note: ReactNode; onResume: () => void }) {
  return (
    <>
      <section className="menu-run" aria-label={title}>
        <div className="menu-run-head">
          <span className="menu-run-title">{title}</span>
          {saved ? (
            <span className="tag tag-ok">
              <Icon name="save" size={12} />
              Autosaved
            </span>
          ) : (
            <span className="tag tag-warn">
              <Icon name="alert" size={12} />
              Not saved
            </span>
          )}
        </div>
        <dl className="menu-run-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <Concept kind={s.kind} icon={s.icon} />
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="menu-seed">{note}</p>
      </section>

      <button type="button" className="btn btn-primary btn-big menu-resume" autoFocus onClick={onResume}>
        <Icon name="play" />
        Resume
      </button>
    </>
  );
}

/** A big, labelled menu choice: what it is, and one line on what it does. */
export function MenuTile({ icon, kind, title, text, onClick, danger = false }: { icon: IconName; kind: ConceptKind; title: string; text: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" className={`menu-tile${danger ? " is-danger" : ""}`} onClick={onClick} aria-label={title}>
      <Concept kind={danger ? "critical" : kind} icon={danger ? "alert" : icon} />
      <span className="menu-tile-body">
        <strong>{title}</strong>
        <span>{danger ? "Your current run will be replaced." : text}</span>
      </span>
    </button>
  );
}
