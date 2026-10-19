import type { useGame } from "@/game/store";
import { campaignGuidance } from "@/game/campaignGuidance";
import { num } from "@/game/format";
import type { GameState } from "@/sim";
import type { Campaign } from "@/sim/campaignTypes";
import { preventionAvailable } from "@/sim/openingPrevention";
import { installPending } from "@/sim/reliability";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";
import { routableApps } from "@/sim/step";
import { confirmingAction } from "./actionConfirmation";

/**
 * Guided Mode's spotlight guides after Chapter 0: one mission per chapter, shown when the company enters it, and
 * one-time tips for moments such as the first slowdown. Each step names one real control; an action step moves on
 * by itself once the player has done it. Steps already satisfied are skipped, so a replay starts where the company is.
 */

export type Snapshot = ReturnType<typeof useGame.getState>;
type Text = string | ((s: Snapshot) => string);

export interface Step {
  title: string;
  /** One short reason, if the goal needs one. */
  why?: Text;
  /** What to click right now. It changes as the player moves through the step. */
  hint: (s: Snapshot) => string;
  /** CSS selector of the thing to spotlight right now. */
  target: (s: Snapshot) => string;
  /** When present, the step completes by itself once this is true. */
  done?: (s: Snapshot) => boolean;
  /** The step no longer applies, for example because the company already has what it teaches. */
  skipIf?: (s: Snapshot) => boolean;
  enter?: (s: Snapshot) => void;
  nextLabel?: string;
  /** The step leads through the Tech tree, so an open tree does not hide it. */
  inTech?: boolean;
  /** The longer explanation, collapsed under Learn more. */
  more?: Text;
  /** Phases the step shows in; management by default. */
  phases?: readonly GameState["phase"][];
  /** Pause the clock when the step opens, so the moment it describes can be read. */
  pause?: boolean;
}

export const text = (t: Text | undefined, s: Snapshot) => (typeof t === "function" ? t(s) : t);

const C = (s: Snapshot): Campaign => s.game.campaign!;
const pending = (s: Snapshot, ...types: string[]) => C(s).pending.some(a => types.includes(a.type));
const action = (label: string) => `[data-campaign-action="${label}"]`;
const inspect = (id: string) => `[data-tutorial="inspect-${id}"]`;
const RUN = ".campaign-play";
const GUIDANCE_ACTION = '[data-tour="guidance-action"]';
const ROUTING = '[data-tour="routing"]';
const BOTH: readonly GameState["phase"][] = ["management", "incident"];
const run = (watching: string) => (s: Snapshot) => (s.running ? watching : "Press Run.");
const routedCapacity = (c: Campaign) => c.apps.filter(a => a.routed && a.health !== "failed").reduce((sum, a) => sum + a.capacity, 0);
const appName = (id: string) => `App ${id.slice(4)}`;

// ---- Chapter 1: Opening ----------------------------------------------------------------------------------------

const grown = (s: Snapshot) => C(s).consumedEvents.includes("opening-growth");
/** The Opening has moved past its first decision: a slowdown, a recorded prevention or the milestone. */
const openingSettled = (s: Snapshot) => {
  const c = C(s);
  return !!c.incident || c.reports.length > 0 || !!c.openingMilestone || !!c.openingPrevention?.outcome;
};
const dbFixStarted = (s: Snapshot) => C(s).dbCapacity > Q.dbCapacity || pending(s, "upgrade-db");
const limitStarted = (s: Snapshot) => C(s).limit !== null || pending(s, "limit");

