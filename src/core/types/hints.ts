/**
 * Progressive Discovery hint types for defense-in-depth (v0.7 #21).
 *
 * Split out of `src/core/types.ts`; re-exported by that barrel — this
 * module is NOT a new public entry point.
 */

// ─── v0.7 (#21) Progressive Discovery — hint surface ─────────────────────

/**
 * A discovery hint. Hints are read-only signals from the hint engine to the
 * user, surfaced after a successful CLI invocation. They are NOT errors and
 * MUST NOT change exit codes.
 *
 * Stable IDs (`H-001-no-dspy`, `H-002-no-lessons`, `H-003-no-feedback`,
 * `H-004-no-federation`) let users dismiss specific hints without disabling
 * the whole subsystem.
 */
export interface Hint {
  /** Stable, hyphen-separated id. Format: `H-NNN-slug`. */
  id: string;
  /**
   * Visual / urgency tier. Both render dim by default; "suggestion" is reserved
   * for the rare hint that recommends a concrete next action (e.g. "run
   * 'did lesson record'").
   */
  severity: "info" | "suggestion";
  /**
   * One-paragraph hint body. Plain text — the renderer adds the lightbulb,
   * dim ANSI codes, and the dismiss footer. Keep under ~240 chars so it fits
   * comfortably in a terminal without wrapping awkwardly.
   */
  body: string;
  /** Hints are always dismissible in v1. Field is reserved for v0.8 sticky alerts. */
  dismissible: true;
}

/**
 * Per-repo persistent state for the hint engine. Stored at
 * `.agents/state/hints-shown.json`. Atomic writes via temp-file rename.
 */
export interface HintState {
  /** Schema version. Bump when the file shape changes incompatibly. */
  version: 1;
  /**
   * One entry per hint id the engine has ever proposed. `dismissedAt` is
   * permanent; `lastShownAt` powers the cooldown window.
   */
  shown: Record<string, HintShownEntry>;
}

export interface HintShownEntry {
  /** ISO timestamp of the most recent emission, or null if dismissed before
   *  ever being shown. */
  lastShownAt: string | null;
  /** ISO timestamp of permanent dismissal, or null if still active. */
  dismissedAt: string | null;
  /** Total emissions across the lifetime of this repo. */
  shownCount: number;
}
