import {render,screen,within,fireEvent,cleanup,act} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel} from "./CampaignUI";
import {CampaignChapters} from "./CampaignChapters";
import {inspectOrSelect,useGame} from "../game/store";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {protectedCombined} from "../sim/__tests__/combinedFixture";
import {advanceSteps} from "../sim/step";
import {applyAction,newGame,type GameState} from "../sim";
import {spikeCompany,act as decide,tick,untilOffset} from "../sim/__tests__/spikeFixtures";
import {preparedReliability} from "../sim/__tests__/reliabilityFixture";
import {combinedCompany} from "../sim/__tests__/combinedFixture";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(cleanup);
function show(game:GameState){useGame.setState({game,ready:true,started:true,onboarding:false});render(<><CampaignChapters/><CampaignPanel/></>);}
it("shows all Opening requirements without a disclosure or generic growth-waiting message",()=>{
 show(newGame());const requirements=screen.getByRole("region",{name:"Guided Mode requirements"});
 expect(within(requirements).getByRole("heading",{name:/Chapter requirements/})).toBeTruthy();
 expect(within(requirements).getAllByRole("listitem")).toHaveLength(3);
 expect(requirements.querySelector("summary")).toBeNull();
 expect(screen.queryByText(/Waiting for the next company growth event/)).toBeNull();
});
it("keeps the selected workload hidden until actual growth and enters through the paused store",()=>{
 show(dataCompany("read-heavy",false));const guide=screen.getByRole("region",{name:"Guided Mode guidance"});
 expect(screen.getByLabelText("Current objective").textContent).toContain("Understand how server capacity and routing work together.");
 expect(guide.textContent).not.toContain("Understand how server capacity and routing work together.");
 expect(within(guide).getByText(/Chapter requirements/)).toBeTruthy();
 expect(within(guide).queryByRole("button",{name:/Continue to data strategy/})).toBeNull();
 fireEvent.click(within(screen.getByRole("region",{name:"Guided Mode chapters"})).getByRole("button",{name:/Continue to data strategy/}));
 const data=screen.getByRole("region",{name:"Data strategy"});expect(data.textContent).toContain("Waiting for workload growth");
 expect(data.textContent).not.toMatch(/read-heavy|write-heavy|80%|20%/);expect(useGame.getState().running).toBe(false);
});

it.each([
 [1,()=>newGame()], [2,()=>dataCompany("read-heavy",false)], [3,()=>dataCompany()],
 [4,()=>spikeCompany(false)], [5,()=>preparedReliability()], [6,()=>combinedCompany()],
] as const)("chapter %i separates its educational goal, situation and requested Hint",(_chapter,company)=>{
 const game=company();show(game);
 const goal=screen.getByLabelText("Current objective").textContent!;
 const guide=screen.getByRole("region",{name:"Guided Mode guidance"});
 expect(goal).not.toMatch(/Run your company|Keep running|Press |Inspect |Prepare if/);
 expect(guide.textContent).toContain("Current situation:");
 expect(guide.textContent).not.toContain(goal.replace("Goal: ",""));
 expect(guide.textContent).not.toMatch(/Next required step:|Run your company|Keep running|Prepare if you wish/);
 fireEvent.click(screen.getByRole("button",{name:"Hint"}));
 expect(screen.getByRole("dialog",{name:"Here's a hint"}).textContent).toMatch(/Run|Start|Continue|Prepare/);
 expect(useGame.getState().game).toBe(game);
});

it("keeps incident warnings and factual measurements visible without disclosing the diagnosis",()=>{
 const game=advanceSteps(newGame(),7).state;show(game);
 const incident=screen.getByRole("region",{name:"Incident"});
 expect(incident.textContent).toContain("Checking recovery: 0/5 game seconds");
 expect(incident.textContent).toContain("Active service incident");
 expect(incident.textContent).not.toContain("Compare database demand");
 fireEvent.click(within(incident).getByRole("button",{name:"Hint"}));
 expect(screen.getByRole("dialog").textContent).toContain("Compare database demand");
 expect(useGame.getState().game).toBe(game);
});

