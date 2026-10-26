import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { ViewSheet, ViewTabs } from "./ViewSheet";
import { HistoryTabs, type HistoryTab } from "./Views";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Workspace() {
  const view = useGame(s => s.view);
  return <><ViewTabs tabs={[
    { id: "tech", label: "Tech", icon: "tree", badge: null },
    { id: "history", label: "History", icon: "history", badge: null },
  ]}/>{(view === "tech" || view === "history") && <ViewSheet view={view}>Content</ViewSheet>}</>;
}

it("focuses a workspace heading and returns focus to its opener without changing the clock", () => {
  render(<Workspace/>);
  const before = useGame.getState();
  const opener = screen.getByRole("button", { name: "Tech" });
  opener.focus(); fireEvent.click(opener);
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Tech tree" }));
  const back = screen.getByRole("button", { name: "Back to room" });
  back.focus(); fireEvent.click(back);
  expect(screen.queryByRole("region", { name: "Tech tree" })).toBeNull();
  expect(document.activeElement).toBe(opener);
  expect(useGame.getState().game).toBe(before.game);
  expect(useGame.getState().running).toBe(before.running);
});

it("keeps view switching available and restores focus to the newly selected view", () => {
  render(<Workspace/>);
  const tech = screen.getByRole("button", { name: "Tech" });
  tech.focus(); fireEvent.click(tech);
  const history = screen.getByRole("button", { name: "History" });
  history.focus(); fireEvent.click(history);
  expect(document.activeElement).toBe(screen.getByRole("heading", { name: "History" }));
  const back = screen.getByRole("button", { name: "Back to room" });
  back.focus(); fireEvent.click(back);
  expect(document.activeElement).toBe(history);
});

it("returns to the phone Views summary when its closed contents still have layout boxes", () => {
  function FoldedWorkspace() {
    const view = useGame(s => s.view);
    return <><footer className="controls-dock"><details open><summary>Views</summary>
      <div onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}>
        <ViewTabs tabs={[{ id: "tech", label: "Tech", icon: "tree", badge: null }]}/>
      </div>
    </details></footer>{view === "tech" && <ViewSheet view={view}>Content</ViewSheet>}</>;
  }
  render(<FoldedWorkspace/>);
  const opener = screen.getByRole("button", { name: "Tech" });
  const rects = Object.assign([new DOMRect(0, 0, 44, 44)], { item: (index: number) => index === 0 ? new DOMRect(0, 0, 44, 44) : null });
  vi.spyOn(opener, "getClientRects").mockReturnValue(rects);
  opener.focus(); fireEvent.click(opener);
  const back = screen.getByRole("button", { name: "Back to room" });
  back.focus(); fireEvent.click(back);
  expect(document.activeElement).toBe(screen.getByText("Views", { selector: "summary" }));
});

it("supports keyboard navigation between History sections with one labelled panel", () => {
  function Sections() {
    const [tab, setTab] = useState<HistoryTab>("charts");
    return <HistoryTabs tab={tab} onChange={setTab} incidents={2}>{tab}</HistoryTabs>;
  }
  render(<Sections/>);
  const charts = screen.getByRole("tab", { name: "Charts" });
  charts.focus(); fireEvent.keyDown(charts, { key: "ArrowRight" });
  const events = screen.getByRole("tab", { name: "Events" });
  expect(document.activeElement).toBe(events);
  expect(screen.getByRole("tabpanel", { name: "Events" }).textContent).toBe("events");
  fireEvent.keyDown(events, { key: "End" });
  expect(screen.getByRole("tabpanel", { name: "Incidents (2)" }).textContent).toBe("postmortems");
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
});
