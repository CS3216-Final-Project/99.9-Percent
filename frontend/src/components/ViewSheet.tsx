import { useLayoutEffect, useRef, type ReactNode } from "react";
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

/** A workspace above the persistent dock; returning restores the view control's focus. */
export function ViewSheet({ view, children }: { view: SheetView; children: ReactNode }) {
  const openView = useGame((s) => s.openView);
  const workspace = view === "tech" || view === "history";
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const opener = document.activeElement;
    const menuTrigger = opener instanceof HTMLElement ? opener.closest("details")?.querySelector<HTMLElement>(":scope > summary") : null;
    const sheet = heading.current?.closest("section");
    heading.current?.focus({ preventScroll: true });
    return () => {
      if (sheet?.contains(document.activeElement) && opener instanceof HTMLElement && opener.isConnected) {
        const target = opener.getClientRects().length ? opener : menuTrigger ?? opener;
        target?.focus({ preventScroll: true });
      }
    };
  }, [view]);
  return (
    <section className={`sheet sheet-${view}`} aria-label={VIEW_TITLES[view]}>
      <header className="sheet-head">
        <h2 ref={heading} tabIndex={-1}>
          <Concept kind={VIEW_ICONS[view][0]} icon={VIEW_ICONS[view][1]} />
          {VIEW_TITLES[view]}
        </h2>
        <button type="button" className={workspace ? "btn sheet-return" : "icon-btn"} data-return-to-room onClick={() => openView(null)} aria-label={workspace ? undefined : "Close"}>
          <Icon name="close" />
          {workspace && "Back to room"}
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
