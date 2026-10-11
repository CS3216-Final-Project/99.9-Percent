import {it,expect,beforeEach,afterEach} from "vitest";
import {render,screen,within,cleanup,fireEvent} from "@testing-library/react";
import {CampaignPanel,CampaignOverlays,CampaignControls} from "./CampaignUI";
import {useGame} from "../game/store";
import {dataCompany,spikeCompany,untilOffset,act} from "../sim/__tests__/spikeFixtures";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
function show(g:ReturnType<typeof dataCompany>){useGame.setState({game:g,started:true,ready:true,onboarding:false});render(<><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);}
it("extends the current strip with factual available continuation and no new store",()=>{
 show(dataCompany());const nav=screen.getByRole("navigation",{name:"Campaign progression"});expect(nav.textContent).toContain("Traffic Spikes & Autoscaling Available next");
 fireEvent.click(screen.getByRole("button",{name:"Continue to traffic spikes"}));expect(nav.textContent).toContain("Data Strategy Completed");expect(nav.textContent).toContain("Traffic Spikes & Autoscaling Current");expect(useGame.getState().running).toBe(false);expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).not.toContain("before continuing to traffic spikes");
});
it("shows live provisioning, counters, delayed routing and per-instance shared selection",()=>{
 show(untilOffset(spikeCompany(),13));const control=screen.getByRole("region",{name:"Traffic spikes and autoscaling"});expect(control.textContent).toContain("TRAFFIC SPIKE ACTIVE");expect(control.textContent).toContain("3 steps, followed by 1 routing step");
 expect(screen.getByRole("note",{name:"App 3 routing status"}).textContent).toContain("Installed capacity does not receive traffic");
 fireEvent.click(within(screen.getByRole("region",{name:"Application instances"})).getByRole("button",{name:/App 3:/}));expect(useGame.getState().selectedAppId).toBe("app-3");
 expect(screen.getAllByRole("status").some(x=>x.textContent?.includes("Routing change: activates in 1"))).toBe(true);
});
it("pending recognition stays visible after saved-state presentation and acknowledgement",()=>{
 let g=spikeCompany(false);g=act(g,{type:"set_traffic_limit",enabled:true});show(untilOffset(g,72));
 expect(screen.getByRole("dialog",{name:"Spike response handled"})).toBeTruthy();expect(screen.getByRole("button",{name:"Run"}).hasAttribute("disabled")).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"Continue operating"}));expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("Traffic Spikes & Autoscaling Completed");expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("Locked");
});
