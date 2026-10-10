import { useId, type CSSProperties } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";

/** One labelled volume slider, 0 to 100% in steps of 5; arrow keys, Page Up/Down, Home and End move it. */
function Volume({ label, value, onChange }: { label: string; value: number; onChange: (percent: number) => void }) {
  const id = useId();
  return (
    <div className="volume">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-valuetext={`${value}%`}
        style={{ "--fill": `${value}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} aria-hidden="true">
        {value}%
      </output>
    </div>
  );
}

/** The menu's sound section, the same in every mode. Changes apply as the slider moves. */
export function SoundSettings() {
  const audio = useGame((s) => s.audio);
  const setAudio = useGame((s) => s.setAudio);
  const toggleMute = useGame((s) => s.toggleMute);
  return (
    <section className={`menu-section menu-sound${audio.muted ? " is-muted" : ""}`} aria-label="Sound">
      <div className="menu-section-head">
        <h4>
          <Icon name={audio.muted ? "muted" : "music"} size={16} />
          Sound
        </h4>
        <button type="button" className={`btn btn-small menu-toggle${audio.muted ? " is-on" : ""}`} aria-pressed={audio.muted} onClick={toggleMute}>
          <Icon name="muted" size={16} />
          Mute all
        </button>
      </div>
      {/* Moving a slider means the player wants to hear it, so it also unmutes. */}
      <Volume label="Music" value={audio.music} onChange={(music) => setAudio({ music, muted: false })} />
      <Volume label="Sound effects" value={audio.effects} onChange={(effects) => setAudio({ effects, muted: false })} />
      <p className="menu-note muted">{audio.muted ? "Muted. Moving a slider turns sound back on." : "Effects play a sample as you set them."}</p>
    </section>
  );
}
