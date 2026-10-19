"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useGame, type TourTrack } from "@/game/store";
import { floorOf, selectedInView } from "@/game/floors";
import type { EquipmentId } from "@/sim";
import { pendingStop } from "@/sim/step";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";
import { EDGE, openRoomArea } from "./roomArea";
import ChapterZero from "./ChapterZeroGuide";
import { CHAPTER_ZERO_LESSONS } from "./chapterZeroLessons";
import { CHAPTER_MISSIONS, GUIDED_TIP_STEPS, text, type Snapshot, type Step } from "./chapterMissions";
import { cardStyle, placeFor, type Box } from "./spotlight";

/**
 * Guided walkthroughs. Each step is a goal ("Add a server") plus one short
 * line saying what to click right now. The screen dims except for that one
 * thing. Challenge Mode and later chapter guides can be skipped; Chapter 0 uses its own lesson book.
 * Guided Mode's chapter missions and tips live in chapterMissions.ts.
 */

const label = (id: string) => `.eq-label[data-eq="${id}"]`;
const PRIMARY = '[data-tour="primary"]';
const TECH_TAB = '.view-tabs button[data-view="tech"]';
const CONFIRMATION = ".campaign-action-popover";
const clear = (s: Snapshot) => {
  s.openView(null);
  s.select(null);
};

const BASICS: Step[] = [
  {
    title: "Add a server",
    why: "A traffic surge hits in week 4.",
    hint: (s) => (selectedInView(s.selected, s.floor) === "app" ? "Press Add server." : "Click Servers."),
    target: (s) => (selectedInView(s.selected, s.floor) === "app" ? `.side ${PRIMARY}` : label("app")),
    enter: clear,
    done: (s) => s.game.infra.appHosts.length >= 2,
  },
  {
    title: "Explore Scale Up",
    why: "Larger servers handle more traffic but cost more to run.",
    hint: (s) => (s.view !== "tech" ? "Open Tech." : s.techFocus !== "larger_servers" ? "Click Scale Up." : "Press Start."),
    target: (s) =>
      s.view !== "tech" ? TECH_TAB : s.techFocus !== "larger_servers" ? '.node[data-tech="larger_servers"]' : `.tree-detail ${PRIMARY}`,
    enter: (s) => s.select(null),
    done: (s) => s.game.tasks.some((t) => t.techId === "larger_servers") || s.game.releases.some((r) => r.techId === "larger_servers") || s.game.techDone.includes("larger_servers"),
  },
  {
    title: "Get more users",
    why: "Promotions bring users, and traffic.",
    hint: (s) => (selectedInView(s.selected, s.floor) === "growth" ? "Press Launch." : "Click Growth."),
    target: (s) => (selectedInView(s.selected, s.floor) === "growth" ? `.side ${PRIMARY}` : label("growth")),
    enter: clear,
    done: (s) => s.game.totals.promosRun > 0,
  },
  {
    title: "Play the week",
    hint: () => "Press Next week.",
    target: () => ".advance",
    enter: clear,
    done: (s) => s.game.turn > 1,
  },
  {
    title: "Follow this tip",
    hint: () => "It always suggests a good next move.",
    target: () => ".next-chip",
    nextLabel: "Got it",
  },
];

const INCIDENT: Step[] = [
  {
    title: "Customers are failing",
    hint: () => "The clock is paused for this guide.",
    target: () => ".incident-clock",
    // The machines are on the server floor, so the guide starts by riding down to them.
    enter: (s) => s.goToFloor("servers", "tour"),
  },
  {
    title: "Find the cause",
    hint: () => "Click red equipment, or these.",
    target: () => ".incident-investigate",
  },
  {
    title: "Pick the matching fix",
    hint: () => "A wrong fix wastes time and money.",
    target: () => ".incident .actions",
    nextLabel: "Start",
  },
];

const TRACKS: Partial<Record<TourTrack, Step[]>> = { basics: BASICS, incident: INCIDENT, ...CHAPTER_MISSIONS, ...GUIDED_TIP_STEPS };
export const BASICS_STEPS = BASICS.length;
export const CAMPAIGN_STEPS = CHAPTER_ZERO_LESSONS.length;

const TRACK_NAMES: Partial<Record<TourTrack, string>> = { basics: "Tutorial", campaign: "Tutorial", incident: "Incident guide", settlement: "Tip", limit: "Tip", slowdown: "Slowdown guide" };

