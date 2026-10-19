import type { RefObject } from "react";
import { useGame } from "@/game/store";
import type { Viewpoint } from "@/game/viewpoints";
import { Icon, type IconName } from "./icons";

/** The ways to see the room: from above with walk mode off or on, or from the avatar, which turns walk mode on. */
const OPTIONS: { walk: boolean; view: Viewpoint; label: string; note: string; icon: IconName }[] = [
  { walk: false, view: "overview", label: "Overview", note: "Pan, zoom and rotate", icon: "eye" },
  { walk: true, view: "overview", label: "Walk mode", note: "Explore on foot", icon: "walk" },
  { walk: true, view: "follow", label: "Follow", note: "Walk with the camera behind you", icon: "follow" },
  { walk: true, view: "first", label: "First person", note: "Walk seeing through its eyes", icon: "eyes" },
];

/** Every choice uses the existing exploration settings; selecting one returns the keys to the room. */
export function ViewModeOptions({ stage }: { stage: RefObject<HTMLDivElement | null> }) {
  const walking = useGame(s => s.walking);
  const viewpoint = useGame(s => s.viewpoint);
  return <div className="view-mode-options" role="group" aria-label="View mode">
    {OPTIONS.map(option =>
      <button type="button" key={option.label} aria-label={option.label} aria-pressed={walking === option.walk && (!walking || viewpoint === option.view)}
        onClick={event => {
          const s = useGame.getState();
          if (option.walk) {
            s.setWalking(true);
            s.setViewpoint(option.view, "menu");
          } else s.setWalking(false);
          const menu = event.currentTarget.closest<HTMLDetailsElement>(".dock-menu");
          if (menu) menu.open = false;
          stage.current?.focus({ preventScroll: true });
        }}>
        <Icon name={option.icon} size={20} /><span><strong>{option.label}</strong><small>{option.note}</small></span>
      </button>)}
  </div>;
}
