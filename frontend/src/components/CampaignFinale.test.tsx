import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newGame } from "@/sim";
import { act, finishedCompany } from "@/sim/__tests__/combinedFixture";
import { campaignFinale } from "@/game/campaignFinale";
import { makeEnvelope } from "@/game/saveEnvelope";
import { useGame } from "@/game/store";
import { CampaignOverlays } from "./CampaignUI";

const won = act(finishedCompany(), { type: "complete_campaign" });
const finale = () => screen.queryByRole("dialog", { name: "Campaign finale" });
const scorecard = () => screen.queryByRole("dialog", { name: "Campaign complete" });
const next = () => within(finale()!).queryByRole("button", { name: "Next" });
const portrait = () => finale()!.querySelector<HTMLImageElement>(".dialogue-portrait")!;
const show = (game = won) => { useGame.setState({ game, ready: true, started: true, onboarding: false, view: null }); return render(<StrictMode><CampaignOverlays/></StrictMode>); };
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("only celebrates a won campaign, with every colleague in order and true numbers", () => {
  expect(campaignFinale(newGame())).toBeNull();
  expect(campaignFinale(finishedCompany())).toBeNull();
  expect(campaignFinale({ ...won, outcome: "bankrupt" })).toBeNull();
  const model = campaignFinale(won)!;
  expect(model.lines.map(l => l.speaker)).toEqual(["maya", "jordan", "sam", "taylor", "alex"]);
  expect(model.lines.every(l => l.mood === "celebrating")).toBe(true);
  expect(model.lines.at(-1)!.text).toContain(won.campaign!.scorecard!.users.toLocaleString("en-US"));
  expect(model.stats.find(s => s.label === "Users")!.value).toBe("50,000");
  const quiet = structuredClone(won), once = structuredClone(won), unknown = structuredClone(won);
  quiet.campaign!.scorecard!.incidentCount = 0; once.campaign!.scorecard!.incidentCount = 1; unknown.campaign!.scorecard!.wholeRunUptime = null;
  expect(campaignFinale(quiet)!.lines[3].text).toContain("Not a single incident");
  expect(campaignFinale(once)!.lines[3].text).toMatch(/^1 incident,/);
  expect(campaignFinale(unknown)!.stats.map(s => s.label)).toEqual(["Users", "Incidents"]);
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
  expect(within(finale()!).getByLabelText("Campaign results").textContent).toContain("50,000");
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

it("preloads every celebrating portrait when the finale opens", () => {
  const requested: string[] = [];
  vi.stubGlobal("Image", class { set src(value: string) { requested.push(value); } });
  show();
  expect([...new Set(requested)]).toEqual(["maya", "jordan", "sam", "taylor", "alex"].map(id => `/characters/${id}-celebrating.webp`));
});
