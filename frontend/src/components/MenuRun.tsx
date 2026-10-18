import type { ReactNode, Ref } from "react";
import { Icon, type IconName } from "./icons";
import { Concept, type ConceptKind } from "./ui";
import { tipProps } from "./tips";

export interface MenuRunStat {
  icon: IconName;
  kind: ConceptKind;
  label: string;
  value: ReactNode;
}

/**
 * What stays above the menu's tabs in both modes: the run at a glance and its save status.
 */
export function MenuRun({ title, saved, stats, note }: { title: string; saved: boolean; stats: MenuRunStat[]; note?: ReactNode }) {
  return (
    <div className="menu-overview">
      <section className="menu-run" aria-label={title}>
        <div className="menu-run-head">
          <span className="menu-run-title"><Icon name="overview" size={22} />{title}</span>
        </div>
        <dl className={`menu-run-stats${stats.length > 3 ? " menu-run-stats-expanded" : ""}`}>
          {stats.map((s) => (
            <div key={s.label}>
              <Concept kind={s.kind} icon={s.icon} />
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="menu-run-foot">
          {note && <p className="menu-seed">{note}</p>}
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
      </section>

    </div>
  );
}

/** Matching action buttons in the Run tab, with Resume first. */
export function MenuActions({ onResume, children }: { onResume: () => void; children: ReactNode }) {
  return <div className="menu-grid" role="group" aria-label="Run">
    <MenuTile icon="play" title="Resume" text="Return to the room." onClick={onResume} primary />
    {children}
  </div>;
}

/** A compact menu button; its explanation is available on hover or focus. */
export function MenuTile({ icon, title, text, onClick, danger = false, primary = false, buttonRef }: { icon: IconName; kind?: ConceptKind; title: string; text: string; onClick: () => void; danger?: boolean; primary?: boolean; buttonRef?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={buttonRef} type="button" className={`menu-tile${primary ? " menu-resume" : ""}${danger ? " is-danger" : ""}${primary ? " is-primary" : ""}`} onClick={onClick} aria-label={title} {...tipProps(danger ? "Your current run will be replaced." : text)}>
      <Icon name={danger ? "alert" : icon} size={20} />
      <span>{title}</span>
    </button>
  );
}
