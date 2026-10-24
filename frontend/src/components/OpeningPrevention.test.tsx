import {render,screen,within,fireEvent,cleanup} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignHeader,CampaignPanel,CampaignControls,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {saveGame,DEFAULT_META,saveMeta} from "../game/persist";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function prevented(){let g=newGame();g=act(g,{type:"set_traffic_limit",enabled:true});g=act(g,{type:"start_db_upgrade"});return advanceSteps(g,4).state;}
function inspected(){let g=prevented();g=act(g,{type:"incident_inspect",equipment:"app"});g=act(g,{type:"incident_inspect",equipment:"db"});return act(g,{type:"set_traffic_limit",enabled:false});}
const qualified=()=>advanceSteps(inspected(),5).state;
const ui=()=><><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>;
function show(g:GameState){useGame.setState({game:g,ready:true,started:true,onboarding:false});return render(ui());}
const guidance=()=>screen.getByRole("region",{name:"Guided Mode requirements"});
const requirement=(id:string)=>guidance().querySelector(`[data-requirement="${id}"]`)!;
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
it("lists outstanding prevention requirements and inspects components without advancing time",()=>{
 show(prevented());
 expect(requirement("admission").getAttribute("data-met")).toBe("false");expect(requirement("app-inspection").getAttribute("data-met")).toBe("false");
 expect(screen.getByRole("region",{name:"Opening prevention progress"}).textContent).toContain("Stable service: 0 / 5");
 fireEvent.click(screen.getByRole("button",{name:"Inspect Application"}));expect(requirement("app-inspection").getAttribute("data-met")).toBe("true");
 fireEvent.click(screen.getByRole("button",{name:"Inspect Database"}));expect(requirement("db-inspection").getAttribute("data-met")).toBe("true");
 expect(useGame.getState().game.campaign!.step).toBe(4);
});
it("recognises prevention accurately and continues to Scaling after both acknowledgements",()=>{
 const g=qualified();show(g);const step=g.campaign!.step,cash=g.campaign!.cashCents;
 expect(screen.queryByRole("dialog",{name:"Incident postmortem"})).toBeNull();
 const review=screen.getByRole("dialog",{name:"Prevention review"});
 expect(review.textContent).toContain("Database upgrade: active before completion · setup $3,000.00");expect(review.textContent).toContain("Traffic limit removal: active before completion");
 fireEvent.click(within(review).getByRole("button",{name:/Continue company/}));
 const recognition=screen.getByRole("dialog",{name:"First growth challenge handled"});
 expect(recognition.textContent).toContain("You spotted the bottleneck early and prevented an outage.");
 expect(useGame.getState().game.campaign!.scaling).toBeNull();
 expect(requirement("recovery").getAttribute("data-met")).toBe("true");
 expect(screen.getByLabelText("Current Guided Mode stage").textContent).toBe("Opening");
 fireEvent.click(within(recognition).getByRole("button",{name:/Continue to Scaling & Routing/}));
 expect(useGame.getState().game.campaign!.scaling).toBeTruthy();expect(useGame.getState().game.campaign!.reports).toEqual([]);
 expect(useGame.getState().game.campaign!.cashCents).toBe(cash);expect(useGame.getState().game.campaign!.step).toBe(step);
});
it.each(["streak","outcome","acknowledged"])("reload preserves prevention %s with paused time",kind=>{
 let g=kind==="streak"?advanceSteps(inspected(),2).state:qualified();
 if(kind==="acknowledged")g=act(g,{type:"acknowledge_prevention_review"});
 expect(saveGame(g)).toBe(true);saveMeta({...DEFAULT_META});useGame.getState().boot();useGame.getState().play();
 render(ui());expect(useGame.getState().running).toBe(false);
 if(kind==="streak")expect(screen.getByRole("region",{name:"Opening prevention progress"}).textContent).toContain("Stable service: 2 / 5");
 if(kind==="outcome")expect(screen.getByRole("dialog",{name:"Prevention review"})).toBeTruthy();
 if(kind==="acknowledged")expect(screen.getByRole("dialog",{name:"First growth challenge handled"})).toBeTruthy();
 expect(useGame.getState().game.campaign).toEqual(g.campaign);
});
it("history excludes purchases made after qualification",()=>{
 let g=qualified();g=act(g,{type:"acknowledge_prevention_review"});g=act(g,{type:"add_server"});
 useGame.setState({view:"history"});show(g);
 fireEvent.click(screen.getByRole("tab",{name:/^Incidents/}));fireEvent.click(screen.getByRole("button",{name:/Opening prevention outcome/}));
 const history=screen.getByRole("region",{name:"Historical Opening prevention outcome"});
 expect(within(history).getAllByText(/Database upgrade:/)).toHaveLength(1);expect(history.textContent).not.toContain("still pending at completion");expect(history.textContent).toContain("$3,000.00");
});
it("distinguishes preparation still pending at qualification",()=>{
 let g=advanceSteps(inspected(),4).state;g=act(g,{type:"add_server"});g=advanceSteps(g,1).state;show(g);
 const review=screen.getByRole("dialog",{name:"Prevention review"});
 expect(review.textContent).toContain("Additional application: still pending at completion · setup $1,000.00");expect(g.campaign!.apps).toHaveLength(1);expect(review.textContent).toContain("$4,000.00");
});
