import type { EquipmentId } from "@/sim";

/** Brief hover/focus summaries; the inspector's About disclosure carries the full explanation. */
export const INFRASTRUCTURE_TIPS: Partial<Record<EquipmentId,string>> = {
    gateway:"Routes incoming requests. Traffic limits reject excess demand.",
    app:"Handles customer requests and uses the Database for data.",
    db:"Stores app data and handles reads and writes.",
    cache:"Answers eligible repeated reads. Misses and writes reach the Database.",
    monitoring:"Shows machine health. Health Checks detect failed servers.",
};

export const INFRASTRUCTURE_HELP: Partial<Record<EquipmentId,string>> = {
    gateway:"Network carries incoming user requests to your system. Traffic limits reject excess requests; rejected requests earn no revenue.",
    app:"An App Server processes user requests and asks the Database for data. Add App Server installs another server that needs routing; Scale Up makes one existing server more powerful.",
    db:"Database stores and retrieves information for the app. More App Server capacity does not fix an overloaded Database.",
    cache:"Read Cache speeds up repeated eligible reads. Misses and writes still need the Database; a new cache needs time to warm up.",
    monitoring:"Monitoring helps identify problems. Health Checks detect failed servers; routing and surviving capacity are needed to keep serving requests.",
};
