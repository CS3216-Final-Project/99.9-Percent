import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import App from "./App";
import { useGame } from "./game/store";
vi.mock("./components/scene/Facility", () => ({ default: () => <div data-testid="facility" /> }));
beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("opening UI", () => {
  it("starts paused with immediate evidence and no later progression controls", async () => {
    render(<StrictMode><App /></StrictMode>); expect(await screen.findByTestId("facility")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("complementary", { name: "System metrics" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tech" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Inspect metrics · free" }));
    expect(useGame.getState().game.campaign!.step).toBe(0);
    expect(useGame.getState().meta.runsStarted).toBe(1);
  });
  it("advances once and cleans up the shared clock on pause/unmount", () => {
    vi.useFakeTimers(); const view = render(<StrictMode><App /></StrictMode>);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(1000)); expect(useGame.getState().game.campaign!.step).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(5000)); expect(useGame.getState().game.campaign!.step).toBe(1);
    view.unmount(); act(() => vi.advanceTimersByTime(5000)); expect(useGame.getState().game.campaign!.step).toBe(1);
  });
  it("visible interventions lead to review and the same company", () => {
    vi.useFakeTimers(); render(<StrictMode><App /></StrictMode>); fireEvent.click(screen.getByRole("button", { name: "Play" }));
    for (let i = 0; i < 6; i++)fireEvent.click(screen.getByRole("button", { name: "Advance step" }));
    const id = useGame.getState().game.campaign!.runId;
    expect(screen.getByText(/Stable steps: 0\/5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Upgrade database/ }));
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(8000));
    expect(screen.getByRole("dialog", { name: "Incident postmortem" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue company" }));
    expect(useGame.getState().game.phase).toBe("management"); expect(useGame.getState().running).toBe(false);
    expect(useGame.getState().game.campaign!.runId).toBe(id);
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    act(() => vi.advanceTimersByTime(46000));
    const c = useGame.getState().game.campaign!;
    expect(c.step).toBe(60); expect(c.settlements).toHaveLength(1);
    expect(c.trace.filter(e => e.type === "action-activated")).toHaveLength(1);
    expect(c.investedCents).toBe(300000);

  });
  it("hidden-page pause does not resume or catch up", () => {
    render(<App />); fireEvent.click(screen.getByRole("button", { name: "Play" })); fireEvent.click(screen.getByRole("button", { name: "Run" }));
    Object.defineProperty(document, "hidden", { configurable: true, value: true }); fireEvent(document, new Event("visibilitychange"));
    expect(useGame.getState().running).toBe(false);
    Object.defineProperty(document, "hidden", { configurable: true, value: false }); fireEvent(document, new Event("visibilitychange"));
    expect(useGame.getState().running).toBe(false);
  });
});
