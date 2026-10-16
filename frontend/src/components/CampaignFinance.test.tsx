import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { CampaignHeader, CampaignPanel } from "./CampaignUI";
import { CampaignAction } from "./CampaignAction";
import { InfrastructureHelp } from "./CampaignInfrastructure";
import { TooltipLayer } from "./Tooltip";
import { CampaignFinance } from "./CampaignFinance";
import { operatingCharges } from "@/sim/settlement";
import { financeMoney, totalCharges } from "@/game/campaignFinance";
import { tick } from "@/sim/__tests__/spikeFixtures";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";

beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);useGame.getState().boot();useGame.getState().play();useGame.setState({onboarding:false,tour:null});});
afterEach(()=>{cleanup();vi.useRealTimers();});
it("keeps the open decision's highlight when focus or hover leaves another action",()=>{
    render(<><CampaignAction label="Upgrade database" decision={{type:"start_db_upgrade"}} onClick={()=>{}}/>
        <CampaignAction label="Limit to 500 requests/s" decision={{type:"set_traffic_limit",enabled:true}} onClick={()=>{}}/></>);
    const database=screen.getByRole("button",{name:"Upgrade database"});
    fireEvent.focus(database);fireEvent.click(database);
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    const limit=screen.getByRole("button",{name:"Limit to 500 requests/s"});
    // Pointer entry happens before the previous button blurs on pointer-down, then the click opens the card.
    fireEvent.pointerEnter(limit);fireEvent.blur(database);fireEvent.click(limit);
    fireEvent.pointerEnter(database);
    expect(useGame.getState().affected).toEqual(["gateway"]);
    fireEvent.pointerLeave(database);
    expect(useGame.getState().affected).toEqual(["gateway"]);
    fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    expect(screen.queryByRole("region",{name:"Confirm Limit to 500 requests/s"})).toBeNull();
});
it("opens finance from Cash, pauses and restores focus without changing company state",()=>{
    render(<CampaignHeader/>);const before=structuredClone(useGame.getState().game);
    act(()=>useGame.getState().setRunning(true));
    const entry=screen.getByRole("button",{name:"View finances"});entry.focus();fireEvent.click(entry);
    const dialog=screen.getByRole("dialog",{name:"Company finances"});
    expect(dialog.textContent).toContain("$0.20");expect(dialog.textContent).toContain("not yet received");
    expect(dialog.textContent).toContain("No completed period yet");
    expect(useGame.getState().running).toBe(false);expect(useGame.getState().game).toEqual(before);
    fireEvent.keyDown(within(dialog).getByRole("button",{name:"Close"}),{key:"Escape"});
    expect(screen.queryByRole("dialog")).toBeNull();expect(document.activeElement).toBe(entry);
});
it("Cancel and double confirmation dispatch at most one purchase",()=>{
    const buy=vi.fn(()=>useGame.getState().act({type:"add_server"}));
    render(<CampaignAction label="Add server" price={1000} decision={{type:"add_server"}} onClick={buy}/>);
    const before=useGame.getState().game;fireEvent.click(screen.getByRole("button",{name:/Add server/}));fireEvent.click(screen.getByRole("button",{name:"Cancel"}));
    expect(useGame.getState().game).toBe(before);
    fireEvent.click(screen.getByRole("button",{name:/Add server/}));const confirm=screen.getByRole("button",{name:"Confirm"});
    fireEvent.click(confirm);fireEvent.click(confirm);
    expect(buy).toHaveBeenCalledTimes(1);expect(useGame.getState().game.campaign!.cashCents).toBe(1900000);
});
it("requires reviewing a changed cash preview and rejects newly unavailable purchases",()=>{
    const buy=vi.fn(()=>useGame.getState().act({type:"add_server"}));
    render(<CampaignAction label="Add server" decision={{type:"add_server"}} price={1000} onClick={buy}/>);
    fireEvent.click(screen.getByRole("button",{name:/Add server/}));
    const g=structuredClone(useGame.getState().game);g.campaign!.cashCents=1800000;
    act(()=>useGame.setState({game:g}));fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
    expect(buy).not.toHaveBeenCalled();expect(screen.getByRole("status").textContent).toContain("preview changed");
    fireEvent.click(screen.getByRole("button",{name:"Confirm"}));expect(buy).toHaveBeenCalledTimes(1);
    expect(useGame.getState().game.campaign!.cashCents).toBe(1700000);
});
it("shows an engine reason outside disabled controls and keeps it keyboard reachable",()=>{
    act(()=>useGame.setState({game:advanceSteps(newGame(),60).state}));
    act(()=>useGame.getState().act({type:"start_db_upgrade"}));render(<CampaignPanel/>);
    const card=screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!;
    const reason=card.querySelector<HTMLElement>(".campaign-action-reason")!;
    expect(reason.textContent).toBe("An infrastructure deployment is already pending.");reason.focus();expect(document.activeElement).toBe(reason);
});
it("disables a confirmation if another deployment makes the action unavailable",()=>{
    const buy=vi.fn();render(<CampaignAction label="Add server" decision={{type:"add_server"}} price={1000} onClick={buy}/>);
    fireEvent.click(screen.getByRole("button",{name:/Add server/}));
    act(()=>useGame.getState().act({type:"start_db_upgrade"}));
    const confirm=screen.getByRole("button",{name:"Confirm"});expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirm);expect(buy).not.toHaveBeenCalled();
    expect(within(screen.getByRole("region",{name:"Confirm Add server"})).getByText("An infrastructure deployment is already pending.")).toBeTruthy();
});
it("drops an open purchase confirmation when a different company is loaded",()=>{
    render(<CampaignAction label="Add server" decision={{type:"add_server"}} price={1000} onClick={()=>{}}/>);
    fireEvent.click(screen.getByRole("button",{name:/Add server/}));
    act(()=>useGame.setState({game:newGame(1,"replacement-company")}));
    expect(screen.queryByRole("button",{name:"Confirm"})).toBeNull();
    expect(useGame.getState().game.campaign!.cashCents).toBe(2000000);
});
it("closes an open purchase confirmation when the view leaves its machine's floor",()=>{
    act(()=>useGame.getState().goToFloor("office","menu"));
    render(<CampaignAction label="Add server" decision={{type:"add_server"}} price={1000} onClick={()=>{}}/>);
    fireEvent.click(screen.getByRole("button",{name:/Add server/}));
    // Opening it took the view to the App Servers' floor, and the card stays while the view is there.
    expect(useGame.getState().floor).toBe("servers");
    expect(screen.getByRole("region",{name:"Confirm Add server"})).toBeTruthy();
    screen.getByRole("button",{name:"Confirm"}).focus();
    act(()=>useGame.getState().goToFloor("office","key"));
    expect(screen.queryByRole("region",{name:"Confirm Add server"})).toBeNull();
    // Focus that was in the card returns to its action rather than falling to the page.
    expect(document.activeElement).toBe(screen.getByRole("button",{name:/Add server/}));
    act(()=>useGame.getState().goToFloor("servers","key"));
    const elsewhere=document.createElement("button");document.body.append(elsewhere);
    fireEvent.click(screen.getByRole("button",{name:/Add server/}));elsewhere.focus();
    act(()=>useGame.getState().goToFloor("office","elevator"));
    expect(screen.queryByRole("region",{name:"Confirm Add server"})).toBeNull();
    expect(document.activeElement).toBe(elsewhere);elsewhere.remove();
    act(()=>useGame.getState().goToFloor("servers","key"));
    expect(screen.queryByRole("region",{name:"Confirm Add server"})).toBeNull();
    expect(useGame.getState().game.campaign!.cashCents).toBe(2000000);
});
it("offers hover, keyboard and touch-focus explanations without taking game actions",()=>{
    vi.useFakeTimers();render(<><InfrastructureHelp/><TooltipLayer/></>);
    fireEvent.click(screen.getByText("What does each component do?"));
    const term=screen.getByText("App Server");
    fireEvent.pointerOver(term,{pointerType:"mouse"});act(()=>vi.advanceTimersByTime(250));
    expect(screen.getByRole("tooltip").textContent).toContain("Scale Up makes one existing");
    fireEvent.pointerDown(term,{pointerType:"touch"});fireEvent.focusIn(term);
    expect(screen.getByRole("tooltip").textContent).toContain("needs routing");
});


