/**
 * defense-in-depth — Public API
 *
 * Usage as library:
 *   import { DefendEngine, allBuiltinGuards } from "defense-in-depth";
 *
 * Usage as CLI:
 *   npx defense-in-depth init
 *   npx defense-in-depth verify
 *   npx defense-in-depth doctor
 */

export { DefendEngine } from "./core/engine.js";
export { loadConfig, DEFAULT_CONFIG } from "./core/config-loader.js";
export { Severity } from "./core/types.js";
export type {
  Guard,
  GuardContext,
  GuardResult,
  EngineVerdict,
  Finding,
  DefendConfig,
  FederationGuardConfig,
} from "./core/types.js";

// Guards
export {
  hollowArtifactGuard,
  ssotPollutionGuard,
  commitFormatGuard,
  branchNamingGuard,
  phaseGateGuard,
  ticketIdentityGuard,
  federationGuard,
  allBuiltinGuards,
} from "./guards/index.js";

// Federation (v0.3 → v0.6)
export { createProvider, FileTicketProvider, HttpTicketProvider } from "./federation/index.js";
export type { TicketStateProvider } from "./federation/types.js";
export type { TicketRef } from "./core/types.js";
