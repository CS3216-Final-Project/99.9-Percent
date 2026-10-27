import InspectionReveal from "./InspectionReveal";
import { inspectionAction } from "./inspectionTestUtils";
import {render,screen,within,cleanup,fireEvent} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel,CampaignHeader,CampaignControls,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame} from "../sim";
import {readyReliability,reliabilityCompany,preparedReliability,act,tick} from "../sim/__tests__/reliabilityFixture";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
function show(g:ReturnType<typeof newGame>){useGame.setState({game:g,ready:true,started:true,onboarding:false});render(<><CampaignHeader/><CampaignPanel/><InspectionReveal/><CampaignControls/><CampaignOverlays/></>);}
it("offers explicit reliability continuation after acknowledged spikes",()=>{show(readyReliability());expect((screen.getByRole("button",{name:/Continue to Stay Online/}) as HTMLButtonElement).disabled).toBe(false);});
it("shows nine technology nodes with derived database ownership and locked future nodes",()=>{
 const g=newGame();g.campaign!.dbCapacity=1000;g.campaign!.upgraded=true;show(g);fireEvent.click(within(screen.getByRole("navigation",{name:"Views"})).getByRole("button",{name:"Tech"}));const dialog=screen.getByRole("region",{name:"Tech tree"});expect(dialog.querySelectorAll("[data-tech]")).toHaveLength(9);expect(within(dialog).getByRole("button",{name:"Larger Database: Owned"})).toBeTruthy();expect(within(dialog).getByRole("button",{name:"Health Checks: Locked"})).toBeTruthy();expect(within(dialog).queryByText(/engineer-weeks/)).toBeNull();
});
it("shows the stage and a legal way to start the test",()=>{
 show(reliabilityCompany());expect(screen.getByLabelText("Current Guided Mode stage").textContent).toBe("Stay Online");expect(screen.getByRole("button",{name:/Start reliability test/})).toBeTruthy();
});
it("exposes actual and detected health and surviving capacity",()=>{
 show(tick(act(preparedReliability(),{type:"arm_reliability"}),8));fireEvent.click(screen.getByRole("button",{name:"App Server"}));fireEvent.click(screen.getByRole("button",{name:"Server management"}));expect(useGame.getState().game.campaign!.apps[1].detectedHealth).toBe("healthy");fireEvent.click(document.querySelector<HTMLElement>('[data-guidance-app="app-2"]')!);const panel=screen.getByRole("dialog",{name:"App Servers"});
 expect(panel.textContent).toContain("failed");expect(panel.textContent).toContain("detected unhealthy");
 fireEvent.click(within(panel).getByText("Technical Details"));
 const individual=within(panel).getByRole("region",{name:"App 2 readings"});
 expect(individual.textContent).not.toContain("Routed capacity");
 expect(within(panel).getByRole("button",{name:"Restore App 2 · free · 3 game seconds"})).toBeTruthy();
 fireEvent.click(within(panel).getByRole("button",{name:"Back to Server management"}));
 fireEvent.click(within(panel).getByText("Fleet Technical Details"));
 const readings=within(panel).getByRole("region",{name:"Servers readings"});
 expect(within(readings).getByText("Routed capacity").parentElement?.querySelector("dd")?.textContent).toBe("1,600 req/s");
 expect(within(readings).getByText("Spare capacity").parentElement?.querySelector("dd")?.textContent).toBe("1,600 req/s");
});
it("uses effective routing for labels and selects an inspected application",()=>{
 show(tick(act(preparedReliability(),{type:"arm_reliability"}),9));
 fireEvent.click(screen.getByRole("button",{name:"App Server"}));fireEvent.click(screen.getByRole("button",{name:"Server management"}));
 const instances=screen.getByRole("region",{name:"Application instances"});
 expect(within(instances).getByRole("button",{name:/App 2: failed; Installed - not receiving traffic/})).toBeTruthy();
 fireEvent.click(within(instances).getByRole("button",{name:/App 2: failed/}));
 expect(useGame.getState().selectedAppId).toBe("app-2");expect(useGame.getState().selected).toBe("app");
});
it("disables failover deployment without a reserved spare and purchases that exhaust cash",()=>{
 let g=preparedReliability();g=act(g,{type:"release_spare"});g=tick(g);
 g.campaign!.reliabilityStage!.failover=null;g.campaign!.reliabilityStage!.checksStep=null;g.campaign!.cashCents=50000;
 show(g);
 for(const name of ["Deploy Automatic Failover","Deploy Health Checks","Install spare"])
  expect((inspectionAction(new RegExp(name)) as HTMLButtonElement).disabled).toBe(true);
});
it("shows the incident treatment while a Stay Online failure is active without an open incident",()=>{
 const armed=tick(act(preparedReliability(),{type:"arm_reliability"}),9);
 // The failover isolates the failed app, so no incident ever opens and the phase stays management.
 expect(armed.phase).toBe("management");expect(armed.campaign!.incident).toBeNull();
 expect(armed.campaign!.reliabilityStage!.fault!.startedStep).not.toBeNull();
 show(armed);
 expect(document.querySelector(".topbar")!.className).toContain("is-incident");
 const dashboard=screen.getByRole("region",{name:"Incident"});
 expect(dashboard.querySelector(".mission-condition")!.className).toContain("is-failure");
 const status=within(dashboard).getByText(/failed and is not restored/).closest("p")!;
 expect(status.querySelector(".state-critical")!.textContent).toContain("Incident");
 expect(document.querySelector(".week")!.className).toContain("is-incident");
 cleanup();
 show(tick(armed,20));
 expect(document.querySelector(".topbar")!.className).not.toContain("is-incident");
});
it("keeps the recorded reliability outcome available after acknowledgement",()=>{
 const completed=tick(act(preparedReliability(),{type:"arm_reliability"}),35);
 show(completed);expect(screen.getByRole("dialog",{name:"Reliability outcome"}).textContent).toContain("Spare promotion");
 fireEvent.click(screen.getByRole("button",{name:"Stay in this chapter"}));
 cleanup();const acknowledged=useGame.getState().game;useGame.setState({view:"history"});show(acknowledged);
 fireEvent.click(screen.getByRole("tab",{name:/^Incidents/}));
 fireEvent.click(screen.getByRole("button",{name:/Stay Online outcome/}));
 expect(screen.getByRole("region",{name:"Historical reliability outcome"}).textContent).toContain("App 3");
});
