import {render,screen,within,cleanup,fireEvent,act as renderAct} from "@testing-library/react";
import {it,expect,beforeEach,afterEach} from "vitest";
import {CampaignPanel,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {dataCompany,spikeCompany,untilOffset,act,tick} from "../sim/__tests__/spikeFixtures";
function decision(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function show(g:GameState){useGame.setState({game:g,started:true,ready:true,onboarding:false});render(<><CampaignPanel/><CampaignOverlays/></>);}
const requirements=()=>screen.getByRole("region",{name:"Progression requirements"});
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
it("shows real Scaling headroom blockers without disabling valid experimentation",()=>{
 let g=advanceSteps(decision(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;g=decision(decision(g,{type:"acknowledge_review"}),{type:"acknowledge_milestone"});show(g);
 expect(requirements().textContent).toContain("Why next stage is locked");expect(requirements().textContent).toContain("✗ Database headroom: 1,000 / 2,000 ops/s");
 expect((screen.getByRole("button",{name:/Add application/}) as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByRole("button",{name:"Continue to data strategy"})).toBeNull();
});
it("shows Data unhealthy/backlog requirements and keeps contrast optional",()=>{
 const g=dataCompany();g.campaign!.dbBacklog=1;g.campaign!.snapshot.latencyMs=500;show(g);
 expect(requirements().textContent).toContain("✗ Application and Database queues empty");expect(requirements().textContent).toContain("✗ Healthy latency");expect(requirements().textContent).toContain("Workload contrast is optional");expect(screen.queryByRole("button",{name:"Continue to traffic spikes"})).toBeNull();
});
it("surfaces stable spike count and reopenable explicit recognition without automatic acknowledgement",()=>{
 let g=act(spikeCompany(false),{type:"set_traffic_limit",enabled:true});g=untilOffset(g,68);show(g);
 expect(requirements().textContent).toContain("Stable baseline observations: 1 / 5");expect(requirements().textContent).toContain("Autoscaling is optional");
 renderAct(()=>useGame.setState({game:tick(g,4)}));const dialog=screen.getByRole("dialog",{name:"Spike response handled"});fireEvent.click(within(dialog).getByRole("button",{name:"Close"}));
 expect(screen.queryByRole("dialog")).toBeNull();expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(false);
 fireEvent.click(within(requirements()).getByRole("button",{name:"Review spike recognition"}));fireEvent.click(within(screen.getByRole("dialog",{name:"Spike response handled"})).getByRole("button",{name:"Continue operating"}));
 expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(true);expect(requirements().textContent).toContain("available through Continue to reliability");
});
it("pending recovery review remains prominent rather than inside History or collapsed details",()=>{
 const g=advanceSteps(decision(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;show(g);
 const button=within(requirements()).getByRole("button",{name:"Review postmortem"});expect(button.closest("details")).toBeNull();expect(button.closest('[aria-label="Campaign guidance"]')).toBeTruthy();
 expect(requirements().textContent).toContain("✓ Incident recovered");expect(requirements().textContent).toContain("✗ Postmortem reviewed");
});
