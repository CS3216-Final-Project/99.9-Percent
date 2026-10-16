import type { GameState } from "@/sim";
import { OPENING_DB as Q } from "@/sim/scenarios/openingDatabaseIncident";

/** Presentation of the existing Campaign header rules, never a second simulation. */
export function campaignAppHealth(game: GameState) {
    const c = game.campaign!;
    const m = c.snapshot;
    const incident = game.phase === "incident";
    const atRisk = m.latencyMs >= Q.latencyThresholdMs;
    const word = incident ? "Incident" : game.phase === "ended" ? game.outcome === "won" ? "Campaign complete" : "Bankrupt" : game.phase === "review" ? "Recovered" : atRisk ? "At risk" : c.limit !== null ? "Traffic limited" : "Healthy";
    const tone = incident || (game.phase === "ended" && game.outcome !== "won") ? "critical" : atRisk ? "warn" : "health";
    const icon = incident ? "incident" : atRisk ? "alert" : "health";
    const reason = word === "Incident" ? "An incident is still open, even if the latest measurements have improved."
        : word === "Campaign complete" ? "You have completed this company's campaign."
        : word === "Bankrupt" ? "This company has closed because it ran out of money."
        : word === "Recovered" ? "Service recovered. The incident outcome is ready for review."
        : word === "At risk" ? `Estimated response time is at least ${Q.latencyThresholdMs} ms.`
        : word === "Traffic limited" ? "A traffic limit is configured for this app."
        : "No incident, response-time warning or traffic limit is active.";
    const available = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
    const responseMs = available(m.latencyMs), failedRate = available(m.serviceErrorRate);
    const appWaiting = available(m.app.backlog), dbWaiting = available(m.db.backlog);
    const waiting = appWaiting === null || dbWaiting === null ? null : appWaiting + dbWaiting;
    const rejected = available(m.rejected);
    const evidence = [
        responseMs !== null && atRisk ? "customers may experience slower responses" : null,
        failedRate !== null && failedRate > 0 ? "some requests failed" : null,
        waiting !== null && waiting > 0 ? "some requests have not been processed yet" : null,
        rejected !== null && rejected > 0 ? "some incoming requests were rejected" : null,
    ].filter((s): s is string => s !== null);
    const interpretation = evidence.length ? evidence.join("; ").replace(/^./, s => s.toUpperCase()) + "."
        : responseMs === null || failedRate === null || waiting === null ? "Some measurements are unavailable; check the readings shown."
        : "No failed requests or waiting work in this snapshot.";
    return { word, tone, icon, reason, interpretation, responseMs, failedRate, waiting, rejected, step: m.step } as const;
}
