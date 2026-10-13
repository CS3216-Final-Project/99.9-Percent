import { afterEach, expect, it, vi } from "vitest";
import type { PostHogConfig } from "posthog-js/dist/module.no-external";
import { configuredAnalytics, createAnalyticsSink, POSTHOG_OPTIONS, startProductAnalytics, type AnalyticsConfig } from "./analytics";
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
