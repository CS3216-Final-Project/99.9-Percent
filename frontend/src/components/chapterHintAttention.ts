import { useSyncExternalStore } from "react";
import { campaignNextStep } from "@/game/campaignNextStep";
import { useGame } from "@/game/store";
import type { GameState } from "@/sim";

// Published Zustand game snapshots are immutable. Share the read-only projection
// across UI subscribers so checking an engine-accepted decision clones only once.
// The underlying campaignNextStep getter stays uncached for mutable test fixtures.
const views = new WeakMap<GameState, { paused?: ReturnType<typeof campaignNextStep>; running?: ReturnType<typeof campaignNextStep> }>();
export function campaignNextView(game: GameState, running = false) {
  let entry = views.get(game);
  if (!entry) { entry = {}; views.set(game, entry); }
  const key = running ? "running" : "paused";
  return entry[key] ??= campaignNextStep(game, running);
}

// Transient attention ownership, like the shared confirmation observer. Never saved.
let target: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
// Keep a stage's dismissal when its entry button moves between panels or remounts.
// This is visit-only UI memory; saved company state is untouched.
let offered: ReadonlySet<string> = new Set();
export function rememberHintOffer(key: string) {
  if (offered.has(key)) return;
  offered = new Set([...offered, key]);
  listeners.forEach(fn => fn());
}
export function useHintOffers() {
  return useSyncExternalStore(subscribe, () => offered);
}
const stop = useGame.subscribe((state, previous) => {
  if (state.generation !== previous.generation || state.game.campaign?.runId !== previous.game.campaign?.runId) {
    offered = new Set();
    listeners.forEach(fn => fn());
  }
});
if (import.meta.hot) import.meta.hot.dispose(stop);
export function setTrafficHint(value: string | null) {
  if (target !== value) { target = value; listeners.forEach(fn => fn()); }
}
export function useTrafficHint() {
  const value = useSyncExternalStore(subscribe, () => target);
  const { game, generation } = useGame();
  return value !== null && value === `${generation}:${campaignNextView(game).key}`;
}
