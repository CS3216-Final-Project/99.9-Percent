import type { ReactNode } from "react";
import { financeMoney as money, type previewCampaignAction } from "@/game/campaignFinance";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { Icon, type IconName } from "./icons";

type Preview = Extract<ReturnType<typeof previewCampaignAction>,{ok:true}>;
/** Spending is red, what remains green (amber when a warning applies), recurring costs amber and timing blue. */
export type TileTone = "cost" | "ok" | "warn" | "info";

/** One figure of a purchase quote: an icon and colour per idea, so cost, cash left and upkeep are told apart at a glance. */
export function PurchaseTile({icon,label,value,sub,tone}:{icon:IconName;label:string;value:ReactNode;sub?:string;tone:TileTone}) {
    return <div className="purchase-tile" data-tone={tone}><dt><Icon name={icon} size={14} />{label}</dt><dd>{value}{sub && <> <span className="purchase-tile-sub">{sub}</span></>}</dd></div>;
}

/** The same authoritative quote, kept short enough to review beside the machine. */
export function PurchaseFinance({preview:p}:{preview:Preview}) {
    return <dl className="purchase-tiles">
        <PurchaseTile icon="cost" label="Setup" value={money(p.spentCents)} tone={p.spentCents>0?"cost":"ok"} />
        <PurchaseTile icon="cashLeft" label="Cash after" value={money(p.cashAfterCents)} tone={p.warning?"warn":"ok"} />
        <PurchaseTile icon="upkeep" label="Upkeep" value={p.upkeepDelta===0 ? "None" : `${p.upkeepDelta>0?"+":""}${money(p.upkeepDelta)}`}
            sub={p.upkeepDelta===0 ? undefined : `per ${Q.periodSteps*Q.stepSeconds} game seconds`} tone={p.upkeepDelta>0?"warn":"ok"} />
        <PurchaseTile icon="latency" label="Ready in" value={`${p.delay} game ${p.delay===1?"second":"seconds"}`} tone="info" />
    </dl>;
}

/** Outside the optional scrolling details, immediately before Confirm/Cancel. */
export function PurchaseWarning({preview:p}:{preview:Preview}) {
    const warning = !p.warning ? null : p.forecast && p.forecast.burnCents>0
        ? p.forecast.runwayPeriods!<=3 ? "Cash may run short: upkeep exceeds recent earnings." : "Upkeep exceeds recent earnings."
        : "Cash after purchase is below unpaid costs. Pending earnings may help.";
    return warning && <p role="note" className="finance-warning">Warning: {warning}</p>;
}
