/**
 * Shared hint emission for the CLI surface (issue #21).
 *
 * Two callers route through this module:
 *   - `did doctor` — emits hints after the 4-check summary.
 *   - `did verify` (success exit) — emits at most one hint after a clean run.
 *
 * The policy is identical in both cases: respect `process.env.NO_HINTS`,
 * `process.env.CI`, the `hints.enabled` config flag, and the per-channel
 * allowlist. Centralising the policy keeps the anti-nag contract in one
 * place — fix it once, apply everywhere.
 */

import { loadConfig } from "../core/config-loader.js";
import {
  DEFAULT_COOLDOWN_DAYS,
  DEFAULT_HINT_CHANNELS,
  evaluateHints,
} from "../core/hint-engine.js";
import { loadHintState, recordHintShown } from "../core/hint-state.js";
import type { Hint } from "../core/types.js";

export type HintChannel = "doctor" | "verify-success";

/**
 * Emit at most one earned hint to stderr for the given channel. Idempotent —
 * after emission the state file is updated so the same hint won't fire again
 * within the cooldown window.
 *
 * Returns the hint that was emitted (if any) so callers can log/test the
 * decision without re-implementing the policy.
 */
export function emitOneHint(
  projectRoot: string,
  channel: HintChannel,
): Hint | null {
  if (!isChannelEnabled(projectRoot, channel)) return null;
  if (process.env.NO_HINTS === "1") return null;
  if (process.env.CI === "true") return null;

  const config = loadConfig(projectRoot);
  const cooldownDays = config.hints?.cooldownDays ?? DEFAULT_COOLDOWN_DAYS;
  const state = loadHintState(projectRoot);
  const eligible = evaluateHints({ projectRoot, state, cooldownDays });
  const hint = eligible[0];
  if (!hint) return null;

  process.stderr.write(formatHint(hint));
  recordHintShown(projectRoot, hint.id);
  return hint;
}

/**
 * Render every eligible hint, no cap. Used by `did doctor --hints`.
 * Each emitted hint's `lastShownAt` still ticks forward so a subsequent
 * default `did doctor` call respects the cooldown.
 */
export function emitAllHints(
  projectRoot: string,
  channel: HintChannel,
): Hint[] {
  if (!isChannelEnabled(projectRoot, channel)) return [];
  if (process.env.NO_HINTS === "1") return [];
  if (process.env.CI === "true") return [];

  const config = loadConfig(projectRoot);
  const cooldownDays = config.hints?.cooldownDays ?? DEFAULT_COOLDOWN_DAYS;
  const state = loadHintState(projectRoot);
  const eligible = evaluateHints({ projectRoot, state, cooldownDays });
  for (const hint of eligible) {
    process.stderr.write(formatHint(hint));
    recordHintShown(projectRoot, hint.id);
  }
  return [...eligible];
}

/**
 * Format a single hint for stderr: dim ANSI body when stderr is a TTY, plain
 * text otherwise. Always wraps in a 2-line block (body + dismiss footer) so
 * the visual signature is consistent across channels.
 */
export function formatHint(hint: Hint): string {
  const useColor = Boolean(process.stderr.isTTY) && process.env.NO_COLOR !== "1";
  const dimOpen = useColor ? "\x1b[2m" : "";
  const dimClose = useColor ? "\x1b[0m" : "";
  const lightbulb = "💡";
  const footer =
    `   (Hide: did doctor --hints dismiss ${hint.id} | NO_HINTS=1)`;
  return `${dimOpen}${lightbulb} Tip: ${hint.body}\n${footer}${dimClose}\n`;
}

/**
 * Resolve whether a CLI surface may emit hints based on the user's config
 * + the built-in default. A missing `hints` block is interpreted as
 * "enabled with default channels".
 */
export function isChannelEnabled(
  projectRoot: string,
  channel: HintChannel,
): boolean {
  const config = loadConfig(projectRoot);
  if (config.hints?.enabled === false) return false;
  const channels = config.hints?.channels ?? DEFAULT_HINT_CHANNELS;
  return channels.includes(channel);
}
