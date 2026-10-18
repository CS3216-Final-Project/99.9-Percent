import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame, WALKTHROUGH_STEPS } from "@/game/store";
import { applyAction, newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { CampaignControls, CampaignOverlays } from "./CampaignUI";
import { setConfirming } from "./actionConfirmation";
import { useGuidanceCue } from "./useGuidanceCue";
import { CampaignAction } from "./CampaignAction";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { ChapterHints } from "./ChapterHints";

beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  useGame.setState({ game: newGame(), started: true, ready: true, tour: { track: "campaign", step: WALKTHROUGH_STEPS.campaign - 1 } });
});
afterEach(() => { cleanup(); setConfirming(null); vi.useRealTimers(); vi.restoreAllMocks(); });
const time = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const run = () => screen.getByRole("button", { name: /^(Run|Pause)$/ });
const cued = () => run().classList.contains("campaign-guidance-cue");
function IdleRunCue() {
  const cue = useGuidanceCue("idle-run", true, 10000);
  return <button className={cue ? "campaign-guidance-cue" : ""}>Run</button>;
}

it("cues the eligible Run instruction after ten idle seconds and re-arms after interaction without advancing time", () => {
  vi.useFakeTimers(); render(<IdleRunCue />);
  time(9999); expect(cued()).toBe(false); time(1); expect(cued()).toBe(true);
  expect(useGame.getState().game.campaign!.step).toBe(0);
  fireEvent.keyDown(document, { key: "Tab" }); expect(cued()).toBe(false);
  time(9999); expect(cued()).toBe(false); time(1); expect(cued()).toBe(true);
});
it("resets the idle delay on interaction and cleans up its timer on unmount", () => {
  vi.useFakeTimers(); const ui = render(<IdleRunCue />);
  time(9000); fireEvent.pointerDown(document); time(9000); expect(cued()).toBe(false);
  time(1000); expect(cued()).toBe(true); ui.unmount(); expect(vi.getTimerCount()).toBe(0);
});
it("cancels an unfinished idle timer when controls unmount", () => {
  vi.useFakeTimers(); const ui = render(<IdleRunCue />);
  time(9000); expect(vi.getTimerCount()).toBe(1);
  ui.unmount(); expect(vi.getTimerCount()).toBe(0);
  time(20000); expect(document.querySelector(".campaign-guidance-cue")).toBeNull();
});
it("ignores synthetic touch hover while real taps still restart Run inactivity", () => {
  vi.useFakeTimers();
  render(<><IdleRunCue/><button className="eq-label">Equipment</button></>);
  time(9000);
  const hover=new Event("pointerover",{bubbles:true});
  Object.defineProperty(hover,"pointerType",{value:"touch"});
  fireEvent(screen.getByRole("button",{name:"Equipment"}),hover);
  time(1000);expect(cued()).toBe(true);
  fireEvent.pointerDown(screen.getByRole("button",{name:"Equipment"}));
  expect(cued()).toBe(false);time(9999);expect(cued()).toBe(false);
  time(1);expect(cued()).toBe(true);
});
it.each([0, 5, 6])("never cues a different Opening instruction (%s)", step => {
  vi.useFakeTimers(); useGame.setState({ tour: { track: "campaign", step } }); render(<CampaignControls />);
  time(20000); expect(cued()).toBe(false);
});
it.each([false, true])("reserves ordinary Run attention for requested Hint, later chapter=%s", later => {
  vi.useFakeTimers(); useGame.setState({ game: later ? dataCompany() : newGame(), tour: null });
  render(<><ChapterHints/><CampaignControls /></>); time(10000); expect(cued()).toBe(false);
  expect(screen.getByRole("button",{name:"Hint"}).className).toContain("campaign-context-cue");
  fireEvent.click(screen.getByRole("button",{name:"Hint"}));
  fireEvent.click(screen.getByRole("button",{name:"Got it"}));time(0);expect(cued()).toBe(true);
  expect(useGame.getState().game.campaign!.pending).toHaveLength(0);
});
it("does not suggest Run when progression requires starting the reliability test", () => {
  vi.useFakeTimers(); useGame.setState({ game: preparedReliability(), tour: null });
  render(<CampaignControls />); time(20000); expect(cued()).toBe(false);
});
it("prioritises immediate incident Pause over Confirm and switches to Confirm only after pausing", async () => {
  vi.useFakeTimers(); const game = advanceSteps(newGame(), 7).state;
  useGame.setState({ game, running: true, tour: null });
  render(<><CampaignControls /><CampaignAction label="Add server" decision={{ type: "add_server" }} price={1000} onClick={() => {}} /></>);
  time(0); expect(cued()).toBe(true); expect(useGame.getState().running).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /Add server/ })); time(0);
  expect(screen.getByRole("button", { name: "Confirm" }).className).not.toContain("campaign-guidance-cue");
  expect(document.querySelectorAll(".campaign-guidance-cue").length).toBe(1);
  fireEvent.pointerDown(document); time(20000); expect(cued()).toBe(true);
  const blocker = document.createElement("div"); blocker.className = "modal-backdrop";
  await act(async () => document.body.append(blocker)); expect(cued()).toBe(false);
  await act(async () => blocker.remove()); time(0); expect(cued()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Pause" })); time(0);
  expect(useGame.getState().running).toBe(false); expect(cued()).toBe(false);
  expect(screen.getByRole("button", { name: "Confirm" }).className).toContain("campaign-guidance-cue");
  expect(document.querySelectorAll(".campaign-guidance-cue").length).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(document.querySelectorAll(".campaign-guidance-cue").length).toBe(0);
});
it("suppresses running, disabled, view, inspection and pending confirmation states", () => {
  vi.useFakeTimers(); render(<CampaignControls />);
  for (const patch of [{ running: true }, { started: false }, { view: "guidance" as const }, { chapterComplete: "scaling" as const }, { roomInspection: { seq: 1, equipment: "db" as const } }]) {
    act(() => useGame.setState(patch)); time(10001); expect(cued()).toBe(false);
    act(() => useGame.setState({ running: false, started: true, view: null, chapterComplete: null, roomInspection: null }));
  }
  act(() => setConfirming("Upgrade database")); time(10001); expect(cued()).toBe(false);
});
it("removes Pause emphasis during engine-recorded verification and does not restore it on a reset", () => {
  vi.useFakeTimers(); let game = advanceSteps(newGame(), 7).state;
  useGame.setState({ game, running: true, tour: null }); render(<CampaignControls/>);
  time(0); expect(cued()).toBe(true);
  const decision = applyAction(game, { type: "set_traffic_limit", enabled: true });
  if (!decision.ok) throw Error(decision.message);
  game = decision.state;
  for (let i = 0; i < 20 && !game.campaign!.incident?.stableSteps; i++) game = advanceSteps(game, 1).state;
  expect(game.campaign!.incident!.stableSteps).toBeGreaterThan(0);
  act(() => useGame.setState({ game })); time(0); expect(cued()).toBe(false);
  expect(useGame.getState().running).toBe(true);
  const removed = applyAction(game, { type: "set_traffic_limit", enabled: false });
  if (!removed.ok) throw Error(removed.message);
  game = advanceSteps(removed.state, 1).state;
  expect(game.campaign!.incident!.stableSteps).toBe(0);
  act(() => useGame.setState({ game })); time(0); expect(cued()).toBe(false);
});
it("hides the cue immediately when Finance or another paper modal covers the room", async () => {
  vi.useFakeTimers(); render(<IdleRunCue />); time(10000); expect(cued()).toBe(true);
  const blocker = document.createElement("div"); blocker.className = "modal-backdrop";
  await act(async () => { document.body.append(blocker); }); expect(cued()).toBe(false);
  await act(async () => blocker.remove()); time(9999); expect(cued()).toBe(false); time(1); expect(cued()).toBe(true);
});
function BriefCue({ eligible = true }: { eligible?: boolean }) {
  return <button className={useGuidanceCue("purchase", eligible, 0, "confirm") ? "cued" : ""}>Confirm fixture</button>;
}
it("keeps purchase emphasis through interaction while the decision remains relevant", () => {
  vi.useFakeTimers(); render(<BriefCue />); time(0);
  expect(screen.getByText("Confirm fixture").className).toBe("cued");
  fireEvent.pointerDown(document); expect(screen.getByText("Confirm fixture").className).toBe("cued");
  time(20000); expect(screen.getByText("Confirm fixture").className).toBe("cued");
});
it("waits behind the spotlight before emphasising Confirm", async () => {
  vi.useFakeTimers(); const tour = document.createElement("div"); tour.className = "tour"; document.body.append(tour);
  render(<BriefCue />); time(0); expect(screen.getByText("Confirm fixture").className).toBe("");
  await act(async () => tour.remove()); time(0);
  expect(screen.getByText("Confirm fixture").className).toBe("cued");
});
it("suspends Confirm behind an overlapping view sheet and resumes after closing it", async () => {
  vi.useFakeTimers(); render(<BriefCue />); time(0);
  const sheet = document.createElement("section"); sheet.className = "sheet sheet-history";
  await act(async () => document.body.append(sheet)); expect(screen.getByText("Confirm fixture").className).toBe("");
  await act(async () => sheet.remove()); time(0); expect(screen.getByText("Confirm fixture").className).toBe("cued");
});
it("never emphasises an unaffordable purchase or an explicitly disabled action", () => {
  vi.useFakeTimers(); const game = newGame(); game.campaign!.cashCents = 100000; useGame.setState({ game });
  render(<CampaignAction label="Add server" decision={{ type: "add_server" }} price={1000} onClick={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Add server/ })); time(20000);
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  expect(document.querySelector(".campaign-guidance-cue")).toBeNull();
});
it("keeps financial warnings prominent alongside a valid Confirm spotlight", () => {
  vi.useFakeTimers(); const game = advanceSteps(newGame(), 1).state; game.campaign!.cashCents = 100001;
  useGame.setState({ game, tour: null });
  render(<CampaignAction label="Add server" decision={{ type: "add_server" }} price={1000} onClick={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Add server/ })); time(0);
  const confirm = screen.getByRole("button", { name: "Confirm" });
  expect(confirm.hasAttribute("disabled")).toBe(false); expect(confirm.className).toContain("campaign-guidance-cue");
  expect(screen.getByRole("note").textContent).toContain("Warning:");
  expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
});
it("emphasises a valid real quote persistently and preserves autofocus", () => {
  vi.useFakeTimers(); useGame.setState({ tour: null });
  render(<CampaignAction label="Add server" decision={{ type: "add_server" }} price={1000} onClick={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Add server/ })); time(0);
  const confirm = screen.getByRole("button", { name: "Confirm" });
  expect(document.activeElement).toBe(confirm); expect(confirm.className).toContain("campaign-guidance-cue");
  time(20000); expect(confirm.className).toContain("campaign-guidance-cue");
});
it("removes Confirm emphasis for an unreviewed quote and a newly refused purchase", () => {
  vi.useFakeTimers(); useGame.setState({ tour: null });
  const buy = vi.fn();
  render(<CampaignAction label="Add server" decision={{ type: "add_server" }} price={1000} onClick={buy} />);
  fireEvent.click(screen.getByRole("button", { name: /Add server/ })); time(0);
  const changed = structuredClone(useGame.getState().game); changed.campaign!.cashCents -= 10000;
  act(() => useGame.setState({ game: changed }));
  expect(screen.getByRole("button", { name: "Confirm" }).className).not.toContain("campaign-guidance-cue");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" })); time(0);
  expect(screen.getByRole("status").textContent).toContain("preview changed"); expect(buy).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Confirm" }).className).not.toContain("campaign-guidance-cue");
  act(() => useGame.getState().act({ type: "start_db_upgrade" })); time(0);
  expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Confirm" }).className).not.toContain("campaign-guidance-cue");
});

