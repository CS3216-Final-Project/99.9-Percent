import InspectionReveal from "./InspectionReveal";
import { inspectionAction, enterHighlightedInspection } from "./inspectionTestUtils";
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampaignAttentionHost } from "./CampaignAttention";
import { CampaignHeader, CampaignControls, CampaignPanel } from "./CampaignUI";
import { useGame } from "@/game/store";
import { newGame, type GameState } from "@/sim";
import { advanceSteps, applyCampaignInput } from "@/sim/step";
import { setConfirming } from "./actionConfirmation";
import { TooltipLayer } from "./Tooltip";
import { act as decide, tick, dataCompany } from "@/sim/__tests__/spikeFixtures";
import { reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "@/sim/__tests__/combinedFixture";

beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 10, y: 10, top: 10, left: 10, right: 54, bottom: 54, width: 44, height: 44, toJSON: () => ({}) });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});
afterEach(() => { cleanup(); setConfirming(null); vi.useRealTimers(); vi.restoreAllMocks(); });
function show(game: GameState = newGame()) {
  useGame.setState({ game, ready: true, started: true, running: false, onboarding: false, tour: null });
  render(<StrictMode><CampaignAttentionHost><CampaignHeader /><CampaignPanel /><InspectionReveal /><CampaignControls /></CampaignAttentionHost><TooltipLayer /></StrictMode>);
}
const gold = () => document.querySelectorAll(".campaign-gold-attention");
function acceptHint() {
  const card = within(screen.getByRole("dialog", { name: "Hint" }));
  fireEvent.click(card.queryByRole("button", { name: "Got it" }) ?? card.queryByRole("button", { name: "Upgrade database" }) ?? card.getByRole("button", { name: "Accept risk" }));
  enterHighlightedInspection();
}

