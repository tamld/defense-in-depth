/**
 * Engine execution option types for defense-in-depth.
 *
 * Split out of `src/core/types.ts`; re-exported by that barrel — this
 * module is NOT a new public entry point.
 */

// ─── Engine Execution Options ───

/**
 * Options for {@link DefendEngine.run}.
 *
 * v1.0 (#50): the engine accepts a single options object instead of
 * positional arguments. This frees the API from the staged-only model
 * baked into v0.x and reserves named slots for future execution modes.
 */
export interface EngineRunOptions {
  /** Files the engine should hand to each guard via `GuardContext.stagedFiles`. */
  files: string[];
  /**
   * Reserved for future execution modes (#50). Currently informational —
   * the engine does not branch on this field. `staged` is the historical
   * default; `full` is intended for full-tree scans; `patch` for partial
   * diffs. Wiring lands in a follow-up PR.
   */
  mode?: "staged" | "full" | "patch";
  /** Current commit message (if available). */
  commitMessage?: string;
  /** Current branch name. */
  branch?: string;
  /**
   * Reserved for future "no side effects" execution (#50). Currently
   * informational — the engine performs no writes today, so this flag
   * is accepted but not yet wired to behaviour. Future guards or
   * provider integrations may consult it.
   */
  dryRun?: boolean;
}
