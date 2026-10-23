"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { isPhoneEdition } from "@/phone/edition";
import { useGame, type TourTrack } from "@/game/store";
import { floorOf, selectedInView } from "@/game/floors";
import { num } from "@/game/format";
import type { EquipmentId } from "@/sim";
import { pendingStop } from "@/sim/step";
import { installPending } from "@/sim/reliability";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { confirmingAction, subscribeConfirming } from "./actionConfirmation";
import { EDGE, openRoomArea } from "./roomArea";
import ChapterZero from "./ChapterZeroGuide";
import { CHAPTER_ZERO_LESSONS, type ChapterZeroLesson } from "./chapterZeroLessons";
import { cardStyle, placeFor, type Box } from "./spotlight";

/**
 * Guided walkthroughs. Each step is a goal ("Add a server") plus one short
 * line saying what to click right now. The screen dims except for that one
 * thing. Challenge Mode and later chapter guides can be skipped; Chapter 0 uses its own lesson book.
 */

type Snapshot = ReturnType<typeof useGame.getState>;

interface Step {
  title: string;
  /** One short reason, if the goal needs one. */
  why?: string | ((s: Snapshot) => string);
  /** What to click right now. It changes as the player moves through the step. */
  hint: (s: Snapshot) => string;
  /** CSS selector of the thing to spotlight right now. */
  target: (s: Snapshot) => string;
  /** When present, the step completes by itself once this is true. */
  done?: (s: Snapshot) => boolean;
  enter?: (s: Snapshot) => void;
  nextLabel?: string;
  /** The step leads through the Tech tree, so an open tree does not hide it. */
  inTech?: boolean;
}

const label = (id: string) => `.eq-label[data-eq="${id}"]`;
const PRIMARY = '[data-tour="primary"]';
const TECH_TAB = '.view-tabs button[data-view="tech"]';
/** Only Deploy Health Checks' own confirmation belongs to its step; another action's is the player's detour. */
const confirmingChecks = () => confirmingAction() === "Deploy Health Checks";
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

/** Each later chapter gets one step on the controls it adds, the first time the company enters it. */
const chapter = (title: string, why: string, hint: string, target: string, enter?: Step["enter"]): Step[] => [{ title, why, hint: () => hint, target: () => target, enter, nextLabel: "Got it" }];
/** A step that points at purchase controls opens the panel's Actions tab, where they are. */
const showActions = (s: Snapshot) => s.setPanelTab("actions");
const CHAPTERS = {
  scaling: chapter(
    "Scale and route",
    `The next growth wave brings ${num(P.traffic)} requests a second.`,
    "Compare scaling and routing options. Extra servers help only when traffic reaches them.",
    '[aria-label="Scaling controls"]',
    showActions,
  ),
  data: chapter(
    "Data strategy",
    "Cache hits answer repeated reads; misses and writes still reach the Database.",
    "Inspect the workload and compare your options.",
    '[aria-label="Data strategy"]',
    showActions,
  ),
  spikes: chapter(
    "Traffic spikes",
    "Two short bursts of traffic are coming.",
    "Inspect demand and compare manual capacity with autoscaling.",
    '[aria-label="Traffic spikes and autoscaling"]',
    showActions,
  ),
  reliability: [
    ...chapter(
      "Stay online",
      "The test makes one App Server fail. Manual and automatic responses are available.",
      "Explore the reliability controls before starting the test.",
      '[aria-label="Stay Online"]',
      showActions,
    ),
    {
      title: "Unlock Health Checks",
      why: "This chapter's capabilities are unlocked in Tech with research points.",
      hint: (s) => (s.view !== "tech" ? "Open Tech." : s.techFocus !== "health_checks" ? "Click Health Checks." : "Press Unlock Health Checks."),
      target: (s) =>
        s.view !== "tech" ? TECH_TAB : s.techFocus !== "health_checks" ? '.node[data-tech="health_checks"]' : `.tree-detail ${PRIMARY}`,
      inTech: true,
      done: (s) => !!s.game.campaign?.reliabilityStage?.owned.includes("health_checks"),
    },
    {
      title: "Deploy Health Checks",
      why: "Unlocking does not deploy it.",
      hint: (s) =>
        s.view === "tech"
          ? "Close Tech."
          : confirmingChecks()
            ? "Press Confirm."
            : s.game.campaign && installPending(s.game.campaign)
              ? "Run until the current install finishes, then press Deploy Health Checks."
              : "Press Deploy Health Checks.",
      // The confirmation opens beside the panel; light it up rather than leaving it under the dim.
      target: (s) => (s.view === "tech" ? TECH_TAB : confirmingChecks() ? ".campaign-action-popover" : '[data-tour="deploy-checks"]'),
      enter: showActions,
      inTech: true,
      done: (s) => {
        const c = s.game.campaign;
        return !!c && (c.reliabilityStage?.checksStep != null || c.pending.some((a) => a.type === "health-checks"));
      },
    },
  ],
  combined: chapter(
    "Grow the company",
    "Three growth waves use everything you have built.",
    "Start each wave when you are ready, then review how it went.",
    ".campaign-guidance",
  ),
} satisfies Record<string, Step[]>;

