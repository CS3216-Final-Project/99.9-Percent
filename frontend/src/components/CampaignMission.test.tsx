import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import type { GameState } from "@/sim";
import { campaignGuidance } from "@/game/campaignGuidance";
import { campaignAttention } from "@/game/campaignAttention";
import { campaignChapters } from "@/game/campaignChapters";
import { spikeCompany, untilOffset, act as decide, tick } from "@/sim/__tests__/spikeFixtures";
import { reliabilityCompany, preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { completedReliability } from "@/sim/__tests__/completionFixture";
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
  for(const r of model.requirements) {
    const row=disclosure.querySelector(`[data-requirement="${r.id}"]`)!;
    expect(row.textContent).toContain(r.label);expect(row.getAttribute("data-met")).toBe(String(r.met));
  }
  expect(disclosure.querySelectorAll("[data-requirement]")).toHaveLength(model.requirements.length);
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

it("names the graded spike in progress and keeps the spike test as the current objective through retries",()=>{
  // Two large servers fail every graded test, so the chapter schedules Spike 3 after Spike 2's debrief.
  let game=untilOffset(spikeCompany(false,"read-heavy",2),68);game=decide(game,{type:"acknowledge_spike_attempt"});
  show(game);
  const progress=()=>screen.getByRole("region",{name:"Chapter Progress"}).textContent!;
  expect(progress()).toContain("Spike 3 in 20 s");
  expect(progress()).toContain("A graded spike served at least 95% of its requests (last test: 80%)");
  cleanup();show(untilOffset(game,92,true));
  expect(progress()).toContain("Spike 3 active");expect(progress()).not.toContain("Spike 2 active");
});

for(const [name,company] of [["Traffic Spikes & Autoscaling",spikeCompany],["Stay Online",reliabilityCompany]] as const)
  it(`titles the mission panel ${name}, the chapter the chapter bar marks current`,()=>{
    const game=company();show(game);
    expect(campaignChapters(game).find(c=>c.current)?.name).toBe(name);
    expect(within(screen.getByRole("region",{name:"Chapter Progress"})).getByRole("heading",{level:3}).textContent).toBe(name);
  });

it("keeps optional autoscaling evidence in App Servers, not the mission",()=>{
  show(spikeCompany());expect(screen.queryByText("Controller evidence and costs")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"App Server"}));
  fireEvent.click(screen.getByRole("button",{name:"Server management"}));
  fireEvent.click(screen.getByRole("button",{name:"Autoscaling"}));
  expect(within(document.querySelector<HTMLElement>(".component-inspection-app")!).getByText("Technical Details")).toBeTruthy();
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
it("keeps a company that stayed after Stay Online in its final chapter, with Complete campaign behind Next",()=>{
  const game=completedReliability();show(game);requirements(game);
  const progress=screen.getByRole("region",{name:"Chapter Progress"}).textContent;
  expect(progress).toContain("Stay Online");expect(progress).toContain("Outcome acknowledged");
  expect(screen.getByRole("region",{name:"Next step"}).textContent).toContain("Use Next in the chapter bar to continue.");
  expect(screen.queryByRole("button",{name:"Complete campaign"})).toBeNull();
  // Nothing is unmet, so the panel does not call its readiness an unmet condition.
  expect(screen.queryByRole("region",{name:"Current unmet condition"})).toBeNull();
  expect(screen.getByRole("region",{name:"Current status"}).textContent).toContain("Ready: Complete campaign");
});
it("shows a completed campaign with its scorecard and no further requirement",()=>{
  const game=decide(completedReliability(),{type:"complete_campaign"});show(game);
  expect(screen.getByRole("region",{name:"Chapter Progress"}).textContent).toContain("Campaign complete");
  expect(screen.queryByRole("region",{name:"Current unmet condition"})).toBeNull();
  expect(screen.getByRole("region",{name:"Current status"}).textContent).toContain("Campaign complete.");
  // Completing needed every Stay Online requirement, and the ended run still shows them all met.
  expect(screen.getByText(/current requirements met$/).textContent).toBe("12 / 12 current requirements met");
  expect(screen.getByRole("button",{name:"View run scorecard"})).toBeTruthy();
});
it("shows the actual pending deployment and recalculates after its activation",()=>{
  const game=decide(decide(reliabilityCompany(),{type:"arm_reliability"}),{type:"add_server"});show(game);
  expect(screen.getByRole("region",{name:"Essential live status"}).textContent).toContain("Add server (Server 4): activates in");
  const advanced=tick(game,2);act(()=>useGame.setState({game:advanced}));
  expect(screen.getByRole("region",{name:"Essential live status"}).textContent).not.toContain("Add server (Server 4): activates in");
  const decision=campaignAttention(advanced);expect(screen.getByRole("region",{name:"Next step"}).textContent).toContain(decision.attention==="run"?decision.message:decision.reason==="spike-plan"?decision.recommendation:decision.action?.label??decision.recommendation);
});
