import { useId } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { QUALITY_OPTIONS } from "./scene/quality";

/**
 * The menu's graphics section, the same in every mode: how much detail the 3D room is drawn with, so a
 * slower machine can trade looks for smoothness. The choice applies at once and is remembered.
 */
export function GraphicsSettings() {
  const quality = useGame((s) => s.graphics.quality);
  const setGraphics = useGame((s) => s.setGraphics);
  const group = useId();
  return (
    <section className="menu-section menu-graphics" aria-label="Graphics">
      <h4>
        <Icon name="monitor" size={20} />
        Graphics quality
      </h4>
      <p className="menu-note">If the room stutters or your fan spins up, try a lower setting. Menus and labels stay sharp at every setting.</p>
      <div className="quality-options" role="radiogroup" aria-label="Graphics quality">
        {QUALITY_OPTIONS.map((o) => (
          <label key={o.id} className={`quality-option${quality === o.id ? " is-on" : ""}`}>
            <input
              type="radio"
              name={group}
              value={o.id}
              checked={quality === o.id}
              aria-labelledby={`${group}-${o.id}-name`}
              aria-describedby={`${group}-${o.id}-text`}
              onChange={() => setGraphics({ quality: o.id })}
            />
            <span className="quality-body">
              <span className="quality-head">
                <strong id={`${group}-${o.id}-name`}>{o.label}</strong>
                <span className="quality-hint">{o.details}</span>
              </span>
              <span id={`${group}-${o.id}-text`} className="quality-text">
                {o.summary}
              </span>
            </span>
          </label>
        ))}
      </div>
      <p className="menu-note">Changing this redraws the room, so the camera returns to its starting view.</p>
    </section>
  );
}