/** One-card Guided Mode tips, shown the first time something happens instead of being taught up front. */
const TIPS = {
  settlement: chapter(
    "Your first week settled",
    `Every ${Q.periodSteps} game seconds the week settles: pending revenue becomes cash, then equipment and salaries are paid.`,
    "Keep enough cash for next week's bill before you buy.",
    ".stat-cash",
  ),
} satisfies Record<string, Step[]>;

const TRACKS: Partial<Record<TourTrack, Step[]>> = { basics: BASICS, incident: INCIDENT, ...CHAPTERS, ...TIPS };
export const BASICS_STEPS = BASICS.length;
export const CAMPAIGN_STEPS = CHAPTER_ZERO_LESSONS.length;

const TRACK_NAMES: Partial<Record<TourTrack, string>> = { basics: "Tutorial", campaign: "Tutorial", incident: "Incident guide", settlement: "Tip" };

/** Where a track's steps make sense: Guided Mode's also wait for any review or milestone and for open views. */
function fits(track: TourTrack, s: Snapshot, step: Pick<Step, "inTech">): boolean {
  if (track === "basics") return s.game.phase === "management";
  if (track === "incident") return s.game.phase === "incident";
  const c = s.game.campaign;
  return !!c && s.game.phase === "management" && pendingStop(c) === null && !(c.openingMilestone && !c.openingMilestone.acknowledged) && (s.view === null || (!!step.inTech && s.view === "tech"));
}

/** Whether a box on screen lies in the part of the room the panel leaves open. */
function inOpenRoom(r: DOMRect, stage: DOMRect): boolean {
  const { right, bottom } = openRoomArea(stage);
  return r.left >= stage.left + EDGE && r.top >= stage.top + EDGE && r.right <= stage.left + right && r.bottom <= stage.top + bottom;
}

/** `chapterZero` presents Chapter 0's lessons; an edition can bring its own, as the phone's coach strip does. */
export default function Tutorial({ chapterZero: Guide = ChapterZero }: { chapterZero?: ComponentType<{ lessons: readonly ChapterZeroLesson[] }> } = {}) {
  const s = useGame();
  if (s.tour?.track === "campaign") {
    if (!fits("campaign", { ...s, view: null }, {}) || s.onboarding) return null;
    return <Guide key={`${s.generation}:${s.tutorialAttempt}`} lessons={CHAPTER_ZERO_LESSONS} />;
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

  const advance = () => {
    const now = useGame.getState();
    if (!now.tour || !TRACKS[now.tour.track]) return;
    if (now.tour.step >= TRACKS[now.tour.track]!.length - 1) now.endTour(true);
    else now.tourNext();
  };

  // Run a step's setup once, then move focus to the card for keyboard and screen-reader users.
  useEffect(() => {
    if (!step) return;
    step.enter?.(useGame.getState());
    card.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, index]);

  // Steps that wait for an action finish as soon as the player has done it.
  useEffect(() => {
    if (step?.done && visible && step.done(useGame.getState())) advance();
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
      const sel = step.target(useGame.getState());
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
      // A phone keeps the compact reach when turned on its side, wider than the desktop's narrow layout.
      const k = isPhoneEdition() || window.innerWidth < 900 ? 0.45 : 1;
      const [pt, pr, pb, pl] = sel.startsWith(".eq-label") ? [10 * k, 46 * k, 120 * k, 46 * k] : [5, 5, 5, 5];
      const x = Math.max(4, r.left - pl);
      const y = Math.max(4, r.top - pt);
      // A phone's guide is docked above the dock; the lit window ends where the strip starts.
      const bottom = isPhoneEdition() && card.current ? Math.max(y, card.current.getBoundingClientRect().top - 6) : window.innerHeight - 4;
      const next = {
        x,
        y,
        w: Math.min(window.innerWidth - 4, r.right + pr) - x,
        h: Math.min(bottom, r.bottom + pb) - y,
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

  const waiting = !!step.done;
  const name = TRACK_NAMES[tour.track] ?? "Chapter guide";
  const why = typeof step.why === "function" ? step.why(s) : step.why;
  const campaign = !!s.game.campaign;
  // A phone docks every guide in its coach strip above the dock (see the phone's tutorial styles).
  const docked = isPhoneEdition();
  return (
    <div className="tour" data-track={tour.track} data-docked={docked || undefined}>
      {box ? <div className="tour-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-label={`${name}, step ${tour.step + 1} of ${steps.length}`}
        tabIndex={-1}
        style={docked ? undefined : cardStyle(box, placeFor(selector), viewport.w, viewport.h, edge, cardHeight)}
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
        <div className="tour-foot">
          <button type="button" className="tour-skip" onClick={() => s.endTour(false)}>
            Skip
          </button>
          {!waiting && (
            <button type="button" className="btn btn-primary btn-small" onClick={advance}>
              {step.nextLabel ?? "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
