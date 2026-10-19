import type { ReactNode } from "react";
import { Tabs, type TabItem } from "./ui";

/** The menu's sections, the same labels in the same order in Classic and Campaign: run, map, preferences, avatar, save files, account, then playtest data. */
export type MenuTab = "run" | "map" | "sound" | "graphics" | "controls" | "avatar" | "saves" | "account" | "playtest";

const MENU_TABS: TabItem<MenuTab>[] = [
  { id: "run", label: "Run", icon: "play" },
  { id: "map", label: "Map", icon: "map" },
  { id: "sound", label: "Sound", icon: "music" },
  { id: "graphics", label: "Graphics", icon: "monitor" },
  { id: "controls", label: "Controls", icon: "sliders" },
  { id: "avatar", label: "Avatar", icon: "user" },
  { id: "saves", label: "Saves", icon: "save" },
  { id: "account", label: "Account", icon: "cloud" },
  { id: "playtest", label: "Playtest", icon: "analytics" },
];

/**
 * The menu's tab navigation. Pass only the selected tab's content, so other tabs' sections are not mounted.
 * `only` keeps a subset of the tabs, in their usual order, for an edition with a smaller menu.
 */
export function MenuTabs({ value, onChange, children, only }: { value: MenuTab; onChange: (tab: MenuTab) => void; children: ReactNode; only?: readonly MenuTab[] }) {
  return (
    <Tabs label="Menu sections" tabs={only ? MENU_TABS.filter((t) => only.includes(t.id)) : MENU_TABS} value={value} onChange={onChange}>
      {children}
    </Tabs>
  );
}
