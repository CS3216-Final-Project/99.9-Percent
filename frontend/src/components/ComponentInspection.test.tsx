import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, inspectInRoom } from "@/game/store";
import { newGame, type GameState } from "@/sim";
import { advanceSteps, step } from "@/sim/step";
import { act as decide, tick, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";
import { combinedCompany } from "@/sim/__tests__/combinedFixture";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { campaignAttention } from "@/game/campaignAttention";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignPanel, CampaignControls } from "./CampaignUI";
import InspectionReveal from "./InspectionReveal";
import { setConfirming } from "./actionConfirmation";

beforeEach(()=>{
  localStorage.clear(); useGame.setState(useGame.getInitialState(),true);
  vi.spyOn(document,"hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({x:10,y:10,top:10,left:10,right:54,bottom:54,width:44,height:44,toJSON:()=>({})});
  vi.useFakeTimers({toFake:["setTimeout","clearTimeout","performance"]});
});
afterEach(()=>{cleanup();setConfirming(null);vi.useRealTimers();vi.restoreAllMocks();});
function show(game:GameState=advanceSteps(newGame(),6).state) {
  useGame.setState({game,ready:true,started:true,onboarding:false,tour:null,running:false});
  render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/><InspectionReveal/></CampaignAttentionHost>);
}
const gold=()=>document.querySelectorAll<HTMLElement>(".campaign-gold-attention");
const open=(name:string)=>fireEvent.click(screen.getByRole("button",{name}));
const titleOf=(name:string)=>name==="Servers"?"App Servers":`${name} inspected`;
const dialog=(name:string)=>within(screen.getByRole("dialog",{name:titleOf(name)}));
const networkView=(name:string)=>{if(screen.queryByRole("button",{name:"Network management"}))open("Network management");expect(dialog("Network").getByRole("heading",{name})).toBeTruthy();};
async function accept() {
  open("Hint");fireEvent.click(within(screen.getByRole("dialog",{name:"Hint"})).getByRole("button",{name:/Got it|Upgrade database/}));
  await act(async()=>{});
}
it("routes accepted database help through inspection and valid immediate Confirm, then authoritative pending Run",async()=>{
  show();const before=useGame.getState().game.campaign!;
  await accept();expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Database");
  fireEvent.click(gold()[0]);await act(async()=>{});
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toContain("Upgrade database");
  expect(dialog("Database").getByText("Overloaded")).toBeTruthy();
  expect(useGame.getState().game.campaign!.step).toBe(before.step);
  fireEvent.click(gold()[0]);await act(async()=>{});
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Confirm");
  expect(screen.getByRole("region",{name:"Purchase preview"}).textContent).toContain("Upkeep");
  open("Confirm");await act(async()=>{});
  expect(gold()).toHaveLength(0);expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="upgrade-db")).toBe(true);
  expect(campaignAttention(useGame.getState().game).attention).toBe("run");
  expect(screen.queryByRole("dialog",{name:"Database inspected"})).toBeNull();
  act(()=>vi.advanceTimersByTime(10000));expect(gold()).toHaveLength(1);expect(gold()[0].getAttribute("aria-label")).toBe("Run");
});
it("shares identical live metrics and actions between room and shortcut without unrelated controls",async()=>{
  show();open("Database");const first=screen.getByRole("dialog",{name:"Database inspected"}).textContent;
  expect(dialog("Database").queryByRole("button",{name:/Add server|Limit to/})).toBeNull();
  open("Inspect details");expect(screen.getByRole("region",{name:"Database readings"}).textContent).toContain("Demand");
  fireEvent.click(dialog("Database").getByRole("button",{name:"Close"}));
  act(()=>inspectInRoom("db"));await act(async()=>{});
  expect(screen.getByRole("dialog",{name:"Database inspected"}).textContent).toBe(first);
  expect(useGame.getState().game.campaign!.trace.filter(e=>e.type==="inspection").length).toBeGreaterThanOrEqual(2);
});
it("keeps Cancel read-only and contains keyboard focus in the existing preview",async()=>{
  show();open("Database");fireEvent.click(dialog("Database").getByRole("button",{name:/Upgrade database/}));await act(async()=>{});
  const before=useGame.getState().game;const quote=screen.getByRole("dialog",{name:"Purchase preview"});
  expect(document.activeElement).toBe(within(quote).getByRole("button",{name:"Confirm"}));
  const cancel=within(quote).getByRole("button",{name:"Cancel"});cancel.focus();fireEvent.keyDown(cancel,{key:"Tab"});
  expect(quote.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(cancel,{key:"Escape"});await act(async()=>{});
  expect(screen.queryByRole("dialog",{name:"Purchase preview"})).toBeNull();expect(useGame.getState().game).toBe(before);
  expect(document.activeElement?.textContent).toContain("Upgrade database");
});
it("disables unaffordable upgrades and never lights an invalid Confirm",async()=>{
  const game=advanceSteps(newGame(),6).state;game.campaign!.cashCents=1;show(game);open("Database");
  expect(dialog("Database").getByRole("button",{name:/Upgrade database/}).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button",{name:"Confirm"})).toBeNull();expect(gold()).toHaveLength(0);
});
it("keeps an installed cache unavailable for duplicate purchase while exposing its tuning action",()=>{
  show(spikeCompany(false));open("Read Cache");
  expect(dialog("Read Cache").getByRole("button",{name:"Deploy Read Cache"}).hasAttribute("disabled")).toBe(true);
  expect(dialog("Read Cache").getByRole("button",{name:/Tune cache ceiling/}).hasAttribute("disabled")).toBe(false);
  expect(screen.queryByRole("button",{name:"Confirm"})).toBeNull();
});
it("keeps Monitoring research prerequisites discoverable without an invalid purchase",()=>{
  show(reliabilityCompany());open("Monitoring");open("Inspect details");
  const action=dialog("Monitoring").getByRole("button",{name:"Deploy Health Checks"});
  expect(action.hasAttribute("disabled")).toBe(true);
  expect(action.querySelector(".act-affordance-locked")).not.toBeNull();
  expect(action.getAttribute("aria-description")).toMatch(/research|unlock/i);
  fireEvent.click(action);expect(screen.queryByRole("dialog",{name:"Purchase preview"})).toBeNull();
  expect(gold()).toHaveLength(0);
});
it("keeps App scaling and adding together and routing prerequisites with Network",()=>{
  show(dataCompany("read-heavy",false));open("App Server");
  expect(dialog("Servers").getByRole("button",{name:/Add server/})).toBeTruthy();
  expect(dialog("Servers").queryByRole("button",{name:/Scale up App/})).toBeNull();open("Server management");fireEvent.click(document.querySelector<HTMLElement>('[data-guidance-app="app-1"]')!);
  expect(dialog("Servers").getByRole("button",{name:/Scale up App/})).toBeTruthy();
  fireEvent.click(dialog("Servers").getByRole("button",{name:"Close"}));open("Network");
  networkView("Load balancing");expect(dialog("Network").getByRole("button",{name:/Deploy load balancing/}).hasAttribute("disabled")).toBe(true);
  networkView("Routing");expect(dialog("Network").getByRole("group",{name:/Send traffic to/})).toBeTruthy();
  open("Back to Network");expect(dialog("Network").getByRole("button",{name:/Limit to ~/})).toBeTruthy();
});
it.each([4,6])("routes Chapter %s traffic-limit advice to its real Network action, not About",async chapter=>{
  let game=chapter===4?spikeCompany(false):combinedCompany();
  if (chapter===4) {
    game=tick(decide(game,{type:"add_server"}),2);
    game=tick(decide(game,{type:"scale_up",appId:"app-3"}),3);
    game=tick(decide(game,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
  }
  game=tick(decide(game,{type:"set_traffic_limit",enabled:true}));
  if(chapter===4) game=untilOffset(game,8);
  show(game);const decision=campaignAttention(game);expect(decision.action?.action.type).toBe("set_traffic_limit");
  await accept();expect(gold()[0].textContent).toBe("Network");fireEvent.click(gold()[0]);await act(async()=>{});
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toContain("Remove traffic limit");
  fireEvent.click(gold()[0]);await act(async()=>{});expect(gold()[0].textContent).toBe("Confirm");
  open("Cancel");await act(async()=>{});expect(gold()).toHaveLength(0);
  expect(useGame.getState().game.campaign!.limit).not.toBeNull();
});
it("a mandatory modal supersedes the accepted inspection spotlight",async()=>{
  show();await accept();fireEvent.click(gold()[0]);await act(async()=>{});expect(gold()).toHaveLength(1);
  const blocker=document.createElement("div");blocker.className="modal-backdrop";
  await act(async()=>{document.body.append(blocker);});expect(gold()).toHaveLength(0);
  await act(async()=>{blocker.remove();});expect(gold()).toHaveLength(0);
});

it("lets the player choose another valid strategy without a competing equipment spotlight",async()=>{
 show();await accept();expect(gold()[0].textContent).toBe("Database");
 open("Network");await act(async()=>{});expect(gold()).toHaveLength(0);
 fireEvent.click(dialog("Network").getByRole("button",{name:/Limit to ~/}));await act(async()=>{});
 expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Confirm");open("Confirm");await act(async()=>{});
 expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="limit")).toBe(true);
 expect(campaignAttention(useGame.getState().game).attention).toBe("run");
});

it("routes eligible read-cache advice to Read Cache instead of the database controls",async()=>{
 const game=tick(dataCompany(),6);
 // Enough for a cache, below the upgrade cost: an existing supported strategy.
 game.campaign!.cashCents=250000;
 expect(campaignAttention(game).action?.action.type).toBe("deploy_cache");show(game);
 await accept();expect(gold()[0].textContent).toBe("Read Cache");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()[0].textContent).toContain("Deploy Read Cache");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()[0].textContent).toBe("Confirm");open("Confirm");await act(async()=>{});
 expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="cache")).toBe(true);
});

