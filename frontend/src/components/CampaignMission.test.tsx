import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import type { GameState } from "@/sim";
import { campaignGuidance } from "@/game/campaignGuidance";
import { campaignAttention } from "@/game/campaignAttention";
import { spikeCompany, untilOffset, act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { reliabilityCompany, preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { combinedCompany, finishedCompany, finishRound } from "@/sim/__tests__/combinedFixture";
import { CampaignPanel } from "./CampaignUI";
import InspectionReveal from "./InspectionReveal";

beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(cleanup);
function show(game:GameState) {
  useGame.setState({game,ready:true,started:true,onboarding:false,tour:null});
  render(<><CampaignPanel/><InspectionReveal/></>);
}
function requirements(game:GameState) {
  const disclosure=screen.getByText("View all requirements").closest("details")!;
  expect(disclosure.open).toBe(false);fireEvent.click(screen.getByText("View all requirements"));
  const model=campaignGuidance(game);
  for(const r of [...model.requirements,...model.finalGoals]) {
    const row=disclosure.querySelector(`[data-requirement="${r.id}"]`)!;
    expect(row.textContent).toContain(r.label);expect(row.getAttribute("data-met")).toBe(String(r.met));
  }
  expect(disclosure.querySelectorAll("[data-requirement]")).toHaveLength(model.requirements.length+model.finalGoals.length);
}
for(const [offset,stage] of [[0,"Preparing"],[8,"Spike 1 active"],[28,"Between spikes"],[48,"Spike 2 active"],[68,"Review / stability verification"]] as const)
  it(`projects Chapter 4 ${stage} from consumed events with the complete authoritative checklist`,()=>{
    const game=untilOffset(decide(spikeCompany(false),{type:"set_traffic_limit",enabled:true}),offset);
    show(game);expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain(stage);
    const decision=campaignAttention(game);expect(screen.getByRole("region",{name:"Next step"}).textContent).toContain(decision.attention==="run"?decision.message:decision.reason==="spike-plan"?decision.recommendation:decision.action?.label??decision.recommendation);
    expect(document.querySelector('.mission-dashboard')).toBeTruthy();
    expect(screen.queryByText("Controller evidence and costs")).toBeNull();requirements(game);
    expect(screen.getByRole("region",{name:"Essential live status"}).textContent).toContain(offset===0?"Traffic limit: activates in 1":"Traffic limit active");
  });

it("keeps optional autoscaling evidence in App Servers, not the mission",()=>{
  show(spikeCompany());expect(screen.queryByText("Controller evidence and costs")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"App Server"}));
  fireEvent.click(screen.getByRole("button",{name:"Server management"}));
  fireEvent.click(screen.getByRole("button",{name:"Autoscaling"}));
  expect(within(screen.getByRole("dialog",{name:"App Servers"})).getByText("Technical Details")).toBeTruthy();
});

it("keeps reliability arming actionable and derives its next scheduled stage",()=>{
  const game=reliabilityCompany();show(game);requirements(game);
  fireEvent.click(screen.getByRole("button",{name:"Start reliability test"}));
  expect(useGame.getState().game.campaign!.reliabilityStage!.fault).toBeTruthy();
  expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain("Failure scheduled");
});
for(const automatic of [false,true]) it(`shows actual ${automatic?"failover":"manual"} failure/recovery state without obsolete chapter metrics`,()=>{
  const game=tick(decide(automatic?preparedReliability():reliabilityCompany(),{type:"arm_reliability"}),10);
  show(game);requirements(game);
  expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain("Stable service:");
  expect(screen.getByRole("region",{name:"Essential live status"}).textContent).toContain("not restored");
  expect(screen.queryByText("Installed / healthy")).toBeNull();
  expect(screen.queryByText("Controller evidence and costs")).toBeNull();
});
it("shows actual verification progress after natural restoration",()=>{
  let game=decide(reliabilityCompany(),{type:"arm_reliability"});
  for(let i=0;i<60&&game.campaign!.reliabilityStage!.fault!.restoredStep===null;i++) {
    if(game.phase==="review")game=decide(game,{type:"acknowledge_review"});game=tick(game);
  }
  show(game);requirements(game);
  expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain(`Stable service: ${game.campaign!.reliabilityStage!.stableSteps} / 5`);
});
for(const state of ["readiness","wave","outcome","final","complete"] as const) it(`shows Chapter 6 ${state}, final goals and business action without old milestones`,()=>{
  let game=state==="final"||state==="complete"?finishedCompany():combinedCompany();
  if(state==="complete")game=decide(game,{type:"complete_campaign"});
  if(state==="wave"||state==="outcome")game=decide(tick(game,5),{type:"start_growth_wave"});
  if(state==="outcome")game=finishRound(game);
  show(game);requirements(game);
  expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain("Grow the Company");
  expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain(`Growth outcomes acknowledged: ${game.campaign!.combinedStage!.completedRounds.length} / 3`);
  expect(screen.queryByRole("region",{name:"Stay Online"})).toBeNull();
  expect(screen.queryByText("Scaling growth recorded: 1,400 requests/s before data growth.")).toBeNull();
  expect(screen.getByRole("button",{name:/Run promotion/}).hasAttribute("disabled")).toBe(state!=="readiness");
});
it("shows the actual pending deployment and recalculates after its activation",()=>{
  const game=decide(combinedCompany(),{type:"add_server"});show(game);
  expect(screen.getByRole("region",{name:"Essential live status"}).textContent).toContain("Add server (App 4): activates in");
  const advanced=tick(game,2);act(()=>useGame.setState({game:advanced}));
  expect(screen.getByRole("region",{name:"Essential live status"}).textContent).not.toContain("Add server (App 4): activates in");
  const decision=campaignAttention(advanced);expect(screen.getByRole("region",{name:"Next step"}).textContent).toContain(decision.attention==="run"?decision.message:decision.reason==="spike-plan"?decision.recommendation:decision.action?.label??decision.recommendation);
});
it("does not hide a low-cash capacity warning in the requirement disclosure",()=>{
  const game=combinedCompany(),c=game.campaign!;c.cashCents=56000;c.limit=500;
  c.apps.forEach(a=>a.capacity=1000);c.dbCapacity=600;c.readCache=null;
  show(game);expect(screen.getByRole("region",{name:"Essential live status"}).textContent).toMatch(/Money at risk|Capacity funding blocked/);
  requirements(game);
});
