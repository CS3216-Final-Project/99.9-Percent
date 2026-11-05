import InspectionReveal from "./InspectionReveal";
import { inspectionAction } from "./inspectionTestUtils";
import {render,screen,within,fireEvent,cleanup,act} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel} from "./CampaignUI";
import {CampaignChapters} from "./CampaignChapters";
import {inspectInRoom,inspectOrSelect,useGame} from "../game/store";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {protectedCompany} from "../sim/__tests__/completionFixture";
import {pauseTransition} from "../sim/__tests__/pauseFixture";
import {advanceSteps,applyCampaignInput} from "../sim/step";
import {applyAction,newGame,type GameState} from "../sim";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(cleanup);
function show(game:GameState){useGame.setState({game,ready:true,started:true,onboarding:false});render(<><CampaignChapters/><CampaignPanel/><InspectionReveal/></>);}
// Construct engine-heavy companies once outside each UI interaction deadline.
const incidentTransitions=new Map([1,2,3,4,5].map(chapter=>[chapter,pauseTransition(chapter)]));
it.each([1,2,3,4,5])("keeps the incident banner and recovery affordances visible during a Chapter %i incident",chapter=>{
 show(structuredClone(incidentTransitions.get(chapter)!).incident);
 expect(useGame.getState().game.phase).toBe("incident");
 expect(screen.getByRole("region",{name:"Incident"})).toBeTruthy();
 expect(screen.getByRole("heading",{name:"Service slowdown"})).toBeTruthy();
 expect(screen.getByRole("region",{name:"Incident recovery"})).toBeTruthy();
});
it("keeps the recovery bar in the pinned incident banner from zero, and the count in the card",()=>{
 const game=structuredClone(incidentTransitions.get(1)!).incident;
 const head=()=>screen.getByRole("region",{name:"Incident"}).querySelector(".panel-head")! as HTMLElement;
 const card=()=>screen.getByRole("region",{name:"Incident recovery"});
 for(const [steps,now,count] of [[0,"0","0/5 s"],[2,"40","2/5 s"]] as const){
  cleanup();game.campaign!.incident!.stableSteps=steps;show(game);
  // The bar never moves: it is in the banner at zero as well, so progress does not make it jump there.
  expect(within(head()).getByRole("progressbar",{name:"Recovery progress"}).getAttribute("aria-valuenow")).toBe(now);
  expect(within(card()).queryByRole("progressbar",{name:"Recovery progress"})).toBeNull();
  expect(within(card()).getByRole("heading",{name:"Recovery progress"})).toBeTruthy();
  expect(within(card()).getByText(count)).toBeTruthy();
  expect(screen.getAllByRole("progressbar",{name:"Recovery progress"})).toHaveLength(1);
 }
});
it.each([1,2])("lists the recovery conditions openly during a Chapter %i incident",chapter=>{
 show(structuredClone(incidentTransitions.get(chapter)!).incident);
 const card=screen.getByRole("region",{name:"Incident recovery"});
 expect(card.querySelector("details")).toBeNull();
 expect(within(card).getByText(/Latency below/)).toBeTruthy();
 expect(within(card).getByText(/consecutive game seconds/)).toBeTruthy();
});
it.each([3,4,5])("folds the recovery conditions into a closed drop-down the player toggles during a Chapter %i incident",chapter=>{
 show(structuredClone(incidentTransitions.get(chapter)!).incident);
 const card=screen.getByRole("region",{name:"Incident recovery"});
 const details=card.querySelector("details")!,summary=within(card).getByText("Recovery requirements");
 expect(summary.tagName).toBe("SUMMARY");
 expect(details.open).toBe(false);
 expect(details.contains(within(card).getByText(/Latency below/))).toBe(true);
 expect(details.contains(within(card).getByText(/consecutive game seconds/))).toBe(true);
 expect(within(card).getByRole("heading",{name:"Recovery progress"})).toBeTruthy();
 expect(details.contains(within(card).getByText(/An unhealthy second resets progress/))).toBe(false);
 fireEvent.click(summary);expect(details.open).toBe(true);
 fireEvent.click(summary);expect(details.open).toBe(false);
});
it.each([
 ["Launch Week",()=>advanceSteps(newGame(1,"launch-title",2),6).state],
 ["Opening",()=>newGame()],
 ["Scaling & Routing",()=>dataCompany("read-heavy",false)],
 ["Data Strategy",()=>dataCompany()],
])("titles the %s requirements with the chapter the chapter bar marks current",(name,company)=>{
 const game=company();show(game);
 expect(screen.getByLabelText("Current Guided Mode stage").textContent).toBe(name);
 const heading=within(screen.getByRole("region",{name:"Guided Mode requirements"})).getByRole("heading",{level:3});
 expect(heading.textContent).toMatch(new RegExp(`^${name.replace("&","\\&")} · \\d+/\\d+$`));
});
it("shows all Opening requirements without a disclosure or generic growth-waiting message",()=>{
 show(newGame());const requirements=screen.getByRole("region",{name:"Guided Mode requirements"});
 expect(within(requirements).getByRole("heading",{name:/^Opening/})).toBeTruthy();
 expect(within(requirements).getAllByRole("listitem")).toHaveLength(3);
 expect(requirements.querySelector("summary")).toBeNull();
 expect(screen.queryByText(/Waiting for the next company growth event/)).toBeNull();
});
it("keeps the selected workload hidden until actual growth and enters through the paused store",()=>{
 show(dataCompany("read-heavy",false));const guide=screen.getByRole("region",{name:"Guided Mode guidance"});
 expect(screen.getByLabelText("Current objective").textContent).toContain("Prepare the system for the next growth wave.");
 expect(guide.textContent).not.toContain("Prepare the system for the next growth wave.");
 expect(within(guide).getByRole("heading",{name:/^Scaling & Routing/})).toBeTruthy();
 expect(within(guide).queryByRole("button",{name:/Continue to Data Strategy/})).toBeNull();
 fireEvent.click(within(screen.getByRole("region",{name:"Guided Mode chapters"})).getByRole("button",{name:/Continue to Data Strategy/}));
 expect(useGame.getState().tour?.track).toBe("data");
 expect(screen.queryByRole("region",{name:"Data strategy"})).toBeNull();
 act(()=>useGame.getState().endTour(true));
 expect(screen.queryByRole("region",{name:"Data strategy"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Read Cache"}));fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 const data=within(screen.getByRole("dialog",{name:"Read Cache"})).getByRole("region",{name:"Data strategy"});expect(data.textContent).toContain("Waiting for workload growth");
 expect(data.textContent).not.toMatch(/read-heavy|write-heavy|80%|20%/);expect(useGame.getState().running).toBe(false);
});
it("shows the current stage cap instead of advertising a locked database tier",()=>{
 show(dataCompany("read-heavy",false));const button=inspectionAction(/Upgrade database/);
 expect(button.hasAttribute("disabled")).toBe(true);expect(button.querySelector(".act-affordance-done")).not.toBeNull();expect(button.closest(".campaign-action-card")!.textContent).not.toContain("3,000");
 fireEvent.click(screen.getByRole("button",{name:"Close"}));
 fireEvent.click(screen.getByRole("button",{name:/Continue to Data Strategy/}));
 act(()=>useGame.getState().endTour(true));
 const nextButton=inspectionAction(/Upgrade database/);
 expect(nextButton.hasAttribute("disabled")).toBe(false);fireEvent.click(nextButton);
 expect(screen.getByRole("region",{name:"Purchase preview"}).textContent).toContain("4 game seconds");
 expect(screen.getByRole("region",{name:"Purchase preview"}).textContent).toContain("4,000");
 fireEvent.click(screen.getByText("How it works"));
 expect(`${nextButton.textContent}${screen.getByRole("region",{name:"Purchase details"}).textContent}`).toContain("3,000 ops/s");
});
it("selects the cache through the same inspection action and displays actual used evidence",()=>{
 show(advanceSteps(dataCompany(),6).state);const c=useGame.getState().game.campaign!,step=c.step;
 fireEvent.click(screen.getByRole("button",{name:"Read Cache"}));
 expect(useGame.getState().selected).toBe("cache");expect(useGame.getState().game.campaign!.step).toBe(step);
 expect(useGame.getState().game.campaign!.trace.at(-1)).toMatchObject({type:"inspection",data:{component:"cache"}});
 fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 const readings=screen.getByRole("region",{name:"Read Cache readings"});
 expect(readings.textContent).toContain("Read / write share80% / 20%");
 expect(readings.textContent).toContain("Effective hit rate used0%");
 expect(readings.textContent).toContain("Eligible misses1,920");
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
 show(acknowledge.state);expect(screen.queryByRole("region",{name:"Data strategy"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Read Cache"}));
 fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 fireEvent.click(screen.getByText("Observe another workload"));
 const before=useGame.getState().game;
 fireEvent.click(screen.getByRole("button",{name:"Observe contrasting workload"}));
 expect(useGame.getState().game.campaign!.dataStage).toEqual(contrast.state.campaign!.dataStage);
 expect(useGame.getState().game.campaign!.step).toBe(before.campaign!.step);
 const data=within(screen.getByRole("dialog",{name:"Read Cache"})).getByRole("region",{name:"Data strategy"});
 expect(data.textContent).toContain("Workload: write-heavy");
 const readings=screen.getByRole("region",{name:"Read Cache readings"});
 expect(readings.textContent).toContain("read-heavy");
 expect(readings.textContent).toContain("Reads / writes");
 expect(readings.textContent).toContain(`${g.campaign!.snapshot.data!.reads.toLocaleString("en-US")} / ${g.campaign!.snapshot.data!.writes.toLocaleString("en-US")}`);
});
it("routes each app through its checkbox and keeps the last routed one checked",()=>{
 show(dataCompany("read-heavy",false));fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));let route=screen.getByRole("group",{name:/Send traffic to/});
 const boxes=within(route).getAllByRole("checkbox");
 expect(boxes.map(b=>b.textContent)).toEqual(["Server 1","Server 2"]);
 expect(boxes.map(b=>b.getAttribute("aria-checked"))).toEqual(["true","true"]);
 fireEvent.click(within(route).getByRole("checkbox",{name:"Server 2"}));
 // Picks in the window wait for it to close, then go as one routing change.
 expect(within(route).getByRole("checkbox",{name:"Server 2"}).getAttribute("aria-checked")).toBe("false");
 expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="routing")).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"Close"}));
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-1"]});
 fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));route=screen.getByRole("group",{name:/Send traffic to/});
 const reason=screen.getByText("Routing requires deployed load balancing, valid active targets and a changed configuration.");
 expect(reason.getAttribute("tabindex")).toBe("0");
 expect(reason.closest("fieldset")).toBeNull();
 expect(route.hasAttribute("disabled")).toBe(true);
 act(()=>useGame.setState({game:advanceSteps(useGame.getState().game,3).state}));
 fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));route=screen.getByRole("group",{name:/Send traffic to/});
 const only=within(route).getByRole("checkbox",{name:"Server 1"});
 expect(only.getAttribute("aria-checked")).toBe("true");expect(only.hasAttribute("disabled")).toBe(true);
 fireEvent.click(only);
 expect(useGame.getState().game.campaign!.routing.targets).toEqual(["app-1"]);
});
it("leaves a reserved spare out of the routing checklist",()=>{
 const g=protectedCompany();expect(g.campaign!.apps.find(a=>a.id==="app-2")!.role).toBe("spare");
 show(g);fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));const route=screen.getByRole("group",{name:/Send traffic to/});
 const boxes=within(route).getAllByRole("checkbox");
 expect(boxes.map(b=>b.textContent)).toEqual(["Server 1","Server 3"]);
 expect(boxes.map(b=>b.getAttribute("aria-checked"))).toEqual(["true","true"]);
 fireEvent.click(within(route).getByRole("checkbox",{name:"Server 3"}));
 fireEvent.click(screen.getByRole("button",{name:"Close"}));
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-1"]});
},15_000);

