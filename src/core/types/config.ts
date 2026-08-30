/**
 * Configuration schema types for defense-in-depth.
 *
 * Shapes loaded from `defense.config.yml` (see `src/core/config-loader.ts`)
 * plus the shared DSPy configuration block.
 *
 * Split out of `src/core/types.ts`; re-exported by that barrel — this
 * module is NOT a new public entry point.
 */

// ─── Configuration Schema ───

export interface HollowArtifactConfig {
  enabled: boolean;
  /** File extensions to scan (default: .md, .json, .yml, .yaml) */
  extensions?: string[];
  /**
   * Patterns indicating hollow content. Each entry is treated as a
   * **literal case-insensitive substring** — regex metacharacters are
   * escaped automatically. Use multiple entries instead of regex
   * alternation (e.g. `["TODO", "FIXME"]`, not `"TODO|FIXME"`).
   */
  patterns?: string[];
  /** Minimum content length (chars after stripping headers) */
  minContentLength?: number;
  /** v0.5: Enable DSPy semantic evaluation for deeper quality analysis (opt-in, default: false) */
  useDspy?: boolean;
  /** v0.5: HTTP endpoint for the DSPy evaluation service */
  dspyEndpoint?: string;
  /** v0.5: Timeout in ms for DSPy HTTP calls (default: 5000) */
  dspyTimeoutMs?: number;
}

export interface SsotPollutionConfig {
  enabled: boolean;
  /** Glob patterns for protected SSoT files */
  protectedPaths?: string[];
}

export interface RootPollutionConfig {
  enabled: boolean;
  /** Exact filenames allowed in the root directory */
  allowedRootFiles?: string[];
  /** Glob patterns for allowed root files (e.g. "*.md") */
  allowedRootPatterns?: string[];
}

export interface CommitFormatConfig {
  enabled: boolean;
  /** Regex pattern for valid commit messages */
  pattern?: string;
  /** Allowed conventional commit types */
  types?: string[];
}

export interface BranchNamingConfig {
  enabled: boolean;
  /** Regex pattern for valid branch names */
  pattern?: string;
}

export interface PhaseGateConfig {
  enabled: boolean;
  /** File that must exist before source commits are allowed */
  planFile?: string;
  /** Glob patterns for "source code" directories */
  sourcePatterns?: string[];
}

/** v0.3: Ticket Identity guard configuration */
export interface TicketIdentityConfig {
  enabled: boolean;
  /** Regex pattern for valid ticket IDs (default: TK-[0-9A-Z-]+) */
  tkidPattern?: string;
  /** Severity: 'warn' (advisory, v0.3 default) or 'block' (enforcement) */
  severity?: 'warn' | 'block';
  /** Provider type: "file" (default) | custom module path (future) */
  provider?: string;
  /** Provider-specific configuration (passed directly to the provider constructor) */
  providerConfig?: Record<string, unknown>;
}

export interface HitlReviewConfig {
  enabled: boolean;
  /** Branches where direct commits are blocked, forcing PR workflow */
  protectedBranches?: string[];
}

/** v0.6: Federation guard configuration — parent↔child ticket governance */
export interface FederationGuardConfig {
  enabled: boolean;
  /** Parent project's ticket resolution endpoint (for HttpTicketProvider) */
  parentEndpoint?: string;
  /** Severity: 'warn' (advisory) or 'block' (enforcement, default) */
  severity?: 'warn' | 'block';
  /** Parent phases that BLOCK child execution (default: BLOCKED, CANCELLED, ARCHIVED) */
  blockedParentPhases?: string[];
  /** Provider type for resolving parent state: 'http' | 'file' (default: 'file') */
  provider?: string;
  /** Provider-specific configuration */
  providerConfig?: Record<string, unknown>;
}

<<<<<<< HEAD
export interface SecretDetectionConfig {
  enabled: boolean;
  /** Custom regex patterns to scan in addition to built-in secret patterns */
  customPatterns?: string[];
}

