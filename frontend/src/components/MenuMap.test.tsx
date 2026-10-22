import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { MenuMap } from "./MenuMap";
import { initialView, viewBoxOf } from "./scene/mapPlaces";
import { avatar, placeAvatar } from "./scene/walk";

// The database shows symptoms of an incident, so the map has a badge and an Incident tag to show.
vi.mock("./scene/sceneModel", async (original) => {
  const real = await original<typeof import("./scene/sceneModel")>();
  return { ...real, buildModel: (g: Parameters<typeof real.buildModel>[0]) => ({ ...real.buildModel(g), symptomatic: ["db"] }) };
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  useGame.setState(useGame.getInitialState(), true);
  useGame.setState({ started: true, floor: "servers" });
  useGame.getState().openView("menu");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const floors = () => screen.getByRole("group", { name: "Map floor" });
const card = () => screen.getByRole("group", { name: "Selected place" });
const directory = () => screen.getByRole("region", { name: "Places on this floor" });
const you = () => document.querySelector(".menu-map-you")?.textContent ?? "";
const plan = () => document.querySelector(".menu-map-plan")!;

describe("the menu's map", () => {
  it("shows the floor in view pressed, lists its places, and says where the avatar is", () => {
    render(<MenuMap />);
    expect(within(floors()).getByRole("button", { name: /^Server floor/ }).getAttribute("aria-pressed")).toBe("true");
    for (const name of ["Network", "Servers", "Database", "Server hall"]) expect(within(directory()).getByRole("button", { name })).toBeTruthy();
    expect(you()).toContain("Meeting room, office floor");
    fireEvent.click(within(floors()).getByRole("button", { name: /^Office floor/ }));
    expect(within(directory()).getByRole("button", { name: "Lounge" })).toBeTruthy();
    expect(within(directory()).getByRole("button", { name: "Make a coffee" })).toBeTruthy();
    expect(within(directory()).queryByRole("button", { name: "Database" })).toBeNull();
    expect(you()).toContain("Meeting room");
    expect(you()).not.toContain("office floor");
  });

  it("hides each layer behind its toggle", () => {
    useGame.setState({ walking: true });
    placeAvatar("servers");
    render(<MenuMap />);
    expect(document.querySelectorAll(".map-pin.kind-equipment").length).toBeGreaterThan(0);
    expect(document.querySelector(".map-avatar")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Equipment" }));
    expect(document.querySelectorAll(".map-pin.kind-equipment")).toHaveLength(0);
    expect(within(directory()).queryByText("Equipment")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zone names" }));
    expect(document.querySelector(".map-names")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(document.querySelector(".map-avatar")).toBeNull();
  });

  it("finds places on both floors by name, and follows a match to its floor", () => {
    render(<MenuMap />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find on the map" }), { target: { value: "lounge" } });
    const matches = screen.getByRole("region", { name: "Matches" });
    fireEvent.click(within(matches).getByRole("button", { name: /^Lounge/ }));
    expect(within(floors()).getByRole("button", { name: /^Office floor/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(card()).getByText("Place")).toBeTruthy();
    expect(within(card()).getByText("Lounge")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find on the map" }), { target: { value: "zzz" } });
    expect(screen.getByText("Nothing called “zzz” on either floor.")).toBeTruthy();
  });

  it("picks equipment from the directory and sends the room to it", () => {
    render(<MenuMap />);
    fireEvent.click(within(directory()).getByRole("button", { name: "Database" }));
    expect(within(card()).getByText("Equipment")).toBeTruthy();
    expect(within(card()).getByText("Database")).toBeTruthy();
    expect(within(card()).getByText("Healthy")).toBeTruthy();
    expect(within(card()).getByText("Incident")).toBeTruthy();
    expect(document.querySelector(".map-pin.mark-alert")).not.toBeNull();
    fireEvent.click(within(card()).getByRole("button", { name: "Show in room" }));
    expect(useGame.getState().selected).toBe("db");
    expect(useGame.getState().cameraFocus?.anchor).toBe("db");
    expect(useGame.getState().view).toBeNull();
  });

  it("picks a place by clicking its pin on the plan", () => {
    render(<MenuMap />);
    fireEvent.click(document.querySelector('.map-pin[data-key="equipment:db"]')!);
    expect(within(card()).getByText("Database")).toBeTruthy();
  });

  it("walks the avatar to a place when walking is on, and sends the room across floors", () => {
    render(<MenuMap />);
    fireEvent.click(within(directory()).getByRole("button", { name: "Workshop" }));
    expect(within(card()).getByRole("button", { name: "Walk here" })).toHaveProperty("disabled", true);
    expect(screen.getByText("Turn on Walk mode on this floor to walk here.")).toBeTruthy();
    useGame.setState({ walking: true });
    placeAvatar("servers");
    fireEvent.click(within(directory()).getByRole("button", { name: "Workshop" }));
    fireEvent.click(within(card()).getByRole("button", { name: "Walk here" }));
    expect(avatar.path.length).toBeGreaterThan(0);
    expect(useGame.getState().view).toBeNull();
    // A place on the other floor cannot be walked to but the room can go to it.
    useGame.getState().openView("menu");
    fireEvent.change(screen.getByRole("searchbox", { name: "Find on the map" }), { target: { value: "lounge" } });
    fireEvent.click(within(screen.getByRole("region", { name: "Matches" })).getByRole("button", { name: /^Lounge/ }));
    expect(within(card()).getByRole("button", { name: "Walk here" })).toHaveProperty("disabled", true);
    fireEvent.click(within(card()).getByRole("button", { name: "Show in room" }));
    expect(useGame.getState().floor).toBe("office");
    expect(useGame.getState().view).toBeNull();
  });

  it("shows a note instead of the shortcuts while a guide is running", () => {
    useGame.setState({ tour: { track: "basics", step: 0 } });
    render(<MenuMap />);
    fireEvent.click(within(directory()).getByRole("button", { name: "Database" }));
    expect(screen.getByText("Finish the guide to use these shortcuts.")).toBeTruthy();
    expect(within(card()).queryByRole("button", { name: "Show in room" })).toBeNull();
    expect(within(card()).queryByRole("button", { name: "Walk here" })).toBeNull();
  });

  it("zooms the plan in and fits it again, with zoom out disabled at home", () => {
    render(<MenuMap />);
    expect(plan().getAttribute("viewBox")).toBe("-22.00 -9.50 44.00 24.00");
    expect(screen.getByRole("button", { name: "Zoom out" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(plan().getAttribute("viewBox")).toBe("-13.75 -5.00 27.50 15.00");
    fireEvent.click(screen.getByRole("button", { name: "Fit the floor" }));
    expect(plan().getAttribute("viewBox")).toBe("-22.00 -9.50 44.00 24.00");
  });

  it("opens closer in when the measured frame is narrow", () => {
    const get = Object.getOwnPropertyDescriptor(SVGSVGElement.prototype, "clientWidth");
    Object.defineProperty(SVGSVGElement.prototype, "clientWidth", { configurable: true, get: () => 310 });
    try {
      render(<MenuMap />);
      const expected = viewBoxOf(initialView(310, null));
      expect(plan().getAttribute("viewBox")).toBe(`${expected.x.toFixed(2)} ${expected.y.toFixed(2)} ${expected.w.toFixed(2)} ${expected.h.toFixed(2)}`);
      expect(screen.getByRole("button", { name: "Zoom out" })).toHaveProperty("disabled", false);
    } finally {
      if (get) Object.defineProperty(SVGSVGElement.prototype, "clientWidth", get);
      else delete (SVGSVGElement.prototype as unknown as { clientWidth?: number }).clientWidth;
    }
  });

  it("names the zone kinds and the map's symbols in a legend", () => {
    render(<MenuMap />);
    const legend = screen.getByRole("list", { name: "Legend" });
    for (const name of ["Machines", "Desks and meetings", "Breaks and fun", "Back of house", "Equipment", "Thing to do", "Person", "You", "Incident"])
      expect(within(legend).getByText(name)).toBeTruthy();
  });

  it("centres the plan on the avatar, switching floors if need be", () => {
    useGame.setState({ walking: true });
    placeAvatar("servers");
    render(<MenuMap />);
    fireEvent.click(within(floors()).getByRole("button", { name: /^Office floor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Centre on you" }));
    expect(within(floors()).getByRole("button", { name: /^Server floor/ }).getAttribute("aria-pressed")).toBe("true");
    expect(plan().getAttribute("viewBox")!.split(" ")[2]).toBe("22.00");
  });

  it("lists the elevator as a place and labels its shaft quietly on the plan", () => {
    render(<MenuMap />);
    expect(within(directory()).getByRole("button", { name: "Elevator" })).toBeTruthy();
    const label = document.querySelector(".map-pin-label.is-quiet");
    expect(label?.textContent).toBe("Elevator");
  });

  it("marks each equipment chip with its state", () => {
    render(<MenuMap />);
    const db = within(directory()).getByRole("button", { name: "Database" });
    expect(db.querySelector(".menu-map-dot.tone-ok")).not.toBeNull();
  });

  it("stops its clock when it unmounts", () => {
    const before = vi.getTimerCount();
    const { unmount } = render(<MenuMap />);
    expect(vi.getTimerCount()).toBe(before + 1);
    unmount();
    expect(vi.getTimerCount()).toBe(before);
  });
});
