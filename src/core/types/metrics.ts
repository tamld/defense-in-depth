/**
 * Memory / growth / telemetry metric types for defense-in-depth
 * (v0.4–v0.8 layers: lessons, F1 feedback, recall outcomes, meta growth,
 * federation payloads).
 *
 * Split out of `src/core/types.ts`; re-exported by that barrel — this
 * module is NOT a new public entry point.
 */

import type { EvidenceLevel } from "./guard.js";

// ─── Future Interfaces (designed now, implemented in later versions) ───

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
  /**
   * v0.7 (#23): Optional regex/string fragment that signifies the
   * `wrongApproach` was repeated. When `did lesson scan-outcomes` walks
   * commit diffs, a hit on this pattern marks the recall `helpful=false`
   * (the lesson was recalled but the user did the wrong thing anyway).
   *
   * Persona A may leave this empty — the scanner falls back to DSPy fuzzy
   * match on `wrongApproach` text when DSPy is enabled, otherwise emits
   * `helpful=null` with `source="scanner-no-match"`. This keeps the field
   * backward-compatible for existing lessons.
   */
  wrongApproachPattern?: string;
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
 * v0.7: Feedback Event — input pipeline for {@link GuardF1Metric}.
 *
 * Persona A (solo dev) and Persona B (AI-augmented team) generate these in
 * two ways:
 *   1. Active CLI: `did feedback tp/fp/fn/tn ...` writes one event per call
 *   2. Passive scraper: `did feedback scan-history` infers events from git
 *      history (fix-up commits → TP, `[guard-override:X]` → FP, reverts → FN)
 *
 * Append-only JSONL at `.agents/records/feedback.jsonl`. Idempotent on `id`.
 * Schema is the single source of truth that {@link GuardF1Metric} consumes —
 * see `src/core/feedback.ts#computeF1FromFeedback`.
 *
 * Tracked in issue #22. The schema is also reused by issue #23
 * ({@link LessonOutcome}) so that recall outcomes share the same provenance
 * chain (`source` + `executor`) as guard feedback.
 */
export interface FeedbackEvent {
  /** Stable ID — sha256(guardId + ticketId + findingHash + timestamp) prefix */
  id: string;
  /** Which guard this feedback is about (e.g. "hollowArtifact"). For
   *  scraper R2 (revert → FN) where we cannot attribute, use
   *  `"unassigned-fn"`. */
  guardId: string;
  /** TKID context. Empty string when no ticket can be extracted — Persona A
   *  on a standalone repo is allowed to skip ticket attribution. */
  ticketId: string;
  /** Hex hash of the finding text being labeled. Stable across re-runs so
   *  re-feedback on the same finding dedupes. */
  findingHash: string;
  /** Confusion-matrix label. */
  label: "TP" | "FP" | "FN" | "TN";
  /** Provenance: where this event came from. */
  source: "cli" | "scraper-fixup" | "scraper-revert" | "scraper-override" | "scraper-clean";
  /** Optional human note. Plaintext — callers are responsible for redaction. */
  note?: string;
  /** ISO timestamp at write time. */
  timestamp: string;
  /** Who wrote it: `"human"` for `cli`, `"scraper:v1"` (or higher) for the
   *  passive scraper. Versioned so analysts can filter out events written
   *  by a specific scraper algorithm version. */
  executor: string;
}

// ─── Meta Layer: Memory About Memory (Layer 2) ───

/**
 * v0.7 (#23): Recall Event — written every time `searchLessons()` returns a
 * lesson, OR when a human invokes `did lesson outcome` for a lesson.
 *
 * This is the *input* side of the meta-memory layer: a fact that "this lesson
 * was surfaced for this query in this ticket context". The *outcome* (was it
 * helpful?) is captured separately in {@link LessonOutcome} because that
 * answer is only knowable after the user finishes the work.
 *
 * Append-only JSONL at `.agents/records/lesson-recalls.jsonl`. Idempotent on
 * `id`, with id deliberately excluding timestamp — same logical recall within
 * the dedupe window collapses to a single event. Same lesson lesson learned
 * in PR #26 / án lệ L-2026-04-29: timestamp in id breaks the idempotent
 * contract across second boundaries.
 */
export interface RecallEvent {
  /** Stable id — sha256(`lessonId|ticketId|queryHash|matchMethod`) prefix.
   *  No timestamp in the id (see comment above). */
  id: string;
  /** The lesson that was surfaced. */
  lessonId: string;
  /** TKID context. Empty string when no ticket can be extracted (Persona A
   *  on a standalone repo is allowed to skip ticket attribution). */
  ticketId: string;
  /** Hex prefix of sha256(query) — stable hash so re-searching the same
   *  query for the same lesson dedupes within the window. */
  queryHash: string;
  /** Which path produced the match. */
  matchMethod: "string" | "semantic";
  /** Provenance: where this recall event came from. */
  source: "search" | "cli-explicit";
  /** ISO timestamp at write time. */
  timestamp: string;
  /** Who triggered the recall: `"human"` for cli-explicit, `"agent:<name>"`
   *  for an agent-invoked search, `"scraper:v1"` reserved for future
   *  retroactive backfills. */
  executor: string;
}

/**
 * v0.7 (#23): Lesson Outcome — was a recall actually helpful?
 *
 * Two production paths:
 *   1. `did lesson outcome <id> --helpful/--not-helpful` (explicit human)
 *   2. `did lesson scan-outcomes` (passive scanner that walks git history,
 *      matches `Lesson.wrongApproachPattern` against commit diffs since the
 *      recall, and infers helpful=false on hit / helpful=true on no hit)
 *
 * Append-only JSONL at `.agents/records/lesson-outcomes.jsonl`. Idempotent
 * on `id` = sha256(`recallId|label`) — re-running the explicit cli writes
 * one event per (recall, label); re-running the scanner is a no-op once the
 * pattern decision is stable.
 *
 * Schema is the single source of truth that `RecallMetric` consumes (v0.8
 * dashboard). Producers/consumers join on `recallId`.
 */
export interface LessonOutcome {
  /** Stable id — sha256(`recallId|label`) prefix. No timestamp in the id. */
  id: string;
  /** Links back to the {@link RecallEvent} that this outcome evaluates. */
  recallId: string;
  /** Denormalized for query convenience — same as the linked recall. */
  lessonId: string;
  /** Was the recall helpful? `null` is a valid outcome — it means we
   *  honestly don't know (no `wrongApproachPattern` and DSPy fuzzy match
   *  was disabled or unavailable). Never assume `null === false`. */
  helpful: boolean | null;
  /** How we decided. `cli-explicit` came from a human; `scanner-pattern-
   *  match` came from a regex hit on `wrongApproachPattern`; `scanner-no-
   *  match` came from a window-walk that found no hit (or could not run). */
  source: "cli-explicit" | "scanner-pattern-match" | "scanner-no-match";
  /** Optional pattern that matched (only present for scanner-pattern-
   *  match — useful for audit). */
  matchedPattern?: string;
  /** Optional human note. Plaintext — callers are responsible for
   *  redaction. */
  note?: string;
  /** ISO timestamp at write time. */
  timestamp: string;
  /** Who wrote it: `"human"` for cli-explicit, `"scanner:v1"` for the
   *  passive evaluator. Versioned so analysts can filter by algo version. */
  executor: string;
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
