import { financeMoney as money, type previewCampaignAction } from "@/game/campaignFinance";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { Row } from "./ui";

type Preview = Extract<ReturnType<typeof previewCampaignAction>,{ok:true}>;

/** The same authoritative quote, kept short enough to review beside the machine. */
export function PurchaseFinance({preview:p}:{preview:Preview}) {
    return <dl className="rows"><Row label="Buy now" value={money(p.spentCents)} /><Row label="Money left" value={money(p.cashAfterCents)} />
        <Row label="Extra running cost" value={p.upkeepDelta===0 ? "None" : `${p.upkeepDelta>0?"+":""}${money(p.upkeepDelta)} per ${Q.periodSteps*Q.stepSeconds} game seconds`} />
        <Row label="Ready in" value={`${p.delay} ${p.delay===1?"step":"steps"}`} /></dl>;
}

/** Outside the optional scrolling details, immediately before Confirm/Cancel. */
export function PurchaseWarning({preview:p}:{preview:Preview}) {
    const warning = !p.warning ? null : p.forecast && p.forecast.burnCents>0
        ? p.forecast.runwayPeriods!<=3 ? "This purchase may leave your company short of cash. Running costs may exceed recent earnings." : "Running costs may exceed recent earnings after this purchase."
        : "Money left does not cover costs waiting to be paid. Earnings awaiting the cash update may help.";
    return warning && <p role="note" className="finance-warning">Warning: {warning}</p>;
}