const scaling = () => decide(decide(tick(decide(tick(newGame(), 6), { type: "start_db_upgrade" }), 30), { type: "acknowledge_review" }), { type: "acknowledge_milestone" });
it("uses the shared ten-second deadline for the growth explanation, then a fresh Run interval after consent", () => {
  show(scaling()); act(() => vi.advanceTimersByTime(9999)); expect(gold()).toHaveLength(0);
  act(() => useGame.setState({ game: structuredClone(useGame.getState().game) }));
  act(() => vi.advanceTimersByTime(1)); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Hint");
  const before = useGame.getState().game;
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Accept risk" }));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Consider growth with current capacity");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Accept growth risk"); expect(useGame.getState().game).toBe(before);
  act(() => vi.advanceTimersByTime(20000)); expect(gold()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Accept growth risk" })); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(9999)); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1)); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
});
it.each([
  ["chapter Next", dataCompany, /^Next:/],
  ["reliability start", reliabilityCompany, "Start reliability test"],
  ["growth start", () => tick(combinedCompany(), 5), "Start next growth wave"],
] as const)("gives %s sole progression attention without dispatching", (_name, make, name) => {
  show(make()); const before = useGame.getState().game;
  act(() => vi.advanceTimersByTime(10000)); expect(gold()).toHaveLength(1);
  expect(gold()[0]).toBe(screen.getByRole("button", { name })); expect(useGame.getState().game).toBe(before);
});
it("keeps database preparation available and switches to Run after actual headroom activation", () => {
  show(scaling()); act(() => vi.advanceTimersByTime(10000));
  fireEvent.click(inspectionAction(/^Upgrade database/));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" })); expect(gold()).toHaveLength(0);
  act(() => useGame.setState({ game: tick(useGame.getState().game, 3) }));
  act(() => vi.advanceTimersByTime(10000)); expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
  expect(useGame.getState().game.campaign!.scalingConsent).toBeFalsy();
});
it("never marks a disabled progression control, and accepted manual help owns the spotlight", () => {
  show(scaling()); const choice = screen.getByRole("button", { name: "Consider growth with current capacity" }) as HTMLButtonElement;
  choice.disabled = true; act(() => vi.advanceTimersByTime(10000));
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Hint");
  choice.disabled = false; fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(gold()).toHaveLength(0); acceptHint(); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
  act(() => vi.advanceTimersByTime(20000)); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
});
it("lets a valid purchase Confirm take priority over the open nonmodal growth explanation", () => {
  show(scaling()); fireEvent.click(screen.getByRole("button", { name: "Consider growth with current capacity" }));
  fireEvent.click(inspectionAction(/^Upgrade database/));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(gold()).toHaveLength(1);
  expect(gold()[0]).toBe(screen.getByRole("button", { name: "Accept growth risk" }));
});
it("one host lights only Run after ten seconds; passive metrics do not restart it", () => {
  show(); act(() => vi.advanceTimersByTime(9000));
  act(() => useGame.setState({ game: structuredClone(useGame.getState().game) }));
  act(() => vi.advanceTimersByTime(1000));
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Run");
  act(() => useGame.getState().setRunning(true)); expect(gold()).toHaveLength(0);
});
it("incident Hint is read-only, then Got it targets Database until interaction", () => {
  show(advanceSteps(newGame(), 6).state); act(() => vi.advanceTimersByTime(10_000));
  expect(gold()).toHaveLength(1); expect(gold()[0].getAttribute("aria-label")).toBe("Hint");
  const before = useGame.getState().game;
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("dialog", { name: "Hint" }).textContent).toContain("Your database is overloaded. Upgrade it to handle more requests.");
  expect(useGame.getState().game).toBe(before); expect(useGame.getState().running).toBe(false);
  acceptHint();
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
});
it("uses a collapsed panel entry without opening it or applying an action", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Hide equipment and actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  acceptHint();
  expect(gold()[0].textContent).toContain("Equipment & actions"); expect(useGame.getState().panelOpen).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Equipment & actions" })); enterHighlightedInspection(); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
});
it("does not point at an inspection toggle that would close already-open evidence", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Database" }));
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("dialog", { name: "Hint" }).textContent).toContain("Upgrade it to handle more requests");
  acceptHint();
  expect(gold()[0].tagName).toBe("BUTTON"); expect(gold()[0].textContent).toContain("Upgrade database");
  expect(useGame.getState().selected).toBe("db");
});
it("pending confirmations and newly mounted local modals immediately suppress attention", async () => {
  show(); act(() => vi.advanceTimersByTime(10_000)); expect(gold()).toHaveLength(1);
  // A quote is opened on the Actions tab, where its card lives.
  act(() => useGame.getState().setPanelTab("actions"));
  act(() => setConfirming("Add server")); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(20_000)); expect(gold()).toHaveLength(0);
  act(() => setConfirming(null));
  const modal = document.createElement("div"); modal.className = "modal-backdrop";
  await act(async () => { document.body.append(modal); });
  act(() => vi.advanceTimersByTime(20_000)); expect(gold()).toHaveLength(0);
  await act(async () => { modal.remove(); });
  act(() => vi.advanceTimersByTime(9999)); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1)); expect(gold()).toHaveLength(1);
});
it("Escape closes only help, restores focus, and the tooltip has the requested title and copy", () => {
  show(); const hint = screen.getByRole("button", { name: "Hint" });
  fireEvent.pointerOver(hint, { pointerType: "mouse" }); act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole("tooltip").textContent).toBe("HintNeed help? See what to try next.");
  fireEvent.pointerDown(hint); fireEvent.pointerUp(hint); fireEvent.click(hint); const dialog = screen.getByRole("dialog", { name: "Hint" });
  fireEvent.keyDown(dialog, { key: "Escape" }); expect(screen.queryByRole("dialog", { name: "Hint" })).toBeNull();
  expect(document.activeElement).toBe(hint);
});
it("accepted targets disappear when a relevant game action changes the decision", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Hint" })); acceptHint();
  expect(gold()).toHaveLength(1);
  act(() => useGame.setState({ game: applyCampaignInput(useGame.getState().game, { type: "start_db_upgrade" }).state }));
  expect(gold()).toHaveLength(0);
});
it("does not turn accepted Run guidance into a Pause spotlight while already running", () => {
  show(); act(() => useGame.getState().setRunning(true));
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("dialog", { name: "Hint" }).textContent).toContain("Keep running to see what happens next");
  acceptHint(); expect(gold()).toHaveLength(0);
});
it("clears attention on blur and requires a fresh ten seconds after focus returns", () => {
  show(); act(() => vi.advanceTimersByTime(10_000)); expect(gold()).toHaveLength(1);
  fireEvent(window, new Event("blur")); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(20_000)); expect(gold()).toHaveLength(0);
  fireEvent(window, new Event("focus")); act(() => vi.advanceTimersByTime(9999)); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1)); expect(gold()).toHaveLength(1);
});
it("visibility changes discard stale attention rather than counting hidden time", () => {
  show(); act(() => vi.advanceTimersByTime(9000));
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange")); act(() => vi.advanceTimersByTime(30_000)); expect(gold()).toHaveLength(0);
  hidden.mockReturnValue(false); fireEvent(document, new Event("visibilitychange"));
  act(() => vi.advanceTimersByTime(9999)); expect(gold()).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1)); expect(gold()).toHaveLength(1);
});

