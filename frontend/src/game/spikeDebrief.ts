import { serverName } from "@/sim";
import type { Campaign, SpikePulse } from "@/sim/campaignTypes";
import { gradedSpikes, pendingSpikeDebrief, spikePeak } from "@/sim/autoscaling";
import { databaseUpgrade } from "@/sim/step";
import { servedShare } from "./chapter4Guidance";

const num = (n: number) => n.toLocaleString("en-US");
export type SpikeCause = "limit" | "database" | "autoscaler-delay" | "uneven-servers" | "servers";
export interface SpikeDebrief {
  pulse: number; share: string; incoming: number; served: number; rejected: number; failed: number;
  cause: SpikeCause; finding: string; fix: string;
  next: { pulse: number; startStep: number; inSeconds: number };
}

/** Readings retained from one spike's window. */
const readingsOf = (c: Campaign, p: SpikePulse) => c.recent.filter(m => m.step >= p.startStep && m.step < p.endStep);

/** The database relief the company can still buy, cheapest first; only purchases the game would accept are named. */
function databaseFix(c: Campaign): string {
  const upgrade = databaseUpgrade(c);
  const options = [
    !c.readCache && "deploy the read cache so it answers repeated reads",
    c.readCache && !c.readCache.tuned && "tune the read cache so it answers more reads",
    upgrade && `upgrade the database to ${num(upgrade.capacity)} ops/s`,
  ].filter((x): x is string => !!x);
  if (!options.length) return "More app servers send it even more work. The database and read cache are already at their best, so let the cache warm up at baseline demand before the next spike.";
  const relief = options.join(", or ");
  return `More app servers send it even more work. ${relief[0].toUpperCase()}${relief.slice(1)}.`;
}

/**
 * Why a graded spike missed its target, from what was recorded during it: a limit's rejections first, since they
 * hide every other constraint, then a database that received more than it could do, then the application tier.
 */
function diagnose(c: Campaign, p: SpikePulse): Pick<SpikeDebrief, "cause" | "finding" | "fix"> {
  const d = c.spikeStage!, peak = num(spikePeak(d)), unserved = p.incoming - p.served;
  if (p.rejected * 2 >= unserved) return { cause: "limit",
    finding: `Your traffic limit rejected ${num(p.rejected)} requests. A rejected request counts as unserved, even though the limit kept the rest healthy.`,
    fix: `Add capacity that fits ${peak} req/s, then remove the traffic limit before the next spike.` };
  // Every request a server completes becomes database work, so a database overloaded as often as the servers caps the spike.
  if (p.dbOverloadSteps > 0 && p.dbOverloadSteps >= p.appOverloadSteps) return { cause: "database",
    finding: `The database received more work than its ${num(c.dbCapacity)} ops/s in ${p.dbOverloadSteps} of the spike's ${p.endStep - p.startStep} seconds.`,
    fix: databaseFix(c) };
  const readings = readingsOf(c, p);
  const decided = c.trace.find(t => t.step >= p.startStep && t.step < p.endStep && (t.type === "autoscale-scale-out-decided" || t.type === "autoscale-scale-up-decided"));
  if (decided) {
    // A new server serves once routing includes it; an upgraded one as soon as its upgrade finishes.
    const joined = c.trace.find(t => t.id > decided.id && t.type === "action-activated" && t.data.source === "autoscaler" &&
      (decided.type === "autoscale-scale-out-decided" ? t.data.routingAfter !== t.data.routingBefore : t.data.targetId === decided.data.targetId));
    const app = typeof decided.data.targetId === "string" ? serverName(decided.data.targetId) : "a server";
    return { cause: "autoscaler-delay",
      finding: `Autoscaling reacted ${decided.step - p.startStep} seconds into the spike and ${joined ? `${app} began serving ${joined.step - p.startStep} seconds in` : `${app} was still starting when it ended`}. Requests failed while the extra capacity was on its way.`,
      fix: "Autoscaling needs a few seconds of high load before it acts, then time to install. Start the spike with more headroom, for example one more server added by hand, and let autoscaling cover the rest." };
  }
  // Balanced routing gives every server the same share, so a smaller server overloads while larger ones have room.
  const uneven = readings.flatMap(m => {
    const routed = m.instances?.filter(x => x.routed) ?? [];
    return routed.some(x => x.tier !== "base" && x.demand <= x.capacity) ? routed.filter(x => x.tier === "base" && x.demand > x.capacity) : [];
  })[0];
  if (uneven) return { cause: "uneven-servers",
    finding: `Balanced routing sends every server the same share, so ${serverName(uneven.id)} (${num(uneven.capacity)} req/s) overloaded while the larger servers had room.`,
    fix: `Scale up ${serverName(uneven.id)} so every routed server can carry its share of ${peak} req/s.` };
  const start = readings[0]?.app.capacity ?? 0, most = Math.max(start, ...readings.map(m => m.app.capacity));
  // Capacity that joined part-way through only served the rest of the spike.
  if (most > start) return { cause: "servers",
    finding: `Your routed servers handled ${num(start)} req/s when the spike began and reached ${num(most)} req/s only ${readings.find(m => m.app.capacity === most)!.step - p.startStep} seconds in. The spike brought ${peak} req/s.`,
    fix: most >= spikePeak(d) ? "That capacity would have been enough. Add and route it before the spike starts, or deploy autoscaling so capacity follows demand."
      : "Add or scale up servers and route traffic to them before the spike starts, or deploy autoscaling so capacity follows demand." };
  return { cause: "servers",
    finding: `Your routed servers can handle ${num(start)} req/s, but the spike brought ${peak} req/s.`,
    fix: "Add or scale up servers and route traffic to them, or deploy autoscaling so capacity follows demand." };
}

/** The failed spike test waiting for the player, explained in terms of what to change before the next one. */
export function spikeDebrief(c: Campaign): SpikeDebrief | null {
  const p = pendingSpikeDebrief(c);
  if (!p) return null;
  const startStep = c.spikeStage!.deadlines.at(-2)!;
  return { pulse: p.pulse, share: servedShare(p), incoming: p.incoming, served: p.served, rejected: p.rejected, failed: p.failed,
    ...diagnose(c, p), next: { pulse: p.pulse + 1, startStep, inSeconds: startStep - c.step } };
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
