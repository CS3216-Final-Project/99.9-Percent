import { isSilent } from "@/game/persist";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { tipProps } from "./tips";

/**
 * Mutes music and sound effects together, keeping both volumes for when sound
 * comes back. The same control and preference in Campaign and Classic, and the
 * same state as "Mute all" in the menu: it also reads as muted when both
 * volumes have been dragged to 0, because nothing would be heard.
 */
export function SoundButton() {
  const silent = useGame(s => isSilent(s.audio));
  const toggleMute = useGame(s => s.toggleMute);
  return <button type="button" className="icon-btn music-btn" onClick={toggleMute}
    aria-label="Mute sound" aria-pressed={silent} {...tipProps(silent ? "Turn sound back on" : "Mute music and sound effects")}>
    <Icon name={silent ? "muted" : "music"} />
  </button>;
}
