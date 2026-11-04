import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/App";
import { BALANCE, type GameState } from "@/sim";
import { balanced, runBot } from "@/sim/__tests__/bots";
import { DEFAULT_META, loadClassicGame, readAnalytics, saveClassicGame, saveMeta, saveMode } from "@/game/persist";
import { useGame } from "@/game/store";

vi.mock("@/components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));

let won: GameState;
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  won ??= runBot(BALANCE.introSeed, balanced, "expert").state;
  saveMeta({ ...DEFAULT_META, challengeUnlocked: true });
  saveMeta({ ...DEFAULT_META, tutorialDone: true, onboarded: true, runsStarted: 1, runsFinished: 1 }, "classic");
  saveMode("classic");
  saveClassicGame(won);
});
afterEach(cleanup);

const home = () => within(screen.getByRole("region", { name: "Choose how you want to play" })).getByRole("region", { name: "Challenge Mode" });
const reload = () => {
  cleanup();
  useGame.setState(useGame.getInitialState(), true);
  render(<StrictMode><App /></StrictMode>);
};

it("reopens a run that secured its Series A on its report, and keeps the same company going with no deadline", () => {
  expect(won).toMatchObject({ phase: "ended", outcome: "won" });
  render(<StrictMode><App /></StrictMode>);
  expect(home().textContent).toMatch(/Saved game\s*Series A secured/);
  fireEvent.click(within(home()).getByRole("button", { name: "See your results" }));

  const report = screen.getByRole("dialog", { name: "Series A secured" });
  const keep = within(report).getByRole("button", { name: "Keep playing" });
  expect(document.activeElement).toBe(keep);
  fireEvent.click(keep);

  expect(screen.queryByRole("dialog", { name: "Series A secured" })).toBeNull();
  expect(useGame.getState().game).toMatchObject({ phase: "management", outcome: null, seriesAWeek: won.totals.weeks, users: won.users });
  const clock = screen.getByRole("group", { name: "Time" });
  expect(clock.textContent).toContain(`Week ${won.turn}`);
  expect(clock.textContent).not.toContain(`/${BALANCE.maxTurns}`);
  expect(within(clock).getByRole("button", { name: /Next week/ })).toHaveProperty("disabled", false);
  expect(readAnalytics().filter((e) => e.name === "endless_started")).toHaveLength(1);
  expect(useGame.getState().meta.runsFinished).toBe(1);

  // The growing company outgrows its database in its first week past the Series A: play goes on as normal.
  fireEvent.click(within(clock).getByRole("button", { name: /Next week/ }));
  const after = useGame.getState().game;
  expect(after).toMatchObject({ phase: "incident", incident: { type: "db_saturation" }, seriesAWeek: won.totals.weeks });
  expect(loadClassicGame()).toMatchObject({ status: "ok", game: { phase: "incident", seriesAWeek: won.totals.weeks } });

  reload();
  expect(home().textContent).toContain(`Week ${after.turn}: Series A secured`);
  fireEvent.click(within(home()).getByRole("button", { name: `Continue week ${after.turn}` }));
  expect(useGame.getState()).toMatchObject({ running: false, game: { phase: "incident", seriesAWeek: won.totals.weeks } });
  expect(screen.queryByRole("dialog", { name: "Series A secured" })).toBeNull();
});

it("still lets a winner start over instead, and offers nothing to a bankrupt run", () => {
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(within(home()).getByRole("button", { name: "See your results" }));
  const report = screen.getByRole("dialog", { name: "Series A secured" });
  fireEvent.click(within(report).getByRole("button", { name: "Play again" }));
  expect(useGame.getState().game).toMatchObject({ phase: "management", outcome: null, turn: 1 });
  expect(useGame.getState().game.seriesAWeek).toBeUndefined();
  expect(readAnalytics().filter((e) => e.name === "endless_started")).toHaveLength(0);

  saveClassicGame({ ...won, outcome: "bankrupt" });
  reload();
  expect(home().textContent).toContain("Last company closed");
});

it("rejects a corrupt Series A week in a stored save", () => {
  saveClassicGame({ ...won, outcome: null, phase: "management", seriesAWeek: -3 });
  expect(loadClassicGame().status).toBe("corrupt");
  saveClassicGame({ ...won, outcome: "won", seriesAWeek: won.totals.weeks });
  expect(loadClassicGame().status).toBe("corrupt");
});

