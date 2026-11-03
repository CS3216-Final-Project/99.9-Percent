import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { newLegacyGame } from "@/sim";
import { choosingAppProfile, useGame } from "@/game/store";
import { AppProfileButton, AppProfilePicker, AppProfileSection } from "./AppProfile";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
});

function company(patch: Partial<ReturnType<typeof useGame.getState>> = {}) {
  act(() => useGame.setState({ game: newLegacyGame(1), started: true, mode: "classic", tour: null, ...patch }));
}

describe("choosing what the company builds", () => {
  it("waits for the first-week tutorial, then holds the week until a card is chosen", () => {
    company({ tour: { track: "basics", step: 0 } });
    render(<><AppProfileButton /><AppProfilePicker /></>);
    expect(screen.queryByRole("dialog", { name: "What are you building?" })).toBeNull();

    act(() => useGame.setState({ tour: null }));
    const picker = screen.getByRole("dialog", { name: "What are you building?" });
    const cards = within(picker).getAllByRole("radio");
    expect(cards.map((c) => c.getAttribute("value"))).toEqual(["social", "gaming", "ecommerce", "streaming"]);
    expect(document.activeElement).toBe(cards[0]);
    const start = within(picker).getByRole("button", { name: "Start building" });
    expect((start as HTMLButtonElement).disabled).toBe(true);

    // Weeks do not move on behind the cards.
    act(() => useGame.getState().advance());
    expect(useGame.getState().game.turn).toBe(1);

    // Tab keeps to the cards, and reaches Start building once a card is chosen: it never walks out into the game.
    fireEvent.keyDown(cards[0], { key: "Tab" });
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.click(within(picker).getByRole("radio", { name: "Online game" }));
    expect((start as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(cards[1], { key: "Tab" });
    expect(document.activeElement).toBe(start);
    fireEvent.keyDown(start, { key: "Tab" });
    expect(document.activeElement).toBe(cards[1]);
    fireEvent.keyDown(cards[1], { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(start);
    fireEvent.click(start);
    expect(useGame.getState().game.appProfile).toBe("gaming");
    expect(screen.queryByRole("dialog", { name: "What are you building?" })).toBeNull();
    expect(choosingAppProfile(useGame.getState())).toBe(false);
  });

  it("keeps the choice in the top bar, where its card explains what it changes", () => {
    company({ game: { ...newLegacyGame(1), appProfile: "ecommerce" } });
    render(<AppProfileButton />);
    const button = screen.getByRole("button", { name: "Your app: Online store" });
    fireEvent.click(button);
    const card = screen.getByRole("dialog", { name: "Your app" });
    expect(card?.textContent).toContain("Checkouts are writes, so the read cache helps less.");
    expect(within(card).getByText("Cacheable reads").nextSibling?.textContent).toContain("35%");
    expect(within(card).getByText("Best promotion").nextSibling?.textContent).toContain("Targeted campaign");
    fireEvent.keyDown(card, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Your app" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("keeps the choice among the phone strip's numbers, opening to the same notes", () => {
    company({ game: { ...newLegacyGame(1), appProfile: "gaming" } });
    const { container } = render(<AppProfileSection />);
    const row = container.querySelector("details")!;
    expect(row.querySelector("summary")?.textContent).toBe("Your appOnline game");
    expect(row.open).toBe(false);
    fireEvent.click(row.querySelector("summary")!);
    expect(row.open).toBe(true);
    expect(within(row).getByText("Lag tolerance").nextSibling?.textContent).toBe("Low: notices lag at half load");
    expect(row.textContent).toContain("Players leave the moment it lags");
  });

  it("shows nothing for a run saved before profiles existed", () => {
    const legacy = newLegacyGame(1);
    delete legacy.appProfile;
    company({ game: legacy });
    const { container } = render(<><AppProfileButton /><AppProfilePicker /><AppProfileSection /></>);
    expect(screen.queryByRole("button", { name: /^Your app/ })).toBeNull();
    expect(container.querySelector(".app-profile-section")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
