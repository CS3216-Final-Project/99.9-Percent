import {render,screen,within,fireEvent,cleanup} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignHeader,CampaignPanel,CampaignControls,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {spikeCompany,untilOffset} from "../sim/__tests__/spikeFixtures";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
function action(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function show(g=newGame()){useGame.setState({game:g,ready:true,started:true,onboarding:false});render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);}
function status(){return screen.getByRole("region",{name:"System status"});}
it("teaches role, architecture and demand in the existing skippable introduction without advancing physics",()=>{
 render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);
 fireEvent.click(screen.getByRole("button",{name:"Try Prototype"}));const before=structuredClone(useGame.getState().game.campaign);
 let intro=screen.getByRole("dialog",{name:"Company introduction"});expect(intro.textContent).toContain("technical side of a growing software company");
 expect(within(intro).getByRole("button",{name:"Skip introduction"})).toBeTruthy();
 fireEvent.click(within(intro).getByRole("button",{name:"Next"}));expect(intro.textContent).toContain("Users → Application → Database");
 fireEvent.click(within(intro).getByRole("button",{name:"Next"}));intro=screen.getByRole("dialog",{name:"Company introduction"});
 expect(intro.textContent).toContain("When demand exceeds capacity");expect(intro.textContent).not.toContain("Upgrade database");
 fireEvent.click(within(intro).getByRole("button",{name:"Start company"}));expect(screen.queryByRole("dialog")).toBeNull();
 expect(useGame.getState().game.campaign).toEqual(before);expect(useGame.getState().running).toBe(false);expect(useGame.getState().meta.openingOnboarding.status).toBe("completed");
});
it("leads with the current objective and healthy authoritative architecture, with detailed evidence optional",()=>{
 const g=newGame(),before=structuredClone(g);show(g);
 expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("First Growth");
 expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).toContain("Watch how the system behaves as traffic increases");
 expect(status().textContent).toContain("Healthy");expect(status().textContent).toContain("300 req/s");
 const architecture=screen.getByRole("region",{name:"Architecture"});expect(architecture.textContent).toContain("Users");
 expect(within(architecture).getByRole("button",{name:/Application.*300 \/ 1000/})).toBeTruthy();
 expect(within(architecture).getByRole("button",{name:/Database.*300 \/ 600/})).toBeTruthy();
 expect(screen.getByText("Detailed system evidence").closest("details")!.open).toBe(false);fireEvent.click(screen.getByRole("button",{name:"Inspect metrics · free"}));
 expect(screen.getByText("Detailed system evidence").closest("details")!.open).toBe(true);
 expect(screen.getByRole("table").textContent).toContain("Processed");expect(screen.getByRole("table").textContent).toContain("Failed");
 expect(useGame.getState().game).toEqual(action(before,{type:"incident_inspect",equipment:"monitoring"}));
});
it("explains running, pausing, speed and physical steps using the same controls",()=>{
 show();const footer=screen.getByRole("contentinfo");
 expect(footer.textContent).toContain("Simulation: Paused");expect(footer.textContent).toContain("one second of system activity");
 fireEvent.click(within(footer).getByRole("button",{name:"Resume company"}));expect(footer.textContent).toContain("Simulation: Running");
 fireEvent.click(within(footer).getByRole("button",{name:"Pause company"}));expect(footer.textContent).toContain("Simulation: Paused");
 fireEvent.click(within(footer).getByRole("button",{name:"Fast · 2×"}));expect(useGame.getState().speed).toBe(2);
 fireEvent.click(within(footer).getByRole("button",{name:"Advance 1 step"}));expect(useGame.getState().game.campaign!.step).toBe(1);
});
it("shows pressure before incident detection without adding an incident threshold",()=>{
 const g=advanceSteps(newGame(),4).state;show(g);expect(status().textContent).toContain("Degraded");
 expect(screen.getByRole("region",{name:"Architecture"}).textContent).toContain("133.33% · Over capacity");expect(screen.queryByRole("alert")).toBeNull();expect(g.campaign!.incident).toBeNull();
});
it("announces the measured incident neutrally and explains disabled stepping",()=>{
 const g=advanceSteps(newGame(),6).state;show(g);const alert=screen.getByRole("alert");
 expect(alert.textContent).toContain("INCIDENT DETECTED");expect(alert.textContent).toContain("cannot keep up");
 for(const answer of ["Upgrade database","Add application","Limit to 500"])expect(alert.textContent).not.toContain(answer);
 expect(screen.getByRole("button",{name:"Advance 1 step"}).hasAttribute("disabled")).toBe(true);
 expect(screen.getByRole("contentinfo").textContent).toContain("Manual stepping is unavailable");
 fireEvent.click(screen.getByRole("button",{name:"Investigate system"}));expect(screen.getByRole("table")).toBeTruthy();
 expect(useGame.getState().game.campaign!.step).toBe(g.campaign!.step);
});
it("shows recovering only after actual qualifying observations",()=>{
 const g=advanceSteps(action(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),4).state;show(g);
 expect(g.campaign!.incident!.stableSteps).toBeGreaterThan(0);expect(status().textContent).toContain("Recovering");expect(screen.queryByRole("button",{name:"Complete Opening"})).toBeNull();
});
it("makes recovery, causal report sections and recognition explicit without inventing a reward",()=>{
 const g=advanceSteps(action(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;show(g);
 const report=screen.getByRole("dialog",{name:"Incident postmortem"});expect(report.textContent).toContain("SERVICE RECOVERED");
 for(const heading of ["What happened","What you changed","What happened next","Trade-off"])expect(within(report).getByRole("heading",{name:heading})).toBeTruthy();
 const cash=g.campaign!.cashCents;fireEvent.click(within(report).getByRole("button",{name:"Continue company"}));
 expect(screen.getByRole("dialog",{name:"First growth challenge handled"}).textContent).toContain("FIRST GROWTH RECOVERED");
 expect(screen.getByRole("button",{name:"Complete Opening"})).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Continue operating"}));
 expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).toContain("STAGE 2 — SCALE YOUR APP");expect(useGame.getState().game.campaign!.cashCents).toBe(cash);expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).toContain("FIRST GROWTH COMPLETE");
});
it.each(["read-heavy","write-heavy"] as const)("describes the actual %s data profile without promising read-heavy play",profile=>{
 show(dataCompany(profile));const g=screen.getByRole("region",{name:"Campaign guidance"});expect(g.textContent).toContain("Data Bottlenecks");
 expect(g.textContent).toContain(profile==="read-heavy"?"80% reads / 20% writes":"20% reads / 80% writes");expect(g.textContent).toContain("Writes still reach the database");
});
it("introduces delayed spike response without exposing upcoming physical deadlines",()=>{
 const g=spikeCompany(false);show(g);expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).toContain("STAGE 4 — SURVIVE TRAFFIC SPIKES");
 expect(screen.getByRole("region",{name:"Traffic spikes and autoscaling"}).textContent).not.toContain("Pulse boundaries");
});
it("shows actual pulse traffic and controller observations rather than a scripted incident",()=>{
 show(untilOffset(spikeCompany(),13));const control=screen.getByRole("region",{name:"Traffic spikes and autoscaling"});
 expect(control.textContent).toContain("TRAFFIC SPIKE ACTIVE: 4000 req/s");expect(control.textContent).toContain("High-utilization observations");expect(control.textContent).toContain("Cooldown");
});