/** Where a track's steps make sense: Guided Mode's also wait for any review or milestone and for open views. */
function fits(track: TourTrack, s: Snapshot, step: Pick<Step, "inTech" | "phases">): boolean {
  if (track === "basics") return s.game.phase === "management";
  if (track === "incident") return s.game.phase === "incident";
  const c = s.game.campaign;
  return !!c && (step.phases ?? ["management"]).includes(s.game.phase) && pendingStop(c) === null && !(c.openingMilestone && !c.openingMilestone.acknowledged) && (s.view === null || (!!step.inTech && s.view === "tech"));
}

/** Whether a box on screen lies in the part of the room the panel leaves open. */
function inOpenRoom(r: DOMRect, stage: DOMRect): boolean {
  const { right, bottom } = openRoomArea(stage);
  return r.left >= stage.left + EDGE && r.top >= stage.top + EDGE && r.right <= stage.left + right && r.bottom <= stage.top + bottom;
}

export default function Tutorial() {
  const s = useGame();
  if (s.tour?.track === "campaign") {
    if (!fits("campaign", { ...s, view: null }, {}) || s.onboarding) return null;
    return <ChapterZero key={`${s.generation}:${s.tutorialAttempt}`} lessons={CHAPTER_ZERO_LESSONS} />;
  }
  return <SpotlightTutorial />;
}

