/**
 * Public surface of the simulation. The UI talks to the game only through
 * these exports; nothing in here touches React, the DOM or localStorage.
 */
export * from "./types";
export { BALANCE, PROMOS, PROMO_ORDER } from "./balance";
export { BRANCHES, TECH, TECH_ORDER, has, isResearchTech, completedTechIds, techStatus, missingPrerequisites } from "./tech";
export * from "./derive";
export { newGame, newLegacyGame } from "./state";
export { applyAction } from "./actions";
export { advanceTurn, incidentTick } from "./turn";
export {
  recoveryOptions,
  symptomaticEquipment,
  inspectable,
  inspectSeconds,
  monitoringLevel,
  type RecoveryOption,
} from "./incidents";
export { INCIDENT_NAMES } from "./postmortem";
export { buildReport, type EndReport } from "./report";
export { rollbackTarget } from "./releases";
export { normaliseSeed } from "./rng";