const OPENING: Step[] = [
  {
    title: "Chapter 1: Opening",
    why: (s) => `Customers send ${num(C(s).snapshot.incoming)} requests a second. More are about to arrive.`,
    hint: () => "This list shows what finishes the chapter.",
    target: () => ".campaign-requirements",
    nextLabel: "Got it",
    more: "Each requirement gets a tick as it is met. You do not need to break anything: preparing well and recovering from a slowdown both complete the Opening.",
    skipIf: grown,
  },
  {
    title: "Run and watch",
    why: "Time is paused. Let it pass and watch the incoming demand.",
    hint: run("Watch the readings…"),
    target: () => RUN,
    done: grown,
    skipIf: openingSettled,
  },
  {
    title: "Demand just grew",
    pause: true,
    why: `Customers now send ${num(Q.grownTraffic)} requests a second. Find the part that cannot keep up.`,
    hint: (s) => (s.selected === "db" ? "Read its demand and capacity." : "Click Database."),
    target: () => inspect("db"),
    done: (s) => s.selected === "db",
    skipIf: openingSettled,
  },
  {
    title: "Fix the bottleneck",
    why: (s) => `The Database handles ${num(C(s).dbCapacity)} operations a second but ${num(C(s).snapshot.db.demand)} arrive, so work piles up in its backlog.`,
    hint: () => "Press Upgrade database, then Confirm. Or press Run and see what happens.",
    target: () => action("Upgrade database"),
    done: (s) => dbFixStarted(s) || limitStarted(s),
    skipIf: openingSettled,
    more: "Upgrade database adds capacity after 3 game seconds and raises the weekly bill. Limit to 500 requests/s takes effect next second at no cost, but turns customers away, and rejected requests earn nothing. Add server does not help here: the App Server still has room. After 3 overloaded seconds a slowdown starts; recovering from it also completes the Opening.",
  },
  {
    title: "Finish without a slowdown",
    why: "Serve all 800 requests a second with healthy readings for 5 game seconds in a row, with no limit on.",
    hint: (s) => {
      const c = C(s);
      if (!dbFixStarted(s)) return "Press Upgrade database.";
      if (c.dbCapacity <= Q.dbCapacity) return run("Waiting for the upgrade to activate…")(s);
      if (c.limit !== null && !pending(s, "unlimit")) return "Press Remove traffic limit.";
      if (c.openingPrevention?.appInspectedStep == null) return "Click App Server to check it too.";
      return run("Counting healthy seconds…")(s);
    },
    target: (s) => {
      const c = C(s);
      if (!dbFixStarted(s)) return action("Upgrade database");
      if (c.dbCapacity > Q.dbCapacity && c.limit !== null && !pending(s, "unlimit")) return action("Remove traffic limit");
      if (c.dbCapacity > Q.dbCapacity && c.openingPrevention?.appInspectedStep == null) return inspect("app");
      return RUN;
    },
    done: (s) => !!C(s).openingPrevention?.outcome,
    skipIf: (s) => !preventionAvailable(C(s)),
    phases: BOTH,
    more: "The panel's Stable service counter shows the streak. An unhealthy second starts it again; pausing freezes it.",
  },
];

// ---- First slowdown --------------------------------------------------------------------------------------------

/** The overloaded part, as its inspection chip names it. */
const culprit = (s: Snapshot) => {
  const id = C(s).incident?.primaryComponent ?? "db";
  return id.startsWith("app") ? "app" : id;
};
const failedApp = (s: Snapshot) => C(s).incident?.kind === "application-failure";
const PART = { app: "App Server", db: "Database", cache: "Read Cache", gateway: "Network", monitoring: "Monitoring" } as Record<string, string>;
const fixStarted = (s: Snapshot) => pending(s, "upgrade-db", "add-app", "scale-up", "limit", "restore-app", "routing", "cache") || C(s).limit !== null;

const SLOWDOWN: Step[] = [
  {
    title: "A slowdown started",
    why: "Customers are waiting too long or seeing errors. The clock is paused so you can look.",
    hint: () => `To recover, meet these conditions for ${Q.stableSteps} game seconds in a row.`,
    target: () => ".incident-clock",
    phases: ["incident"],
  },
  {
    title: "Find the cause",
    why: (s) => (failedApp(s) ? "One App Server has failed and stopped answering." : `The ${PART[culprit(s)]} has more work than it can handle.`),
    hint: (s) => `Click ${PART[culprit(s)]}.`,
    target: (s) => inspect(culprit(s)),
    done: (s) => s.selected === culprit(s),
    phases: ["incident"],
    more: "Compare demand with capacity. The part where demand is higher is the bottleneck; its backlog grows every second.",
  },
  {
    title: "Pick a fix",
    why: (s) => failedApp(s)
      ? "Restoring the failed server is free and takes a few game seconds."
      : culprit(s) === "db"
        ? "More Database capacity removes the cause. A traffic limit is quicker and free, but turns customers away."
        : "More App Server capacity removes the cause. A traffic limit is quicker and free, but turns customers away.",
    hint: (s) => (failedApp(s) ? "Press Restore." : culprit(s) === "db" ? "Press Upgrade database, or Limit to 500 requests/s." : "Press Add server or Scale up, or limit traffic."),
    target: (s) => (failedApp(s) ? ".instance-choices" : culprit(s) === "db" ? action("Upgrade database") : '.campaign-panel .actions'),
    done: fixStarted,
    phases: ["incident"],
    more: "Buying capacity for a part that is not full does not help. Rejected requests earn nothing, but equipment and salaries are still paid.",
  },
  {
    title: "Run to recover",
    why: "Fixes take a few game seconds to activate. Pausing freezes the recovery count; an unhealthy second restarts it.",
    hint: (s) => (s.running ? `Recovery ${C(s).incident?.stableSteps ?? 0} / ${Q.stableSteps}…` : "Press Run."),
    target: () => RUN,
    done: (s) => s.game.phase !== "incident",
    phases: ["incident"],
  },
];

