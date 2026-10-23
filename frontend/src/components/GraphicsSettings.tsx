import { useId } from "react";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { QUALITY_OPTIONS } from "./scene/quality";

/**
 * The menu's graphics section, the same in every mode: how much detail the 3D room is drawn with, so a
 * slower machine can trade looks for smoothness, and whether changing floor rides the elevator's cutscene.
 * Choices apply at once and are remembered.
 */
export function GraphicsSettings() {
  const quality = useGame((s) => s.graphics.quality);
  const skipElevator = useGame((s) => s.graphics.skipElevator);
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
      <div className="menu-section-head">
        <h4>
          <Icon name="floor" size={20} />
          Elevator
        </h4>
        <button type="button" className={`btn btn-small menu-toggle${skipElevator ? " is-on" : ""}`} aria-pressed={skipElevator} onClick={() => setGraphics({ skipElevator: !skipElevator })}>
          Skip elevator cutscene
        </button>
      </div>
      <p className="menu-note">Change floors at once instead of watching the elevator ride between them.</p>
    </section>
  );
}
