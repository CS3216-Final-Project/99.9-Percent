import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostHogConfig } from "posthog-js/dist/module.no-external";
import { ANALYTICS_CONSENT_KEY, browserAsksNotToTrack, configuredAnalytics, createAnalyticsSink, loadAnalyticsConsent, POSTHOG_OPTIONS, saveAnalyticsConsent, startProductAnalyticsUnlessOptedOut, startProductAnalytics, type AnalyticsConfig } from "./analytics";
import { useGame } from "@/game/store";

const config: AnalyticsConfig = { enabled: true, token: "phc_test_public_token", host: "https://us.i.posthog.com", buildId: "test" };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("does not load PostHog without explicit production configuration", () => {
  const load = vi.fn();
  expect(createAnalyticsSink({ ...config, enabled: false }, load)).toBeNull();
  expect(createAnalyticsSink({ ...config, token: "" }, load)).toBeNull();
  expect(createAnalyticsSink({ ...config, host: "https://example.com" }, load)).toBeNull();
  expect(load).not.toHaveBeenCalled();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_ANALYTICS_ENABLED", "true");
  vi.stubEnv("VITE_DEPLOY_ENV", "preview");
  expect(configuredAnalytics().enabled).toBe(false);
  vi.stubEnv("VITE_DEPLOY_ENV", "production");
  expect(configuredAnalytics().enabled).toBe(true);
  vi.stubEnv("PROD", false);
  expect(configuredAnalytics().enabled).toBe(false);
});

it("buffers early gameplay while loading, then sends once with the safe settings", async () => {
  const capture = vi.fn();
  let resolve!: (value: { capture: typeof capture }) => void;
  const load = vi.fn(() => new Promise<{ capture: typeof capture }>(done => { resolve = done; }));
  const sink = createAnalyticsSink(config, load)!;
  sink("gameplay_run_started", { run_id: "run-1" });
  expect(capture).not.toHaveBeenCalled();
  resolve({ capture });
  await Promise.resolve();
  expect(capture).toHaveBeenCalledExactlyOnceWith("gameplay_run_started", { run_id: "run-1" });
  sink("gameplay_session_progress", { session_active_ms: 15000 });
  expect(capture).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledWith(config.token, expect.objectContaining({
    autocapture: false, capture_pageview: false, capture_pageleave: false,
    disable_session_recording: true, disable_surveys: true, person_profiles: "never",
    disable_external_dependency_loading: true, respect_dnt: true, persistence: "localStorage",
    api_host: "https://us.i.posthog.com", ui_host: "https://us.posthog.com",
  }));
});

it("bounds the startup buffer and handles failed loading or capture without breaking play", async () => {
  const capture = vi.fn(() => { throw Error("blocked"); });
  let resolve!: (value: { capture: typeof capture }) => void;
  const sink = createAnalyticsSink(config, () => new Promise(done => { resolve = done; }))!;
  for (let i = 0; i < 250; i++) sink("gameplay_session_progress", { progress_step: i });
  resolve({ capture });
  await Promise.resolve();
  expect(capture).toHaveBeenCalledTimes(200);
  expect(capture.mock.calls[0]).toEqual(["gameplay_session_progress", { progress_step: 50 }]);
  expect(() => sink("gameplay_run_completed", {})).not.toThrow();
  const fail = createAnalyticsSink(config, async () => { throw Error("offline"); })!;
  await Promise.resolve(); await Promise.resolve();
  expect(() => fail("gameplay_run_started", {})).not.toThrow();
});

it("routes EU projects to their own API and dashboard hosts", () => {
  const load = vi.fn(async () => ({ capture: vi.fn() }));
  createAnalyticsSink({ ...config, host: "https://eu.i.posthog.com" }, load);
  expect(load).toHaveBeenCalledWith(config.token, expect.objectContaining({
    api_host: "https://eu.i.posthog.com", ui_host: "https://eu.posthog.com",
  }));
});

it("drops automatic events and any properties outside the gameplay allowlist", () => {
  const filter = POSTHOG_OPTIONS.before_send as Exclude<PostHogConfig["before_send"], unknown[] | undefined>;
  expect(filter({ uuid: "test-1", event: "$pageview", properties: { $current_url: "secret" } })).toBeNull();
  expect(filter(null)).toBeNull();
  const result = filter({ uuid: "test-2", event: "gameplay_run_started", properties: {
    distinct_id: "anonymous-browser", run_id: "run-1", $insert_id: "event-1",
    $current_url: "https://game/?code=secret", $referrer: "private-url",
    $process_person_profile: false, $set: { email: "private@example.com" }, campaign: "raw save", note: "private note", token: "public-token",
  } });
  expect(result?.properties).toEqual({
    distinct_id: "anonymous-browser", run_id: "run-1", $insert_id: "event-1", token: "public-token", $process_person_profile: false,
  });
});

it("installs no observers, timers or storage writes when unconfigured", () => {
  const subscribe = vi.spyOn(useGame, "subscribe");
  const listener = vi.spyOn(window, "addEventListener");
  const stop = startProductAnalytics(useGame, { ...config, enabled: false });
  stop();
  expect(subscribe).not.toHaveBeenCalled();
  expect(listener).not.toHaveBeenCalled();
});