const openRouting=()=>{fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));return screen.getByRole("group",{name:/Send traffic to/});};
const queue=(action:Parameters<typeof applyCampaignInput>[1])=>{const next=applyCampaignInput(useGame.getState().game,action);expect(next.result.ok).toBe(true);act(()=>useGame.setState({game:next.state}));};
const routingPending=()=>useGame.getState().game.campaign!.pending.filter(a=>a.type==="routing").map(a=>a.routing!.targets);
it("drops routing picks with a notice when another routing change is queued while the Network window is open",()=>{
 show(dataCompany("read-heavy",false));
 fireEvent.click(within(openRouting()).getByRole("checkbox",{name:"Server 2"}));
 // The autoscaler queues routing on its own; that closes the window, and the picks can no longer go.
 queue({type:"set_routing",mode:"balanced",targets:["app-2"]});
 expect(screen.queryByRole("dialog",{name:"Network management"})).toBeNull();
 expect(routingPending()).toEqual([["app-2"]]);
 expect(useGame.getState().toast).toMatchObject({kind:"info",text:"Another routing change is pending, so your traffic picks were not sent."});
 // Nothing was tried and refused, so the campaign's history holds no rejection.
 expect(useGame.getState().lastAction?.type).not.toBe("set_routing");
});
it("sends routing picks when the Network window closes for another queued change",()=>{
 show(dataCompany("read-heavy",false));
 fireEvent.click(within(openRouting()).getByRole("checkbox",{name:"Server 2"}));
 queue({type:"set_traffic_limit",enabled:true});
 expect(screen.queryByRole("dialog",{name:"Network management"})).toBeNull();
 expect(routingPending()).toEqual([["app-1"]]);
});
it("sends routing picks when the player inspects another machine from the Network window",()=>{
 show(dataCompany("read-heavy",false));
 fireEvent.click(within(openRouting()).getByRole("checkbox",{name:"Server 2"}));
 act(()=>inspectInRoom("db"));
 expect(routingPending()).toEqual([["app-1"]]);
 expect(screen.getByRole("dialog",{name:"Database"})).toBeTruthy();
});
it("applies routing picks on top of routing that changed while the Network window was open",()=>{
 show(protectedCompany());
 fireEvent.click(within(openRouting()).getByRole("checkbox",{name:"Server 3"}));
 // A failover queued before the window opened promotes the spare while it is open.
 const game=structuredClone(useGame.getState().game),c=game.campaign!;
 c.apps.find(a=>a.id==="app-2")!.role="serving";c.reliabilityStage!.spareId=null;c.routing={mode:"balanced",targets:["app-1","app-2","app-3"]};
 c.apps.forEach(a=>a.routed=c.routing.targets.includes(a.id));
 act(()=>useGame.setState({game}));
 const route=screen.getByRole("group",{name:/Send traffic to/});
 expect(within(route).getAllByRole("checkbox").map(b=>`${b.textContent}:${b.getAttribute("aria-checked")}`)).toEqual(["Server 1:true","Server 2:true","Server 3:false"]);
 fireEvent.click(screen.getByRole("button",{name:"Close"}));
 // Only the player's pick changes: the promoted spare keeps its traffic.
 expect(routingPending()).toEqual([["app-1","app-2"]]);
},15_000);