it("transfers accepted upgrade guidance through a collapsed inspector to immediate Confirm, then cancels cleanly", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Hide equipment and actions" }));
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  acceptHint();
  expect(gold()[0].textContent).toContain("Equipment & actions");
  fireEvent.click(gold()[0]); enterHighlightedInspection();
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
  act(() => useGame.setState({ game: structuredClone(useGame.getState().game) }));
  expect(gold()).toHaveLength(1);
  fireEvent.click(gold()[0]);
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(gold()).toHaveLength(0);
});
it("clears an accepted purchase when cash becomes insufficient mid-sequence", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  acceptHint(); expect(gold()).toHaveLength(1);
  const game = structuredClone(useGame.getState().game); game.campaign!.cashCents = 1;
  act(() => useGame.setState({ game })); expect(gold()).toHaveLength(0);
});
it("shared confirmations immediately glow for valid purchases and stop for stale, invalid and tutorial-owned quotes", () => {
  show(); fireEvent.click(inspectionAction(/Add server/));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
  const changed = structuredClone(useGame.getState().game); changed.campaign!.cashCents -= 1;
  act(() => useGame.setState({ game: changed })); expect(gold()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" })); // existing preview review guard
  expect(gold()).toHaveLength(1);
  act(() => useGame.setState({ tour: { track: "basics", step: 0 } })); expect(gold()).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  act(() => useGame.setState({ tour: null }));
  fireEvent.click(inspectionAction(/Add server/));
  const invalid = structuredClone(changed); invalid.campaign!.cashCents = 0;
  act(() => useGame.setState({ game: invalid })); expect(gold()).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Confirm" }).hasAttribute("disabled")).toBe(true);
});
it("Confirm purchase dispatches the unchanged action and removes its sole spotlight", () => {
  show(); fireEvent.click(inspectionAction(/Upgrade database/));
  expect(gold()[0].textContent).toBe("Confirm");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(0);
  expect(useGame.getState().game.campaign!.pending.some(a => a.type === "upgrade-db")).toBe(true);
});

it("a blocking local modal takes priority over an actual valid purchase quote", async () => {
  show(); fireEvent.click(inspectionAction(/Add server/));
  expect(gold()[0].textContent).toBe("Confirm");
  const modal = document.createElement("div"); modal.className = "modal-backdrop";
  await act(async () => { document.body.append(modal); }); expect(gold()).toHaveLength(0);
  await act(async () => { modal.remove(); });
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Confirm");
});

it("removes gold from a control clipped by its scrolling inspector without discarding acceptance", () => {
  show(advanceSteps(newGame(), 6).state);
  fireEvent.click(screen.getByRole("button", { name: "Hint" })); acceptHint();
  const inspector = screen.getByRole("dialog", { name: "Database inspected" });
  inspector.style.overflowY = "auto";
  Object.defineProperty(inspector, "getBoundingClientRect", { configurable:true, value:()=>({ x:10,y:10,top:10,left:10,right:54,bottom:35,width:44,height:25,toJSON:()=>({}) }) });
  fireEvent.scroll(inspector); expect(gold()).toHaveLength(0);
  Reflect.deleteProperty(inspector, "getBoundingClientRect"); fireEvent.scroll(inspector);
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toContain("Upgrade database");
});

it("shows one short explanation, no choices and an immediately enabled acknowledgement", () => {
  show(advanceSteps(newGame(), 6).state);
  const before = useGame.getState().game;
  fireEvent.click(screen.getByRole("button", {name:"Hint"}));
  const card = screen.getByRole("dialog",{name:"Hint"});
  expect(card.querySelectorAll("p")).toHaveLength(1);
  expect(card.querySelectorAll("input,fieldset,select,[role=radio]")).toHaveLength(0);
  expect(card.querySelector("p")!.textContent!.split(/\s+/).length).toBeLessThan(25);
  expect(screen.getByRole("button",{name:"Got it"}).hasAttribute("disabled")).toBe(false);
  expect(useGame.getState().game).toBe(before);
  acceptHint(); expect(gold()[0].textContent).toContain("Upgrade database");
  expect(inspectionAction(/^Limit to 500/).hasAttribute("disabled")).toBe(false);
});

it("offers both real growth strategies and transfers accepted risk without dispatching until confirmation", () => {
  show(scaling()); const before = useGame.getState().game;
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.getByRole("region", { name: "Hint explanation" }).textContent).toBe("Your database may struggle when more users arrive. Upgrade it to prepare, or accept the risk and continue.");
  fireEvent.click(screen.getByRole("button", { name: "Accept risk" }));
  expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Consider growth with current capacity");
  act(() => useGame.setState({ game: structuredClone(before) }));
  expect(gold()[0].textContent).toBe("Consider growth with current capacity");
  fireEvent.click(gold()[0]); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Accept growth risk");
  expect(useGame.getState().game).toEqual(before);
  fireEvent.click(gold()[0]); expect(useGame.getState().game.campaign!.scalingConsent).toEqual({ policyVersion: 1, acceptedStep: before.campaign!.step });
  expect(gold()).toHaveLength(0);
});
it("offers only the valid risk strategy when database preparation is unaffordable", () => {
  const game = scaling(); game.campaign!.cashCents = 1; show(game);
  fireEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  expect(screen.queryByRole("dialog", { name: "Hint" })?.querySelectorAll(".btn")).toHaveLength(1);
  expect(screen.getByRole("region", { name: "Hint explanation" }).textContent).not.toContain("Upgrade it");
  acceptHint(); expect(gold()).toHaveLength(1); expect(gold()[0].textContent).toBe("Consider growth with current capacity");
});