// ---- Chapter 2: Scaling & Routing ------------------------------------------------------------------------------

const dbReady = (s: Snapshot) => C(s).dbCapacity >= P.dbCapacity || pending(s, "upgrade-db") || !!C(s).scalingConsent || !!C(s).scaling?.consumed;
const scaledUp = (s: Snapshot) => C(s).apps.some(a => a.tier === "large") || pending(s, "scale-up");
const twoServers = (s: Snapshot) => C(s).apps.length >= 2 || pending(s, "add-app");
const routedAll = (s: Snapshot) => C(s).routing.targets.length >= Math.max(2, routableApps(C(s)).length) || pending(s, "routing");
const needsRouting = (s: Snapshot) => twoServers(s) && !scaledUp(s);

const SCALING: Step[] = [
  {
    title: "Chapter 2: Scaling & Routing",
    why: (s) => `The next wave brings ${num(P.traffic)} requests a second. Your App Servers handle ${num(routedCapacity(C(s)))} and your Database ${num(C(s).dbCapacity)} operations a second.`,
    hint: () => "Get the App Servers ready first, then the Database.",
    target: () => '[aria-label="Scaling controls"]',
    nextLabel: "Got it",
    skipIf: (s) => !!C(s).scaling?.consumed,
    more: "The wave waits until the system is calm and the Database has room for it. Everything you buy keeps costing money every week, so check the quote first.",
  },
  {
    title: "Remove the traffic limit",
    why: "The limit still turns customers away, and rejected requests earn nothing.",
    hint: () => "Press Remove traffic limit.",
    target: () => action("Remove traffic limit"),
    done: (s) => C(s).limit === null || pending(s, "unlimit"),
    skipIf: (s) => C(s).limit === null || pending(s, "unlimit"),
  },
  {
    title: "Add App Server capacity",
    why: (s) => `One App Server handles ${num(C(s).apps[0].capacity)} requests a second, less than ${num(P.traffic)}.`,
    hint: () => "Press Add server, or Scale up for one bigger server.",
    target: () => action("Add server"),
    done: (s) => twoServers(s) || scaledUp(s),
    skipIf: (s) => twoServers(s) || scaledUp(s) || routedCapacity(C(s)) >= P.traffic,
    more: `Add server installs a second App Server, which receives no traffic until a load balancer sends it some. Scale up makes one server bigger (${num(P.appCapacity)} requests a second) and needs no routing.`,
  },
  {
    title: "Deploy load balancing",
    why: "A new server gets no traffic by itself. A load balancer splits incoming requests between servers.",
    hint: () => "Press Deploy load balancing.",
    target: () => action("Deploy load balancing"),
    done: (s) => C(s).loadBalancer || pending(s, "deploy-lb"),
    skipIf: (s) => !needsRouting(s) || C(s).loadBalancer || pending(s, "deploy-lb"),
  },
  {
    title: "Send traffic to both servers",
    why: "Routing chooses which servers receive requests. Installed servers left out of it sit idle.",
    hint: (s) => (C(s).loadBalancer ? "Press All apps under Configure routing." : run("Waiting for the load balancer…")(s)),
    target: (s) => (C(s).loadBalancer ? ROUTING : RUN),
    enter: () => document.querySelector<HTMLDetailsElement>(ROUTING)?.setAttribute("open", ""),
    done: routedAll,
    skipIf: (s) => !needsRouting(s) || routedAll(s),
  },
  {
    title: "Make room in the Database",
    why: (s) => `The wave waits for ${num(P.dbCapacity)} operations a second of Database capacity (${num(C(s).dbCapacity)} now), then arrives ${P.observationSteps} game seconds after it has room. So do this last.`,
    hint: () => "Press Upgrade database, then Confirm.",
    target: () => action("Upgrade database"),
    done: dbReady,
    skipIf: dbReady,
    more: "If cash is short, Consider growth with current capacity lets the wave come anyway, at the risk of a slowdown.",
  },
  {
    title: "Run until the wave arrives",
    why: "Purchases activate as time passes. The wave arrives once the system is calm and ready.",
    hint: run("Watch the readings…"),
    target: () => RUN,
    done: (s) => !!C(s).scaling?.consumed,
    phases: BOTH,
  },
];