it("opens shared equipment readings and dismisses without advancing or purchasing",()=>{
 show(newGame());
 const app=screen.getByRole("button",{name:"App Server"});
 const heading=screen.getByRole("heading",{name:"Inspect equipment"});expect(heading.querySelector(".tip")).toBeNull();
 fireEvent.click(app);fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 const readings=screen.getByRole("region",{name:"Servers readings"});
 expect(app.getAttribute("aria-pressed")).toBe("true");
 expect(readings.textContent).not.toMatch(/Latest measurement|Busy is the share|Installed servers only help/);
 const inspected=useGame.getState().game;
 fireEvent.click(screen.getByRole("button",{name:"Close"}));
 expect(screen.queryByRole("region",{name:"Servers readings"})).toBeNull();expect(useGame.getState().game).toBe(inspected);
 expect(useGame.getState().selected).toBe("app");
 fireEvent.click(app);fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));expect(screen.getByRole("region",{name:"Servers readings"})).toBeTruthy();
 fireEvent.click(screen.getByRole("button",{name:"Close"}));
 fireEvent.click(screen.getByRole("button",{name:"Database"}));fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 expect(screen.queryByRole("region",{name:"Servers readings"})).toBeNull();expect(screen.getByRole("region",{name:"Database readings"})).toBeTruthy();
 expect(useGame.getState().game.campaign!.step).toBe(inspected.campaign!.step);expect(useGame.getState().game.campaign!.cashCents).toBe(inspected.campaign!.cashCents);
});

