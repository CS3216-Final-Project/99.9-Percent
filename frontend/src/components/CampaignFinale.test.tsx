import { StrictMode } from "react";
import { act as update, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newGame } from "@/sim";
import { act, completedReliability } from "@/sim/__tests__/completionFixture";
import { campaignFinale } from "@/game/campaignFinale";
import { makeEnvelope } from "@/game/saveEnvelope";
import { useGame } from "@/game/store";
import { CampaignOverlays } from "./CampaignUI";

const ready = completedReliability(), won = act(ready, { type: "complete_campaign" });
const finale = () => screen.queryByRole("dialog", { name: "Campaign finale" });
const scorecard = () => screen.queryByRole("dialog", { name: "Campaign complete" });
const next = () => within(finale()!).queryByRole("button", { name: "Next" });
const portrait = () => finale()!.querySelector<HTMLImageElement>(".dialogue-portrait")!;
/** As in the game, the Guided Mode overlays give way once the loaded company is a Challenge Mode one. */
const Overlays = () => useGame(s => !!s.game.campaign) ? <CampaignOverlays/> : null;
const show = (game = won) => { useGame.setState({ game, ready: true, started: true, onboarding: false, view: null }); return render(<StrictMode><Overlays/></StrictMode>); };
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("only celebrates a won campaign, with every colleague in order and true numbers", () => {
  expect(campaignFinale(newGame())).toBeNull();
  expect(campaignFinale(ready)).toBeNull();
  expect(campaignFinale({ ...won, outcome: "bankrupt" })).toBeNull();
  const model = campaignFinale(won)!;
  expect(model.lines.map(l => l.speaker)).toEqual(["maya", "jordan", "sam", "taylor", "alex"]);
  expect(model.lines.every(l => l.mood === "celebrating")).toBe(true);
  // No line claims what the scorecard cannot back: the Opening's database often did fall behind, and chapters are not in-world.
  expect(model.lines.map(l => l.text).join(" ")).not.toMatch(/chapter|kept up/i);
  expect(model.lines.at(-1)!.text).toContain("one server");
  expect(model.stats.map(s => s.label)).toEqual(["Uptime", "Incidents"]);
  expect(model.stats.find(s => s.label === "Incidents")!.value).toBe(String(won.campaign!.scorecard!.incidentCount));
  const quiet = structuredClone(won), once = structuredClone(won), unknown = structuredClone(won);
  quiet.campaign!.scorecard!.incidentCount = 0; once.campaign!.scorecard!.incidentCount = 1; unknown.campaign!.scorecard!.wholeRunUptime = null;
  expect(campaignFinale(quiet)!.lines[3].text).toContain("Not a single incident");
  expect(campaignFinale(once)!.lines[3].text).toMatch(/^1 incident,/);
  expect(campaignFinale(unknown)!.stats.map(s => s.label)).toEqual(["Incidents"]);
});

it("plays the celebration once before the scorecard, switching speaker and portrait each line", () => {
  const before = JSON.stringify(makeEnvelope(won, 0, 1)), model = campaignFinale(won)!;
  show();
  expect(finale()!.getAttribute("aria-modal")).toBe("true"); expect(scorecard()).toBeNull();
  for (const [i, line] of model.lines.entries()) {
    expect(finale()!.getAttribute("data-speaker")).toBe(line.speaker);
    expect(portrait().getAttribute("src")).toBe(`/characters/${line.speaker}-celebrating.webp`);
    expect(portrait().alt).toMatch(/cheering|raising a glass|pumping/);
    expect(finale()!.textContent).toContain(line.text);
    expect(finale()!.querySelector(".dialogue-stats") !== null).toBe(i === model.lines.length - 1);
    if (next()) fireEvent.click(next()!);
  }
  expect(within(finale()!).getByLabelText("Campaign results").textContent).toContain(model.stats.at(-1)!.value);
  fireEvent.click(within(finale()!).getByRole("button", { name: "See the scorecard" }));
  expect(finale()).toBeNull(); expect(scorecard()).not.toBeNull();
  cleanup(); show(); expect(finale()).toBeNull(); expect(scorecard()).not.toBeNull();
  expect(JSON.stringify(makeEnvelope(useGame.getState().game, 0, 1))).toBe(before);
});

it.each(["X", "Escape"])("skips to the scorecard with %s from any line", method => {
  show(); fireEvent.click(next()!);
  if (method === "X") fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  else fireEvent.keyDown(finale()!, { key: "Escape" });
  expect(finale()).toBeNull(); expect(scorecard()).not.toBeNull();
});

it("plays again if it was left part way, and not once it was skipped", () => {
  const key = campaignFinale(won)!.key;
  show(); fireEvent.click(next()!); expect(localStorage.getItem(key)).toBeNull();
  cleanup(); show(); expect(finale()).not.toBeNull();
  expect(finale()!.querySelector(".dialogue-copy")!.textContent).toContain("Maya: ");
  fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  cleanup(); show(); expect(finale()).toBeNull(); expect(scorecard()).not.toBeNull();
});

