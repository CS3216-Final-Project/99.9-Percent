"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
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

/**
 * Guided walkthroughs. Each step is a goal ("Add a server") plus one short
 * line saying what to click right now. The screen dims except for that one
 * thing. Nothing is blocked: the player can click elsewhere or skip.
 */

type Snapshot = ReturnType<typeof useGame.getState>;
type Place = "top" | "bottom" | "left" | "right";

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

/*
 * Guided Mode's Opening: what the system is, how to read its evidence, what earns money, who controls the clock and
 * what an action costs. It stops at the first purchase without asking for it: the Opening is about finding the
 * bottleneck from evidence, so the walkthrough never names the fix.
 */
const snapshot = (s: Snapshot) => s.game.campaign!.snapshot;
const CAMPAIGN: Step[] = [
  {
    title: "Meet your system",
    why: (s) => `Customers send ${num(snapshot(s).incoming)} requests a second. App Servers handle them.`,
    hint: () => "Click Servers to inspect your app.",
    target: () => label("app"),
    done: (s) => s.selected === "app",
  },
  {
    title: "Follow a request",
    why: "App Servers read and write data in the Database.",
    hint: () => "Click Database to inspect its workload.",
    target: () => label("db"),
    done: (s) => s.selected === "db",
  },
  {
    title: "Read the evidence",
    why: (s) =>
      `Demand: ${num(snapshot(s).db.demand)} operations/s. Capacity: ${num(snapshot(s).db.capacity)} operations/s. Work above capacity waits. Inspection is free.`,
    hint: () => "Compare Database demand with its capacity.",
    target: () => ".campaign-panel .incident-investigate",
  },
  {
    title: "Spot trouble",
    why: `${num(Q.latencyThresholdMs)} ms or more means slow responses. Errors measure failed requests; ${Q.errorThreshold * 100}% is the game's error warning threshold.`,
    hint: () => "Compare response time and failed requests.",
    target: () => ".campaign-panel .incident-symptoms",
  },
  {
    title: "Know what earns money",
    why: `Each successful request earns $${(Q.revenueCents / 100).toFixed(2)}. Money and running costs settle every ${Q.periodSteps} game seconds. Rejected requests earn nothing.`,
    hint: () => "Check Cash before buying. Purchases are paid immediately.",
    target: () => ".topbar .stats-strip",
  },
  {
    title: "You control the clock",
    why: "Time is paused. A game second simulates one second of requests, queues and work. It passes only while Run is on.",
    hint: () => "After this guide, Run to watch. Pause (P) to think.",
    target: () => ".campaign-clock .campaign-play",
  },
  {
    title: "Your actions",
    why: "Check the price, activation delay and extra running costs before deciding.",
    hint: () => "Select an action to preview its costs.",
    target: () => ".campaign-panel .actions",
    done: () => confirmingAction() !== null,
  },
  {
    title: "Compare before buying",
    why: "Nothing is bought until you press Confirm.",
    hint: () => "Cancel the preview, then choose Next to keep learning.",
    target: () => (confirmingAction() ? ".campaign-action-popover" : ".campaign-panel .actions"),
  },
  {
    title: "Game time and operating weeks",
    why: `The clock counts total game seconds. Every ${Q.periodSteps} game seconds is one operating week, the company's billing period. It is compressed game time, not a real calendar week.`,
    hint: () => "For example: at game second 60, Week 1 settles and Week 2 begins. The total seconds keep counting.",
    target: () => ".campaign-clock",
  },
  {
    title: "What happens at week end?",
    why: "Successful requests build pending revenue. At week end it is added to cash, equipment costs and salaries are deducted, and the result appears in History. The company keeps running into the next week.",
    hint: () => "Select Cash or Pending revenue any time to see the financial breakdown.",
    target: () => ".topbar .stats-strip",
  },
  {
    title: "Cash is your spending budget",
    why: "Pending revenue cannot pay for purchases yet. Setup costs are paid immediately; running costs continue each week, including for idle equipment. Cash at zero or below after settlement closes the company.",
    hint: () => "Leave room in your budget for running costs before buying an upgrade.",
    target: () => ".topbar .stats-strip",
  },
  {
    title: "Pause, run and change speed",
    why: "Pause stops requests, activation delays and recovery progress so you can inspect and decide. Speed changes how quickly game seconds pass in real time; it does not change prices or the amount of work per game second.",
    hint: () => "After Chapter 0, use Run/Pause or P. Choose 0.5×, 1× or 2× to suit your pace.",
    target: () => ".campaign-clock",
  },
  {
    title: "Find your way around",
    why: "The server floor holds your machines; the office holds the crew. Open the floor selector (Room on phones) to change floors. Camera (inside Room on phones) contains zoom, rotation and Reset view. Walk mode is optional; equipment can always be selected directly.",
    hint: () => "Use the room controls to explore. On a keyboard, Q/E rotate and Page Up/Page Down switch floors.",
    target: () => ".room-controls",
  },
  {
    title: "Technology and deployment",
    why: "Tech shows the nine capabilities and their prerequisites. Later chapters award research points to unlock capabilities. Owning a technology does not deploy it, create a server or send traffic to it.",
    hint: () => "Use Tech to see what is owned; use the chapter's actions to deploy and configure it.",
    target: () => TECH_TAB,
  },
  {
    title: "Check what changed in History",
    why: "History has Charts for trends, Events for decisions and activations, and Incidents for reports. Traffic and response charts use game seconds; revenue and cost charts use operating weeks.",
    hint: () => "After running the company, compare changes over time instead of judging a single reading.",
    target: () => '.view-tabs button[data-view="history"]',
  },
  {
    title: "Save and come back",
    why: "Your company autosaves in this browser when storage is available. Menu has Save now, backups and Save and exit. Optional Account sign-in enables explicit cloud saves. Changing device or clearing browser data needs a cloud save or backup.",
    hint: () => "Menu also holds sound, graphics, your avatar, game modes and a replay of Chapter 0 under How to play.",
    target: () => ".topbar .menu-btn",
  },
  {
    title: "Capacity, routing and data",
    why: "More app capacity helps only when traffic is routed to it. A database can still be the bottleneck. Later, caching answers eligible repeated reads; misses and writes still reach the Database.",
    hint: () => "Inspect each component's demand, capacity and queue before choosing where to invest.",
    target: () => ".campaign-panel .incident-investigate",
  },
  {
    title: "Respond to incidents with evidence",
    why: "An incident means service is struggling. Inspect equipment for free, compare the evidence and choose a response. Some actions take game seconds to activate. Traffic limits can relieve pressure but rejected requests earn nothing.",
    hint: () => "Run to observe your response. Recovery requires five consecutive healthy game seconds; a failing second resets that streak.",
    target: () => ".campaign-panel .incident-symptoms",
  },
  {
    title: "Later challenges build on this",
    why: "Later chapters introduce changing demand, autoscaling, health checks, spare servers, failover and growth. Automation still needs installed capacity, configuration and activation time. Each chapter introduces its new controls when you reach it.",
    hint: () => "You do not need to buy everything. Compare service, cost and rejected demand, then review the outcome.",
    target: () => ".chapter-bar",
  },
  {
    title: "Chapters advance through goals",
    why: "A week ending does not complete a chapter. Follow its Goal, meet the requirements, review the outcome and choose Next when available. The same company, investments and finances carry forward through six gameplay chapters.",
    hint: () => "View chapters shows the route. You can replay Chapter 0 there or from Menu → How to play without resetting your company.",
    target: () => ".chapter-bar",
  },
  {
    title: "Ready to run your company",
    why: "Your company is still paused and this introduction has bought nothing. Chapter 1: Opening asks you to observe changing demand and find a bottleneck from evidence. A replay returns to your existing chapter.",
    hint: () => "Choose Finish Chapter 0, then Run company when you are ready. You can pause whenever you need to think.",
    target: () => ".campaign-clock .campaign-play",
    nextLabel: "Finish Chapter 0",
  },
];

