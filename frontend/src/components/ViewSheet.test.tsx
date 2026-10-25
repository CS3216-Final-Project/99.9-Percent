import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { useGame } from "@/game/store";
import { ViewSheet, ViewTabs } from "./ViewSheet";
import { HistoryTabs, type HistoryTab } from "./Views";

beforeEach(() => { localStorage.clear(); useGame.setState(useGame.getInitialState(), true); });
afterEach(cleanup);

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
