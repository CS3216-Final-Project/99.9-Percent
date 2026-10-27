"use client";

import { useMemo, useState } from "react";
import { BALANCE, buildReport } from "@/sim";
import { money, moneyFull, num, uptimePct } from "@/game/format";
import { clearAnalytics, readAnalytics, type AnalyticsEvent } from "@/game/persist";
import { useGame } from "@/game/store";
import { AccountSection, CloudSavesSection } from "./Account";
import { AnalyticsSettings } from "./AnalyticsSettings";
import { FeedbackButton } from "./FeedbackButton";
import { Icon } from "./icons";
import { GraphicsSettings } from "./GraphicsSettings";
import { ControlSettings } from "./ControlSettings";
import { AvatarSettings } from "./AvatarPicker";
import { MenuActions, MenuRun, MenuTile } from "./MenuRun";
import { MenuMap } from "./MenuMap";
import { MenuTabs, type MenuTab } from "./MenuTabs";
import { ModeSwitch } from "./ModeSwitch";
import { SaveFiles } from "./SaveFiles";
import { SoundSettings } from "./SoundSettings";
import { Callout, Concept, Modal } from "./ui";
import { OUTCOME_ICON, OUTCOME_LABEL, outcomeTone } from "./presentation";
import { PostmortemBody, RunCharts } from "./Views";

/* ------------------------------------------------------------------ */
/* How to play (reference card, opened from the menu)                  */
/* ------------------------------------------------------------------ */

