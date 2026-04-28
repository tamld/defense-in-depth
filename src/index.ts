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

// ─── Engine + Config ───
export { DefendEngine } from "./core/engine.js";
export { loadConfig, DEFAULT_CONFIG } from "./core/config-loader.js";

// ─── Core enums ───
export { Severity, EvidenceLevel } from "./core/types.js";

// ─── Core types ───
export type {
  Guard,
  GuardMeta,
  GuardContext,
  GuardResult,
  EngineVerdict,
  EngineRunOptions,
  Finding,
  DefendConfig,
  TicketRef,
  Lesson,
  EvaluationScore,
  GuardF1Metric,
  DSPyConfig,
  FeedbackEvent,
} from "./core/types.js";

// ─── Per-guard configuration types ───
export type {
  HollowArtifactConfig,
  SsotPollutionConfig,
  RootPollutionConfig,
  CommitFormatConfig,
  BranchNamingConfig,
  PhaseGateConfig,
  TicketIdentityConfig,
  HitlReviewConfig,
  FederationGuardConfig,
} from "./core/types.js";

// ─── Built-in guards ───
export {
  hollowArtifactGuard,
  ssotPollutionGuard,
  rootPollutionGuard,
  commitFormatGuard,
  branchNamingGuard,
  phaseGateGuard,
  ticketIdentityGuard,
  hitlReviewGuard,
  federationGuard,
  allBuiltinGuards,
} from "./guards/index.js";

// ─── Federation (v0.3 → v0.6) ───
export { createProvider, FileTicketProvider, HttpTicketProvider } from "./federation/index.js";
export type { TicketStateProvider } from "./federation/types.js";

// ─── Typed errors (v1.0 — issue #37) ───
export {
  DiDError,
  ConfigError,
  GuardCrashError,
  ProviderError,
  ErrorCodes,
} from "./core/errors.js";
export type { DiDErrorCode } from "./core/errors.js";