function recover(limited: boolean) {
  const incident = advanceSteps(newGame(), 7).state;
  const result = applyAction(incident, limited ? { type: "set_traffic_limit", enabled: true } : { type: "start_db_upgrade" });
  if (!result.ok) throw Error(result.message);
  const recovered = advanceSteps(result.state, 50).state;
  expect(recovered.phase).toBe("review");
  return { incident, recovered };
}
it.each([false, true])("celebrates a real live recovery (limited=%s), then shows the unchanged review before acknowledgement", limited => {
  const { incident, recovered } = recover(limited);
  useGame.setState({ game: incident, tour: null }); render(<CampaignOverlays />);
  act(() => useGame.setState({ game: recovered, running: false }));
  const celebration = screen.getByRole("dialog", { name: "System Recovered!" });
  expect(celebration.textContent).toContain("Service has stabilised again.");
  expect(celebration.textContent!.includes("requests are rejected")).toBe(limited);
  const before = useGame.getState().game;
  fireEvent.click(within(celebration).getByRole("button", { name: "Review What Happened" }));
  expect(useGame.getState().game).toBe(before);
  expect(screen.getByRole("dialog", { name: "Incident postmortem" })).toBeTruthy();
  act(() => useGame.getState().openView("history"));
  expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
  expect(useGame.getState().game.phase).toBe("management");
});
it("loads an already-pending review directly and clears celebration on company replacement", () => {
  const { incident, recovered } = recover(false);
  useGame.setState({ game: recovered, tour: null }); render(<CampaignOverlays />);
  expect(screen.getByRole("dialog", { name: "Incident postmortem" })).toBeTruthy();
  act(() => useGame.setState({ game: incident })); act(() => useGame.setState({ game: recovered }));
  expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
  act(() => useGame.setState({ game: newGame(99, "replacement"), generation: useGame.getState().generation + 1 }));
  expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
});
it("does not celebrate loading/replacing a company with a review or an ended outcome", () => {
  const { incident, recovered } = recover(false);
  useGame.setState({ game: incident, tour: null }); render(<CampaignOverlays />);
  act(() => useGame.setState({ game: recovered, generation: useGame.getState().generation + 1 }));
  expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
  act(() => useGame.setState({ game: { ...recovered, phase: "ended", outcome: "bankrupt" } }));
  expect(screen.queryByRole("dialog", { name: "System Recovered!" })).toBeNull();
});
it("celebrates a separate later incident in the same company after the first review", () => {
  const first = advanceSteps(newGame(3, "data-company"), 6).state;
  const upgrade = applyAction(first, { type: "start_db_upgrade" }); if (!upgrade.ok) throw Error(upgrade.message);
  const firstReview = advanceSteps(upgrade.state, 30).state;
  useGame.setState({ game: first, tour: null }); render(<CampaignOverlays />);
  act(() => useGame.setState({ game: firstReview }));
  fireEvent.click(screen.getByRole("button", { name: "Review What Happened" }));
  const later = advanceSteps(dataCompany(), 6).state;
  const cache = applyAction(later, { type: "deploy_cache" }); if (!cache.ok) throw Error(cache.message);
  const secondReview = advanceSteps(cache.state, 30).state;
  expect(secondReview.phase).toBe("review");
  expect(secondReview.campaign!.reports.at(-1)!.id).not.toBe(firstReview.campaign!.reports.at(-1)!.id);
  act(() => useGame.setState({ game: later })); act(() => useGame.setState({ game: secondReview }));
  expect(screen.getByRole("dialog", { name: "System Recovered!" })).toBeTruthy();
});

