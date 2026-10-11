import {render,screen,within,cleanup,fireEvent} from "@testing-library/react";
import {beforeEach,afterEach,it,expect} from "vitest";
import {CampaignPanel,CampaignHeader,CampaignOverlays} from "./CampaignUI";
import {useGame} from "../game/store";
import {newGame} from "../sim";
import {readyReliability,reliabilityCompany,preparedReliability,act,tick} from "../sim/__tests__/reliabilityFixture";
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);});afterEach(cleanup);
function show(g:ReturnType<typeof newGame>){useGame.setState({game:g,ready:true,started:true,onboarding:false});render(<><CampaignHeader/><CampaignPanel/><CampaignOverlays/></>);}
it("offers explicit reliability continuation after acknowledged spikes",()=>{show(readyReliability());expect((screen.getByRole("button",{name:/Continue to reliability/}) as HTMLButtonElement).disabled).toBe(false);});
it("shows nine technology nodes with derived database ownership and locked future nodes",()=>{
 const g=newGame();g.campaign!.dbCapacity=1000;g.campaign!.upgraded=true;show(g);fireEvent.click(screen.getByRole("button",{name:"Technology tree"}));const dialog=screen.getByRole("dialog",{name:"Technology tree"});expect(dialog.querySelectorAll("[data-tech]")).toHaveLength(9);expect(within(dialog).getByRole("button",{name:"Larger Database: Owned"})).toBeTruthy();expect(within(dialog).getByRole("button",{name:"Health Checks: Locked"})).toBeTruthy();expect(within(dialog).queryByText(/engineer-weeks/)).toBeNull();
});
it("shows the stage and a legal way to start the test",()=>{
 show(reliabilityCompany());expect(screen.getByLabelText("Current campaign stage").textContent).toBe("Stay Online");expect(screen.getByRole("button",{name:/Start reliability test/})).toBeTruthy();
});
it("exposes actual and detected health and surviving capacity",()=>{
 show(tick(act(preparedReliability(),{type:"arm_reliability"}),8));const panel=screen.getByRole("region",{name:"Stay Online"});
 expect(panel.textContent).toContain("failed");expect(panel.textContent).toContain("detected healthy");expect(panel.textContent).toContain("1,600 /");
 expect(within(panel).getByRole("button",{name:"Restore App 2 · free · 3 steps"})).toBeTruthy();
});
