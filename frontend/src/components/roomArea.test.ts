import { afterEach, expect, it, vi } from "vitest";
import { confirmationRoomArea } from "./roomArea";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

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
