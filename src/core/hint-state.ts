/**
 * Hint state store for issue #21 Progressive Discovery UX.
 *
 * Persists which hints have been shown / dismissed for the current repo at
 * `.agents/state/hints-shown.json`. The state file is the only side effect of
 * the hint subsystem — `hint-engine.ts` is otherwise pure.
 *
 * Idempotency contract:
 *   - `loadHintState` returns a fresh empty state when the file is missing or
 *     corrupt, so a hostile `hints-shown.json` cannot break the CLI.
 *   - `recordHintShown`, `dismissHint`, and `resetHintState` use atomic
 *     temp-file rename so concurrent invocations cannot corrupt the JSON.
 *   - The version field is checked on read; a future-version file is treated
 *     as "no state" rather than crashing — the CLI surface stays usable even
 *     across downgrades.
 *
 * Pattern source: mirrors the append-only JSONL persistence helpers in
 * `feedback.ts` and `lesson-outcome.ts`, but uses a single JSON document
 * because the state set is tiny (≤ a dozen hint ids) and we need to mutate it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import type { HintShownEntry, HintState } from "./types.js";

/** Relative path under projectRoot. Exported so tests can clean up. */
export const HINT_STATE_RELATIVE_PATH = ".agents/state/hints-shown.json";

const CURRENT_VERSION = 1 as const;

function emptyState(): HintState {
  return { version: CURRENT_VERSION, shown: {} };
}

function statePath(projectRoot: string): string {
  return path.join(projectRoot, HINT_STATE_RELATIVE_PATH);
}

/**
 * Read the current hint state from disk. Returns a fresh empty state if the
 * file does not exist, is unparseable, or carries a version we don't know how
 * to read. Never throws.
 */
export function loadHintState(projectRoot: string): HintState {
  const file = statePath(projectRoot);
  if (!fs.existsSync(file)) return emptyState();

  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch {
    return emptyState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyState();
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== CURRENT_VERSION
  ) {
    return emptyState();
  }

  const candidate = parsed as { version: 1; shown?: unknown };
  if (
    typeof candidate.shown !== "object" ||
    candidate.shown === null ||
    Array.isArray(candidate.shown)
  ) {
    return emptyState();
  }

  // Be defensive: drop any entry that doesn't look like HintShownEntry. A
  // hostile file should never poison the cooldown logic.
  const cleaned: Record<string, HintShownEntry> = {};
  for (const [hintId, entry] of Object.entries(
    candidate.shown as Record<string, unknown>,
  )) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry)
    ) {
      continue;
    }
    const e = entry as Partial<HintShownEntry>;
    if (typeof e.shownCount !== "number") continue;
    cleaned[hintId] = {
      lastShownAt: typeof e.lastShownAt === "string" ? e.lastShownAt : null,
      dismissedAt: typeof e.dismissedAt === "string" ? e.dismissedAt : null,
      shownCount: e.shownCount,
    };
  }

  return { version: CURRENT_VERSION, shown: cleaned };
}

/**
 * Atomically replace the hint state file. Writes to a sibling temp file then
 * renames over the target so a crash mid-write cannot leave a half-written
 * JSON on disk.
 */
function writeStateAtomic(projectRoot: string, next: HintState): void {
  const file = statePath(projectRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + os.EOL, "utf-8");
  fs.renameSync(tmp, file);
}

/**
 * Mark a hint as shown right now. Bumps `shownCount` and refreshes
 * `lastShownAt`. If the hint has been dismissed previously, this is a no-op
 * — dismissal is permanent.
 */
export function recordHintShown(
  projectRoot: string,
  hintId: string,
  now: Date = new Date(),
): void {
  const state = loadHintState(projectRoot);
  const existing = state.shown[hintId] ?? {
    lastShownAt: null,
    dismissedAt: null,
    shownCount: 0,
  };

  if (existing.dismissedAt !== null) return;

  state.shown[hintId] = {
    ...existing,
    lastShownAt: now.toISOString(),
    shownCount: existing.shownCount + 1,
  };

  writeStateAtomic(projectRoot, state);
}

/**
 * Permanently dismiss a hint. Subsequent calls to `recordHintShown` for the
 * same id become no-ops, and the hint engine treats it as ineligible.
 */
export function dismissHint(
  projectRoot: string,
  hintId: string,
  now: Date = new Date(),
): void {
  const state = loadHintState(projectRoot);
  const existing = state.shown[hintId] ?? {
    lastShownAt: null,
    dismissedAt: null,
    shownCount: 0,
  };

  state.shown[hintId] = {
    ...existing,
    dismissedAt: now.toISOString(),
  };

  writeStateAtomic(projectRoot, state);
}

/**
 * Wipe the hint state file. Useful for tests, repo handoffs, and the
 * `did doctor --hints reset` CLI.
 */
export function resetHintState(projectRoot: string): void {
  const file = statePath(projectRoot);
  if (fs.existsSync(file)) {
    fs.rmSync(file);
  }
}

/**
 * Test helper: returns the active state path for the repo. Exported so tests
 * can assert atomicity / file presence without duplicating the constant.
 */
export function hintStatePath(projectRoot: string): string {
  return statePath(projectRoot);
}
