import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { combinedCompany, act as decide, tick } from "@/sim/__tests__/combinedFixture";
import { ChapterHints } from "./ChapterHints";
import { CampaignAction } from "./CampaignAction";
import { CampaignControls } from "./CampaignUI";
import { setConfirming } from "./actionConfirmation";
import { FinanceEntry } from "./CampaignFinance";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { StrictMode } from "react";

beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  const game = tick(decide(combinedCompany(), { type: "set_traffic_limit", enabled: true }));
  useGame.setState({ game, started: true, ready: true, tour: null, running: false });
  vi.useFakeTimers();
});
afterEach(() => { cleanup(); setConfirming(null); vi.useRealTimers(); vi.restoreAllMocks(); });
const time = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const offer = () => screen.queryByRole("dialog", { name: "Need a little help?" });

it("proactively highlights Hint in a paused incident and offers centered help without a clock change", async () => {
  const game=advanceSteps(newGame(),7).state;
  useGame.setState({game});
  render(<StrictMode><ChapterHints/><CampaignControls/></StrictMode>);
  const hint=screen.getByRole("button",{name:"Hint"});
  time(9999);expect(hint.className).not.toContain("campaign-context-cue");
  time(1);expect(hint.className).toContain("campaign-context-cue");
  expect(screen.getByRole("button",{name:"Run"}).className).not.toContain("campaign-guidance-cue");
  // Repeated immutable publications and passive pointer events leave the real-time interval intact.
  for(let i=0;i<4;i++){
    act(()=>useGame.setState({game:structuredClone(game)}));
    fireEvent.pointerOver(hint);time(1000);
  }
  time(1000);expect(offer()).toBeTruthy();
  await act(async()=>{});
  expect(hint.className).not.toContain("campaign-context-cue");
  expect(useGame.getState().game).toEqual(game);
  fireEvent.click(screen.getByRole("button",{name:"Yes, show hint"}));
  expect(screen.getByRole("dialog").textContent).toContain("Compare database demand");
});

it("repeated inspection postpones help; stopping offers it without judging the strategy", () => {
  render(<ChapterHints/>);
  for(let i=0;i<4;i++){time(14000);fireEvent.pointerDown(document);expect(offer()).toBeNull();}
  time(15000);expect(offer()).toBeTruthy();
});

it("replaces a stale dialog when the authoritative bottleneck changes",()=>{
  render(<ChapterHints/>);time(15000);expect(offer()).toBeTruthy();
  act(()=>useGame.setState({game:advanceSteps(newGame(),7).state}));
  expect(offer()).toBeNull();time(15000);expect(offer()).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Yes, show hint"}));
  expect(screen.getByRole("dialog").textContent).toContain("Compare database demand");
});

