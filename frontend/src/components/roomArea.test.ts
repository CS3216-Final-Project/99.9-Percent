import { afterEach, expect, it, vi } from "vitest";
import { confirmationRoomArea, openRoomArea } from "./roomArea";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function place(selector: string, box: DOMRect) {
  vi.spyOn(document.querySelector<HTMLElement>(selector)!, "getBoundingClientRect").mockReturnValue(box);
}

it("ends the open room at the top of a phone's sheet, above the panel inside it", () => {
  document.body.innerHTML = '<div class="phone-sheet"><div class="campaign-panel"></div></div>';
  place(".phone-sheet", new DOMRect(0, 400, 390, 300));
  place(".campaign-panel", new DOMRect(0, 450, 390, 250));
  expect(openRoomArea(new DOMRect(0, 50, 390, 700))).toEqual({ right: 378, bottom: 338 });
});

it("falls back to the campaign panel when the sheet takes no space, and to the whole stage without either", () => {
  document.body.innerHTML = '<div class="phone-sheet"></div><div class="campaign-panel"></div>';
  place(".phone-sheet", new DOMRect(0, 0, 0, 0));
  place(".campaign-panel", new DOMRect(700, 0, 300, 600));
  const stage = new DOMRect(0, 0, 1000, 600);
  expect(openRoomArea(stage)).toEqual({ right: 688, bottom: 588 });
  document.body.replaceChildren();
  expect(openRoomArea(stage)).toEqual({ right: 988, bottom: 588 });
});

it("ignores retained geometry inside a closed room menu and reserves space for the same visible controls", () => {
  document.body.innerHTML = '<details><summary>Room</summary><div class="camera-buttons"></div></details>';
  const menu = document.querySelector("details")!;
  const controls = document.querySelector<HTMLElement>(".camera-buttons")!;
  const box = new DOMRect(20, 200, 200, 160);
  vi.spyOn(controls, "getBoundingClientRect").mockReturnValue(box);
  vi.spyOn(controls, "getClientRects").mockReturnValue([box] as unknown as DOMRectList);
  const stage = new DOMRect(0, 0, 390, 600);
  expect(confirmationRoomArea(stage, true).bottom).toBe(588);
  menu.open = true;
  expect(confirmationRoomArea(stage, true).bottom).toBe(188);
});

it("keeps the left purchase column clear of distant camera controls while avoiding controls in that column", () => {
  document.body.innerHTML = '<div class="camera-buttons"></div>';
  const controls = document.querySelector<HTMLElement>(".camera-buttons")!;
  let box = new DOMRect(700, 300, 200, 160);
  vi.spyOn(controls, "getBoundingClientRect").mockImplementation(() => box);
  vi.spyOn(controls, "getClientRects").mockImplementation(() => [box] as unknown as DOMRectList);
  const stage = new DOMRect(0, 0, 1000, 600);
  expect(confirmationRoomArea(stage, false).bottom).toBe(588);
  box = new DOMRect(20, 300, 200, 160);
  expect(confirmationRoomArea(stage, false).bottom).toBe(288);
});
