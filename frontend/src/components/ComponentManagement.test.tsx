import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, inspectInRoom } from "@/game/store";
import { finishingScaling } from "@/sim/__tests__/dataFixture";
import { type GameState } from "@/sim";
import { spikeCompany, act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { CampaignPanel, CampaignHeader, CampaignControls } from "./CampaignUI";
import { CampaignAttentionHost } from "./CampaignAttention";
import InspectionReveal from "./InspectionReveal";
import { setConfirming } from "./actionConfirmation";
import * as guidance from "@/game/campaignAttention";

beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(()=>{cleanup();setConfirming(null);vi.restoreAllMocks();});
function show(game:GameState) {useGame.setState({game,ready:true,started:true,onboarding:false,tour:null,running:false});render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/><InspectionReveal/></CampaignAttentionHost>);}
const press=(name:string|RegExp)=>fireEvent.click(screen.getByRole("button",{name}));
const app=()=>screen.getByRole("dialog",{name:"App Servers"});

it("shows a compact fleet with authoritative counts and hides individual actions until selection",()=>{
  const game=preparedReliability();show(game);press("App Server");press("Server management");const popup=within(app());
  expect(app().querySelectorAll('[data-guidance-app]')).toHaveLength(game.campaign!.apps.length);
  expect(popup.queryByRole("button",{name:/Scale up|Restore App|Install spare/})).toBeNull();
  press("Back to Servers");
  expect(popup.getByRole("button",{name:"Add server"})).toBeTruthy();
  expect(app().querySelectorAll('[data-guidance-app]')).toHaveLength(0);
  expect(app().querySelector(".component-inspection-metric")?.textContent).toBe("3 installed / 3 healthy / 2 currently routed");
  press("Server management");
  expect(popup.getByRole("button",{name:"Autoscaling"})).toBeTruthy();
  const rows=app().querySelectorAll('.inspection-fleet-summary dd');
  expect([...rows].map(r=>r.textContent)).toEqual(["3","3","2"]);
});

it("selects exactly one server and keeps Back, technical metrics and Cancel read-only",()=>{
  const game=tick(finishingScaling(),3);
  show(game);press("App Server");press("Server management");fireEvent.click(app().querySelector('[data-guidance-app="app-2"]')!);
  expect(within(app()).getByRole("heading",{name:"App 2"})).toBeTruthy();
  expect(within(app()).queryByRole("button",{name:"Add server"})).toBeNull();
  const before=useGame.getState().game;press("Scale up App 2");expect(screen.getByRole("dialog",{name:"Purchase preview"})).toBeTruthy();
  press("Cancel");expect(useGame.getState().game).toBe(before);
  press("Back to Server management");expect(app().querySelectorAll('[data-guidance-app]')).toHaveLength(game.campaign!.apps.length);
  press("Back to Servers");
  expect(app().querySelector(".component-inspection-metric")?.textContent).toContain(`${game.campaign!.apps.length} installed`);
  expect(app().querySelectorAll('[data-guidance-app]')).toHaveLength(0);
});

it("keeps locked autoscaling prerequisites visible in its dedicated screen",()=>{
  show(spikeCompany(false));press("App Server");press("Server management");press("Autoscaling");
  expect(app().textContent).toContain("Controller: Locked");
  expect(within(app()).getByRole("button",{name:"Deploy autoscaling"}).hasAttribute("disabled")).toBe(true);
  expect([...app().querySelectorAll(".campaign-action-reason")].map(n=>n.textContent).join(" ")).toMatch(/Requires unlock, balanced routing to two apps/);
  const detail=within(app()).getByText("Technical Details").closest("details")!;
  expect(detail.open).toBe(false);fireEvent.click(within(app()).getByText("Technical Details"));
  expect(detail.textContent).toContain("Scale out above 80% for 3 game seconds");
  expect(detail.textContent).toContain("3 game seconds, followed by 1 routing game second");
  press("Unlock autoscaling");press("Confirm");
  expect(useGame.getState().game.campaign!.spikeStage!.researchSpent).toBeTruthy();
  expect(within(app()).getByRole("button",{name:"Deploy autoscaling"}).hasAttribute("disabled")).toBe(false);
});

it("retains deployed controller configuration and costs without mixing server controls",()=>{
  show(spikeCompany());press("App Server");press("Server management");press("Autoscaling");
  expect(app().textContent).toContain("Controller: Deployed");
  expect(within(app()).queryByRole("button",{name:/Scale up App|Install spare/})).toBeNull();
  press("Disable autoscaling");expect(useGame.getState().game.campaign!.spikeStage!.controller!.enabled).toBe(false);
  expect(app().textContent).toContain("Controller upkeep");
});

