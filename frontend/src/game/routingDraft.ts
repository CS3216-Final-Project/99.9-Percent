import type { Campaign } from "@/sim/campaignTypes";
import { applyCampaignInput, routableApps } from "@/sim/step";
import type { Action, GameState } from "@/sim";

/**
 * The servers the player ticked or unticked in an open Network window, by id: true to send it traffic, false to stop.
 * Only the picks are kept, never a copy of the routing, so a failover or another change landing while the window is
 * open stays as it is and the picks apply on top of it.
 */
export type RoutingDraft = Readonly<Record<string, boolean>>;

const byServer = (ids: string[]) => ids.sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));

/** The live routing with the player's picks applied; a pick for a server that can no longer serve is ignored. */
export function draftedTargets(c: Campaign, draft: RoutingDraft | null): string[] {
  if (!draft) return c.routing.targets;
  const routable = new Set(routableApps(c).map(a => a.id)), targets = new Set(c.routing.targets);
  for (const [id, on] of Object.entries(draft)) {
    if (!on) targets.delete(id);
    else if (routable.has(id)) targets.add(id);
  }
  return byServer([...targets]);
}

/** Flips one server in the draft; a pick that brings it back to the live routing is dropped, so the draft can empty. */
export function toggleDraft(c: Campaign, draft: RoutingDraft | null, id: string): RoutingDraft | null {
  const on = !draftedTargets(c, draft).includes(id), next = { ...draft };
  if (on === c.routing.targets.includes(id)) delete next[id];
  else next[id] = on;
  return Object.keys(next).length ? next : null;
}

/** The routing change closing the window would queue, or null when the picks leave the routing as it is. */
export function draftAction(c: Campaign, draft: RoutingDraft | null): Extract<Action, { type: "set_routing" }> | null {
  const targets = draftedTargets(c, draft);
  if (!draft || !targets.length || targets.join(",") === c.routing.targets.join(",")) return null;
  return { type: "set_routing", mode: "balanced", targets };
}

/** Why the engine would refuse the drafted change right now, in the player's words, or null when it would accept it. */
export function draftRefusal(game: GameState, action: Action): string | null {
  const c = game.campaign!;
  // The autoscaler's retirements and a failover's promotion change the routing too; a change sent over a promotion would
  // cancel the failover.
  if (c.pending.some(a => a.type === "routing" || a.type === "retire-app" || a.type === "promote-spare"))
    return "Another routing change is pending, so your traffic picks were not sent.";
  return applyCampaignInput(game, action).result.ok ? null : "The Network window closed before your traffic picks could be sent.";
}
