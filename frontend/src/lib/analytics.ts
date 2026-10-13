import type { PostHogConfig } from "posthog-js/dist/module.no-external";
import { watchProductAnalytics, type AnalyticsProperties, type AnalyticsSink } from "@/game/productAnalytics";
import type { useGame } from "@/game/store";

export interface AnalyticsConfig {
  enabled: boolean;
  token: string;
  host: string;
  buildId: string;
}
interface Client { capture: AnalyticsSink; }
type Loader = (token: string, config: Partial<PostHogConfig>) => Promise<Client>;

const PROPERTY_ALLOWLIST = new Set([
  "distinct_id", "token", "$process_person_profile", "$is_identified", "$device_id", "$session_id", "$window_id", "$lib", "$lib_version", "$insert_id",
  "event_version", "build_id", "content_version", "mode", "run_id", "gameplay_session_id",
  "device_category", "chapter_id", "progress_step", "session_active_ms", "run_active_ms",
  "active_delta_ms", "eligible_started_run", "entry_type", "replay", "reason", "outcome",
]);

/** Only deliberate gameplay events/properties leave the browser; no URLs, account data or raw saves. */
export const POSTHOG_OPTIONS: Partial<PostHogConfig> = {
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_performance: false,
  capture_exceptions: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_external_dependency_loading: true,
  advanced_disable_flags: true,
  person_profiles: "never",
  persistence: "localStorage",
  respect_dnt: true,
  before_send: event => {
    if (!event || !event.event.startsWith("gameplay_")) return null;
    event.properties = Object.fromEntries(Object.entries(event.properties)
      .filter(([key]) => PROPERTY_ALLOWLIST.has(key)));
    return event;
  },
};
const loadPosthog: Loader = async (token, config) => {
  const { default: posthog } = await import("posthog-js/dist/module.no-external");
  posthog.init(token, config);
  return { capture: (name, properties) => { posthog.capture(name, properties); } };
};

export function configuredAnalytics(): AnalyticsConfig {
  return {
    enabled: import.meta.env.PROD && import.meta.env.VITE_DEPLOY_ENV === "production" &&
      import.meta.env.VITE_ANALYTICS_ENABLED === "true",
    token: import.meta.env.VITE_POSTHOG_TOKEN ?? "",
    host: import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
    buildId: import.meta.env.VITE_BUILD_ID || import.meta.env.VITE_COMMIT_SHA || "unrecorded",
  };
}

/** Bounded startup buffer; failed/blocked SDK loading drops analytics without affecting play. */
export function createAnalyticsSink(config: AnalyticsConfig, load: Loader = loadPosthog): AnalyticsSink | null {
  if (!config.enabled || !config.token || !["https://us.i.posthog.com", "https://eu.i.posthog.com"].includes(config.host)) return null;
  let client: Client | null = null;
  let failed = false;
  const pending: { name: string; properties: AnalyticsProperties }[] = [];
  void load(config.token, {
    ...POSTHOG_OPTIONS, api_host: config.host,
    ui_host: config.host === "https://eu.i.posthog.com" ? "https://eu.posthog.com" : "https://us.posthog.com",
  }).then(loaded => {
    client = loaded;
    for (const item of pending.splice(0)) {
      try { client.capture(item.name, item.properties); } catch { /* Best effort. */ }
    }
  }).catch(() => { failed = true; pending.length = 0; });
  return (name, properties) => {
    if (failed) return;
    if (client) {
      try { client.capture(name, properties); } catch { /* Best effort. */ }
    } else {
      if (pending.length === 200) pending.shift();
      pending.push({ name, properties });
    }
  };
}

export function startProductAnalytics(store: typeof useGame, config = configuredAnalytics()): () => void {
  const sink = createAnalyticsSink(config);
  return sink ? watchProductAnalytics(store, sink, config.buildId) : () => {};
}

/* ------------------------------------------------------------------ */
/* Opt-out: analytics runs unless the player has opted out.            */
/* ------------------------------------------------------------------ */

export type AnalyticsConsent = "accepted" | "declined" | null;
export const ANALYTICS_CONSENT_KEY = "nn.analytics-consent.v1";
export const ANALYTICS_CONSENT_EVENT = "nn:analytics-consent";

/** The saved decision; a missing, corrupt or unreadable record means undecided. */
export function loadAnalyticsConsent(): AnalyticsConsent {
  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return stored === "accepted" || stored === "declined" ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Remembers the decision, then announces it even when storage failed, so an
 * acceptance still applies for this visit. Returns whether it was persisted.
 */
export function saveAnalyticsConsent(value: Exclude<AnalyticsConsent, null>): boolean {
  let saved = false;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    saved = true;
  } catch {
    /* best effort: the event below still applies the decision for this visit */
  }
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: value }));
  return saved;
}

/**
 * Starts product analytics unless the player has opted out: an undecided or
 * accepted choice runs it, while a decline means no SDK load, observer, timer,
 * listener or storage write. A later decline stops everything immediately; a
 * renewed acceptance may start it once again. The returned cleanup stops
 * everything it started.
 */
export function startProductAnalyticsUnlessOptedOut(store: typeof useGame, config = configuredAnalytics()): () => void {
  let consent = loadAnalyticsConsent();
  let stop: (() => void) | null = null;
  const begin = () => {
    if (consent !== "declined" && !stop) stop = startProductAnalytics(store, config);
  };
  const end = () => {
    stop?.();
    stop = null;
  };
  begin();
  const onConsent = (event: Event) => {
    const decision = (event as CustomEvent<AnalyticsConsent>).detail;
    consent = decision === "accepted" || decision === "declined" ? decision : loadAnalyticsConsent();
    if (consent === "declined") end(); else begin();
  };
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    end();
  };
}