it("keeps Network admission separate from routing, balancing and failover",()=>{
  show(preparedReliability());press("Network");const popup=screen.getByRole("dialog",{name:"Network inspected"});
  expect(within(popup).getByRole("button",{name:/Limit to/})).toBeTruthy();
  expect(within(popup).queryByText(/Configure routing/)).toBeNull();
  expect(within(popup).queryByRole("button",{name:/Deploy Automatic Failover/})).toBeNull();
  press("Network management");press("Routing");expect(within(popup).getByText(/Configure routing/)).toBeTruthy();
  press("Back to Network management");press("Automatic failover");expect(within(popup).getByRole("button",{name:"Disable failover"})).toBeTruthy();
  press("Back to Network management");press("Back to Network");expect(within(popup).getByRole("button",{name:"Inspect details"})).toBeTruthy();
});

it("routes a failed-server Hint through its card and valid Confirm to free restoration",async()=>{
  vi.spyOn(document,"hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({x:10,y:10,left:10,top:10,right:54,bottom:54,width:44,height:44,toJSON:()=>({})});
  const game=tick(decide(preparedReliability(),{type:"arm_reliability"}),8),id=game.campaign!.reliabilityStage!.fault!.targetId;
  show(game);press("Hint");press("Got it");await act(async()=>{});
  const gold=()=>document.querySelectorAll<HTMLElement>('.campaign-gold-attention');
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("App Server");fireEvent.click(gold()[0]);await act(async()=>{});
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toContain("Server management");fireEvent.click(gold()[0]);await act(async()=>{});
  expect(gold()).toHaveLength(1);expect(gold()[0].getAttribute("data-guidance-app")).toBe(id);fireEvent.click(gold()[0]);await act(async()=>{});
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toContain(`Restore App ${id.slice(4)}`);fireEvent.click(gold()[0]);await act(async()=>{});
  const before=useGame.getState().game.campaign!;expect(before.pending.some(a=>a.type==="restore-app")).toBe(false);
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Confirm");press("Confirm");
  expect(useGame.getState().game.campaign!.cashCents).toBe(before.cashCents);
  expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="restore-app"&&a.targetId===id)).toBe(true);
  expect(screen.queryByRole("dialog",{name:"App Servers"})).toBeNull();
});

it("shares the focused server view between its card and the room entry",()=>{
  show(preparedReliability());press("App Server");press("Server management");fireEvent.click(app().querySelector('[data-guidance-app="app-2"]')!);const first=app().textContent;
  press("Close");act(()=>inspectInRoom("app","app-2"));expect(app().textContent).toBe(first);
});

it("releases and reserves the selected spare using the original delayed actions",()=>{
  show(preparedReliability());act(()=>inspectInRoom("app","app-3"));
  press(/Release spare/);expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="release-spare")).toBe(true);
  act(()=>useGame.setState({game:tick(useGame.getState().game)}));
  act(()=>inspectInRoom("app","app-3"));press(/Reserve App 3 as spare/);
  expect(useGame.getState().game.campaign!.pending.some(a=>a.type==="reserve-spare"&&a.targetId==="app-3")).toBe(true);
});

it("keeps unaffordable server scaling disabled with its real funding reason",()=>{
  const game=tick(finishingScaling(),3);game.campaign!.cashCents=1;show(game);
  act(()=>inspectInRoom("app","app-2"));
  const scale=within(app()).getByRole("button",{name:"Scale up App 2"});
  expect(scale.hasAttribute("disabled")).toBe(true);
  expect([...app().querySelectorAll('.campaign-action-reason')].map(n=>n.textContent).join(" ")).toMatch(/cash|fund/i);
  fireEvent.click(scale);expect(screen.queryByRole("dialog",{name:"Purchase preview"})).toBeNull();
});

it("routes a valid autoscaling recommendation through its subview to Confirm without changing resolver policy",async()=>{
  // Exercise the UI adapter's advice contract; this does not assert that the
  // optional controller should be the resolver's default strategy.
  const game=decide(spikeCompany(false),{type:"unlock_autoscaling"});
  const base=guidance.campaignAttention(game);
  vi.spyOn(guidance,"campaignAttention").mockReturnValue({...base,key:"autoscaling-adapter",attention:"hint",target:"app",action:{action:{type:"deploy_autoscaler"},label:"Deploy autoscaling",evidence:"Controller unlocked; balanced routing available."}});
  vi.spyOn(document,"hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({x:10,y:10,left:10,top:10,right:54,bottom:54,width:44,height:44,toJSON:()=>({})});
  show(game);press("Hint");press("Got it");await act(async()=>{});
  const gold=()=>document.querySelectorAll<HTMLElement>('.campaign-gold-attention');
  for(const label of ["App Server","Server management","Autoscaling","Deploy autoscaling"]) {
    expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe(label);
    fireEvent.click(gold()[0]);await act(async()=>{});
  }
  expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Confirm");
  const before=useGame.getState().game;press("Cancel");expect(useGame.getState().game).toBe(before);
  expect(screen.getByRole("button",{name:"Back to Server management"})).toBeTruthy();
});
