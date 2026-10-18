import {it,expect,beforeEach,afterEach} from "vitest";
import {render,screen,within,cleanup,fireEvent} from "@testing-library/react";
import {CampaignHeader,CampaignPanel,CampaignOverlays,CampaignControls} from "./CampaignUI";
import {useGame} from "../game/store";
import {dataCompany,spikeCompany,untilOffset,act} from "../sim/__tests__/spikeFixtures";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
function show(g:ReturnType<typeof dataCompany>){useGame.setState({game:g,started:true,ready:true,onboarding:false});render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);}
function chapter(name:string) {
 fireEvent.click(screen.getByRole("button",{name:"View chapters"}));
 const dialog=screen.getByRole("dialog",{name:"Guided Mode chapters"});
 const text=within(dialog).getAllByRole("listitem").find(li=>li.textContent!.includes(name))!.textContent;
 fireEvent.click(within(dialog).getByRole("button",{name:"Back to company"}));
 return text;
}
it("extends the current strip with factual available continuation and no new store",()=>{
 show(dataCompany());expect(chapter("Traffic Spikes")).toContain("Available next");
 fireEvent.click(screen.getByRole("button",{name:"Next: Continue to traffic spikes"}));expect(chapter("Data Strategy")).toContain("Completed");expect(screen.getByLabelText("Current chapter").textContent).toBe("Traffic Spikes & Autoscaling");expect(useGame.getState().running).toBe(false);expect(screen.getByRole("region",{name:"Guided Mode requirements"}).textContent).not.toContain("before continuing to traffic spikes");
});
it("shows live provisioning, counters, delayed routing and per-instance shared selection",()=>{
 show(untilOffset(spikeCompany(),13));const control=screen.getByRole("region",{name:"Traffic spikes and autoscaling"});expect(control.textContent).toContain("TRAFFIC SPIKE ACTIVE");expect(control.textContent).toContain("3 game seconds, followed by 1 routing game second");
 fireEvent.click(screen.getByRole("button",{name:"App Server"}));
 expect(screen.getByRole("note",{name:"App 3 routing status"}).textContent).toContain("Installed capacity does not receive traffic");
 fireEvent.click(within(screen.getByRole("region",{name:"Application instances"})).getByRole("button",{name:/App 3:/}));expect(useGame.getState().selectedAppId).toBe("app-3");
 expect(screen.getAllByRole("status").some(x=>x.textContent?.includes("Routing change: activates in 1"))).toBe(true);
});
it("pending recognition stays visible after saved-state presentation and acknowledgement",()=>{
 let g=spikeCompany(false);g=act(g,{type:"set_traffic_limit",enabled:true});show(untilOffset(g,72));
 expect(screen.getByRole("dialog",{name:"Spike response handled"})).toBeTruthy();expect(screen.getByRole("button",{name:"Run"}).hasAttribute("disabled")).toBe(true);
 fireEvent.click(screen.getByRole("button",{name:"Continue operating"}));expect(chapter("Traffic Spikes")).toContain("Completed");expect(chapter("Stay Online")).toContain("Available next");
});
