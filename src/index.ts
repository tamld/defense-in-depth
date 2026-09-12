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

export { DEFAULT_CONFIG, loadConfig } from "./core/config-loader.js";
// ─── Engine + Config ───
export { DefendEngine } from "./core/engine.js";
export type { DiDErrorCode } from "./core/errors.js";
// ─── Typed errors (v1.0 — issue #37) ───
export {
  ConfigError,
  DiDError,
  ErrorCodes,
  GuardCrashError,
  ProviderError,
} from "./core/errors.js";
// ─── Core types ───
// ─── Per-guard configuration types ───
export type {
  BranchNamingConfig,
  CommitFormatConfig,
  DefendConfig,
  DependencyAuditConfig,
  DSPyConfig,
  EngineRunOptions,
  EngineVerdict,
  EvaluationScore,
  FederationGuardConfig,
  FeedbackEvent,
  FileSizeLimitConfig,
  Finding,
  Guard,
  GuardContext,
  GuardF1Metric,
  GuardMeta,
  GuardResult,
  HitlReviewConfig,
  HollowArtifactConfig,
  Lesson,
  NoStubReturnConfig,
  NoSwallowedErrorConfig,
  NoTriviallyTrueTestConfig,
  NoTypeSafetyBypassConfig,
  PhaseGateConfig,
  RootPollutionConfig,
  SecretDetectionConfig,
  SelfProtectionConfig,
  SsotPollutionConfig,
  TicketIdentityConfig,
  TicketRef,
} from "./core/types.js";
// ─── Core enums ───
export { EvidenceLevel, Severity } from "./core/types.js";
// ─── Federation (v0.3 → v0.6) ───
export { createProvider, FileTicketProvider, HttpTicketProvider } from "./federation/index.js";
export type { TicketStateProvider } from "./federation/types.js";
// ─── Built-in guards ───
export {
  allBuiltinGuards,
  branchNamingGuard,
  commitFormatGuard,
  dependencyAuditGuard,
  federationGuard,
  fileSizeLimitGuard,
  hitlReviewGuard,
  hollowArtifactGuard,
  noStubReturnGuard,
  noSwallowedErrorGuard,
  noTriviallyTrueTestGuard,
  noTypeSafetyBypassGuard,
  phaseGateGuard,
  rootPollutionGuard,
  secretDetectionGuard,
  selfProtectionGuard,
  ssotPollutionGuard,
  ticketIdentityGuard,
} from "./guards/index.js";
