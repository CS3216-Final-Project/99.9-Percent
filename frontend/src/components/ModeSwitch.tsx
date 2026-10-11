"use client";

import { useState } from "react";
import type { GameMode } from "@/game/persist";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Callout } from "./ui";

const ABOUT: Record<GameMode, string> = {
  campaign: "Campaign is the second-by-second simulation.",
  classic: "Classic is the original week-by-week game.",
};
const NAME: Record<GameMode, string> = { campaign: "Campaign", classic: "Classic" };

/** The menu section that switches to the other mode, asking first when the current run cannot be saved. */
export function ModeSwitch({ to }: { to: GameMode }) {
  const switchMode = useGame((s) => s.switchMode);
  const [unsaved, setUnsaved] = useState(false);
  const from: GameMode = to === "campaign" ? "classic" : "campaign";
  return (
    <section className="menu-section" aria-label="Game mode">
      <h4>
        <Icon name="switch" size={20} />
        Game mode
      </h4>
      <p className="menu-note">
        You are playing {NAME[from]}. {ABOUT[to]} Each mode keeps its own saved run.
      </p>
      <div className="menu-actions">
        <button
          type="button"
          className={`btn ${unsaved ? "btn-danger" : ""}`}
          onClick={() => {
            if (!switchMode(to, { discard: unsaved })) setUnsaved(true);
          }}
        >
          <Icon name="switch" size={20} />
          {unsaved ? "Switch and lose this run" : `Switch to ${NAME[to]}`}
        </button>
      </div>
      {unsaved && (
        <Callout compact tone="warn" icon="alert" kicker="Not saved">
          This run could not be saved, so switching now loses it. Press the red button again to switch anyway.
        </Callout>
      )}
    </section>
  );
}
