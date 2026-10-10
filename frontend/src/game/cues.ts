import type { Action, GameState } from "@/sim";
import type { Cue } from "./sfx";
import type { useGame } from "./store";

/*
 * Which sound effect, if any, a change in the game deserves. Read from the
 * store before and after each update, so the simulation never knows about
 * sound. Loading, importing or starting a game is not news: nothing plays for
 * the state it arrives in.
 */

type StoreState = ReturnType<typeof useGame.getState>;
export type CueState = Pick<StoreState, "game" | "generation" | "lastAction" | "toast" | "started" | "audio">;

/** The sound for each accepted decision; decisions that open or close a screen make none. */
const ACTION_CUE: Partial<Record<Action["type"], Cue>> = {
  add_server: "clunk",
  remove_server: "clunk",
  replace_host: "clunk",
  scale_up: "clunk",
  deploy_load_balancer: "clunk",
  deploy_cache: "clunk",
  hire_engineer: "hire",
  launch_promotion: "promo",
  deploy_release: "confirm",
  test_release: "confirm",
  start_tech: "confirm",
  start_db_upgrade: "confirm",
  start_debt_paydown: "confirm",
  set_traffic_limit: "confirm",
  set_routing: "confirm",
  tune_cache: "confirm",
  assign_engineers: "blip",
  cancel_task: "blip",
  incident_inspect: "blip",
  incident_action: "blip",
  incident_hint: "blip",
};

/** When several cues land at once, only the most important plays. */
export const CUE_PRIORITY: readonly Cue[] = [
  "won",
  "lost",
  "alarm",
  "relief",
  "review",
  "unlock",
  "success",
  "failure",
  "weekUp",
  "weekDown",
  "promo",
  "hire",
  "clunk",
  "confirm",
  "buzz",
  "blip",
  "preview",
];

/** Everything worth a sound between two store states, in no particular order. */
export function cuesBetween(prev: CueState, next: CueState): Cue[] {
  const cues: Cue[] = [];
  // The effects slider plays a sample at its new volume, as does turning sound back on.
  if (next.audio.effects !== prev.audio.effects || (prev.audio.muted && !next.audio.muted)) cues.push("preview");
  if (next.generation !== prev.generation || !prev.started || !next.started) return cues;

  const decided = next.lastAction;
  if (decided && decided !== prev.lastAction) {
    const cue = decided.ok ? ACTION_CUE[decided.type] : "buzz";
    if (cue) cues.push(cue);
  }
  if (next.toast && next.toast !== prev.toast && next.toast.kind === "error") cues.push("buzz");
  if (next.game !== prev.game) cues.push(...(next.game.campaign ? campaignCues(prev.game, next.game) : classicCues(prev.game, next.game)));
  return cues;
}

function campaignCues(a: GameState, b: GameState): Cue[] {
  const cues: Cue[] = [];
  const was = a.campaign;
  const now = b.campaign;
  if (!was || !now) return cues;
  if (a.phase !== "incident" && b.phase === "incident") cues.push("alarm");
  // A campaign incident only reaches review by recovering.
  if (a.phase === "incident" && b.phase === "review") cues.push("relief");
  if (a.phase !== "ended" && b.phase === "ended") cues.push("lost");
  const activated = (...types: string[]) =>
    now.actions.some((x) => types.includes(x.type) && x.activatedStep !== null && was.actions.some((y) => y.id === x.id && y.activatedStep === null));
  // An upgrade finishing: the database, a bigger application server, the load balancer or the read cache.
  if (activated("upgrade-db", "scale-up", "deploy-lb", "cache", "cache-tuning")) cues.push("unlock");
  if (activated("add-app")) cues.push("confirm");
  if (now.settlements.length > was.settlements.length) cues.push(now.settlements[now.settlements.length - 1].netCents >= 0 ? "weekUp" : "weekDown");
  return cues;
}

function classicCues(a: GameState, b: GameState): Cue[] {
  const cues: Cue[] = [];
  if (a.phase !== "incident" && b.phase === "incident") cues.push("alarm");
  if (a.phase !== "review" && b.phase === "review") {
    const outcome = b.postmortems[b.postmortems.length - 1]?.outcome;
    cues.push(a.phase === "incident" && (outcome === "resolved" || outcome === "mitigated") ? "relief" : "review");
  }
  if (!a.outcome && b.outcome) cues.push(b.outcome === "won" ? "won" : "lost");
  // States are cloned on every change, so compare the week rather than the report object.
  const report = b.lastReport;
  if (report && report.turn !== a.lastReport?.turn && a.phase === "management" && b.phase === "management") cues.push(report.net >= 0 ? "weekUp" : "weekDown");
  // Engineering finished: a release is built and waiting to ship.
  if (b.releases.some((r) => !r.needsFix && !a.releases.some((p) => p.id === r.id))) cues.push("unlock");
  const was = a.incident;
  const now = b.incident;
  if (was && now && was.id === now.id) {
    if (now.evidence.length > was.evidence.length) cues.push("blip");
    if (now.attempts.length > was.attempts.length) {
      const outcome = now.attempts[now.attempts.length - 1].outcome;
      cues.push(outcome === "fixed" || outcome === "mitigated" ? "success" : "failure");
    }
  }
  return cues;
}

/** The one cue to play from a batch: the most important. */
export function topCue(cues: readonly Cue[]): Cue | null {
  let best: Cue | null = null;
  for (const cue of cues) if (best === null || CUE_PRIORITY.indexOf(cue) < CUE_PRIORITY.indexOf(best)) best = cue;
  return best;
}

type Subscribe = (listener: (state: CueState, prev: CueState) => void) => () => void;

/**
 * Watch the store and play one cue per burst of updates. A single decision can
 * update the store several times in a row (a new state, then a notice), so
 * cues gather until the current task is done. If the game was replaced during
 * the burst, as by loading or importing, the whole burst is dropped.
 */
export function watchCues(subscribe: Subscribe, play: (cue: Cue) => void): () => void {
  let pending: Cue[] = [];
  let replaced = false;
  let queued = false;
  let stopped = false;
  const flush = () => {
    queued = false;
    const cue = topCue(pending);
    // A slider sample still plays after a load; nothing else does.
    const keep = replaced ? (pending.includes("preview") ? "preview" : null) : cue;
    pending = [];
    replaced = false;
    if (keep && !stopped) play(keep);
  };
  const unsubscribe = subscribe((state, prev) => {
    if (state.generation !== prev.generation) replaced = true;
    pending.push(...cuesBetween(prev, state));
    // A replacement with nothing pending still ends its burst, so it cannot swallow a later cue.
    if (!queued && (pending.length > 0 || replaced)) {
      queued = true;
      queueMicrotask(flush);
    }
  });
  return () => {
    stopped = true;
    unsubscribe();
  };
}
