import { useId, type CSSProperties } from "react";
import { LOOK_SPEED } from "@/game/controls";
import { useGame } from "@/game/store";
import { FOV } from "@/game/viewpoints";
import { Icon } from "./icons";

/** One labelled slider, its fill showing how far along it is. */
function Slider({ label, value, min, max, step, text, shown, onChange }: { label: string; value: number; min: number; max: number; step: number; text: string; shown: string; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="volume">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} aria-hidden="true">
        {shown}
      </output>
    </div>
  );
}

/**
 * The menu's controls section, the same in every mode: how the views from the avatar look round, as the mouse moves,
 * a drag, pointing or the arrow keys turn them, and how wide first person sees. Changes apply at once and are
 * remembered in this browser.
 */
export function ControlSettings() {
  const controls = useGame((s) => s.controls);
  const fov = useGame((s) => s.graphics.fov);
  const setControls = useGame((s) => s.setControls);
  const setGraphics = useGame((s) => s.setGraphics);
  const percent = Math.round(controls.lookSpeed * 100);
  return (
    <section className="menu-section menu-controls" aria-label="Controls">
      <div className="menu-section-head">
        <h4>
          <Icon name="sliders" size={20} />
          Looking round
        </h4>
        <button type="button" className={`btn btn-small menu-toggle${controls.invertY ? " is-on" : ""}`} aria-pressed={controls.invertY} onClick={() => setControls({ invertY: !controls.invertY })}>
          Invert up and down
        </button>
      </div>
      <p className="menu-note">For Follow and First person: how fast the view turns as you move the mouse, drag, point towards an edge or hold the arrow keys.</p>
      <Slider label="Look speed" value={controls.lookSpeed} min={LOOK_SPEED.min} max={LOOK_SPEED.max} step={LOOK_SPEED.step} text={`${percent} per cent`} shown={`${percent}%`} onChange={(lookSpeed) => setControls({ lookSpeed })} />
      <Slider label="First-person field of view" value={fov} min={FOV.min} max={FOV.max} step={1} text={`${fov} degrees`} shown={`${fov}°`} onChange={(v) => setGraphics({ fov: v })} />
      <p className="menu-note">A wider view shows more of the room at once; a narrower one can feel calmer.</p>
    </section>
  );
}
