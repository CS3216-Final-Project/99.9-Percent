import type { EquipmentId } from "@/sim";

export const INFRASTRUCTURE_HELP: Partial<Record<EquipmentId,string>> = {
    gateway:"Network carries incoming user requests to your system. Traffic limits reject excess requests; rejected requests earn no revenue.",
    app:"An App Server processes user requests and asks the Database for data. Add App Server installs another server that needs routing; Scale Up makes one existing server more powerful.",
    db:"Database stores and retrieves information for the app. More App Server capacity does not fix an overloaded Database.",
    cache:"Read Cache speeds up repeated eligible reads. Misses and writes still need the Database; a new cache needs time to warm up.",
    monitoring:"Monitoring helps identify problems. Health Checks detect failed servers; routing and surviving capacity are needed to keep serving requests.",
};
