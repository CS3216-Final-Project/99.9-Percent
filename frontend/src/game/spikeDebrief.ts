import { applyAction, serverName, type Action, type GameState } from "@/sim";
import type { Campaign, SpikePulse } from "@/sim/campaignTypes";
import { gradedSpikes, pendingSpikeDebrief, spikePeak } from "@/sim/autoscaling";
import { databaseUpgrade, routableApps } from "@/sim/step";
import { previewCampaignAction } from "./campaignFinance";
import { servedShare } from "./chapter4Guidance";

const num = (n: number) => n.toLocaleString("en-US");
export type SpikeCause = "limit" | "database" | "autoscaler-delay" | "uneven-servers" | "servers";
export interface SpikeDebrief {
  pulse: number; share: string; incoming: number; served: number; rejected: number; failed: number;
  /** Admitted requests still waiting in a queue when the spike ended; they count as unserved too. */
  queued: number;
  cause: SpikeCause; finding: string; fix: string;
  next: { pulse: number; startStep: number; inSeconds: number };
}

/** Readings retained from one spike's window. */
const readingsOf = (c: Campaign, p: SpikePulse) => c.recent.filter(m => m.step >= p.startStep && m.step < p.endStep);
const sentence = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;
const anyOf = (xs: string[]) => xs.length < 3 ? xs.join(" or ") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`;
const NO_CASH = "keep running at baseline demand to earn cash before the next spike";
/** A change the advice may name: offered only when the game would accept it now, cash included. */
interface Option { text: string; action: Action }
const offered = (game: GameState, options: (Option | false | null | undefined)[]) =>
  options.filter((o): o is Option => !!o && previewCampaignAction(game, o.action).ok).map(o => o.text);

/** Whether autoscaling could be deployed now, unlocking it first with the chapter's free research point if needed. */
function deployable(game: GameState): boolean {
  if (game.campaign!.spikeStage!.researchSpent) return previewCampaignAction(game, { type: "deploy_autoscaler" }).ok;
  const unlocked = applyAction(game, { type: "unlock_autoscaling" });
  return unlocked.ok && previewCampaignAction(unlocked.state, { type: "deploy_autoscaler" }).ok;
}
/**
 * Server changes that add routed capacity, the cheapest first: routing servers already installed, upgrading small
 * ones, adding one, then autoscaling. `manual` leaves autoscaling out.
 */
function capacityOptions(game: GameState, manual = false): string[] {
  const c = game.campaign!, d = c.spikeStage!, a = d.controller;
  const routable = routableApps(c).filter(x => x.health !== "failed"), idle = routable.filter(x => !c.routing.targets.includes(x.id));
  const small = routable.find(x => x.tier === "base");
  return offered(game, [
    idle.length > 0 && { text: `route ${anyOf(idle.map(x => serverName(x.id))).replace(" or ", " and ")} so ${idle.length > 1 ? "they share" : "it shares"} the spike`,
      action: { type: "set_routing", mode: "balanced", targets: routable.map(x => x.id) } },
    !!small && { text: `scale up ${serverName(small.id)}`, action: { type: "scale_up", appId: small.id } },
    { text: "add a server and route it", action: { type: "add_server" } },
    !manual && a && !a.enabled && { text: "turn autoscaling back on", action: { type: "set_autoscaling", enabled: true } },
    !manual && !a && deployable(game) && { text: "deploy autoscaling so capacity follows demand", action: d.researchSpent ? { type: "deploy_autoscaler" } : { type: "unlock_autoscaling" } },
  ]);
}
/** Capacity advice that ends the sentence; when nothing can be bought it says so rather than naming a purchase. */
function capacityFix(game: GameState, when: string): string {
  const options = capacityOptions(game);
  return options.length ? `${sentence(anyOf(options))} ${when}.` : `The company cannot afford more server capacity yet, so ${NO_CASH}.`;
}

/** The database relief the company can still buy, cheapest first; only purchases the game would accept are named. */
function databaseFix(game: GameState): string {
  const c = game.campaign!, upgrade = databaseUpgrade(c);
  const candidates: (Option | false | null)[] = [
    !c.readCache && { text: "deploy the read cache so it answers repeated reads", action: { type: "deploy_cache" } },
    !!c.readCache && !c.readCache.tuned && { text: "tune the read cache so it answers more reads", action: { type: "tune_cache" } },
    !!upgrade && { text: `upgrade the database to ${num(upgrade.capacity)} ops/s`, action: { type: "start_db_upgrade" } },
  ];
  const options = offered(game, candidates);
  if (options.length) return `More app servers send it even more work. ${sentence(options.join(", or "))}.`;
  if (candidates.some(Boolean)) return `More app servers send it even more work. The read cache or database upgrade it needs costs more than the company can spend now, so ${NO_CASH}.`;
  return "More app servers send it even more work. The database and read cache are already at their best, so let the cache warm up at baseline demand before the next spike.";
}

/**
 * Why a graded spike missed its target, from what was recorded during it: a limit's rejections first, since they
 * hide every other constraint, then a database that received more than it could do, then the application tier.
 * Advice names only changes the company can make now.
 */
function diagnose(game: GameState, p: SpikePulse): Pick<SpikeDebrief, "cause" | "finding" | "fix"> {
  const c = game.campaign!, d = c.spikeStage!, peak = spikePeak(d), unserved = p.incoming - p.served;
  if (p.rejected * 2 >= unserved) {
    const routed = routableApps(c).filter(x => x.health !== "failed" && c.routing.targets.includes(x.id)).reduce((n, x) => n + x.capacity, 0);
    const options = capacityOptions(game);
    return { cause: "limit",
      finding: `Your traffic limit rejected ${num(p.rejected)} requests. A rejected request counts as unserved, even though the limit kept the rest healthy.`,
      fix: routed >= peak ? `Your routed servers already handle ${num(routed)} req/s, enough for ${num(peak)} req/s. Remove the traffic limit before the next spike.`
        : `Your routed servers handle ${num(routed)} req/s, short of ${num(peak)} req/s. ${options.length ? `${sentence(anyOf(options))}, then remove the traffic limit before the next spike.` : `The company cannot afford more server capacity yet, so ${NO_CASH}, then remove the traffic limit.`}` };
  }
  // Every request a server completes becomes database work, so a database overloaded as often as the servers caps the spike.
  if (p.dbOverloadSteps > 0 && p.dbOverloadSteps >= p.appOverloadSteps) return { cause: "database",
    finding: `The database received more work than its ${num(c.dbCapacity)} ops/s in ${p.dbOverloadSteps} of the spike's ${p.endStep - p.startStep} seconds.`,
    fix: databaseFix(game) };
  const readings = readingsOf(c, p);
  const decided = c.trace.find(t => t.step >= p.startStep && t.step < p.endStep && (t.type === "autoscale-scale-out-decided" || t.type === "autoscale-scale-up-decided"));
  if (decided) {
    // A new server serves once routing includes it; an upgraded one as soon as its upgrade finishes.
    const joined = c.trace.find(t => t.id > decided.id && t.type === "action-activated" && t.data.source === "autoscaler" &&
      (decided.type === "autoscale-scale-out-decided" ? t.data.routingAfter !== t.data.routingBefore : t.data.targetId === decided.data.targetId));
    const app = typeof decided.data.targetId === "string" ? serverName(decided.data.targetId) : "a server";
    const manual = capacityOptions(game, true);
    return { cause: "autoscaler-delay",
      finding: `Autoscaling reacted ${decided.step - p.startStep} seconds into the spike and ${joined ? `${app} began serving ${joined.step - p.startStep} seconds in` : `${app} was still starting when it ended`}. Requests failed while the extra capacity was on its way.`,
      fix: `Autoscaling needs a few seconds of high load before it acts, then time to install. ${manual.length ? `Start the spike with more headroom: ${anyOf(manual)}, and let autoscaling cover the rest.` : `Start the spike with more headroom once the company can afford it; until then, ${NO_CASH}.`}` };
  }
  // Balanced routing gives every server the same share, so a smaller server overloads while larger ones have room.
  const uneven = readings.flatMap(m => {
    const routed = m.instances?.filter(x => x.routed) ?? [];
    return routed.some(x => x.tier !== "base" && x.demand <= x.capacity) ? routed.filter(x => x.tier === "base" && x.demand > x.capacity) : [];
  })[0];
  if (uneven) return { cause: "uneven-servers",
    finding: `Balanced routing sends every server the same share, so ${serverName(uneven.id)} (${num(uneven.capacity)} req/s) overloaded while the larger servers had room.`,
    fix: previewCampaignAction(game, { type: "scale_up", appId: uneven.id }).ok ? `Scale up ${serverName(uneven.id)} so every routed server can carry its share of ${num(peak)} req/s.`
      : capacityFix(game, "before the next spike") };
  const start = readings[0]?.app.capacity ?? 0, most = Math.max(start, ...readings.map(m => m.app.capacity));
  // Capacity that joined part-way through only served the rest of the spike.
  if (most > start) return { cause: "servers",
    finding: `Your routed servers handled ${num(start)} req/s when the spike began and reached ${num(most)} req/s only ${readings.find(m => m.app.capacity === most)!.step - p.startStep} seconds in. The spike brought ${num(peak)} req/s.`,
    fix: most >= peak ? "That capacity would have been enough. Keep it routed before the next spike starts." : capacityFix(game, "before the spike starts") };
  return { cause: "servers",
    finding: `Your routed servers can handle ${num(start)} req/s, but the spike brought ${num(peak)} req/s.`,
    fix: capacityFix(game, "before the next spike") };
}

