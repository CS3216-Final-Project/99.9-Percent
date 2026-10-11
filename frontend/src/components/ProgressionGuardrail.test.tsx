import {render,screen,within,cleanup,fireEvent,act as renderAct} from "@testing-library/react";
import {it,expect,beforeEach,afterEach} from "vitest";
import {CampaignPanel,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame,applyAction,type GameState,type Action} from "../sim";
import {advanceSteps} from "../sim/step";
import {dataCompany,spikeCompany,untilOffset,act,tick} from "../sim/__tests__/spikeFixtures";
function decision(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function show(g:GameState){useGame.setState({game:g,started:true,ready:true,onboarding:false});render(<><CampaignPanel/><CampaignOverlays/></>);}
const guidance=()=>screen.getByRole("region",{name:"Campaign guidance"});
const met=(id:string)=>guidance().querySelector(`[data-requirement="${id}"]`)!.getAttribute("data-met");
const recovered=()=>advanceSteps(decision(advanceSteps(newGame(),6).state,{type:"start_db_upgrade"}),30).state;
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
it("shows the Scaling headroom blocker without disabling experimentation",()=>{
 show(decision(decision(recovered(),{type:"acknowledge_review"}),{type:"acknowledge_milestone"}));
 expect(met("headroom")).toBe("false");expect(guidance().textContent).toContain("Database headroom: 1,000 / 2,000 ops/s");
 expect((screen.getByRole("button",{name:/Add server/}) as HTMLButtonElement).disabled).toBe(false);expect(screen.queryByRole("button",{name:/Continue to data strategy/})).toBeNull();
});
it("shows unmet Data requirements and keeps workload contrast optional",()=>{
 const g=dataCompany();g.campaign!.dbBacklog=1;g.campaign!.snapshot.latencyMs=500;show(g);
 expect(met("queues")).toBe("false");expect(met("healthy")).toBe("false");expect(guidance().textContent).toContain("Workload contrast is optional");
 expect(screen.queryByRole("button",{name:/Continue to traffic spikes/})).toBeNull();
});
it("counts stable spike observations and waits for an explicit acknowledgement",()=>{
 let g=act(spikeCompany(false),{type:"set_traffic_limit",enabled:true});g=untilOffset(g,68);show(g);
 expect(guidance().textContent).toContain("Stable baseline observations: 1 / 5");expect(guidance().textContent).toContain("Autoscaling is optional");
 renderAct(()=>useGame.setState({game:tick(g,4)}));
 expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(false);
 fireEvent.click(within(screen.getByRole("dialog",{name:"Spike response handled"})).getByRole("button",{name:/Continue operating/}));
 expect(useGame.getState().game.campaign!.spikeStage!.acknowledged).toBe(true);expect(guidance().textContent).toContain("available through Continue to reliability");
});
it("keeps a pending postmortem in front of the guidance",()=>{
 show(recovered());
 expect(screen.getByRole("dialog",{name:"Incident postmortem"})).toBeTruthy();
 expect(met("recovery")).toBe("true");expect(met("review")).toBe("false");
});