// Runs before any test loads the real SDK, while the module holds no PostHog instance.
describe("a browser that asks not to track", () => {
  const signal = (target: object, name: string, value: unknown) => Object.defineProperty(target, name, { value, configurable: true });
  const clear = () => {
    for (const name of ["doNotTrack", "msDoNotTrack", "globalPrivacyControl"]) Reflect.deleteProperty(navigator, name);
    Reflect.deleteProperty(window, "doNotTrack");
  };
  afterEach(() => { clear(); localStorage.clear(); });

  it("is read from every source with PostHog's values", () => {
    expect(browserAsksNotToTrack()).toBe(false);
    for (const [target, name] of [[navigator, "doNotTrack"], [navigator, "msDoNotTrack"], [window, "doNotTrack"], [navigator, "globalPrivacyControl"]] as const) {
      for (const value of [true, "true", 1, "1", "yes"]) {
        signal(target, name, value);
        expect(browserAsksNotToTrack()).toBe(true);
      }
      for (const value of [false, "0", "no", "unspecified", null]) {
        signal(target, name, value);
        expect(browserAsksNotToTrack()).toBe(false);
      }
      clear();
    }
  });

  it("overrides an acceptance from any tab and clears leftovers without changing the stored choice", () => {
    saveAnalyticsConsent("accepted");
    for (const key of ["nn.product-analytics.v1", "ph_phc_test_public_token_posthog", "__ph_opt_in_out_phc_test_public_token"]) localStorage.setItem(key, "1");
    signal(navigator, "globalPrivacyControl", true);
    const subscribe = vi.spyOn(useGame, "subscribe");
    const stop = startProductAnalyticsUnlessOptedOut(useGame, config);
    try {
      saveAnalyticsConsent("accepted");
      window.dispatchEvent(new StorageEvent("storage", { key: ANALYTICS_CONSENT_KEY }));
      expect(subscribe).not.toHaveBeenCalled();
      expect(Object.keys(localStorage)).toEqual([ANALYTICS_CONSENT_KEY]);
      expect(loadAnalyticsConsent()).toBe("accepted");
    } finally {
      stop();
    }
  });
});

describe("analytics consent", () => {
  afterEach(() => { localStorage.clear(); });

  it("treats a missing, corrupt or unreadable decision as undecided and round-trips each choice", () => {
    expect(loadAnalyticsConsent()).toBeNull();
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "{");
    expect(loadAnalyticsConsent()).toBeNull();
    localStorage.setItem(ANALYTICS_CONSENT_KEY, '"accepted"');
    expect(loadAnalyticsConsent()).toBeNull();
    expect(saveAnalyticsConsent("accepted")).toBe(true);
    expect(loadAnalyticsConsent()).toBe("accepted");
    expect(saveAnalyticsConsent("declined")).toBe(true);
    expect(loadAnalyticsConsent()).toBe("declined");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
    expect(loadAnalyticsConsent()).toBeNull();
  });

  it("announces the decision even when it cannot be persisted", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    const heard: unknown[] = [];
    const listener = (event: Event) => heard.push((event as CustomEvent).detail);
    window.addEventListener("nn:analytics-consent", listener);
    try {
      expect(saveAnalyticsConsent("accepted")).toBe(false);
      expect(heard).toEqual(["accepted"]);
    } finally {
      window.removeEventListener("nn:analytics-consent", listener);
    }
  });

  it("starts once while undecided, never while declined, and keeps one observer on acceptance", () => {
    const subscribe = vi.spyOn(useGame, "subscribe");
    const stop = startProductAnalyticsUnlessOptedOut(useGame, config);
    try {
      expect(subscribe).toHaveBeenCalledTimes(1);
      // Confirming the notice keeps the running observer rather than adding one.
      saveAnalyticsConsent("accepted");
      expect(subscribe).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "declined");
    const stopDeclined = startProductAnalyticsUnlessOptedOut(useGame, config);
    try {
      expect(subscribe).toHaveBeenCalledTimes(1);
    } finally {
      stopDeclined();
    }
  });

  it("stops the active observer on a later decline and restarts once on re-acceptance", () => {
    const unsubscribers: ReturnType<typeof vi.fn>[] = [];
    const subscribe = vi.spyOn(useGame, "subscribe").mockImplementation(() => {
      const unsubscribe = vi.fn();
      unsubscribers.push(unsubscribe);
      return unsubscribe;
    });
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "declined");
    const stop = startProductAnalyticsUnlessOptedOut(useGame, config);
    try {
      saveAnalyticsConsent("accepted");
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(unsubscribers).toHaveLength(1);
      // Opting out unsubscribes the observer it started.
      saveAnalyticsConsent("declined");
      expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
      // Declining again does nothing further.
      saveAnalyticsConsent("declined");
      expect(subscribe).toHaveBeenCalledTimes(1);
      // Re-acceptance starts exactly one new observer, not duplicates.
      saveAnalyticsConsent("accepted");
      expect(subscribe).toHaveBeenCalledTimes(2);
      expect(unsubscribers).toHaveLength(2);
      saveAnalyticsConsent("accepted");
      expect(subscribe).toHaveBeenCalledTimes(2);
    } finally {
      stop();
    }
    // Final cleanup unsubscribes the still-active second observer.
    expect(unsubscribers[1]).toHaveBeenCalledTimes(1);
  });

  it("starts on boot from a persisted acceptance and cleans up its listener and observer", () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, "accepted");
    const subscribe = vi.spyOn(useGame, "subscribe");
    const remove = vi.spyOn(window, "removeEventListener");
    const stop = startProductAnalyticsUnlessOptedOut(useGame, config);
    expect(subscribe).toHaveBeenCalledTimes(1);
    stop();
    expect(remove).toHaveBeenCalledWith("nn:analytics-consent", expect.any(Function));
    // Cleanup also stops the analytics run it started: a later acceptance stays stopped.
    saveAnalyticsConsent("accepted");
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("applies an opt-out for this visit even when storage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("quota"); });
    const unsubscribe = vi.fn();
    vi.spyOn(useGame, "subscribe").mockImplementation(() => unsubscribe);
    const stop = startProductAnalyticsUnlessOptedOut(useGame, config);
    try {
      saveAnalyticsConsent("declined");
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      stop();
    }
  });
});
