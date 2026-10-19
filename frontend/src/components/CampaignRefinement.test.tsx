import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { DEFAULT_META, saveMeta } from "@/game/persist";
import { newGame, applyAction, type GameState } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { CampaignHeader, CampaignPanel, CampaignControls, CampaignOverlays } from "./CampaignUI";
import { CampaignAction } from "./CampaignAction";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
// These tests drive the clock, which the Opening walkthrough holds until it is done.
function start() { saveMeta({ ...DEFAULT_META, tutorialDone: true }); useGame.getState().boot(); useGame.getState().play(); }
function renderCompany(game?: GameState) {
  if (game) useGame.setState({ game, ready: true, hasRun: true, started: true, onboarding: false });
  return render(<><CampaignHeader/><CampaignPanel/><CampaignControls/><CampaignOverlays/></>);
}
function perform(game:GameState, action:Parameters<typeof applyAction>[1]) { const r=applyAction(game,action); if(!r.ok) throw Error(r.message); return r.state; }

it("makes Run/Pause primary, with secondary manual steps", () => {
  start(); renderCompany(); const run=screen.getByRole("button",{name:"Run"});
  expect(run.className).toContain("btn-primary");
  expect(screen.queryByRole("button",{name:/Advance (?:game second|step)/,hidden:true})).toBeNull();
  fireEvent.click(run); expect(useGame.getState().running).toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Pause"})); expect(useGame.getState().running).toBe(false);
  const steps=within(screen.getByRole("group",{name:"Step time"}));
  // Steps never compete with Run: they are not primary, and a step pauses a running clock.
  expect(steps.getByRole("button",{name:"Step 1 game second"}).className).not.toContain("btn-primary");
  fireEvent.click(run); fireEvent.click(steps.getByRole("button",{name:"Step 1 game second"}));
  expect(useGame.getState().running).toBe(false); expect(screen.getByTestId("physical-step").textContent).toBe("1");
  fireEvent.click(steps.getByRole("button",{name:"Step 5 game seconds"})); expect(screen.getByTestId("physical-step").textContent).toBe("6");
  // The opening incident is live: stepping keeps working there.
  fireEvent.click(steps.getByRole("button",{name:"Step 1 game second"})); expect(screen.getByTestId("physical-step").textContent).toBe("7");
});
it("disables manual steps while the walkthrough holds the clock", () => {
  useGame.getState().boot(); useGame.getState().play(); renderCompany();
  expect((screen.getByRole("button",{name:"Step 1 game second"}) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button",{name:"Step 5 game seconds"}) as HTMLButtonElement).disabled).toBe(true);
});
it("shows inspected evidence as labelled rows and a load bar", () => {
  renderCompany(advanceSteps(newGame(1,"evidence"),6).state);
  fireEvent.click(screen.getByRole("button",{name:/^Database$/}));
  const db=screen.getByRole("region",{name:"Database readings"});
  expect(within(db).getByRole("progressbar",{name:"Database load: 800 of 600 operations/s"})).toBeTruthy();
  expect(within(db).getByText("Backlog").closest(".evidence-row")!.getAttribute("data-tone")).toBe("warn");
  fireEvent.click(screen.getByRole("button",{name:/^Network$/}));
  const net=screen.getByRole("region",{name:"Network readings"});
  for (const [label,value] of [["Incoming","800 requests/s"],["Admitted","800 requests/s"],["Rejected","0 requests/s"]]) expect(within(net).getByText(label).closest(".evidence-row")!.querySelector("dd")!.textContent).toBe(value);
});
it("quotes a purchase as toned tiles", () => {
  start(); renderCompany(); fireEvent.click(screen.getByRole("button",{name:/Add server/}));
  const confirm=screen.getByRole("region",{name:"Confirm Add server"});
  const tone=(label:string)=>within(confirm).getByText(label,{exact:true}).closest(".purchase-tile")!.getAttribute("data-tone");
  expect([tone("Setup"),tone("Cash after"),tone("Upkeep"),tone("Ready in")]).toEqual(["cost","ok","warn","info"]);
});
it("system evidence records a real free inspection without advancing the clock", () => {
  start(); renderCompany();
  expect(screen.queryByRole("button",{name:"Pause & inspect"})).toBeNull();
  expect(screen.queryByLabelText("Request dependencies")).toBeNull();
  const step=useGame.getState().game.campaign!.step;
  fireEvent.click(screen.getByRole("button",{name:"Database"}));
  expect(useGame.getState().game.campaign!.step).toBe(step);
  expect(useGame.getState().game.campaign!.trace.at(-1)?.type).toBe("inspection");
  fireEvent.click(screen.getByRole("button",{name:"Tech"}));
  expect(screen.getByRole("region",{name:"Tech tree"}).textContent).toContain("Owned does not mean deployed");
  fireEvent.click(screen.getByRole("button",{name:"Close"})); expect(useGame.getState().running).toBe(false);
});
it("shows what the machine does, paid-now cash, delayed upkeep and routing limitation only when adding an App Server", () => {
  start(); renderCompany();
  const card=screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!;
  expect(card.textContent).not.toContain("+$700 per 60 game seconds"); expect(screen.queryByText("Effect & costs")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:/Add server/}));
  const confirm=screen.getByRole("region",{name:"Confirm Add server"});
  expect(confirm.textContent).toContain("Processes requests"); expect(confirm.textContent).toContain("Route traffic to this server after activation.");
  expect(confirm.textContent).toContain("$19,000"); expect(confirm.textContent).toContain("+$700 per 60 game seconds");
  expect(confirm.textContent).toContain("No refunds.");
  expect(useGame.getState().game.campaign!.cashCents).toBe(2000000);
});
it("asks for confirmation before an action is dispatched, and Cancel or Escape leaves the company unchanged", () => {
  start(); renderCompany();
  const add=screen.getByRole("button",{name:/Add server/}), before=useGame.getState().game;
  fireEvent.click(add);
  const confirm=screen.getByRole("region",{name:"Confirm Add server"});
  expect(confirm.textContent).toContain("Add App Server"); expect(confirm.textContent).toContain("$19,000");
  expect(useGame.getState().game).toBe(before);
  fireEvent.click(within(confirm).getByRole("button",{name:"Cancel"}));
  expect(screen.queryByRole("region",{name:"Confirm Add server"})).toBeNull(); expect(document.activeElement).toBe(add);
  fireEvent.click(add); fireEvent.keyDown(screen.getByRole("button",{name:"Confirm"}),{key:"Escape"});
  expect(screen.queryByRole("region",{name:"Confirm Add server"})).toBeNull(); expect(useGame.getState().game).toBe(before);
  // Only one confirmation is open at a time.
  fireEvent.click(add); fireEvent.click(screen.getByRole("button",{name:/Upgrade database/}));
  expect(screen.queryByRole("region",{name:"Confirm Add server"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
  expect(useGame.getState().game.campaign!.pending.map(a=>a.type)).toEqual(["upgrade-db"]);
  expect(screen.queryByRole("button",{name:"Confirm"})).toBeNull();
});
it("visibly explains cash and pending-infrastructure reasons without altering accepted action rules", () => {
  start(); renderCompany(); fireEvent.click(screen.getByRole("button",{name:/Upgrade database/})); fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
  const card=screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!;
  expect(card.textContent).toContain("An infrastructure deployment is already pending");
  cleanup(); const game=newGame(); game.campaign!.cashCents=100000; renderCompany(game);
  expect(screen.getByRole("button",{name:/Add server/}).closest(".campaign-action-card")!.textContent).toContain("This purchase would exhaust company cash");
});
it("traffic-limit warning explains rejection without inventing extra charges or discounts", () => {
  const game=advanceSteps(perform(newGame(1,"limit-info"),{type:"set_traffic_limit",enabled:true}),4).state;
  renderCompany(game); expect(screen.getByText(/Infrastructure and salaries still cost the same/)).toBeTruthy();
  expect(screen.queryByText("Operating finances")).toBeNull();
  expect(screen.getByText(/500 admitted \/ 300 rejected req\/s/)).toBeTruthy();
});
it("Scale Up describes the selected server rather than implying another installed instance", () => {
  useGame.setState({game:dataCompany(),ready:true,started:true,onboarding:false,selectedAppId:"app-1"});
  render(<CampaignAction label="Scale up App 1" price={2000} note="3 game seconds" onClick={()=>{}}/>);
  fireEvent.click(screen.getByRole("button",{name:/Scale up App 1/}));
  expect(screen.queryByText(/Makes this App Server larger/)).toBeNull();
  expect(screen.getByText("Total upkeep").closest(".purchase-tile")!.textContent).toContain("$1,100 / 60s (+$400)");
});
it("postmortem keeps all actual causes and observations reachable while leading with a compact summary", () => {
  let game=advanceSteps(newGame(1,"report-info"),6).state;
  game=advanceSteps(perform(game,{type:"start_db_upgrade"}),30).state; renderCompany(game);
  const report=screen.getByRole("dialog",{name:"Incident postmortem"});
  for(const explanation of game.campaign!.reports[0].explanations) expect(report.textContent).toContain(explanation.replace(/\b\d+\.\d{3,}\b/g,v=>Number(v).toFixed(2)));
  fireEvent.click(within(report).getByText("Causes, actions and trade-offs"));
  expect(within(report).getByRole("button",{name:"Continue company"})).toBeTruthy();
});
it.each([
  [/Add server/, ["app"]], [/Upgrade database/, ["db"]], [/Limit to 500/, ["gateway"]],
] as const)("pointing at %s lights up the machine it changes, and leaving clears it", (name, ids) => {
  start(); renderCompany();
  const card=screen.getByRole("button",{name}).closest(".campaign-action-card")!;
  fireEvent.pointerEnter(card); expect(useGame.getState().affected).toEqual(ids);
  fireEvent.pointerLeave(card); expect(useGame.getState().affected).toEqual([]);
});
it("keeps the affected machine lit while its confirmation is open, and clears it after Confirm", () => {
  start(); renderCompany();
  const button=screen.getByRole("button",{name:/Upgrade database/}), card=button.closest(".campaign-action-card")!;
  fireEvent.pointerEnter(card); fireEvent.click(button); fireEvent.pointerLeave(card);
  expect(useGame.getState().affected).toEqual(["db"]);
  fireEvent.click(screen.getByRole("button",{name:"Confirm"}));
  expect(useGame.getState().affected).toEqual([]);
});
it("opening an action's confirmation from the office floor rides to the floor of the machine it changes", () => {
  start(); renderCompany(); useGame.setState({floor:"office"});
  fireEvent.click(screen.getByRole("button",{name:/Upgrade database/}));
  expect(useGame.getState().floor).toBe("servers");
  expect(screen.getByRole("region",{name:"Confirm Upgrade database"}).textContent).toContain("Stores data");
});