function SpotlightTutorial() {
  const s = useGame();
  const { tour } = s;
  const [box, setBox] = useState<Box | null>(null);
  const [selector, setSelector] = useState("");
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  // A dialog that needs the player (a review, the chapter list) covers the room; the guide waits behind it.
  const [covered, setCovered] = useState(false);
  const [edge, setEdge] = useState<number | undefined>(undefined);
  const [cardHeight, setCardHeight] = useState(240);
  const card = useRef<HTMLDivElement>(null);
  // Steps can wait on an action's confirmation, which lives outside the store.
  useSyncExternalStore(subscribeConfirming, confirmingAction);

  const steps = tour ? TRACKS[tour.track] ?? [] : [];
  const step = tour ? steps[tour.step] : undefined;
  const track = tour?.track;
  const index = tour?.step ?? -1;
  const visible = !!step && !!track && fits(track, s, step) && !covered && !s.onboarding && s.view !== "menu";

  // A step revisited with Back keeps its Next button instead of moving on by itself again.
  const [revisit, setRevisit] = useState<{ track: TourTrack; step: number } | null>(null);
  const revisited = !!tour && revisit?.track === tour.track && revisit.step === tour.step;
  const applies = (i: number) => !steps[i]?.skipIf?.(useGame.getState());
  const previous = (() => {
    for (let i = index - 1; i >= 0; i--) if (applies(i)) return i;
    return -1;
  })();

  const advance = () => {
    const now = useGame.getState();
    const list = now.tour ? TRACKS[now.tour.track] : undefined;
    if (!now.tour || !list) return;
    let next = now.tour.step + 1;
    while (next < list.length && list[next].skipIf?.(now)) next++;
    if (next >= list.length) now.endTour(true);
    else now.tourGo(next);
  };

  // Run a step's setup once, then move focus to the card for keyboard and screen-reader users.
  useEffect(() => {
    if (!step) return;
    const now = useGame.getState();
    if (step.skipIf?.(now)) return;
    if (step.pause) now.setRunning(false);
    step.enter?.(now);
    card.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, index]);

  // Steps that wait for an action finish as soon as the player has done it; steps that no longer apply are passed.
  // Guided Mode's steps also finish behind a dialog, such as the postmortem that ends a slowdown.
  useEffect(() => {
    if (!step || revisited) return;
    const now = useGame.getState();
    if (step.skipIf?.(now) || (step.done && (visible || !!now.game.campaign) && step.done(now))) advance();
  });

  // Follow the spotlighted element as the layout, camera or panel contents change.
  useEffect(() => {
    if (!step) return;
    let last = "";
    let scrolledFor = "";
    let floorFor = "";
    let focusedFor = "";
    const read = () => {
      const height = card.current?.getBoundingClientRect().height;
      if (height) setCardHeight(previous => previous === height ? previous : height);
      setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      const hiddenByModal = !!document.querySelector(".modal-backdrop");
      setCovered(hiddenByModal);
      if (hiddenByModal) focusedFor = "";
      // An open purchase confirmation is what the player is deciding on now, so a Guided Mode guide lights it rather
      // than covering its Confirm and Cancel buttons.
      const sel = useGame.getState().game.campaign && confirmingAction() ? CONFIRMATION : step.target(useGame.getState());
      setSelector(sel);
      // A step pointing at equipment on the other floor takes the view there first; its label appears as the car
      // arrives. Once only: a player who then rides elsewhere is not pulled back.
      const eq = /^\.eq-label\[data-eq="([a-zA-Z]+)"\]$/.exec(sel)?.[1] as EquipmentId | undefined;
      if (eq && floorFor !== sel) {
        floorFor = sel;
        const s = useGame.getState();
        if (floorOf(eq) !== s.floor) s.goToFloor(floorOf(eq), "tour");
      }
      const el = document.querySelector<HTMLElement>(sel);
      // Something without a box of its own (hidden, or laid out with display: contents) cannot be pointed at.
      if (!el || el.getClientRects().length === 0) {
        if (last !== "none") {
          last = "none";
          setBox(null);
        }
        return;
      }
      // Guided Mode's panel can cover part of the room (its lower half on a phone). Once the label is placed, a machine
      // out of the open part is brought into it, as Guided Mode's actions do; one in view is left where it is.
      if (eq && !hiddenByModal && el.style.visibility === "visible") {
        const stage = document.querySelector("main.stage")?.getBoundingClientRect();
        if (stage) {
          const area = openRoomArea(stage);
          const layout = `${sel}:${Math.round(stage.width)}:${Math.round(stage.height)}:${Math.round(area.right)}:${Math.round(area.bottom)}`;
          if (focusedFor !== layout) {
            focusedFor = layout;
            if (useGame.getState().game.campaign && !inOpenRoom(el.getBoundingClientRect(), stage)) useGame.getState().focusCamera(eq);
          }
        }
      }
      if (scrolledFor !== sel) {
        scrolledFor = sel;
        if (el.closest(".side, .sheet-body, .tree-scroll, .tree-detail")) el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      const r = el.getBoundingClientRect();
      const side = document.querySelector(".side")?.getBoundingClientRect();
      setEdge(side && side.width > 0 && side.left > window.innerWidth / 2 && !el.closest(".side") ? side.left : undefined);
      // Equipment labels sit above their racks, so the spotlight reaches down to include them.
      const k = window.innerWidth < 900 ? 0.45 : 1;
      const [pt, pr, pb, pl] = sel.startsWith(".eq-label") ? [10 * k, 46 * k, 120 * k, 46 * k] : [5, 5, 5, 5];
      const x = Math.max(4, r.left - pl);
      const y = Math.max(4, r.top - pt);
      const next = {
        x,
        y,
        w: Math.min(window.innerWidth - 4, r.right + pr) - x,
        h: Math.min(window.innerHeight - 4, r.bottom + pb) - y,
      };
      const key = `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}`;
      if (key !== last) {
        last = key;
        setBox(next);
      }
    };
    read();
    const id = window.setInterval(read, 120);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", read);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, index]);

  if (!visible || !step || !tour) return null;

  const waiting = !!step.done && !revisited;
  const name = TRACK_NAMES[tour.track] ?? "Chapter guide";
  const why = text(step.why, s);
  const more = text(step.more, s);
  const campaign = !!s.game.campaign;
  // Docked to the top of a small screen, a Guided Mode card stays below the header so Cash, App Health and Menu remain usable.
  const topbar = campaign ? document.querySelector(".topbar")?.getBoundingClientRect().bottom : undefined;
  const topInset = topbar ? Math.round(topbar) + 8 : undefined;
  return (
    <div className="tour" data-track={tour.track}>
      {box ? <div className="tour-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-label={`${name}, step ${tour.step + 1} of ${steps.length}`}
        tabIndex={-1}
        style={cardStyle(box, placeFor(selector), viewport.w, viewport.h, edge, cardHeight, undefined, topInset)}
      >
        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <i key={i} className={i < tour.step ? "is-done" : i === tour.step ? "is-now" : ""} />
          ))}
        </div>
        <h3>{step.title}</h3>
        {!campaign && why && <p className="muted">{why}</p>}
        <p className="tour-prompt">{step.hint(s)}</p>
        {campaign && why && <p className="muted tour-explanation">{why}</p>}
        {more && <details className="lesson-more tour-more"><summary>Learn more</summary><p>{more}</p></details>}
        <div className="tour-foot">
          <button type="button" className="tour-skip" onClick={() => s.endTour(false)}>
            Skip
          </button>
          <span className="tour-nav">
            {campaign && previous >= 0 && (
              <button type="button" className="btn btn-small" onClick={() => { setRevisit({ track: tour.track, step: previous }); s.tourGo(previous); }}>
                Back
              </button>
            )}
            {!waiting && (
              <button type="button" className="btn btn-primary btn-small" onClick={advance}>
                {revisited ? "Next" : step.nextLabel ?? "Next"}
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
