import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { tipProps } from "./tips";

/**
 * Mutes music and sound effects together, keeping both volumes for when sound
 * comes back. The same control and preference in Campaign and Classic, and the
 * same state as "Mute all" in the menu.
 */
export function SoundButton() {
  const muted = useGame(s => s.audio.muted);
  const toggleMute = useGame(s => s.toggleMute);
  return <button type="button" className="icon-btn music-btn" onClick={toggleMute}
    aria-label="Mute sound" aria-pressed={muted} {...tipProps(muted ? "Turn sound back on" : "Mute music and sound effects")}>
    <Icon name={muted ? "muted" : "music"} />
  </button>;
}