// ---- Chapter 3: Data Strategy ----------------------------------------------------------------------------------

const dataPlanned = (s: Snapshot) => !!C(s).readCache || pending(s, "cache") || C(s).dbCapacity >= D.dbCapacity || pending(s, "upgrade-db");

const DATA: Step[] = [
  {
    title: "Chapter 3: Data Strategy",
    why: `Soon ${num(D.traffic)} requests a second arrive, and each one reads or writes data in the Database.`,
    hint: (s) => (s.selected === "db" ? "Compare its demand with its capacity." : "Click Database."),
    target: () => inspect("db"),
    done: (s) => s.selected === "db",
    skipIf: dataPlanned,
  },
  {
    title: "Meet the Read Cache",
    why: "A cache keeps copies of data that is read often. A hit is answered by the cache; misses and writes still reach the Database.",
    hint: () => "Click Read Cache.",
    target: () => inspect("cache"),
    done: (s) => s.selected === "cache",
    skipIf: dataPlanned,
    more: "A new cache starts cold, holding nothing, and warms up as reads repeat, so its hit rate grows over a few game seconds. It cannot help writes: a write-heavy workload needs Database capacity instead.",
  },
  {
    title: "Choose a plan",
    why: (s) => {
      const d = C(s).dataStage;
      if (!d?.consumed) return "Read-heavy workloads suit a cache. Write-heavy ones need Database capacity.";
      return d.profile === "read-heavy" ? "Your workload is read-heavy: most requests read data, so a cache can take much of the load." : "Your workload is write-heavy: writes always reach the Database, so a cache helps less.";
    },
    hint: () => "Press Deploy Read Cache, or Upgrade database.",
    target: () => '[aria-label="Data strategy"]',
    done: dataPlanned,
    skipIf: dataPlanned,
    more: "Tune cache ceiling raises the best hit rate the cache can reach. Observe contrasting workload is optional: it shows the other kind of workload on the same company.",
  },
  {
    title: "Run and watch",
    why: "Watch Database demand fall as the cache warms up. When every requirement is met, Next in the chapter bar opens Chapter 4.",
    hint: run("Watch the cache hit rate and Database demand…"),
    target: () => RUN,
    done: (s) => campaignGuidance(s.game).spikesAvailable,
    phases: BOTH,
  },
];

// ---- Chapter 4: Traffic Spikes ---------------------------------------------------------------------------------

const pulsesOver = (s: Snapshot) => {
  const d = C(s).spikeStage;
  return !!d && C(s).step >= d.deadlines[3];
};
const spikePlanned = (s: Snapshot) => !!C(s).spikeStage?.researchSpent || C(s).apps.length > 2 || pending(s, "add-app");
const balancedTwo = (s: Snapshot) => C(s).loadBalancer && C(s).routing.mode === "balanced" && C(s).routing.targets.length >= 2;