/** Each later chapter gets one step on the controls it adds, the first time the company enters it. */
const chapter = (title: string, why: string, hint: string, target: string): Step[] => [{ title, why, hint: () => hint, target: () => target, nextLabel: "Got it" }];
const CHAPTERS = {
  scaling: chapter(
    "Scale and route",
    `The next growth wave brings ${num(P.traffic)} requests a second.`,
    "Compare scaling and routing options. Extra servers help only when traffic reaches them.",
    '[aria-label="Scaling controls"]',
  ),
  data: chapter(
    "Data strategy",
    "Cache hits answer repeated reads; misses and writes still reach the Database.",
    "Inspect the workload and compare your options.",
    '[aria-label="Data strategy"]',
  ),
  spikes: chapter(
    "Traffic spikes",
    "Two short bursts of traffic are coming.",
    "Inspect demand and compare manual capacity with autoscaling.",
    '[aria-label="Traffic spikes and autoscaling"]',
  ),
  reliability: [
    ...chapter(
      "Stay online",
      "The test makes one App Server fail. Manual and automatic responses are available.",
      "Explore the reliability controls before starting the test.",
      '[aria-label="Stay Online"]',
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

const TRACKS: Record<TourTrack, Step[]> = { basics: BASICS, incident: INCIDENT, campaign: CAMPAIGN, ...CHAPTERS };
export const BASICS_STEPS = BASICS.length;
export const CAMPAIGN_STEPS = CAMPAIGN.length;

const TRACK_NAMES: Partial<Record<TourTrack, string>> = { basics: "Tutorial", campaign: "Tutorial", incident: "Incident guide" };

/** Where a track's steps make sense: Guided Mode's also wait for any review or milestone and for open views. */
function fits(track: TourTrack, s: Snapshot, step: Step): boolean {
  if (track === "basics") return s.game.phase === "management";
  if (track === "incident") return s.game.phase === "incident";
  const c = s.game.campaign;
  return !!c && s.game.phase === "management" && pendingStop(c) === null && !(c.openingMilestone && !c.openingMilestone.acknowledged) && (s.view === null || (!!step.inTech && s.view === "tech"));
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Whether a box on screen lies in the part of the room the panel leaves open. */
function inOpenRoom(r: DOMRect, stage: DOMRect): boolean {
  const { right, bottom } = openRoomArea(stage);
  return r.left >= stage.left + EDGE && r.top >= stage.top + EDGE && r.right <= stage.left + right && r.bottom <= stage.top + bottom;
}

/** Where the card sits relative to what it points at. */
function placeFor(selector: string): Place {
  if (selector.startsWith(".eq-label") || selector.startsWith(".node")) return "right";
  if (selector.startsWith(".view-tabs") || selector.startsWith(".advance") || selector.startsWith(".campaign-clock") || selector.startsWith(".room-controls")) return "top";
  if (selector.startsWith(".next-chip") || selector.startsWith(".topbar")) return "bottom";
  return "left";
}

/** `edge` is where the open room ends on the right: a panel there is left uncovered when the target is in the room. */
function cardStyle(box: Box | null, place: Place, vw: number, vh: number, edge = vw, height = 240): CSSProperties {
  const W = Math.min(280, vw - 24);
  if (!box) return { left: (vw - W) / 2, top: "50%", transform: "translateY(-50%)", width: W };
  // On small screens the card docks to whichever edge is away from the target.
  if (vw < 900) {
    return box.y + box.h / 2 < vh / 2 ? { left: 12, right: 12, bottom: 12 } : { left: 12, right: 12, top: 12 };
  }
  const gap = 14;
  const x = (v: number) => clamp(v, 12, vw - W - 12);
  const y = (v: number) => clamp(v, 12, Math.max(12, vh - height - 12));
  // Never cover the thing being pointed at: flip sides when there is no room.
  if (place === "left" && box.x - gap - W < 12) place = "right";
  else if (place === "right" && box.x + box.w + gap + W > edge - 12 && box.x - gap - W >= 12) place = "left";
  switch (place) {
    case "bottom":
      return { left: x(box.x), top: y(box.y + box.h + gap), width: W };
    case "top":
      return {
        left: x(box.x + box.w / 2 < vw / 2 ? box.x : box.x + box.w - W),
        top: y(box.y - gap - height),
        width: W,
      };
    case "left":
      return { left: Math.max(12, box.x - gap - W), top: y(box.y - 10), width: W };
    case "right":
      return { left: x(box.x + box.w + gap), top: y(box.y), width: W };
  }
}

export default function Tutorial() {
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

  const steps = tour ? TRACKS[tour.track] : [];
  const step = tour ? steps[tour.step] : undefined;
  const track = tour?.track;
  const index = tour?.step ?? -1;
  const visible = !!step && !!track && fits(track, s, step) && !covered && !s.onboarding && s.view !== "menu";

  const advance = () => {
    const now = useGame.getState();
    if (!now.tour) return;
    if (now.tour.step >= TRACKS[now.tour.track].length - 1) now.endTour(true);
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
      setCovered(!!document.querySelector(".modal-backdrop"));
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
      if (eq && focusedFor !== sel && el.style.visibility === "visible") {
        focusedFor = sel;
        const stage = document.querySelector("main.stage")?.getBoundingClientRect();
        if (useGame.getState().game.campaign && stage && !inOpenRoom(el.getBoundingClientRect(), stage)) useGame.getState().focusCamera(eq);
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

  const waiting = !!step.done;
  const name = TRACK_NAMES[tour.track] ?? "Chapter guide";
  const why = typeof step.why === "function" ? step.why(s) : step.why;
  const campaign = !!s.game.campaign;
  return (
    <div className="tour" data-track={tour.track}>
      {box ? <div className="tour-hole" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} /> : <div className="tour-dim" />}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-label={`${name}, step ${tour.step + 1} of ${steps.length}`}
        tabIndex={-1}
        style={cardStyle(box, placeFor(selector), viewport.w, viewport.h, edge, cardHeight)}
      >
        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <i key={i} className={i < tour.step ? "is-done" : i === tour.step ? "is-now" : ""} />
          ))}
        </div>
        {tour.track === "campaign" && <p className="tour-chapter">Chapter 0 · Getting started <span>Lesson {tour.step + 1} of {steps.length}</span></p>}
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
