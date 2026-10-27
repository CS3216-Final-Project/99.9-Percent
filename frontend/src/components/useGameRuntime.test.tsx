import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { incidentActive } from "@/sim/step";
import { act as decide, tick, preparedReliability } from "@/sim/__tests__/reliabilityFixture";
import { useGameRuntime } from "./useGameRuntime";

// The real player stays silent without the Web Audio API; the mock only records the mood the runtime asks for.
const music = vi.hoisted(() => ({ setEnabled: vi.fn(), setVolume: vi.fn(), setMood: vi.fn(), dispose: vi.fn() }));
vi.mock("@/game/music", () => ({ createMusic: () => music }));

function Probe() {
  useGameRuntime();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  music.setMood.mockClear();
});
afterEach(() => cleanup());

it("plays tense music for an incident burning under management, and calm again once restored", { timeout: 30_000 }, () => {
  // Stay Online's failure test burns for its whole duration while the phase stays "management":
  // the phase alone used to keep the calm theme playing, unlike the incident visuals.
  let game = decide(preparedReliability(), { type: "arm_reliability" });
  for (let i = 0; i < 20 && !(incidentActive(game) && game.phase === "management"); i++) game = tick(game);
  expect(game.phase).toBe("management");
  expect(incidentActive(game)).toBe(true);
  useGame.setState({ game, ready: true, started: true, running: false });
  render(<Probe />);
  expect(music.setMood).toHaveBeenLastCalledWith("tense");
  for (let i = 0; i < 25 && incidentActive(game); i++) game = tick(game);
  expect(game.campaign!.reliabilityStage!.fault!.restoredStep).not.toBeNull();
  act(() => useGame.setState({ game }));
  expect(music.setMood).toHaveBeenLastCalledWith("calm");
});