it.each([
 ["db","Database","Database"], ["app","App Server","Servers"],
 ["gateway","Network","Network"], ["cache","Read Cache","Read Cache"],
 ["monitoring","Monitoring","Monitoring"],
] as const)("shares the %s popup between shortcut and room inspection",async(equipment,shortcut,title)=>{
 show(spikeCompany(false));open(shortcut);
 const first=screen.getByRole("dialog",{name:titleOf(title)}).textContent;
 fireEvent.click(dialog(title).getByRole("button",{name:"Close"}));
 act(()=>inspectInRoom(equipment));await act(async()=>{});
 expect(screen.getByRole("dialog",{name:titleOf(title)}).textContent).toBe(first);
 expect(dialog(title).getByRole("button",{name:"Inspect details"})).toBeTruthy();
});

it("completes accepted Monitoring inspection and recalculates without a stale spotlight",async()=>{
 let game=tick(decide(spikeCompany(false),{type:"add_server"}),2);
 game=tick(decide(game,{type:"scale_up",appId:"app-3"}),3);
 game=tick(decide(game,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
 game=untilOffset(game,8);expect(campaignAttention(game).target).toBe("monitoring");show(game);
 await accept();expect(gold()[0].textContent).toBe("Monitoring");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()).toHaveLength(0);expect(campaignAttention(useGame.getState().game).attention).toBe("run");
 fireEvent.click(dialog("Monitoring").getByRole("button",{name:"Inspect details"}));await act(async()=>{});
 expect(screen.getByRole("region",{name:"Monitoring readings"})).toBeTruthy();
 expect(screen.queryByRole("button",{name:"Confirm"})).toBeNull();
});

it.each([4,5,6])("keeps Chapter %s summaries outside component inspections",chapter=>{
 show(chapter===4?spikeCompany(false):chapter===5?reliabilityCompany():combinedCompany());
 if(chapter>=5) expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain(chapter===5?"Stay Online":"Grow the Company");
 open("Network");const network=screen.getByRole("dialog",{name:"Network inspected"});
 expect(network.textContent).not.toMatch(/Stay online|Stable after restoration|Workload:|Normal demand|Opening campaign/);
 expect(dialog("Network").getByRole("button",{name:/traffic limit|Limit to/})).toBeTruthy();
 networkView("Routing");expect(dialog("Network").getByRole("group",{name:/Send traffic to/})).toBeTruthy();
 if(chapter>=5) {networkView("Automatic failover");expect(dialog("Network").getByRole("button",{name:/Deploy Automatic Failover/})).toBeTruthy();}
 fireEvent.click(dialog("Network").getByRole("button",{name:"Close"}));open("Read Cache");
 expect(screen.getByRole("dialog",{name:"Read Cache inspected"}).textContent).not.toMatch(/Workload:|Growth due|Waiting for workload growth/);
 expect(dialog("Read Cache").getByRole("button",{name:/Tune cache ceiling/})).toBeTruthy();
 fireEvent.click(dialog("Read Cache").getByRole("button",{name:"Close"}));open("App Server");
 expect(screen.getByRole("dialog",{name:"App Servers"}).textContent).not.toMatch(/Stay online|Stable after restoration|Normal demand|spike demand/);
 open("Server management");open("Autoscaling");expect(dialog("Servers").getByRole("button",{name:/Deploy autoscaling/})).toBeTruthy();
});

it("distinguishes saturation from overload without inventing an incident",()=>{
 const game=advanceSteps(newGame(),6).state,m=game.campaign!.snapshot.db;
 m.demand=m.capacity;m.demandRatio=1;m.backlog=0;show(game);open("Database");
 expect(dialog("Database").getByText("At capacity",{exact:true})).toBeTruthy();
 expect(dialog("Database").queryByText("Overloaded",{exact:true})).toBeNull();
 expect(screen.getByRole("dialog",{name:"Database inspected"}).textContent).toContain("using all available capacity");
});

it("describes a failed server's zero available capacity and shows that instance's diagnostics",async()=>{
 const game=tick(decide(reliabilityCompany(),{type:"arm_reliability"}),8);
 const id=game.campaign!.reliabilityStage!.fault!.targetId;
 show(game);act(()=>inspectInRoom("app",id));await act(async()=>{});
 const popup=screen.getByRole("dialog",{name:"App Servers"});
 expect(dialog("Servers").getByText("Down",{exact:true})).toBeTruthy();
 expect(popup.querySelector(".component-inspection-metric")?.textContent).toContain("0 available /");
 expect(popup.textContent).not.toMatch(/operating at full capacity|using all available capacity/);
 fireEvent.click(dialog("Servers").getByText("Technical Details"));
 const evidence=screen.getByRole("region",{name:"Servers readings"}),instance=game.campaign!.snapshot.instances!.find(a=>a.id===id)!;
 expect(evidence.querySelectorAll(".evidence-rows dd")[0].textContent).toBe(`${instance.demand.toLocaleString("en-US")} requests/s`);
 expect(dialog("Servers").getByRole("button",{name:new RegExp(`^Restore App ${id.slice(4)}`)}).hasAttribute("disabled")).toBe(false);
});

it("groups unrouted serving capacity into one warning instead of repeating it per server",()=>{
 const game=tick(decide(combinedCompany(),{type:"set_routing",mode:"single",targets:["app-1"]}));show(game);open("App Server");open("Server management");
 const notes=screen.getByRole("dialog",{name:"App Servers"}).querySelectorAll(".inspection-warning");
 expect(notes).toHaveLength(1);
 for(const app of game.campaign!.apps.filter(a=>!a.routed&&a.role!=="spare")) expect(notes[0].textContent).toContain(`App ${app.id.slice(4)}`);
});

it("transfers a specific server recommendation through instance selection before Scale up",async()=>{
 const game=tick(decide(untilOffset(spikeCompany(false),8),{type:"add_server"}),2);
 expect(campaignAttention(game).action?.action).toEqual({type:"scale_up",appId:"app-3"});show(game);
 await accept();expect(gold()[0].textContent).toBe("App Server");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toContain("Server management");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()).toHaveLength(1);expect(gold()[0].getAttribute("data-guidance-app")).toBe("app-3");
 fireEvent.click(gold()[0]);await act(async()=>{});expect(gold()[0].textContent).toBe("Scale up App 3");
 fireEvent.click(gold()[0]);await act(async()=>{});expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Confirm");
});
it("walks Chapter 6 routing through its checklist before pending Run",async()=>{
 let game=tick(decide(combinedCompany(),{type:"set_traffic_limit",enabled:true}));
 game=tick(decide(game,{type:"set_routing",mode:"single",targets:["app-1"]}));
 expect(campaignAttention(game).action?.action).toEqual({type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]});show(game);
 await accept();expect(gold()[0].textContent).toBe("Network");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()[0].textContent).toContain("Network management");fireEvent.click(gold()[0]);await act(async()=>{});
 expect(gold()[0].getAttribute("role")).toBe("checkbox");expect(gold()[0].textContent).toBe("App 2");
 fireEvent.click(gold()[0]);await act(async()=>{});
 expect(screen.queryByRole("dialog",{name:"Network inspected"})).toBeNull();
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-1","app-2"]});
});

