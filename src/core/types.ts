/**
 * Core type definitions for defense-in-depth.
 *
 * Guard Interface — the contract every guard must implement.
 * All guards are pluggable: implement this interface → register with engine.
 */

// ─── Verdict Primitives ───

export enum Severity {
  PASS = "pass",
  WARN = "warn",
  BLOCK = "block",
}

/** A single finding from a guard */
export interface Finding {
  guardId: string;
  severity: Severity;
  message: string;
  filePath?: string;
  line?: number;
  /** Suggested fix command */
  fix?: string;
  /** Evidence level — how was this finding verified? */
  evidence?: EvidenceLevel;
}

/** Result from running a single guard */
export interface GuardResult {
  guardId: string;
  passed: boolean;
  findings: Finding[];
  durationMs: number;
}

/** Aggregated verdict from the engine */
export interface EngineVerdict {
  passed: boolean;
  totalGuards: number;
  passedGuards: number;
  failedGuards: number;
  warnedGuards: number;
  results: GuardResult[];
  durationMs: number;
}

// ─── Guard Contract ───

/** Runtime context passed to each guard */
export interface GuardContext {
  /** Files staged for commit (relative paths) */
  stagedFiles: string[];
  /** Project root directory */
  projectRoot: string;
  /** Current commit message (if available) */
  commitMessage?: string;
  /** Current branch name */
  branch?: string;
  /** Loaded configuration */
  config: DefendConfig;
  /** Extracted Ticket Identifier Context (v0.3) */
  ticket?: TicketRef;
  /** v0.5: Precomputed semantic evaluations for pure guards */
  semanticEvals?: {
    dspy?: Record<string, { score: number; feedback?: string } | null>;
  };
}

/** The Guard interface — implement this to create a new guard */
export interface Guard {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  check(ctx: GuardContext): Promise<GuardResult>;
}

// ─── Configuration Schema ───

export interface HollowArtifactConfig {
  enabled: boolean;
  /** File extensions to scan (default: .md, .json, .yml, .yaml) */
  extensions?: string[];
  /** Patterns indicating hollow content */
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
  };
}

// ─── Evidence System (Trust-but-Verify) ───

/** Evidence level for findings — proof of what was checked */
export enum EvidenceLevel {
  /** Verified by reading source code */
  CODE = "CODE",
  /** Verified by execution, logs, or filesystem state */
  RUNTIME = "RUNTIME",
  /** Inferred from structure but not executed */
  INFER = "INFER",
  /** Hypothesis, not yet verified */
  HYPO = "HYPO",
}

// ─── Future Interfaces (designed now, implemented in later versions) ───

/** v0.3: Ticket identity for ticket-aware guards */
export interface TicketRef {
  /** Ticket ID, e.g. "TK-20260407-001" */
  id: string;
  /** Current lifecycle phase */
  phase?: string;
  /** Ticket type */
  type?: "feat" | "fix" | "chore" | "docs" | "refactor";
}

/**
 * v0.4: Lesson from a completed task — input for memory/growth layer.
 *
 * This is an "Án Lệ" (Case Law) record. Every lesson MUST specify:
 * - The concrete situation that produced the error (scenario)
 * - The wrong approach that was tried (wrongApproach)
 * - The correct resolution that fixed it (correctApproach)
 * - A generalizable insight for future tasks (insight)
 *
 * Generic lessons like "always test your code" are REJECTED.
 * Lessons without wrongApproach context are incomplete and will not be recalled.
 */
export interface Lesson {
  /** Unique identifier */
  id: string;
  /** Short, searchable title */
  title: string;
  /** The concrete situation — what happened, which files, what triggered it */
  scenario: string;
  /** What was tried and FAILED — the wrong approach with specific details */
  wrongApproach: string;
  /** What actually fixed it — the correct approach with specific actions */
  correctApproach: string;
  /** Generalizable insight — the reusable principle extracted */
  insight: string;
  /** Classification */
  category: "code" | "process" | "tool" | "arch";
  /** How was this lesson verified? */
  evidence: EvidenceLevel;
  /** Confidence in the lesson's correctness (0-1) */
  confidence: number;
  /** Originating ticket ID */
  sourceTicket?: string;
  /** Semantic tags for categorization */
  tags?: string[];
  /** Keywords optimized for recall/search — agents use these to find this lesson */
  searchTerms?: string[];
  /** Related lesson IDs — for building a knowledge graph */
  relatedLessons?: string[];
  /** Related file paths that this lesson applies to */
  relatedFiles?: string[];
  /** ISO timestamp */
  createdAt: string;
}

/** v0.5: Quality evaluation score — interface for DSPy/LLM evaluators */
export interface EvaluationScore {
  artifactPath: string;
  score: number;
  maxScore: number;
  evaluator: string;
  dimensions?: Record<string, number>;
  feedback?: string;
}

/** v0.4: Growth metric — tracks system learning velocity */
export interface GrowthMetric {
  /** Metric name (e.g., "lessons_per_ticket", "guard_false_positive_rate") */
  name: string;
  /** Numeric value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** When this was measured */
  measuredAt: string;
  /** Source ticket or guard that produced this metric */
  source?: string;
  /** Trend direction */
  trend?: "improving" | "stable" | "degrading";
}
// ─── Guard Effectiveness Metrics (F1 Scoring) ───

