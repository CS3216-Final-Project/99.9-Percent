import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newGame, newLegacyGame } from "@/sim";
import { act as decide, tick, spikeCompany } from "@/sim/__tests__/spikeFixtures";
import { dataCompany } from "@/sim/__tests__/dataFixture";
import { preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "@/sim/__tests__/combinedFixture";
import { preventedOpening, recoveredOpening } from "@/game/__fixtures__/openingOutcome";
import { chapterCompanyMessage } from "@/game/chapterCompanyMessage";
import { makeEnvelope, decodeSave } from "@/game/saveEnvelope";
import { useGame } from "@/game/store";
import { DEFAULT_META, loadGame, saveGame, saveMeta } from "@/game/persist";
import { ChapterCompanyMessage } from "./ChapterCompanyMessage";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignPanel, CampaignControls } from "./CampaignUI";
import { setConfirming } from "./actionConfirmation";

const companies = [newGame(), dataCompany("read-heavy", false), dataCompany(), spikeCompany(false), preparedReliability(), combinedCompany()];
const senders = [["Maya", "Customer Support"], ["Alex", "CEO"], ["Jordan", "Software Engineer"], ["Sam", "Marketing"], ["Taylor", "Operations Engineer"], ["Alex", "CEO"]];
const message = () => screen.queryByRole("dialog", { name: "Company Message" });
const next = () => within(message()!).queryByRole("button", { name: "Next" });
/** Advances through the colleague's lines to the mission, then acknowledges it. */
const readThrough = () => { while (next()) fireEvent.click(next()!); fireEvent.click(within(message()!).getByRole("button", { name: "Got it" })); };
beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
});
afterEach(() => { cleanup(); setConfirming(null); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const host = () => <CampaignAttentionHost><CampaignHeader/><CampaignPanel/><CampaignControls/></CampaignAttentionHost>;

it("shows the same Maya dialogue in fresh and replayed Chapter 0 without replacing the saved company", () => {
  const fresh = decide(newGame(1,"first-introduction",2),{type:"begin_introduction"});
  const first = chapterCompanyMessage(fresh)!;
  expect(first).toMatchObject({chapter:0,speaker:"maya",lines:chapterCompanyMessage(newGame())!.lines});
  render(<StrictMode><ChapterCompanyMessage model={first} enabled/></StrictMode>);
  expect(within(message()!).getByRole("img",{name:/^Maya,/}).getAttribute("src")).toBe("/characters/maya.webp");
  readThrough(); cleanup();

  const company = tick(newGame(1,"kept-company"),6);
  saveGame(company,400);saveMeta({...DEFAULT_META,tutorialDone:true});
  useGame.getState().boot();useGame.getState().play();
  useGame.getState().startTour("campaign");
  const replay = chapterCompanyMessage(useGame.getState().game)!;
  expect(replay.lines).toEqual(first.lines);expect(replay.key).not.toBe(first.key);
  render(host());
  expect(message()!.textContent).toContain(first.lines[0]);
  expect(within(message()!).getByRole("img",{name:/^Maya,/}).getAttribute("src")).toBe("/characters/maya.webp");
  readThrough();cleanup();
  useGame.getState().endSession();useGame.setState(useGame.getInitialState(),true);
  useGame.getState().boot();useGame.getState().play();render(host());
  expect(message()).toBeNull(); // Reloading the same practice does not repeat the message.
  act(()=>useGame.getState().endTour(false));
  expect(useGame.getState().game).toEqual(company);
  expect(loadGame()).toMatchObject({status:"ok",game:company,remainderMs:400});
});

it.each(companies.map((game, i) => [i + 1, game] as const))("shows the actual chapter %i colleague and mission once in StrictMode", (chapter, game) => {
  const before = JSON.stringify(makeEnvelope(game, 0, 1)), model = chapterCompanyMessage(game)!;
  expect(model.chapter).toBe(chapter);
  const show = () => <StrictMode><ChapterCompanyMessage model={model} enabled><p>Current stage cue</p></ChapterCompanyMessage></StrictMode>;
  render(show());
  expect(screen.getAllByRole("dialog")).toHaveLength(1); expect(message()!.getAttribute("aria-modal")).toBe("true");
  expect(document.querySelector(".dialogue-backdrop")).not.toBeNull();
  expect(message()!.textContent).toContain(senders[chapter - 1][0]); expect(message()!.textContent).toContain(senders[chapter - 1][1]);
  expect(within(message()!).getByRole("img", { name: new RegExp(`^${model.name}, `) }).getAttribute("src")).toBe(`/characters/${model.speaker}.webp`);
  expect(screen.queryByText("Current stage cue")).toBeNull();
  for (const [i, line] of model.lines.entries()) {
    expect(message()!.textContent).toContain(line);
    expect(within(message()!).getByRole("img", { name: `Line ${i + 1} of ${model.lines.length}` })).toBeTruthy();
    if (i < model.lines.length - 1) { expect(message()!.textContent).not.toContain("Your mission:"); fireEvent.click(next()!); }
  }
  expect(message()!.textContent).toContain("Your mission:"); expect(message()!.textContent).toContain(model.mission);
  fireEvent.click(within(message()!).getByRole("button", { name: "Got it" }));
  expect(message()).toBeNull(); expect(document.querySelector(".dialogue-backdrop")).toBeNull(); expect(screen.getByText("Current stage cue")).toBeTruthy();
  cleanup(); render(show()); expect(message()).toBeNull();
  expect(JSON.stringify(makeEnvelope(game, 0, 1))).toBe(before);
});

it.each(["X", "Escape"])("dismisses with %s part way through the dialogue", method => {
  const model = chapterCompanyMessage(newGame())!;
  render(<ChapterCompanyMessage model={model} enabled/>); fireEvent.click(next()!);
  if (method === "X") fireEvent.click(within(message()!).getByRole("button", { name: "Dismiss company message" }));
  else fireEvent.keyDown(message()!, { key: "Escape" });
  expect(message()).toBeNull();
});

it("advances one line at a time from the dialogue box and keeps the mission until acknowledged", () => {
  const model = chapterCompanyMessage(companies[3])!;
  render(<ChapterCompanyMessage model={model} enabled/>);
  const copy = message()!.querySelector(".dialogue-copy")!;
  // The live region names the speaker, so a screen reader hears who says each line.
  expect(copy.getAttribute("aria-live")).toBe("polite");
  expect(copy.textContent).toBe(`Sam: ${model.lines[0]}`);
  // A press outside the buttons focuses the dialogue, and reading on returns focus to Next.
  expect(message()!.tabIndex).toBe(-1);
  message()!.focus(); fireEvent.click(copy); expect(copy.textContent).toBe(`Sam: ${model.lines[1]}`); expect(document.activeElement).toBe(next());
  fireEvent.click(message()!.querySelector(".dialogue-foot")!); expect(copy.textContent).toContain(model.lines[2]);
  fireEvent.click(copy); fireEvent.click(copy);
  expect(copy.textContent).toContain(model.lines.at(-1)); expect(copy.textContent).toContain(model.mission);
  expect(next()).toBeNull(); expect(message()).not.toBeNull();
  expect(message()!.querySelectorAll(".dialogue-progress > [data-read]")).toHaveLength(model.lines.length);
});

it("lets the player select text without reading on, and reads on with Enter while the dialogue itself has focus", () => {
  const model = chapterCompanyMessage(companies[3])!;
  render(<ChapterCompanyMessage model={model} enabled/>);
  const copy = message()!.querySelector(".dialogue-copy")!, line = copy.querySelector(".dialogue-line")!;
  expect(fireEvent.mouseDown(copy)).toBe(true);
  window.getSelection()!.selectAllChildren(line); fireEvent.click(line);
  expect(copy.textContent).toContain(model.lines[0]);
  window.getSelection()!.removeAllRanges();
  message()!.focus(); fireEvent.keyDown(message()!, { key: "Enter" });
  expect(copy.textContent).toContain(model.lines[1]);
  fireEvent.keyDown(message()!, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(next());
});

it("preloads every portrait of the scene and hides a portrait that fails to load", () => {
  const requested: string[] = [];
  vi.stubGlobal("Image", class { set src(value: string) { requested.push(value); } });
  render(<ChapterCompanyMessage model={chapterCompanyMessage(companies[0])!} enabled/>);
  expect(requested).toEqual(["/characters/maya.webp"]);
  const portrait = message()!.querySelector<HTMLImageElement>(".dialogue-portrait")!;
  expect(portrait.hasAttribute("data-broken")).toBe(false);
  fireEvent.error(portrait); expect(portrait.hasAttribute("data-broken")).toBe(true);
});

it("keeps a valid line when the current message gets shorter while it is read", () => {
  const healthy = chapterCompanyMessage(newGame())!, slow = { ...chapterCompanyMessage(tick(newGame(), 5))!, key: healthy.key };
  expect(slow.lines.length).toBeLessThan(healthy.lines.length);
  const view = render(<ChapterCompanyMessage model={healthy} enabled/>); fireEvent.click(next()!); fireEvent.click(next()!);
  view.rerender(<ChapterCompanyMessage model={slow} enabled/>);
  expect(message()!.textContent).toContain(slow.lines.at(-1)); expect(message()!.textContent).toContain("Your mission:");
});

it("deduplicates an already-shown message across reload before dismissal without changing the save", () => {
  const game = companies[0], raw = JSON.stringify(makeEnvelope(game, 0, 1));
  render(<ChapterCompanyMessage model={chapterCompanyMessage(game)!} enabled/>); expect(message()).not.toBeNull(); cleanup();
  const loaded = decodeSave(raw); if (loaded.status !== "ok") throw Error(loaded.status);
  render(<ChapterCompanyMessage model={chapterCompanyMessage(loaded.game)!} enabled/>); expect(message()).toBeNull();
  expect(loaded.game).toEqual(game);
});

it("uses a different receipt for a new company and actual stage entry", () => {
  expect(chapterCompanyMessage(companies[0])!.key).not.toBe(chapterCompanyMessage(newGame(0, "another-company"))!.key);
  const recognised = decide(decide(recoveredOpening(), {type:"acknowledge_review"}), {type:"acknowledge_milestone",enterScaling:false});
  expect(chapterCompanyMessage(recognised)!.chapter).toBe(1);
  expect(chapterCompanyMessage(decide(recognised, {type:"enter_scaling"}))!.chapter).toBe(2);
});

it("uses truthful Opening copy and the actual final target", () => {
  const said = (game: Parameters<typeof chapterCompanyMessage>[0]) => chapterCompanyMessage(game)!.lines.join(" ");
  const healthy = newGame(); expect(said(healthy)).not.toContain("reporting");
  expect(said(tick(healthy, 5))).toContain("getting slower");
  const custom = structuredClone(companies[5]); custom.campaign!.combinedStage!.finalUserTarget = 75000;
  expect(said(custom)).toContain("75,000"); expect(said(custom)).not.toContain("50,000");
  custom.campaign!.combinedStage!.users = 75000;
  expect(said(custom)).toContain("finish the final Campaign checks");
  expect(chapterCompanyMessage(newLegacyGame())).toBeNull();
});

it("retains an in-memory receipt if storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("Unavailable"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("Unavailable"); });
  const model = chapterCompanyMessage(newGame(0, "company-message-unavailable"))!;
  render(<ChapterCompanyMessage model={model} enabled/>); expect(message()).not.toBeNull(); cleanup();
  render(<ChapterCompanyMessage model={model} enabled/>); expect(message()).toBeNull();
});

it("defers without consuming a receipt and sequences the Chapter 4 cue after dismissal", () => {
  useGame.setState({ game: companies[3], ready: true, started: true, onboarding: false, tour: {track:"spikes",step:0} });
  render(host()); expect(message()).toBeNull();
  expect(localStorage.getItem(chapterCompanyMessage(companies[3])!.key)).toBeNull();
  act(() => useGame.setState({tour:null})); expect(message()).not.toBeNull();
  expect(screen.queryByRole("dialog",{name:/^Chapter 4:/})).toBeNull();
  readThrough();
  expect(message()).toBeNull(); expect(screen.getByRole("dialog",{name:"Chapter 4: Prepare"})).toBeTruthy();
});

it.each(["incident", "review", "prevention", "recognition", "next", "menu", "confirmation", "classic"])("respects %s priority without consuming the introduction", priority => {
  let game = newGame();
  if(priority === "incident") game = tick(game,6);
  if(priority === "review") game = recoveredOpening();
  if(priority === "prevention") game = preventedOpening();
  if(priority === "recognition") game = decide(recoveredOpening(),{type:"acknowledge_review"});
  if(priority === "next") game = companies[1];
  if(priority === "classic") game = newLegacyGame();
  if(priority === "confirmation") setConfirming("Add server");
  useGame.setState({game,ready:true,started:true,onboarding:false,tour:null,view:priority === "menu"?"menu":null});
  render(priority === "classic" ? <CampaignAttentionHost><span>Classic company</span></CampaignAttentionHost> : host()); expect(message()).toBeNull();
  const model = chapterCompanyMessage(game); if(model) expect(localStorage.getItem(model.key)).toBeNull();
});

it("does not replay after pause/resume and preserves manual Hint after dismissal", () => {
  const game = companies[3]; useGame.setState({game,ready:true,started:true,onboarding:false,tour:null});
  render(host()); expect(message()).not.toBeNull();
  act(() => useGame.getState().setRunning(true)); expect(message()).not.toBeNull();
  act(() => useGame.getState().setRunning(false)); expect(screen.getAllByRole("dialog",{name:"Company Message"})).toHaveLength(1);
  readThrough();
  fireEvent.click(within(screen.getByRole("dialog",{name:"Chapter 4: Prepare"})).getByRole("button",{name:"Got it"}));
  fireEvent.click(screen.getByRole("button",{name:"Hint"})); expect(message()).toBeNull();
  fireEvent.click(within(screen.getByRole("dialog",{name:"Hint"})).getByRole("button",{name:"Got it"}));
  expect(document.querySelectorAll(".campaign-gold-attention")).toHaveLength(1); expect(message()).toBeNull();
  expect(useGame.getState().game).toBe(game);
});

it("contains keyboard focus, ignores outside clicks and restores background interaction and focus", () => {
  const background = document.createElement("div"), trigger = document.createElement("button");
  background.append(trigger); document.body.append(background); trigger.focus();
  const view = render(<ChapterCompanyMessage model={chapterCompanyMessage(companies[0])!} enabled/>);
  const dismiss = within(message()!).getByRole("button",{name:"Dismiss company message"});
  const primary = next()!;
  expect(background.inert).toBe(true); expect(document.activeElement).toBe(primary);
  fireEvent.keyDown(primary,{key:"Tab"}); expect(document.activeElement).toBe(dismiss);
  fireEvent.keyDown(dismiss,{key:"Tab",shiftKey:true}); expect(document.activeElement).toBe(primary);
  fireEvent.mouseDown(document.querySelector(".dialogue-backdrop")!);
  fireEvent.click(document.querySelector(".dialogue-backdrop")!); expect(message()).not.toBeNull();
  // Game shortcuts listen on the window; none of the dialogue's keys may reach them.
  const shortcuts: string[] = [], listen = (event: KeyboardEvent) => shortcuts.push(event.key);
  window.addEventListener("keydown", listen);
  fireEvent.keyDown(primary,{key:"p"}); fireEvent.keyDown(message()!,{key:"p"}); expect(message()).not.toBeNull();
  expect(shortcuts).toEqual([]);
  readThrough(); expect(background.inert).toBeFalsy(); expect(document.activeElement).toBe(trigger);
  fireEvent.keyDown(trigger,{key:"p"}); expect(shortcuts).toEqual(["p"]);
  window.removeEventListener("keydown", listen);
  view.unmount(); background.remove();
});

it("restores background interaction when a higher-priority modal interrupts", () => {
  const view = render(<ChapterCompanyMessage model={chapterCompanyMessage(companies[0])!} enabled/>);
  expect(view.container.inert).toBe(true);
  view.rerender(<ChapterCompanyMessage model={chapterCompanyMessage(companies[0])!} enabled={false}/>);
  expect(view.container.inert).toBeFalsy(); expect(document.querySelector(".dialogue-backdrop")).toBeNull();
});

it("does not paint over a blocking modal mounted in the same render", () => {
  useGame.setState({game:companies[0],ready:true,started:true,onboarding:false,tour:null});
  render(<CampaignAttentionHost><div className="modal-backdrop"/></CampaignAttentionHost>);
  expect(message()).toBeNull(); expect(localStorage.getItem(chapterCompanyMessage(companies[0])!.key)).toBeNull();
});