it("does not treat a hidden Chapter 0 lesson as an incident Run instruction", () => {
  vi.useFakeTimers();
  const result = applyAction(advanceSteps(newGame(), 7).state, {type:"start_db_upgrade"});
  if (!result.ok) throw Error(result.message);
  useGame.setState({game:result.state, tour:{track:"campaign",step:WALKTHROUGH_STEPS.campaign-1}});
  render(<><ChapterHints/><CampaignControls/></>);
  time(20000); expect(cued()).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"Hint"}));
  fireEvent.click(screen.getByRole("button",{name:"Got it"}));
  time(0); expect(cued()).toBe(true);
  expect(useGame.getState().game).toBe(result.state);
});

it.each([0, 5, 6, 20])("interactive Chapter 0 owns attention without optional Hint interference, lesson %s", step => {
  vi.useFakeTimers();
  const game = newGame();
  useGame.setState({game, tour:{track:"campaign",step,...(step===5?{clockUntil:1}:{})}});
  render(<><CampaignControls/><ChapterHints/></>);
  time(30000);
  expect(screen.queryByRole("dialog",{name:"Need a little help?"})).toBeNull();
  expect(document.querySelector(".campaign-guidance-cue")).toBeNull();
  expect(run().hasAttribute("disabled")).toBe(step!==5);
  expect(screen.getByRole("button",{name:"Hint"}).hasAttribute("disabled")).toBe(true);
  expect(useGame.getState().game).toBe(game);
});
it("keeps the interactive practice Confirm disabled and unlit without spending cash", () => {
  vi.useFakeTimers();
  const game=newGame();useGame.setState({game,tour:{track:"campaign",step:6}});
  render(<CampaignAction label="Add server" decision={{type:"add_server"}} price={1000} onClick={()=>{throw Error("Practice must not buy");}}/>);
  fireEvent.click(screen.getByRole("button",{name:/Add server/}));time(30000);
  const confirm=screen.getByRole("button",{name:"Confirm"});
  expect(confirm.hasAttribute("disabled")).toBe(true);
  expect(confirm.className).not.toContain("campaign-guidance-cue");
  fireEvent.click(confirm);expect(useGame.getState().game).toBe(game);
});
it("defers optional Confirm attention behind the interactive Chapter 0 guide", async () => {
  vi.useFakeTimers();const guide=document.createElement("section");guide.className="chapter-zero-modal";document.body.append(guide);
  render(<BriefCue/>);time(30000);expect(screen.getByText("Confirm fixture").className).toBe("");
  await act(async()=>guide.remove());time(0);expect(screen.getByText("Confirm fixture").className).toBe("cued");
});