const SPIKES: Step[] = [
  {
    title: "Chapter 4: Traffic Spikes",
    why: `Two short bursts of ${num(T.peak)} requests a second will hit, on top of the usual ${num(T.baseline)}.`,
    hint: () => "This shows when the next burst starts.",
    target: () => '[aria-label="Traffic spikes and autoscaling"]',
    nextLabel: "Got it",
    skipIf: pulsesOver,
  },
  {
    title: "Check the App Servers",
    why: (s) => `Your routed App Servers handle ${num(routedCapacity(C(s)))} requests a second.`,
    hint: (s) => (s.selected === "app" ? "Compare their capacity with the burst." : "Click App Server."),
    target: () => inspect("app"),
    done: (s) => s.selected === "app",
    skipIf: (s) => pulsesOver(s) || spikePlanned(s),
  },
  {
    title: "Plan for the bursts",
    why: "Add servers yourself, or let autoscaling add and remove them as traffic changes.",
    hint: () => "Press Unlock autoscaling, or Add server.",
    target: () => action("Unlock autoscaling"),
    done: spikePlanned,
    skipIf: (s) => pulsesOver(s) || spikePlanned(s),
    more: "Unlocking spends your research point; deploying is a separate purchase. Servers you add yourself keep costing money after the bursts end. Autoscaling adds a server when the servers are busier than 80% for 3 game seconds and removes one when they are calm.",
  },
  {
    title: "Deploy autoscaling",
    why: "Unlocking did not install it. Autoscaling needs a load balancer sending traffic to at least two servers.",
    hint: (s) => (balancedTwo(s) ? "Press Deploy autoscaling." : "Route traffic to at least two servers under Configure routing first."),
    target: (s) => (balancedTwo(s) ? action("Deploy autoscaling") : ROUTING),
    done: (s) => !!C(s).spikeStage?.controller || pending(s, "deploy-autoscaler"),
    skipIf: (s) => !C(s).spikeStage?.researchSpent || !!C(s).spikeStage?.controller || pending(s, "deploy-autoscaler") || pulsesOver(s),
  },
  {
    title: "Ride out the bursts",
    why: `Run through both bursts. Afterwards, ${Q.stableSteps} calm game seconds at normal traffic finish the chapter.`,
    hint: run("Watch demand and the servers…"),
    target: () => RUN,
    done: (s) => C(s).spikeStage?.completedStep != null,
    phases: BOTH,
  },
];

// ---- Chapter 5: Stay Online ------------------------------------------------------------------------------------

const TECH_TAB = '.view-tabs button[data-view="tech"]';
const PRIMARY = '[data-tour="primary"]';
/** Only Deploy Health Checks' own confirmation belongs to its step; another action's is the player's detour. */
const confirmingChecks = () => confirmingAction() === "Deploy Health Checks";
const fault = (s: Snapshot) => C(s).reliabilityStage?.fault ?? null;

const RELIABILITY: Step[] = [
  {
    title: "Chapter 5: Stay Online",
    why: "The test makes one App Server fail. Manual and automatic responses are available.",
    hint: () => "Explore the reliability controls before starting the test.",
    target: () => '[aria-label="Stay Online"]',
    nextLabel: "Got it",
    skipIf: (s) => !!fault(s),
  },
  {
    title: "Unlock Health Checks",
    why: "This chapter's capabilities are unlocked in Tech with research points.",
    hint: (s) => (s.view !== "tech" ? "Open Tech." : s.techFocus !== "health_checks" ? "Click Health Checks." : "Press Unlock Health Checks."),
    target: (s) =>
      s.view !== "tech" ? TECH_TAB : s.techFocus !== "health_checks" ? '.node[data-tech="health_checks"]' : `.tree-detail ${PRIMARY}`,
    inTech: true,
    done: (s) => !!C(s).reliabilityStage?.owned.includes("health_checks"),
    skipIf: (s) => !!fault(s) || !!C(s).reliabilityStage?.owned.includes("health_checks"),
  },
  {
    title: "Deploy Health Checks",
    why: "Unlocking does not deploy it.",
    hint: (s) =>
      s.view === "tech"
        ? "Close Tech."
        : confirmingChecks()
          ? "Press Confirm."
          : installPending(C(s))
            ? "Run until the current install finishes, then press Deploy Health Checks."
            : "Press Deploy Health Checks.",
    // The confirmation opens beside the panel; light it up rather than leaving it under the dim.
    target: (s) => (s.view === "tech" ? TECH_TAB : confirmingChecks() ? ".campaign-action-popover" : '[data-tour="deploy-checks"]'),
    inTech: true,
    done: (s) => C(s).reliabilityStage?.checksStep != null || pending(s, "health-checks"),
    skipIf: (s) => !!fault(s) || C(s).reliabilityStage?.checksStep != null || pending(s, "health-checks"),
    more: "Health Checks watch each server and notice when one fails. A spare server and Automatic Failover, also in Tech, can take over from a failed server.",
  },
  {
    title: "Start the test",
    why: "A server will fail at a moment you do not choose. Start the test when you are prepared.",
    hint: () => "Press Start reliability test.",
    target: () => GUIDANCE_ACTION,
    done: (s) => !!fault(s),
    skipIf: (s) => !!fault(s),
  },
  {
    title: "Run until a server fails",
    why: "Keep an eye on each server's health while time passes.",
    hint: run("Waiting for the failure…"),
    target: () => RUN,
    done: (s) => fault(s)?.startedStep != null,
    skipIf: (s) => fault(s)?.restoredStep != null,
    phases: BOTH,
  },
  {
    title: "A server failed",
    pause: true,
    why: (s) => `${appName(fault(s)?.targetId ?? "app-1")} stopped answering. Actual health is the truth; detected health is what monitoring has noticed so far.`,
    hint: (s) => `Press Restore ${appName(fault(s)?.targetId ?? "app-1")}.`,
    target: () => ".instance-choices",
    done: (s) => fault(s)?.restoredStep != null || pending(s, "restore-app"),
    skipIf: (s) => fault(s)?.restoredStep != null,
    phases: BOTH,
    more: "Restoring is free and takes 3 game seconds. Until then, the remaining servers carry the traffic; a spare with Automatic Failover takes over by itself.",
  },
  {
    title: "Finish the test",
    why: `After the server is restored, ${Q.stableSteps} stable game seconds complete the test. Then review what happened.`,
    hint: run("Counting stable seconds…"),
    target: () => RUN,
    done: (s) => C(s).reliabilityStage?.completedStep != null,
    phases: BOTH,
  },
];

