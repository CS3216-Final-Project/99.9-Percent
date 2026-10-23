import type { Action, GameState } from "@/sim";
import type { Campaign } from "@/sim/campaignTypes";
import { applyCampaignInput } from "@/sim/step";
import { accruedCharges, operatingCharges } from "@/sim/settlement";
import { openingTuning } from "@/sim/launchWeek";
import { APPLICATION_SCALING as P } from "@/sim/scenarios/applicationScaling";
import { DATA_STRATEGY as D } from "@/sim/scenarios/dataStrategy";
import { APPLICATION_RELIABILITY as R } from "@/sim/scenarios/applicationReliability";
import { TRAFFIC_SPIKES as T } from "@/sim/scenarios/trafficSpikes";

export const totalCharges = (costs: ReturnType<typeof operatingCharges>) => Object.values(costs).reduce((a,b)=>a+b,0);
export const financeMoney = (cents:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:cents%100===0 ? 0 : 2,maximumFractionDigits:2}).format(cents/100);
export const COST_NAMES = {app:"App Servers", db:"Database", salary:"Salaries", lb:"Load balancing", cache:"Read Cache", controller:"Autoscaling controller", checks:"Health Checks", failover:"Automatic Failover"};

/** No future traffic, failures or autoscaler decisions are simulated to manufacture a forecast. */
export function financeForecast(c: Campaign, cashCents = c.cashCents, extraUpkeepCents = 0) {
    const last = c.settlements.at(-1);
    if (!last || c.pending.length || c.cashCents <= 0 || c.scorecard) return null;
    const costs = totalCharges(operatingCharges(c)) + extraUpkeepCents;
    const burnCents = costs - last.revenueCents;
    // A full-period budget estimate only: settlement boundaries, demand and future decisions can change it.
    return { revenueCents:last.revenueCents, costsCents:costs, burnCents,
        runwayPeriods:burnCents > 0 ? Math.max(0,cashCents)/burnCents : null };
}

/** Preview through the authoritative dispatcher; its cloned output and trace never enter the live store. */
export function previewCampaignAction(game: GameState, action: Action) {
    const {state,result} = applyCampaignInput(game, action);
    if (!result.ok) return {ok:false as const, reason:result.message};
    const c = game.campaign!, after = state.campaign!;
    const scheduled = after.pending.find(p=>!c.pending.some(old=>old.id===p.id));
    const current = operatingCharges(c);
    const tuning = openingTuning(c);
    const upkeepDelta = !scheduled ? 0 : scheduled.type === "add-app" || scheduled.type === "create-spare" ? tuning.appWeeklyCents
        : scheduled.type === "scale-up" ? P.appWeeklyCents-tuning.appWeeklyCents
        : scheduled.type === "upgrade-db" ? (scheduled.capacityAfter === D.dbCapacity ? D.dbWeeklyCents : scheduled.capacityAfter !== undefined && scheduled.capacityAfter >= P.dbCapacity ? P.dbWeeklyCents : tuning.upgradedDbWeeklyCents)-current.db
        : scheduled.type === "deploy-lb" ? P.lbWeeklyCents
        : scheduled.type === "cache" ? D.cacheWeeklyCents
        : scheduled.type === "deploy-autoscaler" ? T.controllerWeeklyCents
        : scheduled.type === "health-checks" ? R.checksWeeklyCents
        : scheduled.type === "failover" ? R.failoverWeeklyCents : 0;
    const spentCents = c.cashCents-after.cashCents;
    const forecast = financeForecast(c,after.cashCents,upkeepDelta);
    const accrued = totalCharges(accruedCharges(c));
    const warning = forecast && forecast.burnCents > 0
        ? `Recent period revenue is below upkeep after activation.${forecast.runwayPeriods! <= 3 ? " Remaining cash covers less than three full operating periods at that rate." : " Cash may decline if that rate continues."}`
        : after.cashCents <= accrued ? "Remaining cash does not cover already accrued expenses. Pending revenue settles with expenses; future revenue is uncertain."
        : null;
    return {ok:true as const, spentCents, cashAfterCents:after.cashCents, upkeepDelta, delay:scheduled ? scheduled.activationStep-c.step : 0, warning, forecast};
}
