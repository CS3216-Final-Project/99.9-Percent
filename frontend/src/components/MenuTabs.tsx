import type { ReactNode } from "react";
import { Tabs, type TabItem } from "./ui";

/** The menu's sections, the same labels in the same order in Classic and Campaign. */
export type MenuTab = "run" | "sound" | "graphics" | "saves" | "playtest";

const MENU_TABS: TabItem<MenuTab>[] = [
  { id: "run", label: "Run", icon: "play" },
  { id: "sound", label: "Sound", icon: "music" },
  { id: "graphics", label: "Graphics", icon: "monitor" },
  { id: "saves", label: "Saves", icon: "save" },
  { id: "playtest", label: "Playtest", icon: "analytics" },
];

/** The menu's tab strip. Pass only the selected tab's content, so other tabs' sections are not mounted. */
export function MenuTabs({ value, onChange, children }: { value: MenuTab; onChange: (tab: MenuTab) => void; children: ReactNode }) {
  return (
    <Tabs label="Menu sections" tabs={MENU_TABS} value={value} onChange={onChange}>
      {children}
    </Tabs>
  );
}