/**
 * v0.5: Guard F1 Metric — measures guard pipeline quality.
 *
 * Applies Information Retrieval metrics to the guard system:
 *   Precision = TP / (TP + FP) → "When we flag, are we right?"
 *   Recall    = TP / (TP + FN) → "Are we catching everything?"
 *   F1        = 2 * (P * R) / (P + R)
 *
 * TP = Guard correctly flags a real problem
 * FP = Guard flags something that's actually fine (developer friction)
 * FN = Guard passes something that should have been caught (governance leak)
 * TN = Guard correctly passes clean code
 */
export interface GuardF1Metric {
  /** Guard ID this metric applies to */
  guardId: string;
  /** Measurement period (ISO interval) */
  period: string;
  /** Total guard runs in this period */
  totalRuns: number;
  /** True positives — correctly flagged issues */
  truePositives: number;
  /** False positives — incorrectly flagged clean code */
  falsePositives: number;
  /** False negatives — missed real issues */
  falseNegatives: number;
  /** Computed precision (0-1) */
  precision: number;
  /** Computed recall (0-1) */
  recall: number;
  /** Computed F1 score (0-1) */
  f1: number;
  /** When this metric was computed */
  computedAt: string;
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

// ─── Meta Layer: Memory About Memory (Layer 2) ───

/**
 * v0.6: Lesson Outcome — tracks whether a lesson was recalled and useful.
 *
 * This is the META MEMORY layer. A lesson that exists but is never recalled
 * is the same as a lesson that doesn't exist. This type enables measuring
 * how well the memory system actually WORKS.
 *
 * Usage: After each guard run or task completion, check if any existing lesson
 * SHOULD HAVE been recalled for the current scenario. Log the outcome.
 */
export interface LessonOutcome {
  /** The lesson that was (or should have been) recalled */
  lessonId: string;
  /** Was this lesson recalled when a similar situation arose? */
  recalled: boolean;
  /** Was the recall actually helpful to the agent? */
  helpful: boolean | null;
  /** The scenario that triggered (or should have triggered) recall */
  triggerScenario: string;
  /** Who was the agent/executor at the time? */
  executor?: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * v0.6: Recall Metric — aggregated quality of the recall system.
 *
 * Computed FROM LessonOutcome data. These metrics tell you whether
 * the memory system is worth having at all.
 */
export interface RecallMetric {
  /** Time period this metric covers (ISO interval) */
  period: string;
  /** Precision: % of recalled lessons that were actually helpful */
  precision: number;
  /** Coverage: % of situations where a relevant lesson existed but wasn't recalled */
  coverageGap: number;
  /** Total recall attempts in this period */
  totalRecalls: number;
  /** Total situations where recall SHOULD have happened but didn't */
  missedRecalls: number;
}

// ─── Meta Layer: Growth About Growth (Layer 3) ───

/**
 * v0.7: Meta Growth Snapshot — measures whether the GROWTH SYSTEM itself is improving.
 *
 * This is the highest meta layer. It doesn't ask "are guards catching errors?"
 * It asks "is the RATE of guard improvement accelerating?"
 *
 * Think of it as the second derivative: if Growth is velocity, MetaGrowth is acceleration.
 */
export interface MetaGrowthSnapshot {
  /** Snapshot period (ISO interval) */
  period: string;
  /** How many new lessons were created (growth velocity) */
  lessonsCreated: number;
  /** How many lessons were actually recalled and helpful (growth quality) */
  lessonsEffective: number;
  /** False positive rate trend across all guards */
  guardFalsePositiveTrend: "improving" | "stable" | "degrading";
  /** Average time from bug discovery to guard shipped (in hours) */
  timeToGuardHours: number;
  /** Community contributions in this period */
  communityContributions: number;
  /** Lessons that were specific enough to be actionable (specificity score 0-1) */
  lessonSpecificityScore: number;
}

// ─── Telemetry Layer: Reverse Design ───

/**
 * v0.8: Telemetry Payload — data format for reverse flow to internal systems.
 *
 * defense-in-depth collects field data (layers 0-2).
 * Hub consumes + analyzes (layers 2-3).
 * This type defines the bidirectional data contract.
 *
 * Flow: defense-in-depth (OSS embassy) → TelemetryPayload → Hub (HQ)
 * Hub learns from real-world OSS usage. defense-in-depth gets refined patterns back.
 */
export interface FederationPayload {
  /** Source project identifier */
  sourceProject: string;
  /** defense-in-depth version that generated this payload */
  version: string;
  /** Lessons discovered in the field (anonymized) */
  lessons: Lesson[];
  /** Recall quality metrics */
  recallMetrics?: RecallMetric;
  /** Meta growth snapshot */
  metaGrowth?: MetaGrowthSnapshot;
  /** Guard effectiveness data (which guards catch what, FP rates) */
  guardStats?: Array<{
    guardId: string;
    totalRuns: number;
    truePositives: number;
    falsePositives: number;
    /** Average execution time in ms */
    avgDurationMs: number;
  }>;
  /** ISO timestamp of payload generation */
  generatedAt: string;
}
