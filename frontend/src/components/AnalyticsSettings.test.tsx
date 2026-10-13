import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ANALYTICS_CONSENT_KEY, saveAnalyticsConsent } from "@/lib/analytics";
import { AnalyticsSettings } from "./AnalyticsSettings";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const optOut = () => screen.getByRole("button", { name: "Opt out" });
const note = () => screen.getByRole("status").textContent;

describe("the Anonymous analytics setting", () => {
  it("shows analytics as on while undecided or accepted", () => {
    render(<StrictMode><AnalyticsSettings /></StrictMode>);
    expect(optOut().getAttribute("aria-pressed")).toBe("false");
    expect(note()).toContain("We never send account details, URLs, or saved games.");
  });

  it("opts out after consenting and opts back in, remembering each choice", () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    render(<StrictMode><AnalyticsSettings /></StrictMode>);
    fireEvent.click(optOut());
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("declined");
    expect(optOut().getAttribute("aria-pressed")).toBe("true");
    expect(note()).toBe("You have opted out. No gameplay events are sent from this browser.");
    fireEvent.click(optOut());
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("accepted");
    expect(optOut().getAttribute("aria-pressed")).toBe("false");
  });

  it("follows a choice made elsewhere, such as the home screen notice", () => {
    render(<StrictMode><AnalyticsSettings /></StrictMode>);
    act(() => { saveAnalyticsConsent("declined"); });
    expect(optOut().getAttribute("aria-pressed")).toBe("true");
  });
});
