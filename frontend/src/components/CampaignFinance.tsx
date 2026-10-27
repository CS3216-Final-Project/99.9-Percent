import { useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "@/game/store";
import { moneyFull as headlineMoney, money as compactMoney } from "@/game/format";
import { accruedCharges, operatingCharges } from "@/sim/settlement";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";
import { COST_NAMES, financeForecast, totalCharges, financeMoney as money } from "@/game/campaignFinance";
import { Modal, Row, Stat } from "./ui";
import "./CampaignFinance.css";
import { chapter6FinancialRisk } from "@/game/chapter6Finance";

export function FinanceEntry() {
    const [open,setOpen] = useState(false);
    const cash = useGame(s=>s.game.campaign!.cashCents);
    return <><Stat icon="cash" kind="cash" label="Cash" actionLabel="View finances"
        tip={`Available cash: ${money(cash)}. Open company finances. Purchases are paid immediately.`}
        onClick={()=>{useGame.getState().setRunning(false);setOpen(true);}}>
        <strong className={cash <= 0 ? "text-critical" : ""}><span className="finance-cash-full">{headlineMoney(cash/100)}</span><span className="finance-cash-compact">{compactMoney(cash/100)}</span></strong>
    </Stat>{open && <CampaignFinance onClose={()=>setOpen(false)} />}</>;
}
export function CampaignFinance({onClose}:{onClose:()=>void}) {
    const game = useGame(s=>s.game), c = game.campaign!, risk = chapter6FinancialRisk(game);
    const accrued = accruedCharges(c), installed = operatingCharges(c), last = c.settlements.at(-1), forecast = financeForecast(c);
    const pendingRevenue = c.ledger.successes*Q.revenueCents;
    const other = installed.lb+installed.cache+installed.controller+installed.checks+installed.failover;
    const costs = [["Employee salaries",installed.salary],["Server running costs",installed.app],["Database running costs",installed.db],["Other equipment costs",other]] as const;
    const names = {...COST_NAMES, app:"Server running costs",db:"Database running costs",salary:"Employee salaries"};
    const closed = c.scorecard || c.cashCents<=0;
    const health = closed ? "This company has closed. Its completed results remain available."
        : !last ? "Complete a period before we can estimate your financial health."
        : c.pending.length ? "An estimate will be available after pending changes finish."
        : forecast && forecast.burnCents <= 0 ? "Your recent earnings cover your current running costs."
        : forecast && forecast.runwayPeriods! <= 3 ? "Your company may run short of money soon."
        : "Your current running costs exceed your recent earnings.";
    return createPortal(<Modal title="Company finances" icon={{kind:"cash",name:"cash"}} onClose={onClose}>
        <section className="finance-overview" aria-label="Company finances overview"><dl className="rows">
            <Row label="Money available" value={money(c.cashCents)} />
            <Row label="Money earned, not yet received" value={money(pendingRevenue)} />
            {last && <Row label="Money earned last period" value={money(last.revenueCents)} />}
            <Row label="Current running costs per period" value={money(totalCharges(installed))} />
            {last && <Row label="Money earned minus running costs, last period" value={money(last.netCents)} />}
        </dl><p className="muted">{last ? "Last period's result does not include purchases." : "No completed period yet."}</p></section>
        <section aria-labelledby="finance-earnings"><h3 id="finance-earnings">How your company makes money</h3>
            <p>Your company earns {money(Q.revenueCents)} for each customer request completed successfully. Failed or rejected requests earn nothing. Queued requests earn money only when completed successfully.</p>
            <p>Earned money becomes available at the next cash update, when running costs are also paid.</p>
        </section>
        <section aria-labelledby="finance-costs"><h3 id="finance-costs">Where your money goes</h3>
            <p className="muted">For one full period: {Q.periodSteps*Q.stepSeconds} game seconds, using your currently installed equipment.</p>
            <dl className="rows">{costs.filter(([,value])=>value!==0).map(([label,value])=><Row key={label} label={label} value={money(value)} />)}<Row label="Total running costs" value={money(totalCharges(installed))} /></dl>
            <p className="muted">Salaries and equipment costs continue even when equipment is idle.</p>
        </section>
        <section aria-labelledby="finance-health"><h3 id="finance-health">Financial health</h3>
            {risk&&<p className="finance-warning" role="note">{risk.message}{risk.kind==="blocked"&&" Close finances and open Menu to export your save or start a new company."}</p>}
            <p className={forecast && forecast.burnCents>0 ? "finance-warning" : ""}>{health}</p>
            {!closed && c.cashCents<=totalCharges(accrued) && <p className="finance-warning" role="note">Money available does not cover costs already waiting to be paid. Earnings awaiting the cash update may help cover them.</p>}
            {forecast && forecast.runwayPeriods!==null && <p>How long your money might last: at this rate, your available money covers about {forecast.runwayPeriods.toFixed(1)} full periods. Cash updates may leave you short sooner.</p>}
        </section>
        <details className="more finance-advanced"><summary>Advanced details</summary>
            <dl className="rows"><Row label="Costs waiting to be paid" value={money(totalCharges(accrued))} /><Row label="Next cash update" value={`In ${Q.periodSteps-c.step%Q.periodSteps} game seconds; time must run`} /></dl>
            <p>{c.ledger.successes.toLocaleString("en-US")} successful completed requests × {money(Q.revenueCents)} = {money(pendingRevenue)} earned, not yet received.</p>
            <details className="more"><summary>Detailed running costs</summary>
                <p>Costs waiting to be paid include the part of this period already used and carried fractions of a cent. Equipment running costs describe a full period at the current configuration.</p>
                <table className="campaign-table"><caption>Costs waiting to be paid and current full-period costs</caption><thead><tr><th>Expense</th><th>Waiting to be paid</th><th>Per period</th></tr></thead><tbody>{Object.entries(names).map(([key,name])=><tr key={key}><th scope="row">{name}</th><td>{money(accrued[key as keyof typeof accrued])}</td><td>{money(installed[key as keyof typeof installed])}</td></tr>)}</tbody></table>
                <p>Idle, unrouted and spare servers still cost money. Traffic limits reduce admitted demand and potential earnings, but do not remove running costs or salaries. Disabled controllers still have running costs.</p>
            </details>
            <details className="more"><summary>Cash update history</summary>
                {c.settlements.length ? c.settlements.map(s=><details className="more" key={s.period}><summary>Period {s.period} · game seconds {s.step-Q.periodSteps+1}–{s.step}</summary><dl className="rows">
                    <Row label="Money earned" value={money(s.revenueCents)}/><Row label="Running costs paid" value={money(s.revenueCents-s.netCents)}/><Row label="Money earned minus running costs" value={money(s.netCents)}/>
                    {Object.entries(names).map(([key,name])=><Row key={key} label={name} value={money((s[(key+"Cents") as keyof typeof s] as number) ?? 0)}/>)}</dl></details>) : <p>No cash updates recorded.</p>}
            </details>
            <details className="more"><summary>Company totals</summary><dl className="rows"><Row label="All money received" value={money(c.revenueCents)} /><Row label="All running costs paid" value={money(c.costsCents)} /><Row label="Purchases and upgrades" value={money(c.investedCents)} /><Row label="Total money gained or lost" value={money(c.revenueCents-c.costsCents-c.investedCents)} /></dl><p>Money received minus running costs paid and purchases. Does not include starting money or earnings not yet received.</p></details>
            <details className="more"><summary>Purchase history</summary>{c.actions.filter(a=>a.costCents>0).map(a=><p key={a.id}>Game second {a.requestedStep}: {a.type.replaceAll("-"," ")} · {money(a.costCents)}{a.activatedStep===null ? " · not active yet" : ` · active from game second ${a.activatedStep}`}{a.source==="autoscaler" ? " · automatic purchase" : ""}</p>)}{!c.actions.some(a=>a.costCents>0)&&<p>No purchases recorded.</p>}</details>
            <details className="more"><summary>How estimates work</summary>
                {forecast ? <p>Last period's earnings {money(forecast.revenueCents)} are compared with current full-period running costs {money(forecast.costsCents)}. {forecast.runwayPeriods===null ? "No depletion estimate is shown when recent earnings cover these costs." : `Estimated cash budget: ${forecast.runwayPeriods.toFixed(1)} full periods (${Math.round(forecast.runwayPeriods*Q.periodSteps*Q.stepSeconds)} game seconds).`}</p> : <p>Estimates need a completed period, no pending changes and an open company.</p>}
                <p>This is a budget estimate, not a bankruptcy deadline. It assumes recent earnings continue. Cash update timing, traffic, failures, deployment and future purchases can change the outcome.</p>
            </details>
        </details>
    </Modal>,document.body);
}
