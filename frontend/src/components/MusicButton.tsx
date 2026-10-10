import { useGame } from "@/game/store";
import { Icon } from "./icons";

/** The same control and preference in Campaign and Classic. */
export function MusicButton() {
  const music = useGame(s => s.meta.music);
  const toggleMusic = useGame(s => s.toggleMusic);
  return <button type="button" className="icon-btn music-btn" onClick={toggleMusic}
    aria-label="Music" aria-pressed={music} title={music ? "Mute music" : "Unmute music"}>
    <Icon name={music ? "music" : "muted"} />
  </button>;
}
