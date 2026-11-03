import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import type { Campaign } from "@/sim/campaignTypes";
import { CampaignReadings } from "./CampaignReadings";
import { GateCounts } from "./scene/Facility";
import { useCountUp } from "./useCountUp";

let reduced = false;

beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  reduced = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") && reduced, media: query, addEventListener() {}, removeEventListener() {} }));
  // Animation frames arrive every 16 ms of a fake clock that performance.now() shares.
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function count(initial: number, strict = false) {
  const hook = renderHook(({ value }) => useCountUp(value), { initialProps: { value: initial }, reactStrictMode: strict });
  return { ...hook, to: (value: number) => hook.rerender({ value }) };
}
const after = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it("shows the first figure at once, also under StrictMode", () => {
  for (const strict of [false, true]) {
    const { result, unmount } = count(300, strict);
    expect(result.current).toBe(300);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  }
});

it("eases out from the old figure to the new one in whole numbers and settles within 80% of a game second", () => {
  const { result, to } = count(300);
  to(800);
  // Nothing moves before the first frame, so the old figure never flickers.
  expect(result.current).toBe(300);
  const seen: number[] = [];
  for (let ms = 0; ms < 800; ms += 16) { after(16); seen.push(result.current); }
  expect(seen.every(Number.isInteger)).toBe(true);
  expect(seen.every((n, i) => n >= (seen[i - 1] ?? 300) && n <= 800)).toBe(true);
  // Easing out: most of the climb shows early, the last of it slowly.
  expect(seen[5]).toBeGreaterThan(550);
  expect(seen[5]).toBeLessThan(800);
  after(16);
  expect(result.current).toBe(800);
  // The count stops asking for frames once it settles.
  expect(vi.getTimerCount()).toBe(0);
});

it("counts down as well as up", () => {
  const { result, to } = count(800);
  to(500);
  after(100);
  expect(result.current).toBeLessThan(800);
  expect(result.current).toBeGreaterThan(500);
  after(800);
  expect(result.current).toBe(500);
});

it("settles within the shorter game second at 2x", () => {
  useGame.setState({ speed: 2 });
  const { result, to } = count(300);
  to(800);
  after(320);
  expect(result.current).toBeLessThan(800);
  after(96);
  expect(result.current).toBe(800);
});

it("restarts from the figure on screen when a new reading arrives mid-count", () => {
  const { result, to } = count(300);
  to(800);
  after(100);
  const mid = result.current;
  to(1_000);
  expect(result.current).toBe(mid);
  after(16);
  expect(result.current).toBeGreaterThanOrEqual(mid);
  expect(result.current).toBeLessThan(1_000);
  after(800);
  expect(result.current).toBe(1_000);
});

it("shows the new figure at once with reduced motion", () => {
  reduced = true;
  const { result, to } = count(300);
  to(800);
  expect(result.current).toBe(800);
  expect(vi.getTimerCount()).toBe(0);
});

it("shows the new figure at once where matchMedia is missing", () => {
  vi.unstubAllGlobals();
  vi.stubGlobal("matchMedia", undefined);
  const { result, to } = count(300);
  to(800);
  expect(result.current).toBe(800);
});

it("shows the new figure at once during a deployment rush", () => {
  useGame.setState({ deployRush: true });
  const { result, to } = count(300);
  to(800);
  expect(result.current).toBe(800);
  expect(vi.getTimerCount()).toBe(0);
});

it("shows the new figure at once when the game is replaced wholesale (a load, another company, practice)", () => {
  const { result, rerender } = count(300);
  // The store swaps the game and its generation in one update, so both arrive in the same render.
  act(() => { useGame.setState({ generation: useGame.getState().generation + 1 }); rerender({ value: 800 }); });
  expect(result.current).toBe(800);
  expect(vi.getTimerCount()).toBe(0);
  // The next reading in the new game counts again.
  rerender({ value: 900 });
  after(16);
  expect(result.current).toBeGreaterThan(800);
  expect(result.current).toBeLessThan(900);
});

it("runs one count under StrictMode and stops asking for frames on unmount", () => {
  const { result, to, unmount } = count(300, true);
  to(800);
  expect(vi.getTimerCount()).toBe(1);
  after(48);
  expect(vi.getTimerCount()).toBe(1);
  expect(result.current).toBeGreaterThan(300);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("counts every traffic figure in the Network readings together, so none outruns Incoming", () => {
  const game = newGame(7, "count-up-readings", 2);
  useGame.setState({ game });
  const at = (incoming: number, successful: number, failed: number): Campaign => {
    const c = structuredClone(game.campaign!);
    Object.assign(c.snapshot, { incoming, admitted: incoming, rejected: 0, successful, failed });
    return c;
  };
  const { rerender } = render(<CampaignReadings place="gateway" campaign={at(300, 300, 0)} />);
  rerender(<CampaignReadings place="gateway" campaign={at(800, 600, 200)} />);
  after(64);
  // What is on screen: the counting figure while one runs, else the settled one.
  const shown = (label: string) => {
    const dd = screen.getByText(label).closest("div")!.querySelector("dd")!;
    return Number((dd.querySelector("[aria-hidden]") ?? dd).textContent!.match(/[\d,]+/)![0].replace(/,/g, ""));
  };
  const incoming = shown("Incoming"), successful = shown("Completed successfully"), failed = shown("Failed");
  expect(incoming).toBeGreaterThan(300);
  expect(incoming).toBeLessThan(800);
  expect(successful).toBeGreaterThan(300);
  expect(successful).toBeLessThan(600);
  expect(failed).toBeGreaterThan(0);
  expect(failed).toBeLessThan(200);
  // Each figure rounds on its own, so the parts may pass the whole by one.
  expect(successful + failed).toBeLessThanOrEqual(incoming + 1);
  after(800);
  expect([shown("Incoming"), shown("Completed successfully"), shown("Failed")]).toEqual([800, 600, 200]);
  // Screen readers get the settled figures throughout.
  rerender(<CampaignReadings place="gateway" campaign={at(300, 300, 0)} />);
  after(64);
  expect(screen.getByText("Completed successfully").closest("div")!.querySelector(".visually-hidden")?.textContent).toBe("300");
});

it("counts the room's In and Out tags together while their accessible names give the settled figures", () => {
  const game = newGame(7, "count-up-gates", 2);
  useGame.setState({ game });
  const at = (admitted: number, successful: number): Campaign => {
    const c = structuredClone(game.campaign!);
    Object.assign(c.snapshot, { incoming: admitted, admitted, rejected: 0, successful });
    return c;
  };
  const { rerender } = render(<GateCounts c={at(300, 300)} />);
  rerender(<GateCounts c={at(800, 600)} />);
  after(64);
  const figure = (tag: HTMLElement) => Number(tag.textContent!.match(/(?:In|Out)\s*([\d,]+)\/s/)![1].replace(/,/g, ""));
  const inTag = screen.getByLabelText(/^In:/), outTag = screen.getByLabelText(/^Out:/);
  expect(figure(inTag)).toBeGreaterThan(300);
  expect(figure(inTag)).toBeLessThan(800);
  expect(figure(outTag)).toBeGreaterThan(300);
  expect(figure(outTag)).toBeLessThan(600);
  expect(figure(outTag)).toBeLessThanOrEqual(figure(inTag));
  expect(inTag.getAttribute("aria-label")).toBe("In: 800 requests per second");
  expect(outTag.getAttribute("aria-label")).toBe("Out: 600 requests per second served");
  after(800);
  expect([figure(inTag), figure(outTag)]).toEqual([800, 600]);
});