export interface FileSizeLimitConfig {
  enabled: boolean;
  /** Maximum file size in bytes before blocking (default: 1048576 = 1 MB) */
  maxSizeBytes?: number;
  /** Severity: 'warn' or 'block' (default: 'block') */
  severity?: 'warn' | 'block';
  /** File extensions to exempt from size checks (e.g. [".mp4", ".zip"]) */
  ignoredExtensions?: string[];
}

export interface DependencyAuditConfig {
  /** Opt-in switch for running npm audit during verification (default: false) */
  enabled: boolean;
  /** Severity: 'warn' or 'block' on high/critical vulnerabilities (default: 'block') */
  severity?: 'warn' | 'block';
}

export interface NoTypeSafetyBypassConfig {
  enabled: boolean;
  severity?: 'warn' | 'block';
  allowlistPaths?: string[];
}

export interface NoSwallowedErrorConfig {
  enabled: boolean;
  severity?: 'warn' | 'block';
  allowlistPaths?: string[];
}

export interface NoStubReturnConfig {
  enabled: boolean;
  severity?: 'warn' | 'block';
  allowlistPaths?: string[];
}

export interface NoTriviallyTrueTestConfig {
  enabled: boolean;
  severity?: 'warn' | 'block';
  allowlistPaths?: string[];
}

export interface SelfProtectionConfig {
  enabled: boolean;
  severity?: 'warn' | 'block';
  protectedPaths?: string[];
}

/** Root configuration loaded from defense.config.yml */
export interface DefendConfig {
  version: string;
  guards: {
    hollowArtifact?: HollowArtifactConfig;
    ssotPollution?: SsotPollutionConfig;
    rootPollution?: RootPollutionConfig;
    commitFormat?: CommitFormatConfig;
    branchNaming?: BranchNamingConfig;
    phaseGate?: PhaseGateConfig;
    ticketIdentity?: TicketIdentityConfig;
    hitlReview?: HitlReviewConfig;
    federation?: FederationGuardConfig;
    secretDetection?: SecretDetectionConfig;
    fileSizeLimit?: FileSizeLimitConfig;
    dependencyAudit?: DependencyAuditConfig;
    noTypeSafetyBypass?: NoTypeSafetyBypassConfig;
    noSwallowedError?: NoSwallowedErrorConfig;
    noStubReturn?: NoStubReturnConfig;
    noTriviallyTrueTest?: NoTriviallyTrueTestConfig;
    selfProtection?: SelfProtectionConfig;
  };
  /** v0.7 (#21): Progressive Discovery UX — earned, dim-formatted hints. */
  hints?: HintsConfig;
}

/**
 * v0.7 (#21) Progressive Discovery — top-level config.
 *
 * The hint engine is the bridge between Persona A (solo dev) and Persona B
 * (AI-augmented team). Hints fire only on earned signals (e.g. you actually
 * had a guard block, you actually committed N times) — never on cold-start
 * repos. All knobs default to the least-noisy option.
 */
export interface HintsConfig {
  /** Master switch. When false, no hints are emitted on any surface. */
  enabled?: boolean;
  /** Minimum days between re-showings of the same hint. Defaults to 7. */
  cooldownDays?: number;
  /**
   * CLI surfaces allowed to emit hints. Defaults to ["doctor", "verify-success"].
   * - "doctor": at most 1 hint after the 4-check summary (or all hints with --hints).
   * - "verify-success": at most 1 hint after a clean `verify` exit. Never emitted
   *   on a BLOCK exit (avoids piling onto an error message).
   */
  channels?: ReadonlyArray<"doctor" | "verify-success">;
}

/**
 * v0.5: DSPy configuration — shared across all layers.
 *
 * This is the canonical config shape for any DiD module that uses DSPy.
 * Guards, memory, and meta layers all reference this same shape.
 */
export interface DSPyConfig {
  /** Enable DSPy for this module (default: false) */
  enabled: boolean;
  /** HTTP endpoint for the DSPy evaluation service */
  endpoint?: string;
  /** Timeout in ms for DSPy HTTP calls (default: 5000) */
  timeoutMs?: number;
}
