import type { Intervention } from "./campaignTypes";

/** The player-facing name of every scheduled change, shared by reports, the pending list and the event history. */
export const ACTION_NAMES: Record<Intervention, string> = {
  "add-app": "Add server", "upgrade-db": "Database upgrade", limit: "Traffic limit", unlimit: "Remove traffic limit", "scale-up": "Application scale up", "deploy-lb": "Load balancer deployment", routing: "Routing change", cache: "Read Cache deployment", "cache-tuning": "Cache tuning",
  "deploy-autoscaler": "Autoscaling controller deployment", "retire-app": "Safe application retirement", "health-checks": "Health Checks deployment", "create-spare": "Spare application install", "reserve-spare": "Reserve spare", "release-spare": "Release spare", failover: "Automatic Failover deployment", "promote-spare": "Promote spare", "restore-app": "Restore application", promotion: "Promotion",
};

/** "app-2" reads as "App 2"; other ids are already names. */
export const appName = (id: string) => id.replace("app-", "App ");
