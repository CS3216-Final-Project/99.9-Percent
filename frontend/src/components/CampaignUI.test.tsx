import InspectionReveal from "./InspectionReveal";
import { inspectionAction } from "./inspectionTestUtils";
import {render,screen,within,fireEvent,cleanup,act} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel} from "./CampaignUI";
import {CampaignChapters} from "./CampaignChapters";
import {inspectOrSelect,useGame} from "../game/store";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {protectedCombined} from "../sim/__tests__/combinedFixture";
import {pauseTransition} from "../sim/__tests__/pauseFixture";
import {advanceSteps} from "../sim/step";
import {applyAction,newGame,type GameState} from "../sim";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(cleanup);
function show(game:GameState){useGame.setState({game,ready:true,started:true,onboarding:false});render(<><CampaignChapters/><CampaignPanel/><InspectionReveal/></>);}
// Construct engine-heavy companies once outside each UI interaction deadline.
const incidentTransitions=new Map([1,2,3,4,5,6].map(chapter=>[chapter,pauseTransition(chapter)]));
it.each([1,2,3,4,5,6])("keeps the incident banner and recovery affordances visible during a Chapter %i incident",chapter=>{
 show(structuredClone(incidentTransitions.get(chapter)!).incident);
 expect(useGame.getState().game.phase).toBe("incident");
 expect(screen.getByRole("region",{name:"Incident"})).toBeTruthy();
 expect(screen.getByRole("heading",{name:"Service slowdown"})).toBeTruthy();
 expect(screen.getByRole("region",{name:"Incident recovery"})).toBeTruthy();
});
it("shows all Opening requirements without a disclosure or generic growth-waiting message",()=>{
 show(newGame());const requirements=screen.getByRole("region",{name:"Guided Mode requirements"});
 expect(within(requirements).getByRole("heading",{name:/Chapter requirements/})).toBeTruthy();
 expect(within(requirements).getAllByRole("listitem")).toHaveLength(3);
 expect(requirements.querySelector("summary")).toBeNull();
 expect(screen.queryByText(/Waiting for the next company growth event/)).toBeNull();
});
it("keeps the selected workload hidden until actual growth and enters through the paused store",()=>{
 show(dataCompany("read-heavy",false));const guide=screen.getByRole("region",{name:"Guided Mode guidance"});
 expect(screen.getByLabelText("Current objective").textContent).toContain("Prepare the system for the next growth wave.");
 expect(guide.textContent).not.toContain("Prepare the system for the next growth wave.");
 expect(within(guide).getByText(/Chapter requirements/)).toBeTruthy();
 expect(within(guide).queryByRole("button",{name:/Continue to Data Strategy/})).toBeNull();
 fireEvent.click(within(screen.getByRole("region",{name:"Guided Mode chapters"})).getByRole("button",{name:/Continue to Data Strategy/}));
 expect(useGame.getState().tour?.track).toBe("data");
 expect(screen.queryByRole("region",{name:"Data strategy"})).toBeNull();
 act(()=>useGame.getState().endTour(true));
 expect(screen.queryByRole("region",{name:"Data strategy"})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Read Cache"}));fireEvent.click(screen.getByRole("button",{name:"Inspect details"}));
 const data=within(screen.getByRole("dialog",{name:"Read Cache inspected"})).getByRole("region",{name:"Data strategy"});expect(data.textContent).toContain("Waiting for workload growth");
 expect(data.textContent).not.toMatch(/read-heavy|write-heavy|80%|20%/);expect(useGame.getState().running).toBe(false);
});
it("shows the current stage cap instead of advertising a locked database tier",()=>{
 show(dataCompany("read-heavy",false));const button=inspectionAction(/Upgrade database/);
 expect(button.hasAttribute("disabled")).toBe(true);expect(button.closest(".campaign-action-card")!.textContent).toContain("The database is already upgraded.");expect(button.closest(".campaign-action-card")!.textContent).not.toContain("3,000");
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
 const data=within(screen.getByRole("dialog",{name:"Read Cache inspected"})).getByRole("region",{name:"Data strategy"});
 expect(data.textContent).toContain("Workload: write-heavy");
 const readings=screen.getByRole("region",{name:"Read Cache readings"});
 expect(readings.textContent).toContain("read-heavy");
 expect(readings.textContent).toContain("Reads / writes");
 expect(readings.textContent).toContain(`${g.campaign!.snapshot.data!.reads.toLocaleString("en-US")} / ${g.campaign!.snapshot.data!.writes.toLocaleString("en-US")}`);
});
it("offers each routing choice once and marks the one in use",()=>{
 show(dataCompany("read-heavy",false));fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));fireEvent.click(screen.getByText(/Configure routing/));let route=screen.getByRole("group",{name:/Send traffic to/});
 expect(within(route).getAllByRole("button").map(b=>b.textContent)).toEqual(["All apps","App 1 only","App 2 only"]);
 expect(within(route).getByRole("button",{name:"All apps"}).getAttribute("aria-pressed")).toBe("true");
 const before=useGame.getState().game;
 fireEvent.click(within(route).getByRole("button",{name:"All apps"}));
 expect(useGame.getState().game).toBe(before);
 expect(screen.getByText("Configure routing · all apps")).toBeTruthy();
 fireEvent.click(within(route).getByRole("button",{name:"App 2 only"}));
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-2"]});
 fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));fireEvent.click(screen.getByText(/Configure routing/));route=screen.getByRole("group",{name:/Send traffic to/});
 const reason=screen.getByText("Routing requires deployed load balancing, valid active targets and a changed configuration.");
 expect(reason.getAttribute("tabindex")).toBe("0");
 expect(reason.closest("fieldset")).toBeNull();
 expect(route.hasAttribute("disabled")).toBe(true);
});
it("leaves a reserved spare out of the routing choices, so the apps in use still read as all apps",()=>{
 const g=protectedCombined();expect(g.campaign!.apps.find(a=>a.id==="app-2")!.role).toBe("spare");
 show(g);fireEvent.click(screen.getByRole("button",{name:"Network"}));fireEvent.click(screen.getByRole("button",{name:"Network management"}));fireEvent.click(screen.getByText(/Configure routing/));const route=screen.getByRole("group",{name:/Send traffic to/});
 expect(within(route).getAllByRole("button").map(b=>b.textContent)).toEqual(["All apps","App 1 only","App 3 only"]);
 expect(within(route).getByRole("button",{name:"All apps"}).getAttribute("aria-pressed")).toBe("true");
 expect(screen.getByText("Configure routing · all apps")).toBeTruthy();
 fireEvent.click(within(route).getByRole("button",{name:"App 3 only"}));
 expect(useGame.getState().game.campaign!.pending.find(a=>a.type==="routing")!.routing).toEqual({mode:"balanced",targets:["app-3"]});
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
