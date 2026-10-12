import { act as reactAct, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame, applyAction, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import { CampaignAction } from "./CampaignAction";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function start() { useGame.getState().boot(); useGame.getState().play(); }
function renderCompany(game?: GameState) {
  if (game) useGame.setState({ game, ready: true, hasRun: true, started: true, onboarding: false });
  return render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);
}
function skip() { fireEvent.click(screen.getByRole("button", {name:"Skip introduction"})); }
function move() { fireEvent.click(screen.getByRole("button", {name:"Next"})); }
function perform(game:GameState, action:Parameters<typeof applyAction>[1]) { const r=applyAction(game,action); if(!r.ok) throw Error(r.message); return r.state; }

it("interactive introduction inspects live component capacity without physical actions, money or trace changes", () => {
  start(); const before=structuredClone(useGame.getState().game); renderCompany();
  const intro=screen.getByRole("dialog",{name:"Company introduction"});
  fireEvent.click(within(intro).getByRole("button",{name:"App Server"}));
  expect(useGame.getState().selected).toBe("app"); expect(intro.textContent).toContain("capacity 1,000 req/s");
  fireEvent.click(within(intro).getByRole("button",{name:"Database"}));
  expect(useGame.getState().selected).toBe("db"); expect(intro.textContent).toContain("capacity 600 ops/s");
  expect(useGame.getState().game).toEqual(before); expect(useGame.getState().running).toBe(false);
});
it("lets players compare actual request revenue and introduces ownership separately from deployment", () => {
  start(); renderCompany(); move(); const intro=screen.getByRole("dialog",{name:"Company introduction"});
  expect(intro.textContent).toContain("$0.20 earned per successful request");
  fireEvent.click(within(intro).getByRole("button",{name:"Rejected request"}));
  expect(intro.textContent).toContain("$0 earned"); expect(intro.textContent).toContain("still cost the same");
  expect(intro.textContent).toContain("not spendable yet"); move();
  fireEvent.click(within(intro).getByRole("button",{name:"Technology tree"}));
  expect(intro.textContent).toContain("Owned does not mean deployed");
});
it("completion records existing onboarding metadata, stays paused and does not reappear after reload", () => {
  start(); renderCompany(); move(); move(); fireEvent.click(screen.getByRole("button",{name:"Finish introduction"}));
  expect(useGame.getState().meta.openingOnboarding.status).toBe("completed");
  expect(screen.getByRole("region",{name:"Campaign chapters"}).textContent).toContain("Getting started");
  expect(useGame.getState().game.campaign!.step).toBe(0); expect(useGame.getState().running).toBe(false);
  cleanup(); useGame.setState(useGame.getInitialState(),true); start(); renderCompany();
  expect(screen.queryByRole("dialog",{name:"Company introduction"})).toBeNull();
});
it("skip is durable and replay returns to the same company without changing its state", () => {
  start(); renderCompany(); const before=structuredClone(useGame.getState().game); skip();
  cleanup(); useGame.setState(useGame.getInitialState(),true); start(); renderCompany();
  expect(screen.queryByRole("dialog",{name:"Company introduction"})).toBeNull();
  reactAct(()=>useGame.getState().showOnboarding());
  expect(screen.getByRole("dialog",{name:"Company introduction"})).toBeTruthy();
  expect(useGame.getState().game).toEqual(before);
});
it("resumes the existing unfinished introduction prompt after reload", () => {
  start(); renderCompany(); move(); cleanup(); useGame.setState(useGame.getInitialState(),true); start(); renderCompany();
  expect(screen.getByRole("dialog",{name:"Company introduction"}).textContent).toContain("Know what earns money");
  expect(useGame.getState().game.campaign!.step).toBe(0);
});
it("makes Run primary and keeps manual advancement behind optional controls", () => {
  start(); renderCompany(); skip(); const run=screen.getByRole("button",{name:"Run"});
  expect(run.textContent).toContain("Run company"); expect(run.className).toContain("btn-primary");
  expect(screen.getByRole("button",{name:"Advance step",hidden:true}).closest("details")!.hasAttribute("open")).toBe(false);
  fireEvent.click(screen.getByText("More controls"));
  const step=screen.getByRole("button",{name:"Advance step"}); expect(step.className).not.toContain("btn-primary");
  fireEvent.click(step); expect(useGame.getState().game.campaign!.step).toBe(1);
});
it("Pause & inspect explicitly stops the current clock and records a real free inspection", () => {
  start(); renderCompany(); skip(); fireEvent.click(screen.getByRole("button",{name:"Run"}));
  const step=useGame.getState().game.campaign!.step;
  fireEvent.click(screen.getByRole("button",{name:"Pause & inspect"}));
  expect(useGame.getState().running).toBe(false); expect(useGame.getState().game.campaign!.step).toBe(step);
  expect(useGame.getState().game.campaign!.trace.at(-1)?.type).toBe("inspection");
  fireEvent.click(screen.getByRole("button",{name:"Tech"}));
  expect(screen.getByRole("region",{name:"Tech tree"}).textContent).toContain("Owned does not mean deployed");
  fireEvent.click(screen.getByRole("button",{name:"Close"})); expect(useGame.getState().running).toBe(false);
});
it("shows paid-now cash, delayed upkeep and routing limitation before adding an App Server", () => {
  start(); renderCompany(); skip();
  const card=screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!;
  expect(card.textContent).toContain("Another App Server"); expect(card.textContent).toContain("needs routing");
  fireEvent.click(within(card as HTMLElement).getByText("Effect & costs"));
  expect(card.textContent).toContain("$19,000"); expect(card.textContent).toContain("$700");
  expect(card.textContent).toContain("per 60 modeled seconds"); expect(card.textContent).toContain("no refund or undo");
  expect(useGame.getState().game.campaign!.cashCents).toBe(2000000);
});
it("visibly explains cash and pending-infrastructure reasons without altering accepted action rules", () => {
  start(); renderCompany(); skip(); fireEvent.click(screen.getByRole("button",{name:/Upgrade database/}));
  const card=screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!;
  expect(card.textContent).toContain("An infrastructure deployment is pending");
  cleanup(); const game=structuredClone(useGame.getState().game); game.campaign!.cashCents=100000; renderCompany(game);
  expect(screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!.textContent).toContain("Not enough available cash");
});
it("traffic-limit warning and financial details explain rejection without inventing extra charges or discounts", () => {
  const game=advanceSteps(perform(newGame(1,"limit-info"),{type:"set_traffic_limit",enabled:true}),4).state;
  renderCompany(game); expect(screen.getByText(/Infrastructure and salaries still cost the same/)).toBeTruthy();
  fireEvent.click(screen.getByText("Operating finances"));
  expect(screen.getByText(/Each successful request earns/).textContent).toContain("$0.20");
  expect(screen.getByText(/pending revenue cannot fund purchases/)).toBeTruthy();
  expect(screen.getByText(/500 admitted \/ 300 rejected req\/s/)).toBeTruthy();
});
it("Scale Up describes the selected server rather than implying another installed instance", () => {
  useGame.setState({game:dataCompany(),ready:true,started:true,onboarding:false,selectedAppId:"app-1"});
  render(<CampaignAction label="Scale up App 1" price={2000} note="3 steps" onClick={()=>{}}/>);
  expect(screen.getByText(/Makes this App Server larger/)).toBeTruthy();
  expect(screen.getByText(/Total upkeep after activation/).textContent).toContain("$1,100");
});
it("postmortem keeps all actual causes and observations reachable while leading with a compact summary", () => {
  let game=advanceSteps(newGame(1,"report-info"),6).state;
  game=advanceSteps(perform(game,{type:"start_db_upgrade"}),30).state; renderCompany(game);
  const report=screen.getByRole("dialog",{name:"Incident postmortem"});
  for(const explanation of game.campaign!.reports[0].explanations) expect(report.textContent).toContain(explanation.replace(/\b\d+\.\d{3,}\b/g,v=>Number(v).toFixed(2)));
  fireEvent.click(within(report).getByText("Causes, actions and trade-offs"));
  expect(within(report).getByRole("button",{name:"Continue company"})).toBeTruthy();
});
