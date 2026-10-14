"use client";

import { useState } from "react";
import type { GameMode } from "@/game/persist";
import { useGame } from "@/game/store";
import { Icon } from "./icons";
import { Callout } from "./ui";

const ABOUT: Record<GameMode, string> = {
  campaign: "Guided Mode teaches infrastructure concepts through five guided chapters of continuous play.",
  classic: "Challenge Mode is the 26-week weekly challenge: apply what you learned on your own.",
};
const NAME: Record<GameMode, string> = { campaign: "Guided Mode", classic: "Challenge Mode" };

/** The menu section that switches to the other mode, asking first when the current run cannot be saved. */
export function ModeSwitch({ to }: { to: GameMode }) {
  const switchMode = useGame((s) => s.switchMode);
  // Challenge Mode stays locked until the Guided Mode company acknowledges its final chapter.
  const locked = useGame((s) => to === "classic" && s.mode !== "classic" && !s.meta.challengeUnlocked && s.game.campaign?.reliabilityStage?.acknowledged !== true);
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
      {locked ? (
        <>
          <p className="menu-note">Complete the first five Guided Mode chapters to unlock Challenge Mode.</p>
          <div className="menu-actions">
            <button type="button" className="btn" disabled>
              <Icon name="lock" size={20} />
              Complete Guided Mode to unlock
            </button>
          </div>
        </>
      ) : (
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
      )}
      {unsaved && !locked && (
        <Callout compact tone="warn" icon="alert" kicker="Not saved">
          This run could not be saved, so switching now loses it. Press the red button again to switch anyway.
        </Callout>
      )}
    </section>
  );
}