/** The failed spike test waiting for the player, explained in terms of what to change before the next one. */
export function spikeDebrief(game: GameState): SpikeDebrief | null {
  const c = game.campaign, p = c && pendingSpikeDebrief(c);
  if (!c || !p) return null;
  const startStep = c.spikeStage!.deadlines.at(-2)!;
  return { pulse: p.pulse, share: servedShare(p), incoming: p.incoming, served: p.served, rejected: p.rejected, failed: p.failed,
    queued: Math.max(0, p.incoming - p.served - p.rejected - p.failed),
    ...diagnose(game, p), next: { pulse: p.pulse + 1, startStep, inSeconds: startStep - c.step } };
}

export interface SpikeScore {
  pulse: number; share: string; attempts: number;
  setupCents: number; idleShare: string | null; manual: number; automatic: number;
}
/**
 * The cost side of a passed test, scored but never required: what the chapter's changes cost to set up, how much
 * routed capacity sat idle in the calm seconds outside the spikes, and who made the changes.
 */
export function spikeScore(c: Campaign): SpikeScore | null {
  const d = c.spikeStage;
  if (!d || !gradedSpikes(d) || d.completedStep === null) return null;
  const passed = d.pulses!.find(p => p.result === "passed")!;
  const entered = c.trace.find(t => t.type === "spike-stage-entered"), completed = c.trace.find(t => t.type === "traffic-spike-stage-completed");
  const { capacity, idle } = d.calm!;
  return { pulse: passed.pulse, share: servedShare(passed), attempts: d.pulses!.filter(p => p.graded).length,
    setupCents: Number(completed?.data.investedCents ?? c.investedCents) - Number(entered?.data.investedCents ?? 0),
    idleShare: capacity ? `${Math.round(idle * 100 / capacity)}%` : null,
    manual: Number(completed?.data.manualRequests ?? 0), automatic: Number(completed?.data.automaticRequests ?? 0) };
}
