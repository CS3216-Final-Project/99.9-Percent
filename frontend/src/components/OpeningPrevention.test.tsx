import {render,screen,within,fireEvent,cleanup} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignHeader,CampaignPanel,CampaignControls,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {saveGame,DEFAULT_META,saveMeta} from "../game/persist";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function prevented(){let g=newGame();g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});return advanceSteps(g,4).state;}
function show(g:GameState){useGame.setState({game:g,ready:true,started:true,onboarding:false});return render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);}
function qualified(){let g=prevented();g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});g=act(g,{type:"set_traffic_limit",enabled:false});return advanceSteps(g,5).state;}
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
it("shows factual outstanding prevention requirements and explicit component inspection",()=>{
 show(prevented());const checklist=screen.getByRole("region",{name:"Opening prevention progress"});
 expect(checklist.textContent).toContain("✗ Serve the full 800 req/s");expect(checklist.textContent).toContain("Handling the traffic increase without an incident is a valid way to complete First Growth");expect(checklist.textContent).toContain("You are protecting the system by rejecting traffic");expect(checklist.textContent).toContain("Stable service: 0 / 5");
 fireEvent.click(within(checklist).getByRole("button",{name:"Inspect Application evidence"}));expect(checklist.textContent).toContain("✓ Inspect the Application");
 fireEvent.click(within(checklist).getByRole("button",{name:"Inspect Database evidence"}));expect(checklist.textContent).toContain("✓ Inspect the Database");
 expect(useGame.getState().game.campaign!.step).toBe(4);expect(screen.queryByRole("button",{name:"Review outcome"})).toBeNull();
});
it("shows a distinct dismissible prevention outcome and the existing explicit milestone flow",()=>{
 const g=qualified();show(g);const step=g.campaign!.step,cash=g.campaign!.cashCents;
 expect(screen.queryByRole("dialog",{name:"Incident postmortem"})).toBeNull();const report=screen.getByRole("dialog",{name:"Prevention review"});
 expect(report.textContent).toContain("You prevented a production incident");expect(report.textContent).toContain("Rejected traffic before completion");
 for(const heading of ["What happened","What you prepared","What the evidence showed","Trade-offs","Outcome"])expect(within(report).getByRole("heading",{name:heading})).toBeTruthy();
 expect(report.textContent).toContain("Database upgrade: active before completion · setup $3,000.00");expect(report.textContent).toContain("Traffic limit removal: active before completion");
 expect(report.textContent).toContain(String(g.campaign!.openingPrevention!.outcome!.rejectedDemand));
 expect(report.textContent).not.toMatch(/perfect architecture|optimal spending|qualifying observations|prevention eligibility/i);
 fireEvent.click(within(report).getByRole("button",{name:"Close"}));expect(screen.getByRole("button",{name:"Review outcome"})).toBeTruthy();expect(screen.getByRole("region",{name:"Opening prevention progress"}).textContent).toContain("FIRST GROWTH PREVENTED");
 fireEvent.click(screen.getByRole("button",{name:"Review outcome"}));fireEvent.click(within(screen.getByRole("dialog",{name:"Prevention review"})).getByRole("button",{name:"Continue company"}));
 const milestone=screen.getByRole("dialog",{name:"First growth challenge handled"});expect(milestone.textContent).toContain("FIRST GROWTH PREVENTED");
 expect(screen.getByRole("button",{name:"Complete Opening"})).toBeTruthy();expect(useGame.getState().game.campaign!.scaling).toBeNull();
 fireEvent.click(within(milestone).getByRole("button",{name:"Continue operating"}));expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("First GrowthOpening Completed");
 expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).toContain("Current stage: Scale Your App");
 expect(useGame.getState().game.campaign!.cashCents).toBe(cash);expect(useGame.getState().game.campaign!.step).toBe(step);
});
it.each(["streak","outcome","milestone","scaling"])("reload preserves prevention %s guidance with paused time",kind=>{
 let g=qualified();if(kind==="streak"){
  g=prevented();g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,2).state;
 }
 if(kind==="milestone"||kind==="scaling")g=act(g,{type:"acknowledge_prevention_review"});if(kind==="scaling")g=act(g,{type:"acknowledge_milestone"});
 expect(saveGame(g)).toBe(true);saveMeta({...DEFAULT_META,openingOnboarding:{version:1,step:2,status:"completed"}});useGame.getState().boot();useGame.getState().play();
 render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);expect(useGame.getState().running).toBe(false);
 if(kind==="streak")expect(screen.getByRole("region",{name:"Opening prevention progress"}).textContent).toContain("Stable service: 2 / 5");
 if(kind==="outcome")expect(screen.getByRole("dialog",{name:"Prevention review"})).toBeTruthy();
 if(kind==="milestone")expect(screen.getByRole("button",{name:"Complete Opening"})).toBeTruthy();
 if(kind==="scaling")expect(screen.getByRole("region",{name:"Campaign guidance"}).textContent).toContain("Scale Your App");
 expect(useGame.getState().game.campaign).toEqual(g.campaign);
});

it("historical preparation excludes later purchases made at the same physical step",()=>{
 let g=qualified();g=act(g,{type:"acknowledge_prevention_review"});g=act(g,{type:"acknowledge_milestone"});g=act(g,{type:"start_db_upgrade"});
 useGame.setState({view:"history"});show(g);
 const history=screen.getByRole("region",{name:"Historical Opening prevention outcome"});
 expect(within(history).getAllByText(/Database upgrade:/)).toHaveLength(1);expect(history.textContent).not.toContain("still pending at completion");expect(history.textContent).toContain("Setup spending: $3,000.00");
});
it("review distinguishes accepted preparation still pending from useful installed capacity",()=>{
 let g=prevented();g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});g=act(g,{type:"set_traffic_limit",enabled:false});g=advanceSteps(g,4).state;g=act(g,{type:"add_server"});g=advanceSteps(g,1).state;show(g);
 const review=screen.getByRole("dialog",{name:"Prevention review"});expect(review.textContent).toContain("Additional application: requested; still pending at completion · setup $1,000.00");expect(g.campaign!.apps).toHaveLength(1);expect(review.textContent).toContain("Setup spending: $4,000.00");
});