export function HowToPlay() {
  const finish = useGame((s) => s.finishOnboarding);
  return (
    <Modal title="How to play" onClose={finish} icon={{ kind: "go", name: "info" }}>
      <ul className="howto">
        <li>
          <Concept kind="users" icon="goal" />
          <span>
            Reach {num(BALANCE.targetUsers)} users by week {BALANCE.maxTurns}. Do not run out of cash.
          </span>
        </li>
        <li>
          <Concept kind="ok" icon="server" />
          <span>Click equipment in the room to see it and act on it.</span>
        </li>
        <li>
          <Concept kind="tech" icon="tree" />
          <span>Tech holds upgrades. Engineers build them, then you ship them.</span>
        </li>
        <li>
          <Concept kind="go" icon="next" />
          <span>Next week moves everything forward.</span>
        </li>
        <li>
          <Concept kind="critical" icon="incident" />
          <span>In an incident, find the cause, then pick the matching fix.</span>
        </li>
        <li>
          <Concept kind="tech" icon="rotateRight" />
          <span>Drag to move and scroll to zoom. Shift + drag (or right-drag) rotates and tilts; Q and E turn the room.</span>
        </li>
        <li>
          <Concept kind="muted" icon="pause" />
          <span>P pauses. Esc closes panels.</span>
        </li>
      </ul>
      <div className="modal-foot">
        <span />
        <button type="button" className="btn btn-primary" autoFocus onClick={finish}>
          Got it
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Postmortem after an incident                                        */
/* ------------------------------------------------------------------ */

export function PostmortemModal() {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.act);
  const pm = game.postmortems.find((p) => p.id === game.reviewId) ?? game.postmortems[game.postmortems.length - 1];
  if (!pm) return null;
  return (
    <Modal title={pm.title} wide tone={pm.outcome === "failed" ? "alert" : undefined} icon={{ kind: outcomeTone(pm), name: "incident" }}>
      <p className="pm-meta">
        <span className={`tag tag-${outcomeTone(pm)}`}>
          <Icon name={OUTCOME_ICON[pm.outcome]} size={12} />
          {OUTCOME_LABEL[pm.outcome]}
        </span>
        <span className="muted">Postmortem, week {pm.turn}</span>
      </p>
      <PostmortemBody pm={pm} />
      <div className="modal-foot">
        <span />
        <button type="button" className="btn btn-primary" autoFocus onClick={() => act({ type: "acknowledge_review" })}>
          <Icon name="next" size={20} />Continue
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* End of run                                                          */
/* ------------------------------------------------------------------ */

/** The reply under "Enjoyed it?"; a low rating also opens the feedback form below it. */
const RATING_REPLY: Record<number, string> = {
  1: "Sorry it wasn't fun. Tell us why?",
  2: "Thanks. What would make it better?",
  3: "Thanks, noted.",
  4: "Glad you liked it!",
  5: "Thanks, glad you loved it!",
};

export function EndReport() {
  const game = useGame((s) => s.game);
  const newRun = useGame((s) => s.newRun);
  const rate = useGame((s) => s.rate);
  const rating = useGame((s) => s.rating);
  const openView = useGame((s) => s.openView);
  const view = useGame((s) => s.view);
  const [askedWhy, setAskedWhy] = useState(false);
  const r = useMemo(() => buildReport(game), [game]);
  if (view === "history") return null;

  return (
    <Modal title={r.headline} wide tone={r.outcome === "won" ? undefined : "alert"} icon={r.outcome === "won" ? { kind: "go", name: "goal" } : { kind: "critical", name: "flag" }}>
      <div className="report-top">
        <div className={`grade grade-${r.grade}`} aria-label={`Grade ${r.grade}`}>
          {r.grade}
        </div>
        <p className="report-summary">{r.summary}</p>
      </div>

      <dl className="stats">
        <div>
          <Concept kind="users" icon="users" />
          <dt>Users</dt>
          <dd>{num(r.users)}</dd>
        </div>
        <div>
          <Concept kind="health" icon="health" />
          <dt>Uptime</dt>
          <dd>{uptimePct(r.uptime)}</dd>
        </div>
        <div>
          <Concept kind="cash" icon="cash" />
          <dt>Cash</dt>
          <dd>{moneyFull(r.cash)}</dd>
        </div>
        <div>
          <Concept kind="critical" icon="incident" />
          <dt>Incidents</dt>
          <dd>{r.incidents.total}</dd>
        </div>
      </dl>

      <div className="callout-stack">
        {r.takeaways.slice(0, 2).map((t) => (
          <Callout key={t} tone="hint" icon="bulb" kicker="Takeaway">
            {t}
          </Callout>
        ))}
      </div>

      <div className="rating">
        <p id="rating-label">Enjoyed it?</p>
        <div className="rating-buttons" role="radiogroup" aria-labelledby="rating-label">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} out of 5`}
              className={rating === n ? "is-on" : ""}
              onClick={() => {
                rate(n);
                if (n <= 2) setAskedWhy(true);
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <span className={rating ? undefined : "muted"} role="status">
          {rating ? RATING_REPLY[rating] : "1 no, 5 loved it"}
        </span>
      </div>
      {/* Kept mounted once shown, so moving to 3-5 and back does not lose a typed draft. */}
      {askedWhy && (
        <div className="rating-feedback" hidden={!rating || rating > 2}>
          <FeedbackButton embedded />
        </div>
      )}

      <details className="more">
        <summary>Details</summary>
        <dl className="rows">
          <div className="row">
            <dt>Score</dt>
            <dd>{r.score} / 100</dd>
          </div>
          <div className="row">
            <dt>Incidents</dt>
            <dd>
              {r.incidents.resolved} fixed, {r.incidents.mitigated} contained, {r.incidents.failed} failed, {r.incidents.automatic} automatic
            </dd>
          </div>
          <div className="row">
            <dt>Upgrades live</dt>
            <dd>
              {r.techCount} of {r.techTotal}
            </dd>
          </div>
          <div className="row">
            <dt>Deploys</dt>
            <dd>
              {r.releasesTested} tested, {r.releasesUntested} untested
            </dd>
          </div>
          <div className="row">
            <dt>Seed</dt>
            <dd>{r.seed}</dd>
          </div>
        </dl>
        <RunCharts game={game} compactSet />
      </details>

      <div className="modal-foot">
        <button type="button" className="btn btn-quiet" onClick={() => openView("history")}>
          <Icon name="history" size={16} />
          History
        </button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => newRun({ seed: game.seed, voluntary: true })}>
            <Icon name="refresh" size={16} />
            Same seed
          </button>
          <button type="button" className="btn btn-primary" autoFocus onClick={() => newRun({ voluntary: true })}>
            <Icon name="play" size={16} />
            Play again
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Menu: the run above tabs for the run, sound, graphics, saves and playtest data */
/* ------------------------------------------------------------------ */

function summarise(events: AnalyticsEvent[]) {
  const count = (name: string) => events.filter((e) => e.name === name).length;
  const ratings = events.filter((e) => e.name === "rating_submitted").map((e) => Number(e.data?.rating ?? 0));
  return [
    ["Runs started", count("run_started")],
    ["Runs finished", count("run_finished")],
    ["Tutorial finished", count("tutorial_completed") > 0 ? "yes" : "no"],
    ["First incident started", count("first_incident_started") > 0 ? "yes" : "no"],
    ["First incident completed", count("first_incident_completed") > 0 ? "yes" : "no"],
    ["Incidents handled", count("incident_completed")],
    ["Hints used", count("hint_used")],
    ["Voluntary replays", count("voluntary_replay")],
    ["Average rating", ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "none"],
  ] as [string, string | number][];
}

export function Menu() {
  const game = useGame((s) => s.game);
  const openView = useGame((s) => s.openView);
  const saveNow = useGame((s) => s.saveNow);
  const saveStatus = useGame((s) => s.saveStatus);
  const newRun = useGame((s) => s.newRun);
  const showOnboarding = useGame((s) => s.showOnboarding);
  const startTutorialRun = useGame((s) => s.startTutorialRun);
  const notify = useGame((s) => s.notify);
  const [tab, setTab] = useState<MenuTab>("run");
  const [seed, setSeed] = useState("");
  const [confirm, setConfirm] = useState<"new" | "reset" | "tutorial" | null>(null);
  const [events, setEvents] = useState<AnalyticsEvent[]>(readAnalytics);

  const inProgress = !game.outcome && game.totals.weeks > 0;
  const start = (kind: "new" | "reset" | "tutorial") => {
    if (inProgress && confirm !== kind) {
      setConfirm(kind);
      return;
    }
    if (kind === "tutorial") {
      startTutorialRun();
    } else if (kind === "reset") {
      newRun({ seed: BALANCE.introSeed });
    } else {
      newRun({ seed: seed.trim() });
    }
  };
  const label = (kind: "new" | "reset" | "tutorial", text: string) => (confirm === kind ? "Lose this run? Press again" : text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
      notify("Copied", "success");
    } catch {
      notify("Could not reach the clipboard.", "error");
    }
  };

  const close = () => openView(null);
  const week = Math.min(game.turn, BALANCE.maxTurns);
  // Shown beside whichever control asked for the confirmation.
  const warning = (
    <Callout compact tone="warn" icon="alert" kicker="Are you sure?">
      This replaces your week {week} run. Press the button again to confirm.
    </Callout>
  );

  // A confirmation belongs to the control that asked for it, so it does not wait on another tab.
  const goTo = (next: MenuTab) => {
    setConfirm(null);
    setTab(next);
  };

  return (
    <Modal title="Menu" onClose={close} icon={{ kind: "go", name: "menu" }} className="modal-menu">
      <MenuRun
        title="At a glance"
        saved={saveStatus === "saved"}
        stats={[
          { icon: "week", kind: "go", label: "Week", value: `${week} / ${BALANCE.maxTurns}` },
          { icon: "users", kind: "users", label: "Users", value: num(game.users) },
          { icon: "cash", kind: "cash", label: "Cash", value: money(game.cash) },
        ]}
        note={
          <>
            Seed <code>{game.seed}</code> Playing the same seed again gives the same run.
          </>
        }
      />

      <MenuTabs value={tab} onChange={goTo}>
        {tab === "run" && (
          <>
            <MenuActions onResume={close}>
              <MenuTile icon="save" kind="ok" title="Save now" text="Write this run to the browser." onClick={() => saveNow()} />
              <MenuTile icon="info" kind="users" title="How to play" text="The rules on one card." onClick={showOnboarding} />
              <MenuTile icon="robot" kind="go" title={label("tutorial", "Tutorial")} text="Replay the guided first week." danger={confirm === "tutorial"} onClick={() => start("tutorial")} />
            </MenuActions>
            {confirm === "tutorial" && warning}
            <ModeSwitch to="campaign" />
          </>
        )}

        {tab === "map" && <MenuMap />}

        {tab === "sound" && <SoundSettings />}

        {tab === "graphics" && <GraphicsSettings />}

        {tab === "controls" && <ControlSettings />}

        {tab === "avatar" && <AvatarSettings />}

        {tab === "saves" && (
          <>
            <div className="menu-columns">
              <div className="menu-col">
                <SaveFiles />
              </div>
              <div className="menu-col">
                <section className="menu-section menu-danger" aria-label="Start over">
                  <h4>
                    <Icon name="refresh" size={20} />
                    Start over
                  </h4>
                  <label className="field">
                    <span>Seed (optional): leave empty for a random run.</span>
                    <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Random" inputMode="text" maxLength={24} />
                  </label>
                  <div className="menu-actions">
                    <button type="button" className={`btn${confirm === "new" ? " btn-danger" : ""}`} onClick={() => start("new")}>
                      <Icon name="play" size={20} />
                      {label("new", "New game")}
                    </button>
                    <button type="button" className={`btn${confirm === "reset" ? " btn-danger" : ""}`} onClick={() => start("reset")}>
                      <Icon name="refresh" size={20} />
                      {label("reset", "Reset to first run")}
                    </button>
                  </div>
                  {(confirm === "new" || confirm === "reset") && warning}
                </section>
              </div>
            </div>
            <CloudSavesSection onOpenAccount={() => goTo("account")} />
          </>
        )}

        {tab === "account" && <AccountSection />}

        {tab === "playtest" && (
          <>
            <AnalyticsSettings />
            <section className="menu-section" aria-label="Playtest data">
              <h4>
                <Icon name="analytics" size={20} />
                Playtest data ({events.length} events)
              </h4>
              <FeedbackButton inline />
              <p className="menu-note">Playtest events below are kept in this browser only.</p>
              <dl className="rows">
                {summarise(events).map(([k, v]) => (
                  <div className="row" key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="btn-row">
                <button type="button" className="btn" onClick={copy} disabled={events.length === 0}>
                  <Icon name="copy" size={16} />Copy as JSON
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  disabled={events.length === 0}
                  onClick={() => {
                    clearAnalytics();
                    setEvents([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </section>
          </>
        )}
      </MenuTabs>
    </Modal>
  );
}
