import {render,screen,within,fireEvent,cleanup} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel,CampaignHeader,CampaignOverlays,CampaignControls} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {saveGame,DEFAULT_META,saveMeta} from "../game/persist";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(()=>cleanup());
function action(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function recovered(){return advanceSteps(action(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;}
function show(g:GameState){useGame.setState({game:g,ready:true,started:true,onboarding:false});return render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);}
function guidance(){return screen.getByRole("region",{name:"Campaign guidance"});}
it("labels the opening current and future stages locked without mutating campaign state",()=>{
 const g=newGame(),before=structuredClone(g);show(g);
 const nav=screen.getByRole("navigation",{name:"Campaign progression"});
 expect(nav.querySelector('[aria-current="step"]')?.textContent).toBe("1. First GrowthOpening Current");
 expect(within(nav).getByText(/Later stages/).closest("li")!.textContent).toContain("Locked");
 expect(within(guidance()).getByText(/Current stage:/).textContent).toContain("Opening");
 expect(within(guidance()).getByText(/Next stage requires acknowledgement/)).toBeTruthy();
 fireEvent.click(screen.getByText("Detailed system evidence"));
 expect(screen.getByRole("region",{name:"System evidence"})).toBeTruthy();expect(screen.getByRole("region",{name:"Actions"})).toBeTruthy();
 expect(useGame.getState().game).toEqual(before);
});
it("makes traffic limiting and opportunity value visible even when service is healthy",()=>{
 let g=advanceSteps(action(advanceSteps(newGame(),6).state,{type:"set_traffic_limit",enabled:true}),30).state;
 g=action(g,{type:"acknowledge_review"});g=action(g,{type:"acknowledge_milestone"});show(g);
 expect(screen.getByText("Stable — traffic limited")).toBeTruthy();
 const notice=screen.getByRole("note",{name:"Traffic limit trade-off"});
 expect(notice.textContent).toContain("Incoming: 800 req/s · Admitted: 500 req/s · Rejected: 300 req/s");
 expect(notice.textContent).toContain(new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(g.campaign!.ledger.rejected*20/100));
 expect(notice.textContent).toContain("not an extra charge");
});
it("explains installed but unrouted application capacity and its progression gate",()=>{
 const g=advanceSteps(action(newGame(),{type:"add_server"}),2).state;show(g);
 const note=screen.getByRole("note",{name:"App 2 routing status"});
 expect(note.textContent).toContain("Installed ✓ · Receiving traffic ✗");
 expect(note.textContent).toContain("Installed capacity: 1000 req/s · Routed capacity: 0 req/s");
 expect(note.textContent).toContain("until it is included in routing");
 expect(note.textContent).toContain("after acknowledging the opening postmortem and milestone");
});
it("keeps postmortem and milestone continuations visible and derives the next stage after acknowledgement",()=>{
 const g=recovered();show(g);
 expect(guidance().textContent).toContain("Pending acknowledgement: Incident postmortem");
 expect(guidance().textContent).toContain("Incident recovered");
 expect(useGame.getState().game.campaign!.openingMilestone).toBeNull();
 expect(useGame.getState().game.campaign!.scaling).toBeNull();
 fireEvent.click(within(screen.getByRole("dialog",{name:"Incident postmortem"})).getByRole("button",{name:"Close"}));
 expect(useGame.getState().game).toEqual(g);
 expect(screen.queryByRole("dialog")).toBeNull();
 expect(within(guidance()).queryByRole("button",{name:"Complete Opening"})).toBeNull();
 fireEvent.click(within(guidance()).getByRole("button",{name:"Review postmortem"}));
 fireEvent.click(screen.getByRole("button",{name:"Continue company"}));
 expect(guidance().textContent).toContain("Pending acknowledgement: First growth challenge handled");
 expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("Available next · acknowledge milestone");
 expect(useGame.getState().game.campaign!.scaling).toBeNull();
 const milestone=screen.getByRole("dialog",{name:"First growth challenge handled"});
 fireEvent.keyDown(milestone,{key:"Escape"});
 expect(useGame.getState().game.campaign!.openingMilestone!.acknowledged).toBe(false);
 fireEvent.click(within(guidance()).getByRole("button",{name:"Complete Opening"}));
 fireEvent.click(screen.getByRole("button",{name:"Continue operating"}));
 const nav=screen.getByRole("navigation",{name:"Campaign progression"});
 expect(nav.textContent).toContain("Opening Completed");expect(nav.querySelector('[aria-current="step"]')?.textContent).toBe("2. Scale Your AppScaling & Routing Current");
 expect(guidance().textContent).toContain("Database headroom: 1,000 / 2,000 ops/s");
 expect(useGame.getState().game.campaign!.step).toBe(g.campaign!.step);
});
it("shows available data continuation then current data context through existing actions",()=>{
 show(dataCompany("read-heavy",false));
 expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("Data Strategy Available next");
 fireEvent.click(within(guidance()).getByRole("button",{name:"Continue to data strategy"}));
 expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("Scaling & Routing Completed");
 expect(guidance().textContent).toContain("Current stage: Data Bottlenecks (Data Strategy)");expect(guidance().textContent).toMatch(/% reads \/ .*% writes/);
 expect(guidance().textContent).toContain("Cache: Not deployed");expect(guidance().textContent).toContain("No completed workload observation yet");
});
it.each(["review","milestone","scaling","data"])("reload derives %s guidance from existing saved state",kind=>{
 let g=kind==="data"?dataCompany():recovered();
 if(kind==="milestone"||kind==="scaling")g=action(g,{type:"acknowledge_review"});
 if(kind==="scaling")g=action(g,{type:"acknowledge_milestone"});
 saveMeta({...DEFAULT_META,openingOnboarding:{version:1,step:2,status:"completed"}});saveGame(g);
 useGame.getState().boot();useGame.getState().play();render(<><CampaignPanel/><CampaignOverlays/></>);
 const text=guidance().textContent;
 expect(text).toContain(kind==="review"?"Pending acknowledgement: Incident postmortem":kind==="milestone"?"Pending acknowledgement: First growth challenge handled":kind==="scaling"?"Current stage: Scale Your App (Scaling & Routing)":"Current stage: Data Bottlenecks (Data Strategy)");
 expect(useGame.getState().game.campaign).toEqual(g.campaign);
 if(kind==="review"||kind==="milestone") {
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Close"}));
  expect(within(guidance()).getByRole("button",{name:kind==="review"?"Review postmortem":"Complete Opening"})).toBeTruthy();
  expect(useGame.getState().game.campaign!.scaling).toBeNull();
 } else if(kind==="scaling") {
  expect(screen.getByRole("navigation",{name:"Campaign progression"}).textContent).toContain("Opening Completed");
  expect(within(guidance()).queryByRole("button",{name:"Complete Opening"})).toBeNull();
 }
});
it.each([0,1200,6000])("displays cache warmth %s from actual observations without selecting a solution",warmth=>{
 let g=dataCompany();g=advanceSteps(action(g,{type:"deploy_cache"}),2).state;
 g.campaign!.readCache!.warmth=warmth;show(g);
 expect(within(guidance()).getByText(new RegExp(`Cache: ${warmth===0?"Cold":warmth===6000?"Warm":"Warming"}\\.`))).toBeTruthy();
 expect(guidance().textContent).not.toContain("Upgrade the database now");
});

it("does not offer acknowledgements or unlock scaling before measured recovery",()=>{
 const g=advanceSteps(newGame(),6).state;show(g);
 expect(g.campaign!.incident).not.toBeNull();
 expect(within(guidance()).queryByRole("button",{name:"Review postmortem"})).toBeNull();
 expect(within(guidance()).queryByRole("button",{name:"Complete Opening"})).toBeNull();
 expect(useGame.getState().act({type:"enter_scaling"})).toBe(false);
 expect(useGame.getState().game.campaign!.scaling).toBeNull();
});
it("allows menu and history during pending review without implicitly acknowledging it",()=>{
 const g=recovered();show(g);
 fireEvent.click(within(screen.getByRole("dialog",{name:"Incident postmortem"})).getByRole("button",{name:"Close"}));
 fireEvent.click(screen.getByRole("button",{name:"Menu"}));
 expect(screen.getByRole("dialog",{name:"Menu"})).toBeTruthy();
 expect(useGame.getState().game).toEqual(g);
 fireEvent.click(within(screen.getByRole("dialog",{name:"Menu"})).getByRole("button",{name:"Close"}));
 expect(screen.getByRole("dialog",{name:"Incident postmortem"})).toBeTruthy();
 expect(useGame.getState().game).toEqual(g);
 fireEvent.click(within(screen.getByRole("dialog",{name:"Incident postmortem"})).getByRole("button",{name:"Close"}));
 fireEvent.click(screen.getByRole("button",{name:"History"}));
 expect(screen.getByRole("dialog",{name:"Campaign history"})).toBeTruthy();
 expect(useGame.getState().game).toEqual(g);
 fireEvent.click(within(screen.getByRole("dialog",{name:"Campaign history"})).getByRole("button",{name:"Close"}));
 expect(screen.getByRole("dialog",{name:"Incident postmortem"})).toBeTruthy();
 expect(useGame.getState().game).toEqual(g);
});
