import { afterEach, describe, expect, it } from "vitest";
import { currentEdition, decideEdition, isPhoneEdition, PHONE_MAX_SHORT_SIDE, readEditionSignals, setEditionForTests } from "./edition";

afterEach(() => setEditionForTests());

/** A browser window with just the signals the edition reads. */
function fakeWindow({ coarse, width, height, search = "" }: { coarse: boolean; width: number; height: number; search?: string }): Window {
  return {
    location: { search },
    matchMedia: (query: string) => ({ matches: query === "(pointer: coarse)" && coarse }),
    screen: { width, height },
  } as unknown as Window;
}
const edition = (w: Window) => decideEdition(readEditionSignals(w));

describe("edition", () => {
  it("plays the phone edition on a phone-sized touch screen, upright or on its side", () => {
    expect(edition(fakeWindow({ coarse: true, width: 390, height: 844 }))).toBe("phone");
    expect(edition(fakeWindow({ coarse: true, width: 844, height: 390 }))).toBe("phone");
    expect(edition(fakeWindow({ coarse: true, width: 320, height: 568 }))).toBe("phone");
    expect(edition(fakeWindow({ coarse: true, width: PHONE_MAX_SHORT_SIDE, height: 1000 }))).toBe("phone");
  });

  it("plays the desktop edition on tablets, touch laptops and narrow desktop windows", () => {
    expect(edition(fakeWindow({ coarse: true, width: 834, height: 1194 }))).toBe("desktop");
    expect(edition(fakeWindow({ coarse: true, width: 1920, height: 1080 }))).toBe("desktop");
    // A mouse at a phone's screen size, as a desktop browser's device toolbar without touch.
    expect(edition(fakeWindow({ coarse: false, width: 390, height: 844 }))).toBe("desktop");
    expect(edition(fakeWindow({ coarse: true, width: PHONE_MAX_SHORT_SIDE + 1, height: 1000 }))).toBe("desktop");
  });

  it("follows an explicit edition in the address, and ignores anything else there", () => {
    expect(edition(fakeWindow({ coarse: false, width: 1440, height: 900, search: "?edition=phone" }))).toBe("phone");
    expect(edition(fakeWindow({ coarse: true, width: 390, height: 844, search: "?edition=desktop" }))).toBe("desktop");
    expect(edition(fakeWindow({ coarse: true, width: 390, height: 844, search: "?edition=tablet" }))).toBe("phone");
  });

  it("is the desktop without a window or its signals", () => {
    expect(decideEdition(readEditionSignals(undefined))).toBe("desktop");
    expect(edition({ location: { search: "" } } as unknown as Window)).toBe("desktop");
  });

  it("is decided once per page", () => {
    // jsdom has a mouse-sized, matchMedia-free window: the desktop.
    expect(currentEdition()).toBe("desktop");
    setEditionForTests("phone");
    expect(currentEdition()).toBe("phone");
    expect(isPhoneEdition()).toBe(true);
    setEditionForTests();
    expect(isPhoneEdition()).toBe(false);
  });
});