it("offers once at fifteen seconds; No suppresses repeat offers while manual Hint stays available", () => {
  render(<ChapterHints/>); const game = useGame.getState().game;
  time(14999); expect(offer()).toBeNull(); time(1); expect(offer()).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "No, thanks" })); expect(offer()).toBeNull();
  time(60000); expect(offer()).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("dialog", { name: "Here's a hint" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(useGame.getState().game).toBe(game); expect(useGame.getState().running).toBe(false);
});
it("retains dismissal if the same stage's Hint entry unmounts and remounts",()=>{
  const ui=render(<ChapterHints/>);time(15000);
  fireEvent.click(screen.getByRole("button",{name:"No, thanks"}));ui.unmount();
  render(<ChapterHints/>);time(60000);expect(offer()).toBeNull();
  expect(screen.getByRole("button",{name:"Hint"}).className).not.toContain("campaign-context-cue");
});
it("meaningful interaction postpones the offer and cleanup cancels its timer", async () => {
  const ui = render(<ChapterHints/>); time(14000); fireEvent.keyDown(document, { key: "Tab" });
  time(14999); expect(offer()).toBeNull(); time(1); expect(offer()).toBeTruthy();
  await act(async () => ui.unmount());
  time(0); // jsdom queues selectionchange when the shared Modal restores focus.
  expect(vi.getTimerCount()).toBe(0);
});
it("allows one new offer for a materially different objective, not metric or readiness ticks", () => {
  render(<ChapterHints/>); time(15000);
  fireEvent.click(screen.getByRole("button", { name: "No, thanks" }));
  act(() => useGame.setState({game:tick(useGame.getState().game,2)}));
  time(60000); expect(offer()).toBeNull();
  act(() => useGame.setState({game:tick(decide(useGame.getState().game,{type:"set_traffic_limit",enabled:false}))}));
  time(14999); expect(offer()).toBeNull(); time(1); expect(offer()).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "No, thanks" }));
  act(() => useGame.setState({game:tick(useGame.getState().game)}));
  time(60000); expect(offer()).toBeNull();
});
it("offers manual diagnostic help during an incident and cues Database without prescribing a purchase", () => {
  useGame.setState({game:advanceSteps(newGame(),7).state});
  render(<><ChapterHints/><CampaignControls/><button data-guidance="db">Database</button></>);
  fireEvent.click(screen.getByRole("button",{name:"Hint"}));
  expect(screen.getByRole("dialog").textContent).toContain("Compare database demand");
  fireEvent.click(screen.getByRole("button",{name:"Got it"})); time(0);
  expect(screen.getByRole("button",{name:"Database"}).className).toContain("campaign-context-cue");
  time(30000);
  expect(screen.getByRole("button",{name:"Run"}).className).not.toContain("campaign-guidance-cue");
  expect(offer()).toBeNull();
});
it("reveals an idle progression decision, then offers contextual help without losing its target", () => {
  useGame.setState({game:tick(combinedCompany(),5)});
  render(<><ChapterHints/><button data-guidance="progression">Start next growth wave</button></>);
  const button=screen.getByRole("button",{name:"Start next growth wave"});
  const reveal=vi.fn(()=>fireEvent.pointerOver(button)); button.scrollIntoView=reveal;
  const hint=screen.getByRole("button",{name:"Hint"});hint.focus();
  time(11999);expect(reveal).not.toHaveBeenCalled();
  time(1);expect(reveal).toHaveBeenCalledWith({block:"nearest"});
  expect(document.activeElement).toBe(hint);
  expect(button.className).toContain("campaign-context-cue");
  time(3000);expect(offer()).toBeTruthy();
  expect(button.className).not.toContain("campaign-context-cue");
  fireEvent.click(screen.getByRole("button",{name:"No, thanks"}));
  time(30000);expect(offer()).toBeNull();
});
it("allows fifteen seconds to read evidence, then offers help even if it stays open", async () => {
  render(<><ChapterHints/><aside className="campaign-panel"><details><summary>Database evidence</summary><p>Demand and capacity</p></details></aside></>);
  time(14000);
  const summary=screen.getByText("Database evidence");
  await act(async()=>fireEvent.click(summary));
  time(14999);expect(offer()).toBeNull();
  expect(screen.getByRole("button",{name:"Hint"})).toHaveProperty("disabled",false);
  time(1);expect(offer()).toBeTruthy();
});
it("Yes and Got it cue only the available Remove traffic limit, preserve confirmation priority and clear obsolete hints", () => {
  render(<><ChapterHints/><CampaignControls/><CampaignAction label="Remove traffic limit" decision={{ type: "set_traffic_limit", enabled: false }} price={0} onClick={() => useGame.getState().act({ type: "set_traffic_limit", enabled: false })}/></>);
  time(15000); fireEvent.click(screen.getByRole("button", { name: "Yes, show hint" }));
  expect(screen.getByRole("dialog", { name: "Here's a hint" }).textContent).toContain("Check your infrastructure capacity first");
  fireEvent.click(screen.getByRole("button", { name: "Got it" })); time(0);
  expect(document.querySelectorAll(".campaign-traffic-cue")).toHaveLength(1);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /Remove traffic limit/ }));
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  time(15000); expect(offer()).toBeNull();
  expect(screen.getByRole("button", { name: "Run" }).className).not.toContain("campaign-guidance-cue");
  fireEvent.click(screen.getByRole("button", { name: /Remove traffic limit/ })); time(0);
  expect(document.querySelector(".campaign-traffic-cue")).toBeNull();
  expect(screen.getByRole("button", { name: "Confirm" }).className).toContain("campaign-guidance-cue");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  act(() => useGame.setState({ game: tick(useGame.getState().game) })); time(0);
  expect(document.querySelector(".campaign-traffic-cue")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("dialog", { name: "Here's a hint" }).textContent).not.toContain("remove the traffic limit");
});
it.each([{ running: true }, { view: "history" as const }, { tour: { track: "campaign" as const, step: 7 } }, { roomInspection: { seq: 1, equipment: "db" as const } }])("suppresses automatic offers during higher-priority work: %j", patch => {
  useGame.setState(patch); render(<ChapterHints/>); time(30000); expect(offer()).toBeNull();
});
it("waits behind paper modals and restarts when they close", async () => {
  render(<ChapterHints/>); time(14000);
  const modal = document.createElement("div"); modal.className = "modal-backdrop";
  await act(async () => document.body.append(modal)); time(30000); expect(offer()).toBeNull();
  await act(async () => modal.remove()); time(14999); expect(offer()).toBeNull(); time(1); expect(offer()).toBeTruthy();
});
it("manual Hint pauses a running company and preserves focus on dismissal", () => {
  useGame.setState({ running: true }); render(<ChapterHints/>);
  const button = screen.getByRole("button", { name: "Hint" }); button.focus(); fireEvent.click(button);
  expect(useGame.getState().running).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Got it" }));
  expect(document.activeElement).toBe(button);
});
it("ignores passive cursor motion but postpones an offer while actively dragging", () => {
  render(<ChapterHints/>); time(14000);
  fireEvent.pointerMove(document, { buttons: 0 }); time(999); expect(offer()).toBeNull();
  fireEvent.mouseMove(document, { buttons: 1 });
  fireEvent.pointerDown(document); time(14999); expect(offer()).toBeNull();
  time(1); expect(offer()).toBeTruthy();
});
it("explains a pending traffic change without spotlighting a disabled action", () => {
  useGame.setState({ game: decide(useGame.getState().game, { type: "set_traffic_limit", enabled: false }) });
  render(<ChapterHints/>); fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("dialog").textContent).toContain("activate accepted changes");
  fireEvent.click(screen.getByRole("button", { name: "Got it" })); time(15000);
  expect(document.querySelector(".campaign-traffic-cue")).toBeNull(); expect(offer()).toBeNull();
});
it("suspends offers during a purchase and invalidates them on company replacement", () => {
  render(<ChapterHints/>); time(14000);
  act(() => setConfirming("Upgrade database")); time(30000); expect(offer()).toBeNull();
  act(() => setConfirming(null)); time(15000); expect(offer()).toBeTruthy();
  act(() => useGame.setState({ generation: useGame.getState().generation + 1 }));
  expect(offer()).toBeNull(); time(14999); expect(offer()).toBeNull();
});
it("does not steal restored Cash focus when an accepted hint resumes behind Finance", async () => {
  render(<><ChapterHints/><FinanceEntry/><CampaignAction label="Remove traffic limit" decision={{ type: "set_traffic_limit", enabled: false }} price={0} onClick={() => {}}/></>);
  const hint = screen.getByRole("button", { name: "Hint" }); hint.focus(); fireEvent.click(hint);
  fireEvent.click(screen.getByRole("button", { name: "Got it" })); time(0);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /Remove traffic limit/ }));
  const cash = screen.getByRole("button", { name: "View finances" }); cash.focus(); fireEvent.click(cash);
  await act(async () => {}); time(0); expect(document.querySelector(".campaign-traffic-cue")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await act(async () => {}); time(0);
  expect(document.querySelector(".campaign-traffic-cue")).toBeTruthy(); expect(document.activeElement).toBe(cash);
});

it("keeps incident Hint available while a saved Chapter 0 lesson is hidden", () => {
  const game = advanceSteps(newGame(), 7).state;
  useGame.setState({ game, tour: { track: "campaign", step: 7 } });
  render(<ChapterHints/>);
  expect(screen.getByRole("button", { name: "Hint" }).hasAttribute("disabled")).toBe(false);
  time(15000); expect(offer()).toBeTruthy();
  expect(useGame.getState().tour).toEqual({ track: "campaign", step: 7 });
  expect(useGame.getState().game).toEqual(game);
});