const lit = () => document.querySelectorAll<HTMLElement>("[data-spotlight]");
const overlay = () => document.querySelector(".tour[data-guidance=spotlight]");
const spotOn = (name: RegExp | string) => {
  expect(overlay()).toBeTruthy();
  expect(lit()).toHaveLength(1);
  const target = lit()[0], text = target.textContent ?? target.getAttribute("aria-label") ?? "";
  if (name instanceof RegExp) expect(text).toMatch(name); else expect(text).toBe(name);
};
const noSpot = () => { expect(overlay()).toBeNull(); expect(lit()).toHaveLength(0); };
it("teaches Launch Week with spotlighted tutorial steps instead of the Hint button", () => {
  show(newGame(7, "lw", 2));
  expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
  // The colleague introduction comes once, before the first Run; the tutorial waits for it.
  const intro = screen.getByRole("dialog", { name: "Company Message" });
  expect(screen.queryByRole("region", { name: "Launch Week tutorial" })).toBeNull();
  fireEvent.click(within(intro).getByRole("button", { name: "Dismiss company message" }));
  const card = screen.getByRole("region", { name: "Launch Week tutorial" });
  spotOn("Run");
  fireEvent.click(within(card).getByRole("button", { name: "Got it" })); noSpot();
  expect(screen.queryByRole("region", { name: "Launch Week tutorial" })).toBeNull();
  cleanup();
  // The week's one incident frames the Database inspection straight away.
  show(advanceSteps(newGame(7, "lw", 2), 20).state);
  expect(screen.queryByRole("dialog", { name: "Company Message" })).toBeNull();
  expect(screen.getByRole("region", { name: "Launch Week tutorial" }).textContent).toContain("Your database is overloading");
  spotOn(/Database/);
  // Inspecting shows the metrics first; Next moves the spotlight to the fix.
  fireEvent.click(lit()[0]);
  const metrics = screen.getByRole("region", { name: "Launch Week tutorial" });
  expect(metrics.textContent).toContain("Read the metrics");
  expect(lit()[0].classList.contains("component-inspection-summary")).toBe(true);
  fireEvent.click(within(metrics).getByRole("button", { name: "Next" }));
  // The fix is in the shared Database inspection, already open after reading metrics.
  spotOn(/^Upgrade database/);
});