it("keeps actual results separate from current costs and hides accounting behind disclosures",()=>{
    const game=tick(newGame(),60);
    act(()=>useGame.setState({game}));render(<CampaignFinance onClose={()=>{}}/>);
    const overview=screen.getByRole("region",{name:"Company finances overview"});
    const last=game.campaign!.settlements.at(-1)!;
    expect(within(overview).getByText("Money earned last period").nextElementSibling?.textContent).toBe(financeMoney(last.revenueCents));
    expect(within(overview).getByText("Money earned minus running costs — last period").nextElementSibling?.textContent).toBe(financeMoney(last.netCents));
    expect(within(overview).getByText("Current running costs per period").nextElementSibling?.textContent).toBe(financeMoney(totalCharges(operatingCharges(game.campaign!))));
    const advanced=screen.getByText("Advanced details").closest("details")!;
    expect(advanced.open).toBe(false);
    expect(advanced.contains(screen.getByText("Costs waiting to be paid"))).toBe(true);
    expect(advanced.contains(screen.getByText("Purchase history"))).toBe(true);
    expect(screen.getByText("Cash update history").closest("details")!.querySelector("summary")!.textContent).toBe("Cash update history");
    expect(screen.getByRole("region",{name:"Where your money goes"}).textContent).not.toContain("Other equipment costs");
});
it("groups installed equipment accurately without losing the full cost breakdown",()=>{
    const game=preparedReliability();act(()=>useGame.setState({game}));render(<CampaignFinance onClose={()=>{}}/>);
    const costs=operatingCharges(game.campaign!);
    const region=screen.getByRole("region",{name:"Where your money goes"});
    expect(within(region).getByText("Other equipment costs").nextElementSibling?.textContent).toBe(financeMoney(costs.lb+costs.cache+costs.controller+costs.checks+costs.failover));
    expect(within(region).getByText("Employee salaries").nextElementSibling?.textContent).toBe(financeMoney(costs.salary));
    expect(within(region).getByText("Total running costs").nextElementSibling?.textContent).toBe(financeMoney(totalCharges(costs)));
    expect(screen.getByText("Detailed running costs").closest("details")!.textContent).toContain("Automatic Failover");
});
it("withholds forecasts until supported and distinguishes covered costs from cash risk",()=>{
    const game=tick(newGame(),60);
    game.campaign!.settlements.at(-1)!.revenueCents=totalCharges(operatingCharges(game.campaign!));
    act(()=>useGame.setState({game}));render(<CampaignFinance onClose={()=>{}}/>);
    expect(screen.getByRole("region",{name:"Financial health"}).textContent).toContain("recent earnings cover");
    expect(screen.getByRole("region",{name:"Financial health"}).textContent).not.toContain("How long your money might last");
    const low=structuredClone(game);low.campaign!.settlements.at(-1)!.revenueCents=0;low.campaign!.cashCents=100000;
    act(()=>useGame.setState({game:low}));
    expect(screen.getByRole("region",{name:"Financial health"}).textContent).toContain("may run short of money soon");
    expect(screen.getByRole("region",{name:"Financial health"}).textContent).toContain("Cash updates may leave you short sooner");
    const pending=structuredClone(low);pending.campaign!.pending.push({id:"pending-test",type:"add-app",requestedStep:60,activationStep:62,activatedStep:null,costCents:100000});
    act(()=>useGame.setState({game:pending}));
    expect(screen.getByRole("region",{name:"Financial health"}).textContent).toContain("after pending changes finish");
    expect(screen.getByRole("region",{name:"Financial health"}).textContent).not.toContain("How long your money might last");
});
it("traps focus through visible disclosure summaries and skips their closed contents",()=>{
    render(<CampaignFinance onClose={()=>{}}/>);
    const close=screen.getByRole("button",{name:"Close"});
    const advanced=screen.getByText("Advanced details");
    close.focus();fireEvent.keyDown(close,{key:"Tab",shiftKey:true});
    expect(document.activeElement).toBe(advanced);
    fireEvent.keyDown(advanced,{key:"Tab"});expect(document.activeElement).toBe(close);
    act(()=>{advanced.closest("details")!.open=true;});
    const estimates=screen.getByText("How estimates work");
    fireEvent.keyDown(close,{key:"Tab",shiftKey:true});expect(document.activeElement).toBe(estimates);
    fireEvent.keyDown(estimates,{key:"Tab"});expect(document.activeElement).toBe(close);
});
it("shows unpaid-cost risk before a forecast is available and withholds estimates for closed companies",()=>{
    const game=advanceSteps(newGame(),3).state;game.campaign!.cashCents=1;
    act(()=>useGame.setState({game}));render(<CampaignFinance onClose={()=>{}}/>);
    const health=screen.getByRole("region",{name:"Financial health"});
    expect(health.textContent).toContain("does not cover costs already waiting to be paid");
    expect(health.textContent).not.toContain("How long your money might last");
    const closed=structuredClone(game);closed.campaign!.cashCents=0;
    act(()=>useGame.setState({game:closed}));
    expect(health.textContent).toContain("This company has closed");
    expect(health.textContent).not.toContain("How long your money might last");
});