// ---- Chapter 6: Grow the Company -------------------------------------------------------------------------------

const round = (s: Snapshot) => C(s).combinedStage?.currentRound ?? null;

const COMBINED: Step[] = [
  {
    title: "Chapter 6: Grow the Company",
    why: (s) => `Three growth waves test everything you have built. Reach ${num(C(s).combinedStage?.finalUserTarget ?? 0)} registered users.`,
    hint: () => "These requirements show what each wave needs.",
    target: () => ".campaign-requirements",
    nextLabel: "Got it",
    skipIf: (s) => (C(s).combinedStage?.completedRounds.length ?? 0) > 0,
  },
  {
    title: "Start a growth wave",
    why: "Each wave is announced first, so you can prepare before the pressure arrives.",
    hint: () => "Press Start next growth wave when you are ready.",
    target: () => GUIDANCE_ACTION,
    done: (s) => !!round(s),
    skipIf: (s) => !!round(s) || (C(s).combinedStage?.completedRounds.length ?? 0) > 0,
  },
  {
    title: "Handle the pressure",
    why: "Watch the readings and use what you built: servers, routing, the cache, autoscaling and Health Checks.",
    hint: run("Watch the readings…"),
    target: () => RUN,
    done: (s) => round(s)?.pressureEndedStep != null,
    skipIf: (s) => !round(s) || round(s)!.pressureEndedStep != null,
    phases: BOTH,
    more: "A promotion brings extra demand for a short time. It is optional, and rejected requests earn nothing.",
  },
  {
    title: "Settle and review",
    why: `Restore any failed server, then ${Q.stableSteps} calm game seconds at full demand end the wave. Review the outcome, then start the next one.`,
    hint: run("Counting stable seconds…"),
    target: () => RUN,
    nextLabel: "Got it",
    phases: BOTH,
  },
];

export const CHAPTER_MISSIONS = {
  opening: OPENING,
  scaling: SCALING,
  data: DATA,
  spikes: SPIKES,
  reliability: RELIABILITY,
  combined: COMBINED,
} satisfies Record<string, Step[]>;

/** One-time Guided Mode tips, shown the first time something happens instead of being taught up front. */
export const GUIDED_TIP_STEPS = {
  settlement: [{
    title: "Your first week settled",
    why: `Every ${Q.periodSteps} game seconds the week settles: pending revenue becomes cash, then equipment and salaries are paid.`,
    hint: () => "Keep enough cash for next week's bill before you buy.",
    target: () => ".stat-cash",
    nextLabel: "Got it",
  }],
  slowdown: SLOWDOWN,
  limit: [{
    title: "The traffic limit is still on",
    why: "Your system is calm again, but the limit still turns customers away. Rejected requests earn no revenue.",
    hint: () => "Press Remove traffic limit when your capacity is ready.",
    target: () => action("Remove traffic limit"),
    nextLabel: "Got it",
  }],
} satisfies Record<string, Step[]>;