it("keeps normal Campaign infrastructure controls in inspections and retains the optional contrast",()=>{
 const game=dataCompany(),c=game.campaign!;show(game);
 const panel=within(screen.getByRole("complementary",{name:"System metrics"}));
 expect(panel.queryByRole("heading",{name:"Actions"})).toBeNull();
 expect(panel.queryByRole("heading",{name:"Analysis"})).toBeNull();
 expect(panel.queryByRole("region",{name:"Data strategy"})).toBeNull();
 expect(panel.queryByText(/Scaling growth recorded|Traffic growth applied/)).toBeNull();
 expect(panel.getByRole("region",{name:"Guided Mode requirements"})).toBeTruthy();
 expect(panel.queryByRole("button",{name:/Deploy Read Cache|Upgrade database|Add server/})).toBeNull();
 fireEvent.click(panel.getByRole("button",{name:"Read Cache"}));
 fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 fireEvent.click(screen.getByText("Observe another workload"));
 const contrast=screen.getByRole("button",{name:"Observe contrasting workload"});
 expect(contrast.hasAttribute("disabled")).toBe(true);
 const before=useGame.getState().game;fireEvent.click(contrast);expect(useGame.getState().game).toBe(before);
 const grown=advanceSteps(game,6).state;act(()=>useGame.setState({game:grown}));
 expect(screen.getByRole("region",{name:"Data strategy"}).textContent).toContain(c.dataStage!.profile);
});
