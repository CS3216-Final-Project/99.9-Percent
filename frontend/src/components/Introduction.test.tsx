import {act,cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {useGame} from "@/game/store";
import {CampaignAttentionHost} from "./CampaignAttention";
import {CampaignHeader,CampaignPanel,CampaignControls} from "./CampaignUI";
import InspectionReveal from "./InspectionReveal";
import {decodeSave,CAMPAIGN_SAVE_KEY} from "@/game/saveEnvelope";
const names=["Network","App Server","Database","Monitoring"];
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);vi.spyOn(document,"hasFocus").mockReturnValue(true);vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({x:10,y:10,top:10,left:10,right:54,bottom:54,width:44,height:44,toJSON:()=>({})});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function show(){render(<CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/><InspectionReveal/></CampaignAttentionHost>);const message=screen.queryByRole("dialog",{name:"Company Message"});if(message)fireEvent.click(within(message).getByRole("button",{name:"Dismiss company message"}));}
function start(){useGame.getState().boot();useGame.getState().play();show();}
const gold=()=>document.querySelectorAll<HTMLElement>(".campaign-gold-attention");
const press=(name:string)=>fireEvent.click(screen.getByRole("button",{name}));
it("guides each component, repeats Hint at every step and explicitly enters Chapter 1",async()=>{
 start();expect(screen.getByRole("button",{name:"Complete Introduction"}).hasAttribute("disabled")).toBe(true);
 const c=useGame.getState().game.campaign!;
 for(let i=0;i<names.length;i++) {
  await act(async()=>{});expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe(names[i]);
  press("Hint");const hint=screen.getByRole("dialog",{name:"Hint"});expect(hint.textContent).toContain(names[i]==="App Server"?"App Servers":names[i]);
  fireEvent.click(within(hint).getByRole("button",{name:"Got it"}));await act(async()=>{});
  press(names[i]);await act(async()=>{});expect(gold()).toHaveLength(0);
  expect(useGame.getState().game.campaign!.launchWeek!.introduction!.explored).toHaveLength(i);
  expect(screen.queryByRole("button",{name:/Upgrade database|Add server|Limit to/})).toBeNull();
  press("Inspect details");press("Got it");await act(async()=>{});
  expect(useGame.getState().game.campaign!.launchWeek!.introduction!.explored).toHaveLength(i+1);
 }
 press("Hint");expect(screen.getByRole("dialog",{name:"Hint"}).textContent).toContain("Complete Introduction");press("Got it");
 expect(screen.getByRole("button",{name:"Complete Introduction"}).hasAttribute("disabled")).toBe(false);press("Complete Introduction");
 const next=useGame.getState().game.campaign!;expect(next.scaling).toBeNull();expect(next.openingMilestone).toBeNull();expect(next.inputs.at(-1)?.action).toEqual({type:"complete_introduction",handoff:"opening"});expect(next.runId).toBe(c.runId);expect(next.cashCents).toBe(2000000);expect(next.dbCapacity).toBe(600);expect(next.step).toBe(0);
 expect(screen.queryByRole("region",{name:"Introduction Progress"})).toBeNull();expect(next.completedIntroduction!.completed).toBe(true);expect(screen.getByLabelText("Current chapter").textContent).toBe("Opening");
});
it("lets players explore other components and close with Escape without skipping the current step",async()=>{
 start();press("Monitoring");fireEvent.keyDown(screen.getByRole("dialog",{name:"Monitoring"}),{key:"Escape"});await act(async()=>{});
 expect(useGame.getState().game.campaign!.launchWeek!.introduction!.explored).toEqual([]);
 expect(screen.queryByRole("dialog",{name:"Monitoring"})).toBeNull();expect(gold()).toHaveLength(1);expect(gold()[0].textContent).toBe("Network");
 press("Network");press("Close");await act(async()=>{});expect(gold()[0].textContent).toBe("App Server");
 expect(useGame.getState().game.campaign!.step).toBe(0);
});
it("resumes halfway from the normal save without advancing or duplicating progress",async()=>{
 start();for(const name of names.slice(0,2)){press(name);press("Got it");}
 const raw=localStorage.getItem(CAMPAIGN_SAVE_KEY)!;expect(decodeSave(raw).status).toBe("ok");cleanup();
 useGame.setState(useGame.getInitialState(),true);useGame.getState().boot();useGame.getState().play();show();await act(async()=>{});
 expect(screen.getByRole("region",{name:"Introduction Progress"}).textContent).toContain("2/4");expect(gold()[0].textContent).toBe("Database");
 press("Network");press("Got it");expect(useGame.getState().game.campaign!.launchWeek!.introduction!.explored).toHaveLength(2);
 for(const name of names.slice(2)){press(name);press("Got it");}press("Complete Introduction");expect(useGame.getState().game.campaign!.scaling).toBeNull();expect(useGame.getState().game.campaign!.completedIntroduction!.completed).toBe(true);
});
it("keeps the introduction clock paused and refuses premature completion through the store",()=>{
 start();const c=useGame.getState().game.campaign!;
 act(()=>{useGame.getState().setRunning(true);useGame.getState().tick(10000);});
 expect(useGame.getState().game.campaign!.step).toBe(0);expect(useGame.getState().game.campaign!.cashCents).toBe(c.cashCents);
 act(()=>{expect(useGame.getState().act({type:"complete_introduction"})).toBe(false);});expect(useGame.getState().game.campaign!.scaling).toBeNull();
});

it("restores the original company after a completed practice introduction",async()=>{
 start();for(const name of names){press(name);press("Got it");}press("Complete Introduction");cleanup();
 const original=useGame.getState().game;act(()=>useGame.getState().startTour("campaign"));show();await act(async()=>{});
 expect(useGame.getState().tutorialCompany!.game).toEqual(original);
 for(const name of names){press(name);press("Got it");}press("Complete Introduction");
 expect(useGame.getState().tutorialCompany).toBeNull();expect(useGame.getState().game).toEqual(original);expect(useGame.getState().running).toBe(false);
});
