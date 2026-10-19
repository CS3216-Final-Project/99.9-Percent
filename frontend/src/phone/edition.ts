/**
 * The one place that decides which edition of the game this page plays: the full desktop edition, or the phone
 * edition with its own shell and a smaller scope (see game/scope.ts and phone/README.md).
 *
 * Rule: the phone edition is for a touch device whose screen is phone-sized, that is, whose primary pointer is
 * coarse and whose screen's short side is at most PHONE_MAX_SHORT_SIDE CSS pixels. Everything else, including
 * tablets, touch laptops and a narrow desktop browser window, plays the desktop edition with its responsive layout.
 *
 * The decision uses the screen, not the window, so it does not change when a phone turns on its side or a window is
 * resized; it is made once per page load and never swaps the shell under a running game. `?edition=phone` or
 * `?edition=desktop` in the address overrides it, for development and browser tests.
 */
export type Edition = "desktop" | "phone";

/** The largest short screen side, in CSS pixels, that counts as a phone. Phones are 320 to 480; small tablets 600+. */
export const PHONE_MAX_SHORT_SIDE = 500;

export interface EditionSignals {
  /** Whether the primary pointer is coarse (a finger). */
  coarsePointer: boolean;
  /** The screen's shorter side in CSS pixels. */
  screenShortSide: number;
  /** The `edition` address parameter, if any. */
  override: string | null;
}

/** The edition these signals call for. */
export function decideEdition({ coarsePointer, screenShortSide, override }: EditionSignals): Edition {
  if (override === "phone" || override === "desktop") return override;
  return coarsePointer && screenShortSide > 0 && screenShortSide <= PHONE_MAX_SHORT_SIDE ? "phone" : "desktop";
}

/** Read the signals from a browser window. Without a window, or where a signal cannot be read, it is the desktop. */
export function readEditionSignals(win: Window | undefined = typeof window === "undefined" ? undefined : window): EditionSignals {
  if (!win) return { coarsePointer: false, screenShortSide: 0, override: null };
  let override: string | null = null;
  try { override = new URLSearchParams(win.location.search).get("edition"); } catch { /* no address to read */ }
  const coarsePointer = win.matchMedia?.("(pointer: coarse)").matches ?? false;
  const screen = win.screen;
  const screenShortSide = screen ? Math.min(screen.width, screen.height) : 0;
  return { coarsePointer, screenShortSide, override };
}

let decided: Edition | null = null;

/** This page's edition, decided on first use and then fixed for the page's lifetime. */
export function currentEdition(): Edition {
  decided ??= decideEdition(readEditionSignals());
  return decided;
}

/** For code outside React: whether this page plays the phone edition. */
export const isPhoneEdition = (): boolean => currentEdition() === "phone";

/** Tests only: fix the edition, or with no argument decide it again on next use. */
export function setEditionForTests(edition?: Edition): void {
  decided = edition ?? null;
}