it("summarises a failed fleet without exposing server cards until management",()=>{
 const game=tick(decide(reliabilityCompany(),{type:"arm_reliability"}),8);
 show(game);open("App Server");
 const popup=screen.getByRole("dialog",{name:"App Servers"}),c=game.campaign!;
 expect(popup.querySelectorAll('[data-guidance-app]')).toHaveLength(0);
 expect(dialog("Servers").getByText("Warning",{exact:true})).toBeTruthy();
 expect(popup.querySelector(".component-inspection-metric")?.textContent).toContain(`${c.apps.filter(a=>a.health!=="failed").length} healthy`);
 open("Server management");
 expect(popup.querySelectorAll('[data-guidance-app]')).toHaveLength(c.apps.length);
});

it("returns keyboard focus to the shortcut after initial and nested inspection dismissal",()=>{
 show(newGame());
 const shortcut=screen.getByRole("button",{name:"App Server"});
 shortcut.focus();fireEvent.click(shortcut);
 const popup=screen.getByRole("dialog",{name:"App Servers"});
 fireEvent.keyDown(within(popup).getByRole("button",{name:"Close"}),{key:"Escape"});
 expect(document.activeElement).toBe(shortcut);
 fireEvent.click(shortcut);open("Server management");
 fireEvent.keyDown(screen.getByRole("dialog",{name:"App Servers"}),{key:"Escape"});
 expect(document.activeElement).toBe(shortcut);
});

it("keeps legacy Launch Week incident inspections and upgrades usable after the week ends",()=>{
 let game=newGame(7,"late-launch-inspection",2);
 // Step explicitly past the incident pause to reproduce an already-saved week-end incident.
 for(let i=0;i<60;i++)game=step(game).state;
 expect(game.phase).toBe("incident");
 expect(game.campaign!.launchWeek!.completedStep).not.toBeNull();
 expect(game.campaign!.openingMilestone!.acknowledged).toBe(false);
 show(game);open("Database");
 const popup=screen.getByRole("dialog",{name:"Database inspected"});
 const upgrade=within(popup).getByRole("button",{name:/Upgrade database/});
 expect(upgrade.hasAttribute("disabled")).toBe(false);
 fireEvent.click(upgrade);
 expect(screen.getByRole("region",{name:"Confirm Upgrade database"})).toBeTruthy();
 expect(screen.getByRole("button",{name:"Confirm"}).hasAttribute("disabled")).toBe(false);
});