it("keeps Chapter 4's goal stable and exposes its actual final baseline observation",()=>{
 let game=spikeCompany(false);game=tick(decide(game,{type:"add_server"}),2);
 game=tick(decide(game,{type:"scale_up",appId:"app-3"}),3);
 game=tick(decide(game,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
 game=untilOffset(game,71);show(game);
 expect(screen.getByLabelText("Current objective").textContent).toBe("Goal: Keep your company reliable during sudden traffic spikes.");
 const progress=screen.getByLabelText("Spike progress");
 expect(progress.textContent).toContain("Traffic pulses completed2 / 2");
 expect(progress.textContent).toContain("Stable baseline observations4 / 5");
 expect(screen.getByRole("region",{name:"Guided Mode guidance"}).textContent).not.toContain("Run your company");
 fireEvent.click(screen.getByRole("button",{name:"Hint"}));
 expect(screen.getByRole("dialog").textContent).toContain("One more stable observation");
 expect(screen.getByRole("dialog").textContent).toContain("Run your company");
});

it("keeps the reliability decision and factual requirements available before Hint",()=>{
 show(preparedReliability());
 expect(screen.getByRole("button",{name:"Start reliability test"}).hasAttribute("disabled")).toBe(false);
 const requirements=screen.getByRole("region",{name:"Reliability requirements"});
 expect(requirements.querySelector('[data-requirement="armed"]')?.getAttribute("data-met")).toBe("false");
 expect(requirements.textContent).toContain("Stable service: 0 / 5");
 expect(screen.getByRole("region",{name:"Stay Online"}).textContent).not.toContain("Prepare, then");
});

it("preserves reliability restoration and remaining observation facts without Run advice",()=>{
 let game=decide(preparedReliability(),{type:"arm_reliability"});
 for(let i=0;i<100&&game.campaign!.reliabilityStage!.stableSteps!==4;i++){
  if(game.phase==="review")game=decide(game,{type:"acknowledge_review"});game=tick(game);
 }
 show(game);
 const requirements=screen.getByRole("region",{name:"Reliability requirements"});
 for(const id of ["armed","observed","restored"])expect(requirements.querySelector(`[data-requirement="${id}"]`)?.getAttribute("data-met")).toBe("true");
 expect(requirements.textContent).toContain("Stable service: 4 / 5");
 expect(screen.getByRole("region",{name:"Guided Mode guidance"}).textContent).not.toContain("Run your company");
 fireEvent.click(screen.getByRole("button",{name:"Hint"}));
 expect(screen.getByRole("dialog").textContent).toContain("One more stable observation");
});
it("shows the current stage cap instead of advertising a locked database tier",()=>{
 show(dataCompany("read-heavy",false));const button=screen.getByRole("button",{name:/Upgrade database/});
 expect(button.hasAttribute("disabled")).toBe(true);expect(button.textContent).toContain("Current stage tier reached");expect(button.textContent).not.toContain("3,000");
 fireEvent.click(screen.getByRole("button",{name:/Continue to data strategy/}));
 expect(button.hasAttribute("disabled")).toBe(false);expect(button.textContent).toContain("4,000");expect(button.textContent).toContain("4 game seconds");
});
it("selects the cache through the same inspection action and displays actual used evidence",()=>{
 show(advanceSteps(dataCompany(),6).state);const c=useGame.getState().game.campaign!,step=c.step;
 fireEvent.click(screen.getByRole("button",{name:"Read Cache"}));
 expect(useGame.getState().selected).toBe("cache");expect(useGame.getState().game.campaign!.step).toBe(step);
 expect(useGame.getState().game.campaign!.trace.at(-1)).toMatchObject({type:"inspection",data:{component:"cache"}});
 const data=screen.getByRole("region",{name:"Data strategy"});expect(data.textContent).toContain("Reads 80% / writes 20%");
 expect(data.textContent).toContain("effective hit rate used 0%");expect(data.textContent).toContain("eligible misses 1920");
});

it("inspects the Team office as company operations, and ignores equipment Guided Mode does not support",()=>{
 show(dataCompany());const before=useGame.getState().game.campaign!;
 act(()=>inspectOrSelect("team"));
 expect(useGame.getState().selected).toBe("team");
 const after=useGame.getState().game.campaign!;
 expect(after.step).toBe(before.step);expect(after.inputs).toBe(before.inputs);expect(after.trace).toBe(before.trace);
 const callout=screen.getByText("Engineers operate the infrastructure and carry out scheduled changes.");
 expect(callout.closest('[role="status"]')).not.toBeNull();
 act(()=>inspectOrSelect("standby"));
 expect(useGame.getState().selected).toBe("team");
 expect(useGame.getState().game.campaign!.inputs).toBe(before.inputs);
});

it("labels the last completed profile separately from an immediate contrast",()=>{
 let g=advanceSteps(dataCompany(),6).state;
 const deploy=applyAction(g,{type:"deploy_cache"});if(!deploy.ok)throw Error(deploy.message);
 g=advanceSteps(deploy.state,30).state;const acknowledge=applyAction(g,{type:"acknowledge_review"});if(!acknowledge.ok)throw Error(acknowledge.message);
 const contrast=applyAction(acknowledge.state,{type:"contrast_workload"});if(!contrast.ok)throw Error(contrast.message);
 show(contrast.state);const data=screen.getByRole("region",{name:"Data strategy"});
 expect(data.textContent).toContain("Workload: write-heavy");
 expect(data.textContent).toContain(`Workload evidence · game second ${g.campaign!.step} · read-heavy`);
 expect(data.textContent).toContain("Reads 80% / writes 20%");
});
it("offers each routing choice once and marks the one in use",()=>{
 show(dataCompany("read-heavy",false));const route=screen.getByRole("group",{name:/Send traffic to/});
 expect(within(route).getAllByRole("button").map(b=>b.textContent)).toEqual(["All apps","App 1 only","App 2 only"]);
 expect(within(route).getByRole("button",{name:"All apps"}).getAttribute("aria-pressed")).toBe("true");
 const before=useGame.getState().game;
 fireEvent.click(within(route).getByRole("button",{name:"All apps"}));
 expect(useGame.getState().game).toBe(before);
 expect(screen.getByText("Configure routing · all apps")).toBeTruthy();
 fireEvent.click(within(route).getByRole("button",{name:"App 2 only"}));
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-2"]});
 const reason=screen.getByText("Routing requires deployed load balancing, valid active targets and a changed configuration.");
 expect(reason.getAttribute("tabindex")).toBe("0");
 expect(reason.closest("fieldset")).toBeNull();
 expect(route.hasAttribute("disabled")).toBe(true);
});
it("leaves a reserved spare out of the routing choices, so the apps in use still read as all apps",()=>{
 const g=protectedCombined();expect(g.campaign!.apps.find(a=>a.id==="app-2")!.role).toBe("spare");
 show(g);const route=screen.getByRole("group",{name:/Send traffic to/});
 expect(within(route).getAllByRole("button").map(b=>b.textContent)).toEqual(["All apps","App 1 only","App 3 only"]);
 expect(within(route).getByRole("button",{name:"All apps"}).getAttribute("aria-pressed")).toBe("true");
 expect(screen.getByText("Configure routing · all apps")).toBeTruthy();
 fireEvent.click(within(route).getByRole("button",{name:"App 3 only"}));
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-3"]});
});
