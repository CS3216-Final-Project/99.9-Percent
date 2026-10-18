import type { RefObject } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";

/** Both choices use the existing exploration setting; selecting either returns the keys to the room. */
export function ViewModeOptions({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const walking = useGame(s => s.walking);
  return <div className="view-mode-options" role="group" aria-label="View mode">
    {([{ walk: false, label: "Overview", note: "Pan, zoom and rotate", icon: "eye" },
      { walk: true, label: "Walk mode", note: "Explore on foot", icon: "walk" }] as const).map(option =>
      <button type="button" key={option.label} aria-label={option.label} aria-pressed={walking === option.walk}
        onClick={event => {
          useGame.getState().setWalking(option.walk);
          const menu = event.currentTarget.closest<HTMLDetailsElement>(".dock-menu");
          if (menu) menu.open = false;
          stage.current?.focus({ preventScroll: true });
        }}>
        <Icon name={option.icon} size={20} /><span><strong>{option.label}</strong><small>{option.note}</small></span>
      </button>)}
  </div>;
}
