/**
 * Guard contract types for defense-in-depth.
 *
 * Guard Interface — the contract every guard must implement.
 * All guards are pluggable: implement this interface → register with engine.
 *
 * Split out of `src/core/types.ts`; re-exported by that barrel — this
 * module is NOT a new public entry point.
 */

import type { DefendConfig } from "./config.js";

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
  /**
   * Precomputed semantic evaluations from Phase 2.5. Exposed so callers
   * (e.g. the `verify` CLI) can detect Tier-1 silent degradation —
   * useDspy was on, but the call returned null for one or more files —
   * and emit a contract-level WARN to stderr. Same shape as
   * GuardContext.semanticEvals.
   */
  semanticEvals?: {
    dspy?: Record<string, { score: number; feedback?: string } | null>;
  };
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

/**
 * Optional descriptive metadata a guard can attach for tooling
 * (registry UIs, dashboards, hint engine). Reserved for future use —
 * the engine accepts the field but does not consult it at runtime.
 */
export interface GuardMeta {
  /** Semver string, free-form. */
  readonly version?: string;
  /** Author or owning team. */
  readonly author?: string;
  /** Documentation URL. */
  readonly homepage?: string;
}

/** The Guard interface — implement this to create a new guard */
export interface Guard {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  check(ctx: GuardContext): Promise<GuardResult>;

  // ─── Optional lifecycle (v1.0 — issue #49) ───

  /**
   * Called once by the engine before this guard's `check()` runs, in
   * priority order. Use for per-guard setup (warm caches, build
   * per-run indices). Note: higher-priority guards will have already
   * completed both `init()` and `check()` by the time a lower-priority
   * guard's `init()` is invoked — the pipeline interleaves init→check
   * per guard, it does not pre-init every guard before the first check.
   * If `init` throws, the guard is treated as crashed: the engine
   * records a typed `GuardCrashError` BLOCK finding with a
   * `"Guard init crashed: …"` prefix and **skips the `check()` call**
   * for that guard. `dispose()` is still invoked.
   */
  init?(ctx: GuardContext): Promise<void>;

  /**
   * Called once by the engine after the pipeline finishes, in a
   * `finally` block — so it runs even when `check()` or `init()`
   * throws. Use for cleanup (close handles, flush caches). Errors
   * thrown from `dispose()` are **never** propagated to the verdict;
   * the engine logs them with `console.warn` and continues.
   */
  dispose?(): Promise<void>;

  /**
   * Higher number = runs first. Default 0. Ties preserve registration
   * order (stable sort). Use for ordering when one guard's BLOCK should
   * short-circuit another (e.g. a future `secrets` guard at priority
   * 100 runs before an expensive `dependency-audit` guard at 50).
   */
  readonly priority?: number;

  /**
   * Hint that a guard only applies to a subset of staged files.
   * Reserved for future per-guard file filtering — accepted on the
   * type but not consulted by the engine today. Plugin authors may
   * still expose it for downstream tooling.
   */
  supports?(file: string): boolean;

  /** Free-form metadata for tooling. See `GuardMeta`. */
  readonly meta?: GuardMeta;
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
  /** v0.6: Parent ticket ID from the root/upstream project */
  parentId?: string;
  /** v0.6: Parent ticket's current phase (resolved via provider) */
  parentPhase?: string;
  /** v0.6: Authorization status from parent (true = allowed to proceed) */
  authorized?: boolean;
}
