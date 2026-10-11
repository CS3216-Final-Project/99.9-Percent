import {render,screen,within,fireEvent,cleanup} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel} from "./CampaignUI";
import {useGame} from "../game/store";
import {dataCompany} from "../sim/__tests__/dataFixture";
import {advanceSteps} from "../sim/step";
import {applyAction,type GameState} from "../sim";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});
afterEach(cleanup);
function show(game:GameState){useGame.setState({game,ready:true,started:true,onboarding:false});render(<CampaignPanel/>);}
it("keeps the selected workload hidden until actual growth and enters through the paused store",()=>{
 show(dataCompany("read-heavy",false));const guide=screen.getByRole("region",{name:"Campaign guidance"});
 fireEvent.click(within(guide).getByRole("button",{name:/Continue to data strategy/}));
 const data=screen.getByRole("region",{name:"Data strategy"});expect(data.textContent).toContain("Waiting for workload growth");
 expect(data.textContent).not.toMatch(/read-heavy|write-heavy|80%|20%/);expect(useGame.getState().running).toBe(false);
});
it("shows the current stage cap instead of advertising a locked database tier",()=>{
 show(dataCompany("read-heavy",false));const button=screen.getByRole("button",{name:/Upgrade database/});
 expect(button.hasAttribute("disabled")).toBe(true);expect(button.textContent).toContain("Current stage tier reached");expect(button.textContent).not.toContain("3,000");
 fireEvent.click(screen.getByRole("button",{name:/Continue to data strategy/}));
 expect(button.hasAttribute("disabled")).toBe(false);expect(button.textContent).toContain("4,000");expect(button.textContent).toContain("4 steps");
});
it("selects the cache through the same inspection action and displays actual used evidence",()=>{
 show(advanceSteps(dataCompany(),6).state);const c=useGame.getState().game.campaign!,step=c.step;
 fireEvent.click(screen.getByRole("button",{name:"Read Cache"}));
 expect(useGame.getState().selected).toBe("cache");expect(useGame.getState().game.campaign!.step).toBe(step);
 expect(useGame.getState().game.campaign!.trace.at(-1)).toMatchObject({type:"inspection",data:{component:"cache"}});
 const data=screen.getByRole("region",{name:"Data strategy"});expect(data.textContent).toContain("Reads 80% / writes 20%");
 expect(data.textContent).toContain("effective hit rate used 0%");expect(data.textContent).toContain("eligible misses 1920");
});

it("labels the last completed profile separately from an immediate contrast",()=>{
 let g=advanceSteps(dataCompany(),6).state;
 const deploy=applyAction(g,{type:"deploy_cache"});if(!deploy.ok)throw Error(deploy.message);
 g=advanceSteps(deploy.state,30).state;const acknowledge=applyAction(g,{type:"acknowledge_review"});if(!acknowledge.ok)throw Error(acknowledge.message);
 const contrast=applyAction(acknowledge.state,{type:"contrast_workload"});if(!contrast.ok)throw Error(contrast.message);
 show(contrast.state);const data=screen.getByRole("region",{name:"Data strategy"});
 expect(data.textContent).toContain("Workload: write-heavy");
 expect(data.textContent).toContain(`Workload evidence · step ${g.campaign!.step} · read-heavy`);
 expect(data.textContent).toContain("Reads 80% / writes 20%");
});
