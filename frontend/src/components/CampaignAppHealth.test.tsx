import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { newGame } from "@/sim";
import { CampaignHeader } from "./CampaignUI";
import { CampaignAction } from "./CampaignAction";
import { confirmingAction, setConfirming } from "./actionConfirmation";

beforeEach(() => {
    localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
    useGame.getState().boot(); useGame.getState().play(); useGame.setState({ onboarding: false, tour: null });
});
afterEach(() => { cleanup(); setConfirming(null); });
it("keeps the estimated reading visible and the game-specific target explanation under More details", () => {
    const g=newGame(); g.campaign!.snapshot.latencyMs=500;
    useGame.setState({game:g}); render(<CampaignHeader />);
    fireEvent.click(screen.getByRole("button",{name:"View app health"}));
    const dialog=screen.getByRole("dialog",{name:"App Health"});
    expect(within(dialog).getByText("Your app is responding too slowly. Keep response time below 500 ms.")).toBeTruthy();
    expect(within(dialog).getByText("500 ms (estimated)")).toBeTruthy();
    const explanation=within(dialog).getByText("500 ms is a target for this game, not a rule for every real app.");
    expect(explanation.closest("details")!.open).toBe(false);
});
it("opens from the shared status card, pauses, and restores focus without changing the company", () => {
    render(<CampaignHeader />);
    const entry = screen.getByRole("button", { name: "View app health" });
    expect(entry.textContent).toContain("App Health"); expect(entry.textContent).toContain("Healthy");
    expect(entry.getAttribute("data-tip")).toContain("estimated response time");
    act(() => useGame.getState().setRunning(true));
    const before = structuredClone(useGame.getState().game);
    entry.focus(); fireEvent.click(entry);
    const dialog = screen.getByRole("dialog", { name: "App Health" });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.textContent).toContain("100 ms (estimated)");
    expect(dialog.textContent).toContain("0.00%");
    expect(dialog.querySelector("details")!.open).toBe(false);
    expect(useGame.getState().running).toBe(false);
    fireEvent.keyDown(within(dialog).getByRole("button", { name: "Close" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(entry);
    expect(useGame.getState().running).toBe(false); expect(useGame.getState().game).toEqual(before);
});
it("shows unavailable errors and explains rejected and waiting work separately", () => {
    const g = newGame(); g.campaign!.snapshot.serviceErrorRate = null; g.campaign!.snapshot.rejected = 40;
    g.campaign!.snapshot.app.backlog = 3; g.campaign!.snapshot.db.backlog = 7;
    useGame.setState({ game: g }); render(<CampaignHeader />);
    fireEvent.click(screen.getByRole("button", { name: "View app health" }));
    const dialog = screen.getByRole("dialog", { name: "App Health" });
    const measurements = within(within(dialog).getByLabelText("App measurements"));
    expect(measurements.getByText("Failed requests (%)", {exact:true}).parentElement?.textContent).toBe("Failed requests (%)Unavailable");
    expect(measurements.getByText("Requests waiting", {exact:true}).parentElement?.textContent).toBe("Requests waiting10");
    expect(dialog.textContent).toContain("40 in this snapshot");
    expect(dialog.textContent).toContain("separate from failed requests"); expect(dialog.textContent).toContain("may still finish later");
});
it("closes the dashboard when a different company replaces the current company", () => {
    render(<CampaignHeader />); fireEvent.click(screen.getByRole("button", { name: "View app health" }));
    act(() => useGame.setState({ game: newGame(1, "replacement-health-company") }));
    expect(screen.queryByRole("dialog", { name: "App Health" })).toBeNull();
});
it("keeps an open purchase quote and its highlight through dashboard inspection", () => {
    render(<><CampaignHeader /><CampaignAction label="Add server" decision={{ type: "add_server" }} price={1000} onClick={() => {}} /></>);
    fireEvent.click(screen.getByRole("button", { name: /Add server/ }));
    const quote = screen.getByRole("region", { name: "Confirm Add server" }).textContent;
    const affected = useGame.getState().affected;
    fireEvent.click(screen.getByRole("button", { name: "View app health" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "App Health" })).getByRole("button", { name: "Close" }));
    expect(confirmingAction()).toBe("Add server"); expect(useGame.getState().affected).toEqual(affected);
    expect(screen.getByRole("region", { name: "Confirm Add server" }).textContent).toBe(quote);
});
