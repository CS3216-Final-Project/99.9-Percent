import type { ReactNode } from "react";
import { useGame, type View } from "@/game/store";
import { Icon, type IconName } from "./icons";
import { tipProps } from "./tips";
import { Concept, type ConceptKind } from "./ui";

/** The views that open over the room from the bottom bar. */
export type SheetView = Extract<View, "tech" | "engineers" | "history">;

const VIEW_TITLES: Record<SheetView, string> = { tech: "Tech tree", engineers: "Team", history: "History" };
const VIEW_ICONS: Record<SheetView, [ConceptKind, IconName]> = {
  tech: ["tech", "tree"],
  engineers: ["team", "team"],
  history: ["users", "history"],
};

export interface ViewTab {
  id: SheetView;
  label: string;
  icon: IconName;
  badge: string | null;
  disabled?: boolean;
}

/** The bottom bar's view tabs. Both modes put them at the left, in the order Tech, Team, History. */
export function ViewTabs({ tabs }: { tabs: ViewTab[] }) {
  const view = useGame((s) => s.view);
  const openView = useGame((s) => s.openView);
  return (
    <nav className="view-tabs" aria-label="Views">
      {tabs.map(({ id, label, icon, badge, disabled }) => (
        <button type="button" key={id} data-view={id} className={view === id ? "is-active" : ""} aria-pressed={view === id} aria-label={label} {...tipProps(label)} disabled={disabled} onClick={() => openView(view === id ? null : id)}>
          <span className="tab-icon" aria-hidden="true">
            <Icon name={icon} />
          </span>
          <span className="tab-label">{label}</span>
          <span className="badge" aria-hidden={!badge}>{badge ?? ""}</span>
        </button>
      ))}
    </nav>
  );
}

/** A view opened from the bottom bar: it covers the room, and Close or Esc returns to it. */
export function ViewSheet({ view, children }: { view: SheetView; children: ReactNode }) {
  const openView = useGame((s) => s.openView);
  return (
    <section className={`sheet sheet-${view}`} aria-label={VIEW_TITLES[view]}>
      <header className="sheet-head">
        <h2>
          <Concept kind={VIEW_ICONS[view][0]} icon={VIEW_ICONS[view][1]} />
          {VIEW_TITLES[view]}
        </h2>
        <button type="button" className="icon-btn" onClick={() => openView(null)} aria-label="Close">
          <Icon name="close" />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
