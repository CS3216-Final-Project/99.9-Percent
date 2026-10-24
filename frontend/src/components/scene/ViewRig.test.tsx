import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useGame } from "@/game/store";
import { mouse, viewNow } from "./viewState";
import { ViewRig } from "./ViewRig";

const scene = vi.hoisted(() => ({
  gl: { domElement: document.createElement("canvas") },
  get: vi.fn(() => ({ camera: { isOrthographicCamera: false } })),
  set: vi.fn(),
}));
vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
  useThree: (select: (state: typeof scene) => unknown) => select(scene),
}));
vi.mock("./sceneSounds", () => ({ sceneSound: vi.fn() }));

const pointerDescriptor = Object.getOwnPropertyDescriptor(document, "pointerLockElement");
let locked: Element | null = null;
const request = vi.fn();
beforeEach(() => {
  localStorage.clear(); useGame.setState(useGame.getInitialState(), true);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  locked = null; request.mockReset();
  Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => locked });
  Object.defineProperty(scene.gl.domElement, "requestPointerLock", { configurable: true, value: request });
});
afterEach(() => {
  cleanup(); document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals();
  if (pointerDescriptor) Object.defineProperty(document, "pointerLockElement", pointerDescriptor);
  else Reflect.deleteProperty(document, "pointerLockElement");
});
/** Model only the browser boundary: it locks initially, then rejects a click during Escape's cooldown. */
function pendingRetry() {
  const view = render(<ViewRig />);
  request.mockImplementationOnce(() => {
    locked = scene.gl.domElement;
    fireEvent(document, new Event("pointerlockchange"));
  }).mockImplementation(() => fireEvent(document, new Event("pointerlockerror")));
  act(() => useGame.setState({ started: true, walking: true, viewpoint: "first" }));
  viewNow.want = "first"; viewNow.perspective = true;
  locked = null;
  fireEvent(document, new Event("pointerlockchange"));
  act(() => mouse.take());
  expect(request).toHaveBeenCalledTimes(2);
  return view;
}
it("retries after Escape while the player still wants the pointer", () => {
  pendingRetry();
  request.mockImplementation(() => {
    locked = scene.gl.domElement;
    fireEvent(document, new Event("pointerlockchange"));
  });
  act(() => vi.advanceTimersByTime(1100));
  expect(request).toHaveBeenCalledTimes(3);
  expect(viewNow.locked).toBe(true);
});
it.each(["menu", "overview", "stop walking", "home"])("cancels a pending pointer retry on %s", change => {
  pendingRetry();
  act(() => {
    if (change === "menu") useGame.setState({ view: "menu" });
    else if (change === "overview") useGame.setState({ viewpoint: "overview" });
    else if (change === "stop walking") useGame.setState({ walking: false });
    else useGame.setState({ started: false });
  });
  act(() => vi.advanceTimersByTime(3000));
  expect(request).toHaveBeenCalledTimes(2);
  expect(viewNow.lockRefused).toBe(false);
});
it("does not revive a cancelled retry when the menu closes before the cooldown ends", () => {
  pendingRetry();
  act(() => useGame.setState({ view: "menu" }));
  act(() => useGame.setState({ view: null }));
  act(() => vi.advanceTimersByTime(3000));
  expect(request).toHaveBeenCalledTimes(2);
});
it("cancels the retry when a dialog opens, even if it closes before the cooldown ends", async () => {
  pendingRetry();
  const dialog = document.createElement("div"); dialog.setAttribute("role", "dialog");
  await act(async () => { document.body.append(dialog); });
  dialog.remove();
  act(() => vi.advanceTimersByTime(3000));
  expect(request).toHaveBeenCalledTimes(2);
});
it("cancels the retry when the room unmounts", () => {
  const view = pendingRetry(); view.unmount();
  act(() => vi.advanceTimersByTime(3000));
  expect(request).toHaveBeenCalledTimes(2);
});
