import { drawBreakout, newGame, step, type Breakout, type BreakoutEvent, type BreakoutInput } from "./breakout";
import { sceneSound } from "./sceneSounds";
import { avatar, endBusyAt, held } from "./walk";

/*
 * The brick-breaker session while the avatar plays the red arcade cabinet (see breakout.ts for the game itself
 * and Office.tsx's ArcadeScreen, which drives and draws it): the live game, what the on-page panel's hold buttons
 * add to the keys, the best score kept in the browser, and the sounds, score pops and ending each event causes.
 * Pure wiring - nothing here changes the simulation or a save.
 */

/** What the panel hears: only when the score, lives, phase or best changes, never every frame. */
export interface ArcadeStatus {
  score: number;
  lives: number;
  phase: Breakout["phase"] | "idle";
  best: number;
}

/** The game under way, or null outside one; drawn by the cabinet's screen and the panel's canvas. */
export let arcadeGame: Breakout | null = null;

/** What the touch hold buttons add to the keys held: the ArcadePanel sets these while pressed. */
export const arcadeInput = { left: false, right: false };

/** When the ball last hit the paddle or a brick, for the avatar's little hop of a bob. */
export const arcadeHit = { at: -Infinity };

const BEST_KEY = "nn.arcade.best.v1";
/** The best score seen this visit, so a storage failure mid-session does not lose it. */
let bestMemory = 0;

function readBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? 0 : Number(raw);
    bestMemory = Number.isFinite(n) && n > bestMemory ? n : bestMemory;
  } catch {
    /* storage unavailable: memory stands */
  }
  return bestMemory;
}

function writeBest(score: number): void {
  if (score <= bestMemory) return;
  bestMemory = score;
  try {
    window.localStorage.setItem(BEST_KEY, String(bestMemory));
  } catch {
    /* memory still holds it */
  }
}

const statusListeners = new Set<(s: ArcadeStatus) => void>();
const eventListeners = new Set<(e: BreakoutEvent) => void>();

/** Hear the score, lives, phase and best, only as they change. */
export function onArcade(listener: (s: ArcadeStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/** Hear the game's bounces, brick hits and endings as they happen, for sounds and score pops. */
export function onArcadeEvent(listener: (e: BreakoutEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

let shown: ArcadeStatus = { score: 0, lives: 3, phase: "idle", best: 0 };
let pendingServe = false;
/** When the avatar's busy with the arcade began, or null while the cabinet idles. */
let sessionAt: number | null = null;
/** The panel's little canvas, bound while it is mounted, painted the same frame as the cabinet's screen. */
let panelCtx: CanvasRenderingContext2D | null = null;

/** Give the panel's canvas to the session (null on unmount), to be painted with each stepped frame. */
export function bindArcadeCanvas(el: HTMLCanvasElement | null): void {
  panelCtx = el ? el.getContext("2d") : null;
  if (panelCtx) panelCtx.imageSmoothingEnabled = false;
}

function announce(): void {
  const next: ArcadeStatus = arcadeGame
    ? { score: arcadeGame.score, lives: arcadeGame.lives, phase: arcadeGame.phase, best: readBest() }
    : { score: 0, lives: 3, phase: "idle", best: readBest() };
  if (next.score === shown.score && next.lives === shown.lives && next.phase === shown.phase && next.best === shown.best) return;
  shown = next;
  for (const l of statusListeners) l(next);
}

/** The game's status as last announced, for a panel mounting mid-game. */
export const arcadeStatus = (): ArcadeStatus => shown;

/** Begin a game for the avatar's busy with the arcade: a fresh field and the browser's best to beat. */
export function startArcade(now: number): void {
  arcadeGame = newGame();
  sessionAt = now;
  pendingServe = false;
  arcadeHit.at = -Infinity;
  readBest();
  announce();
}

/** The game is done with: the field idles back into its attract mode. */
export function stopArcade(): void {
  if (!arcadeGame && sessionAt === null) return;
  arcadeGame = null;
  sessionAt = null;
  pendingServe = false;
  arcadeInput.left = arcadeInput.right = false;
  announce();
}

/** Ask for the ball to be served, taken up by the next frame's step. */
export function serveArcade(): void {
  if (arcadeGame?.phase === "serve") pendingServe = true;
}

/**
 * One frame of the session: read the held keys and the panel's buttons into the game, then act on its events -
 * a blip and a score pop for a brick, a pop for a lost ball, a dance and stars for a win, and the busy ending
 * shortly after the game does.
 */
export function stepArcade(dt: number, now: number): void {
  const g = arcadeGame;
  if (!g) return;
  const input: BreakoutInput = {
    left: held.has("KeyA") || held.has("ArrowLeft") || arcadeInput.left,
    right: held.has("KeyD") || held.has("ArrowRight") || arcadeInput.right,
    serve: pendingServe,
  };
  pendingServe = false;
  const { events } = step(g, input, dt);
  for (const e of events) {
    switch (e.kind) {
      case "paddle":
        arcadeHit.at = now;
        sceneSound("blip", 0.25);
        break;
      case "brick":
        arcadeHit.at = now;
        sceneSound("blip", 0.25);
        writeBest(g.score);
        break;
      case "lost":
        sceneSound("pop", 0.3);
        break;
      case "won":
        if (avatar.busy) {
          avatar.busy.clip = "dance";
          endBusyAt(now + 3);
        }
        break;
      case "over":
        endBusyAt(now + 2.5);
        break;
    }
    for (const l of eventListeners) l(e);
  }
  announce();
  // The panel's canvas shows the same frame the cabinet's screen does (see Office.tsx's ArcadeScreen).
  if (panelCtx) drawBreakout(panelCtx, g, now);
}
