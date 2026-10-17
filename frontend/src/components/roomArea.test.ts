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
