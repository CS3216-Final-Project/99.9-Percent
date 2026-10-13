import { useSyncExternalStore } from "react";
import { ANALYTICS_CONSENT_EVENT, loadAnalyticsConsent, saveAnalyticsConsent, type AnalyticsConsent } from "@/lib/analytics";
import { Icon } from "./icons";

const subscribe = (onChange: () => void) => {
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onChange);
  return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onChange);
};

/** The saved analytics choice, kept in step with every other control that changes it. */
function useAnalyticsConsent(): AnalyticsConsent {
  return useSyncExternalStore(subscribe, loadAnalyticsConsent, () => null);
}

/**
 * Lets the player stop or resume anonymous gameplay analytics at any time after the home screen notice.
 * Analytics runs unless the player has opted out, so "Opt out" is the pressed state, like "Mute all".
 */
export function AnalyticsSettings() {
  const optedOut = useAnalyticsConsent() === "declined";
  return (
    <section className="menu-section menu-analytics" aria-label="Anonymous analytics">
      <div className="menu-section-head">
        <h4>
          <Icon name="analytics" size={20} />
          Anonymous analytics
        </h4>
        <button
          type="button"
          className={`btn btn-small menu-toggle${optedOut ? " is-on" : ""}`}
          aria-pressed={optedOut}
          onClick={() => saveAnalyticsConsent(optedOut ? "accepted" : "declined")}
        >
          Opt out
        </button>
      </div>
      <p className="menu-note" role="status">
        {optedOut
          ? "You have opted out. No gameplay events are sent from this browser."
          : "We track anonymous gameplay events, like which chapters you finish and how long they take, to help make the game better. We never send account details, URLs, or saved games."}
      </p>
    </section>
  );
}
