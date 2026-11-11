import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "@/App";
import { useGame } from "@/game/store";
import { loadVisitor } from "@/game/booth";

vi.mock("@/components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  window.history.pushState({}, "", "/steps");
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.pushState({}, "", "/"); });

async function enter(name: string) {
  render(<StrictMode><App /></StrictMode>);
  const dialog = await screen.findByRole("dialog", { name: "Can you keep the startup online?" });
  fireEvent.change(within(dialog).getByLabelText("Your name on the leaderboard"), { target: { value: name } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Start playing" }));
  return dialog;
}
// The game itself may fetch on boot (the account session), so count only leaderboard calls.
const boardCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/leaderboard"));
const posted = () => JSON.parse(boardCalls().at(-1)![1].body as string);

it("asks for a name, then starts a fresh Challenge Mode company even while it is locked", async () => {
  const dialog = await enter("  ");
  expect(within(dialog).getByText(/Use 1–16 letters/)).toBeTruthy();
  expect(useGame.getState().started).toBe(false);
  fireEvent.change(within(dialog).getByLabelText("Your name on the leaderboard"), { target: { value: " Ada  L " } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Start playing" }));
  const s = useGame.getState();
  expect(s.mode).toBe("classic");
  expect(s.started).toBe(true);
  expect(s.game.campaign).toBeUndefined();
  expect(s.tour).toEqual({ track: "basics", step: 0 });
  const hud = screen.getByRole("complementary", { name: "Leaderboard" });
  expect(hud.textContent).toContain("Ada L");
  expect(loadVisitor()).toMatchObject({ name: "Ada L", runSeed: s.game.seed, posted: null });
  expect(screen.queryByRole("dialog", { name: "Can you keep the startup online?" })).toBeNull();
});

it("continues the visitor's saved company after a reload put a locked device back in Guided Mode", async () => {
  await enter("Ada");
  const seed = useGame.getState().game.seed;
  const submissionId = loadVisitor()!.submissionId;
  // What a reload does on a locked profile: the store boots into Guided Mode.
  act(() => useGame.setState(useGame.getInitialState(), true));
  fireEvent.click(screen.getByRole("button", { name: "Continue my run" }));
  expect(useGame.getState().mode).toBe("classic");
  expect(useGame.getState().game.seed).toBe(seed);
  expect(useGame.getState().started).toBe(true);
  expect(loadVisitor()).toMatchObject({ runSeed: seed, submissionId });
  expect(screen.getByRole("button", { name: "Finish & post" })).toBeTruthy();
});

it("starts a fresh run with a new submission when the visitor's save is gone", async () => {
  await enter("Ada");
  const before = loadVisitor()!;
  localStorage.removeItem("nn.classic.save.v1");
  act(() => useGame.setState(useGame.getInitialState(), true));
  fireEvent.click(screen.getByRole("button", { name: "Continue my run" }));
  const after = loadVisitor()!;
  expect(after.runSeed).toBe(useGame.getState().game.seed);
  expect(after.submissionId).not.toBe(before.submissionId);
  expect(useGame.getState().tour).toEqual({ track: "basics", step: 0 });
});

it("posts an early finish once, shows the place and hands over to the next player", async () => {
  await enter("Ada");
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
    init?.body ? json({ id: JSON.parse(init.body as string).id, rank: 2, total: 9 }, 201) : json({}, 401));
  useGame.getState().setRunning(true);
  fireEvent.click(screen.getByRole("button", { name: "Finish & post" }));
  await waitFor(() => expect(within(screen.getByRole("complementary", { name: "Leaderboard" })).getByRole("status").textContent).toContain("#2 of 9"));
  expect(boardCalls()).toHaveLength(1);
  expect(posted()).toMatchObject({ name: "Ada", outcome: "unfinished", grade: expect.stringMatching(/^[SABCD]$/) });
  expect(useGame.getState().running).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Next player" }));
  expect(await screen.findByRole("dialog", { name: "Can you keep the startup online?" })).toBeTruthy();
  expect(loadVisitor()).toBeNull();
});

it("posts a finished run by itself, with its outcome", async () => {
  await enter("Grace");
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
    init?.body ? json({ id: JSON.parse(init.body as string).id, rank: 1, total: 1 }, 201) : json({}, 401));
  const game = useGame.getState().game;
  act(() => useGame.setState({ game: { ...game, outcome: "bankrupt", phase: "ended" } }));
  await waitFor(() => expect(within(screen.getByRole("complementary", { name: "Leaderboard" })).getByRole("status").textContent).toContain("#1 of 1"));
  expect(boardCalls()).toHaveLength(1);
  expect(posted()).toMatchObject({ name: "Grace", outcome: "bankrupt" });
});

it("retries a failed post with exactly the same submission", async () => {
  await enter("Linus");
  fetchMock.mockImplementation(async (_url: string, init: RequestInit) => json(init?.body ? { error: "down" } : {}, init?.body ? 503 : 401));
  fireEvent.click(screen.getByRole("button", { name: "Finish & post" }));
  const retry = await screen.findByRole("button", { name: "Couldn't post. Retry" });
  const first = posted();
  // The company changing after the failed post must not change what is resent.
  act(() => useGame.setState({ game: { ...useGame.getState().game, cash: 1 } }));
  fetchMock.mockImplementation(async () => json({ id: first.id, rank: 4, total: 4 }, 200));
  fireEvent.click(retry);
  await waitFor(() => expect(within(screen.getByRole("complementary", { name: "Leaderboard" })).getByRole("status").textContent).toContain("#4 of 4"));
  expect(posted()).toEqual(first);
});

it("shows the big-screen board without starting the game", async () => {
  window.history.pushState({}, "", "/steps/board");
  fetchMock.mockImplementation(async () => json({
    top: [
      { name: "Ada", score: 91, grade: "S", weeks: 14, users: 52_000, outcome: "won", createdAt: "2026-11-12T07:00:00Z" },
      { name: "Grace", score: 60, grade: "B", weeks: 26, users: 30_000, outcome: "deadline", createdAt: "2026-11-12T07:05:00Z" },
    ],
    recent: [{ name: "Grace", score: 60, grade: "B", weeks: 26, users: 30_000, outcome: "deadline", createdAt: "2026-11-12T07:05:00Z" }],
    total: 2, generatedAt: "2026-11-12T07:06:00Z",
  }));
  render(<StrictMode><App /></StrictMode>);
  const top = await screen.findByRole("region", { name: "Top scores" });
  await waitFor(() => expect(within(top).getAllByRole("listitem")).toHaveLength(2));
  expect(within(top).getAllByRole("listitem")[0].textContent).toContain("Ada");
  expect(screen.getByText(/Play at .*\/steps/)).toBeTruthy();
  expect(screen.getByText("companies launched", { exact: false }).textContent).toContain("2");
  expect(screen.queryByTestId("facility")).toBeNull();
  expect(useGame.getState().started).toBe(false);
});

it("leaves the normal game alone on other addresses", async () => {
  window.history.pushState({}, "", "/");
  render(<StrictMode><App /></StrictMode>);
  await act(async () => {});
  expect(screen.queryByRole("dialog", { name: "Can you keep the startup online?" })).toBeNull();
  expect(screen.queryByRole("complementary", { name: "Leaderboard" })).toBeNull();
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/leaderboard/), expect.anything());
});