it("climbs the Users goal through the milestones past the Series A, celebrates each one, then drops the meter", () => {
  render(<StrictMode><App /></StrictMode>);
  const topbar = () => document.querySelector<HTMLElement>(".topbar")!;
  fireEvent.click(within(home()).getByRole("button", { name: "See your results" }));
  expect(within(topbar()).getByRole("progressbar", { name: "Progress to 50,000 users" })).toBeTruthy();
  fireEvent.click(within(screen.getByRole("dialog", { name: "Series A secured" })).getByRole("button", { name: "Keep playing" }));

  // Past the Series A the next goal is the first milestone above the company's peak.
  expect(within(topbar()).getByRole("progressbar", { name: "Progress to 100,000 users" })).toBeTruthy();
  expect(topbar().querySelector(".stat-goal")?.textContent).toBe("100k");
  expect(screen.queryByText(/users reached/)).toBeNull();

  // A week that takes the company past 100,000 users moves the goal on and says so. This week's database incident is
  // fixed the way a player would, and the week finishes when its postmortem is acknowledged.
  const game = useGame.getState().game;
  useGame.setState({ game: { ...game, users: 99_000, totals: { ...game.totals, peakUsers: 99_000 } } });
  act(() => useGame.getState().advance());
  expect(useGame.getState().game.incident?.type).toBe("db_saturation");
  // A company this size loses users by the thousand: the incident's tile reads them compactly instead of cutting off.
  const lost = (n: number) => act(() => { const g = useGame.getState().game; useGame.setState({ game: { ...g, incident: { ...g.incident!, damage: { ...g.incident!.damage, usersLost: n } } } }); });
  const lostTile = () => screen.getByText("Users lost", { selector: ".impact dt" }).nextElementSibling?.textContent;
  const actual = useGame.getState().game.incident!.damage.usersLost;
  lost(23_812);
  expect(lostTile()).toBe("23.8k");
  lost(812);
  expect(lostTile()).toBe("812");
  lost(actual);
  act(() => {
    useGame.setState({ running: true });
    useGame.getState().tick(20);
    useGame.getState().act({ type: "incident_action", recovery: "db_upgrade" });
    for (let i = 0; i < 200 && useGame.getState().game.phase === "incident"; i++) useGame.getState().tick(2);
  });
  // The week finishes as the incident closes, so the milestone is announced over its postmortem.
  expect(useGame.getState().game).toMatchObject({ phase: "review", totals: { peakUsers: expect.any(Number) } });
  expect(useGame.getState().game.totals.peakUsers).toBeGreaterThanOrEqual(100_000);
  expect(screen.getByText("100,000 users reached. Next goal: 1,000,000.")).toBeTruthy();
  act(() => useGame.getState().act({ type: "acknowledge_review" }));
  expect(within(topbar()).getByRole("progressbar", { name: "Progress to 1,000,000 users" })).toBeTruthy();
  expect(topbar().querySelector(".stat-goal")?.textContent).toBe("1.0M");

  // Past the last milestone there is only the count.
  const later = useGame.getState().game;
  act(() => useGame.setState({ game: { ...later, users: 123_456_789, totals: { ...later.totals, peakUsers: 123_456_789 } } }));
  expect(within(topbar()).queryByRole("progressbar", { name: /^Progress to/ })).toBeNull();
  expect(topbar().textContent).toContain("123,456,789");
});

it("announces a milestone reached in a quiet week instead of that week's usual summary", () => {
  render(<StrictMode><App /></StrictMode>);
  fireEvent.click(within(home()).getByRole("button", { name: "See your results" }));
  fireEvent.click(within(screen.getByRole("dialog", { name: "Series A secured" })).getByRole("button", { name: "Keep playing" }));
  // The first week past the Series A brings a database incident; fix it and acknowledge its postmortem.
  act(() => {
    useGame.getState().advance();
    useGame.setState({ running: true });
    useGame.getState().tick(20);
    useGame.getState().act({ type: "incident_action", recovery: "db_upgrade" });
    for (let i = 0; i < 200 && useGame.getState().game.phase === "incident"; i++) useGame.getState().tick(2);
    useGame.getState().act({ type: "acknowledge_review" });
  });
  const game = useGame.getState().game;
  expect(game.phase).toBe("management");
  useGame.setState({ game: { ...game, users: 99_000, totals: { ...game.totals, peakUsers: 99_000 } } });
  act(() => useGame.getState().advance());
  expect(useGame.getState().game).toMatchObject({ phase: "management", turn: game.turn + 1 });
  expect(screen.getByText("100,000 users reached. Next goal: 1,000,000.")).toBeTruthy();
  expect(document.querySelector(".toast")?.textContent).toMatch(/^Milestone/);
});