it("remembers a finished finale for the session when storage is unavailable", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("Unavailable"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("Unavailable"); });
  const game = structuredClone(won); game.campaign!.scorecard!.runId = "finale-without-storage";
  show(game); fireEvent.keyDown(finale()!, { key: "Escape" });
  cleanup(); show(game); expect(finale()).toBeNull(); expect(scorecard()).not.toBeNull();
});

it("continues from the scorecard into Challenge Mode, saving the finished company first", () => {
  show(); useGame.setState({ hasRun: true }); fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  const go = within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" });
  expect(document.activeElement).toBe(go);
  fireEvent.click(go);
  expect(useGame.getState().mode).toBe("classic");
  expect(useGame.getState().game.campaign).toBeUndefined();
  expect(localStorage.getItem("nn.mode.v1")).toBe("classic");
  expect(JSON.parse(localStorage.getItem("nn.campaign.save.v1")!).step).toBe(won.campaign!.step);
});

it("asks before losing a finished company that cannot be saved, then switches when asked again", () => {
  show(); useGame.setState({ hasRun: true }); fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("Full"); });
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" }));
  expect(useGame.getState().mode).toBe("campaign");
  expect(within(scorecard()!).getByRole("alert").textContent).toContain("This company could not be saved");
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Switch and lose this company" }));
  expect(useGame.getState().mode).toBe("classic");
});

it("keeps Continue to Challenge Mode on a won run's scorecard reopened from the final company, opening on Close", () => {
  show(); useGame.setState({ hasRun: true }); fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Inspect final company" }));
  update(() => useGame.getState().openView("scorecard"));
  const reopened = screen.getByRole("dialog", { name: "Company scorecard" });
  expect(document.activeElement).toBe(within(reopened).getByRole("button", { name: "Close" }));
  // Inspect final company returns to the company, as Close does.
  fireEvent.click(within(reopened).getByRole("button", { name: "Inspect final company" }));
  expect(useGame.getState().view).toBe("guidance");
  update(() => useGame.getState().openView("scorecard"));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Company scorecard" })).getByRole("button", { name: "Continue to Challenge Mode" }));
  expect(useGame.getState().mode).toBe("classic");
  expect(JSON.parse(localStorage.getItem("nn.campaign.save.v1")!).step).toBe(won.campaign!.step);
});

it("offers no Challenge Mode from a bankrupt company's scorecard", () => {
  const bankrupt = structuredClone(won); bankrupt.outcome = "bankrupt"; bankrupt.campaign!.scorecard!.outcome = "bankrupt";
  show(bankrupt); update(() => useGame.getState().openView("scorecard"));
  const card = screen.getByRole("dialog", { name: "Company scorecard" });
  expect(within(card).queryByRole("button", { name: "Continue to Challenge Mode" })).toBeNull();
  expect(within(card).queryByRole("button", { name: "Inspect final company" })).toBeNull();
});

it("does not switch on a held Enter that carried on from the finale", () => {
  show(); useGame.setState({ hasRun: true });
  while (next()) fireEvent.click(next()!);
  fireEvent.click(within(finale()!).getByRole("button", { name: "See the scorecard" }));
  const go = within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" });
  expect(document.activeElement).toBe(go);
  // A repeated key is cancelled before it can activate the button; a new press still does.
  expect(fireEvent.keyDown(go, { key: "Enter", repeat: true })).toBe(false);
  expect(fireEvent.keyDown(go, { key: "Enter" })).toBe(true);
});

it("drops the warning when a cloud action refuses the switch instead of the save", () => {
  show(); useGame.setState({ hasRun: true }); fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("Full"); });
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" }));
  useGame.setState({ cloudBusy: true });
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Switch and lose this company" }));
  expect(scorecard()!.textContent).not.toContain("could not be saved");
  // Once the cloud action is over, the switch tries to save again rather than discarding the company unasked.
  useGame.setState({ cloudBusy: false }); setItem.mockRestore();
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" }));
  expect(useGame.getState().mode).toBe("classic");
  expect(JSON.parse(localStorage.getItem("nn.campaign.save.v1")!).step).toBe(won.campaign!.step);
});

it("waits out a cloud action without claiming the finished company could not be saved", () => {
  show(); useGame.setState({ hasRun: true }); fireEvent.click(within(finale()!).getByRole("button", { name: "Skip to the scorecard" }));
  useGame.setState({ cloudBusy: true });
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" }));
  expect(useGame.getState().mode).toBe("campaign");
  expect(useGame.getState().toast?.text).toBe("Wait for the cloud operation before replacing this company.");
  expect(scorecard()!.textContent).not.toContain("could not be saved");
  useGame.setState({ cloudBusy: false });
  fireEvent.click(within(scorecard()!).getByRole("button", { name: "Continue to Challenge Mode" }));
  expect(useGame.getState().mode).toBe("classic");
});

it("preloads every celebrating portrait when the finale opens", () => {
  const requested: string[] = [];
  vi.stubGlobal("Image", class { set src(value: string) { requested.push(value); } });
  show();
  expect([...new Set(requested)]).toEqual(["maya", "jordan", "sam", "taylor", "alex"].map(id => `/characters/${id}-celebrating.webp`));
});
