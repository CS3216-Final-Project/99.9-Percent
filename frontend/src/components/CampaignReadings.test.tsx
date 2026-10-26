import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { CampaignReadings } from "./CampaignReadings";

beforeEach(()=>{
  localStorage.clear();
  useGame.setState(useGame.getInitialState(),true);
});
afterEach(cleanup);

it("never substitutes fleet measurements for an unobserved individual server",()=>{
  const game=newGame(),campaign=game.campaign!;
  delete campaign.snapshot.instances;
  campaign.snapshot.app.demand=9876;
  useGame.setState({game});
  const view=render(<CampaignReadings place="app" campaign={campaign} appId="app-1"/>);
  const individual=screen.getByRole("region",{name:"App 1 readings"});
  expect(individual.textContent).toContain("No individual workload observation is available for App 1 yet");
  expect(individual.textContent).not.toContain("9,876");
  expect(individual.querySelector(".evidence-rows")).toBeNull();
  expect(individual.textContent).not.toContain("Read Cache");
  view.rerender(<CampaignReadings place="app" campaign={campaign}/>);
  expect(screen.getByRole("region",{name:"Servers readings"}).textContent).toContain("9,876 requests/s");
});

it("labels measured individual evidence and keeps aggregate capacity in fleet readings",()=>{
  const game=spikeCompany(false),campaign=game.campaign!;
  const instance=campaign.snapshot.instances![0];
  useGame.setState({game});
  render(<CampaignReadings place="app" campaign={campaign} appId={instance.id}/>);
  const individual=screen.getByRole("region",{name:`App ${instance.id.slice(4)} readings`});
  expect(individual.querySelector(".evidence-rows dd")?.textContent).toBe(`${instance.demand.toLocaleString("en-US")} requests/s`);
  expect(individual.textContent).not.toContain("Installed server capacity");
  expect(individual.textContent).not.toContain("Routed capacity");
  expect(individual.textContent).not.toContain("Not yet observed");
});
