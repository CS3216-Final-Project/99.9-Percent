import { useState } from "react";
import { useGame } from "@/game/store";
import { AccountPanel } from "./AccountPanel";
import { FeedbackButton } from "./FeedbackButton";
import { Icon } from "./icons";
import { Callout } from "./ui";

/** New players choose a mode before starting either simulation. */
export function ModeChoice() {
  const play = useGame((s) => s.play);
  const switchMode = useGame((s) => s.switchMode);
  const [unsaved, setUnsaved] = useState(false);

  return <div className="title-screen campaign-title mode-title">
    <div className="title-card mode-entry">
      <header>
        <span className="title-kicker"><Icon name="server" size={16} />A system design tycoon</span>
        <h1>99.99%</h1>
        <p className="title-tag">Grow a startup. Keep it online.</p>
      </header>
      <section className="mode-selection" aria-labelledby="mode-heading">
        <h2 id="mode-heading">Choose how you want to play</h2>
        <div className="mode-options">
          <section className="mode-option" aria-labelledby="campaign-heading">
            <h3 id="campaign-heading"><Icon name="server" />Campaign</h3>
            <p className="mode-pace">Continuous play · Guided challenges</p>
            <p>Grow one company through guided infrastructure challenges. Inspect problems, upgrade servers and watch your changes take effect. Pause whenever you need.</p>
            <button type="button" className="btn btn-primary" onClick={play}><Icon name="play" />Play Campaign</button>
          </section>
          <section className="mode-option" aria-labelledby="classic-heading">
            <h3 id="classic-heading"><Icon name="week" />Classic</h3>
            <p className="mode-pace">Week by week · 26-week challenge</p>
            <p>Manage money, engineers and research. Grow to 50,000 users in 26 weeks while handling outages and keeping the business afloat.</p>
            <button type="button" className={`btn ${unsaved ? "btn-danger" : "btn-primary"}`} onClick={() => {
              if (!switchMode("classic", { discard: unsaved })) setUnsaved(true);
            }}><Icon name="play" />{unsaved ? "Switch and lose this run" : "Play Classic"}</button>
          </section>
        </div>
        {unsaved && <Callout compact tone="warn" icon="alert" kicker="Not saved">
          This run could not be saved, so switching now loses it. Press the red button again to switch anyway.
        </Callout>}
        <p className="mode-note">You can switch modes from the menu. Each mode keeps its own progress.</p>
      </section>
      <div className="mode-extras">
        <div>
          <p className="muted">Play as a guest. Progress saves in this browser.</p>
          <AccountPanel />
          <div className="title-actions">
            <FeedbackButton />
          </div>
        </div>
        <img className="gameplay-preview" src="/opening-gameplay.png" alt="The furnished office and component evidence in the playable campaign" />
      </div>
    </div>
  </div>;
}
