/**
 * Progressive Discovery hint engine for issue #21.
 *
 * The engine answers exactly one question:
 *
 *   "Given the current repo state and the hint history, which hints (if any)
 *    are eligible to surface right now?"
 *
 * It returns an ordered list — the caller decides whether to emit zero, one,
 * or all of them. The default `did doctor` flow emits the first eligible
 * hint, the `did doctor --hints` flow emits the full list. `did verify`
 * (success path) is wired through the same engine so the trigger logic stays
 * in one place.
 *
 * Design constraints:
 *   - **Pure-ish.** `evaluateHints` only reads the project root: config file,
 *     lessons file, feedback events, git plumbing. It never writes; persisting
 *     "we showed this hint" is the caller's responsibility via
 *     `recordHintShown` from `hint-state.ts`. This makes the rules trivial to
 *     unit test and keeps the trigger logic deterministic.
 *   - **Anti-nag discipline.** Three layers of restraint, all enforced here:
 *       1. Earned trigger — a hint only fires if there's a concrete signal
 *          (config absent + ≥5 commits, guard block in last 30 days, etc.).
 *          Pure cold-start repos see exactly zero hints.
 *       2. Cooldown — a hint that was shown in the last `cooldownDays` is
 *          filtered out. Default 7 days.
 *       3. Permanent dismiss — `dismissedAt !== null` removes the hint from
 *          the eligible set forever.
 *   - **Stable order.** The catalog order (H-001 → H-004) is the priority
 *     order. The first hint a user has earned is the most useful next step.
 *   - **CI-clean.** Callers consult `process.env.CI === "true"` and skip
 *     emission entirely. The engine itself doesn't read env vars; that
 *     decision lives at the call site.
 *
 * Pattern source: mirrors the pure evaluator pattern from
 * `evaluateRecallAgainstCommits` in `lesson-outcome.ts` — gather state once,
 * apply rules, return ordered findings.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

import { loadConfig } from "./config-loader.js";
import { readFeedback } from "./feedback.js";
import type { DefendConfig, FeedbackEvent, Hint, HintState } from "./types.js";

/** Default minimum days between re-showings of the same hint. */
export const DEFAULT_COOLDOWN_DAYS = 7;

/** Default channels that are allowed to emit hints. */
export const DEFAULT_HINT_CHANNELS: ReadonlyArray<"doctor" | "verify-success"> = [
  "doctor",
  "verify-success",
];

/** Lookback window for "recent guard blocks" used by H-002. */
const RECENT_BLOCK_WINDOW_DAYS = 30;

/** Repo-age floor used by H-001 and the commit-burst arm of H-003. */
const H001_MIN_COMMITS = 5;
const H003_MIN_COMMITS = 10;

/** "Few feedback events" threshold for H-003. */
const H003_LOW_FEEDBACK_LIMIT = 5;

/**
 * Snapshot of repo state used by the rule evaluator. Built once per call so
 * a single evaluation pass doesn't re-read the same files.
 */
interface RepoState {
  config: DefendConfig;
  configFileExists: boolean;
  hasDspyConfig: boolean;
  hasFederationConfig: boolean;
  commitCount: number;
  contributorCount: number;
  hasChangelog: boolean;
  hasDocsDir: boolean;
  lessonsCount: number;
  feedbackEvents: FeedbackEvent[];
}

export interface EvaluateHintsOptions {
  projectRoot: string;
  state: HintState;
  /** Defaults to {@link DEFAULT_COOLDOWN_DAYS}. */
  cooldownDays?: number;
  /** Defaults to `new Date()`. Overridable for deterministic tests. */
  now?: Date;
}

/**
 * Return the ordered list of hints currently eligible. The caller picks how
 * many to emit; this function never writes.
 */
export function evaluateHints(opts: EvaluateHintsOptions): Hint[] {
  const cooldownDays = opts.cooldownDays ?? DEFAULT_COOLDOWN_DAYS;
  const now = opts.now ?? new Date();
  const repo = readRepoState(opts.projectRoot);

  const candidates: Hint[] = [];

  if (ruleH001(repo)) candidates.push(HINT_CATALOG.H001);
  if (ruleH002(repo, now)) candidates.push(HINT_CATALOG.H002);
  if (ruleH003(repo)) candidates.push(HINT_CATALOG.H003);
  if (ruleH004(repo)) candidates.push(HINT_CATALOG.H004);

  return candidates.filter((hint) =>
    isEligible(hint, opts.state, cooldownDays, now),
  );
}

/**
 * Test seam: list every hint in the catalog. Useful for `--hints` exhaustive
 * dump and for the docs page. Order matches the priority used in evaluation.
 */
export function listAllHints(): Hint[] {
  return [HINT_CATALOG.H001, HINT_CATALOG.H002, HINT_CATALOG.H003, HINT_CATALOG.H004];
}

// ───────────────────────────────────────────────────────────────────────────
// Hint catalog — bodies are short, end-user prose. The renderer in the CLI
// adds the lightbulb prefix, dim ANSI codes, and the dismiss footer.
// ───────────────────────────────────────────────────────────────────────────

const HINT_CATALOG = {
  H001: {
    id: "H-001-no-dspy",
    severity: "info",
    body:
      "defense-in-depth supports DSPy semantic checks for hollow-artifact " +
      "guard. See docs/dev-guide/dspy-providers.md to enable them.",
    dismissible: true,
  },
  H002: {
    id: "H-002-no-lessons",
    severity: "suggestion",
    body:
      "A guard blocked something recently. Recording an Án Lệ (lesson) helps " +
      "you avoid the same blocker next time. See 'did lesson record --help'.",
    dismissible: true,
  },
  H003: {
    id: "H-003-no-feedback",
    severity: "info",
    body:
      "did feedback labels guard findings as TP/FP/FN/TN. Helps tune precision " +
      "over time. See 'did feedback --help'.",
    dismissible: true,
  },
  H004: {
    id: "H-004-no-federation",
    severity: "info",
    body:
      "Federation links commits to external tickets (Jira/Linear/file). " +
      "See docs/dev-guide/federation.md to wire it in.",
    dismissible: true,
  },
} as const satisfies Record<string, Hint>;

// ───────────────────────────────────────────────────────────────────────────
// Eligibility — cooldown + dismissal filter applied to every candidate.
// ───────────────────────────────────────────────────────────────────────────

function isEligible(
  hint: Hint,
  state: HintState,
  cooldownDays: number,
  now: Date,
): boolean {
  const entry = state.shown[hint.id];
  if (!entry) return true;
  if (entry.dismissedAt !== null) return false;
  if (entry.lastShownAt === null) return true;

  const lastShown = Date.parse(entry.lastShownAt);
  if (Number.isNaN(lastShown)) return true;
  const elapsedMs = now.getTime() - lastShown;
  return elapsedMs >= cooldownDays * 24 * 60 * 60 * 1000;
}

// ───────────────────────────────────────────────────────────────────────────
// Rule predicates — one per hint. Each takes the pre-computed RepoState so
// nothing reads the disk twice per evaluation.
// ───────────────────────────────────────────────────────────────────────────

/** H-001: no DSPy block in config + the repo has accumulated some history. */
function ruleH001(repo: RepoState): boolean {
  if (repo.hasDspyConfig) return false;
  return repo.commitCount >= H001_MIN_COMMITS;
}

/**
 * H-002: lessons.jsonl is empty / missing AND the user actually had a guard
 * block in the last 30 days. We treat any TP/FP feedback event in window as
 * "the guard surfaced a finding" — a TP is a real block, an FP is still a
 * block from the user's POV (the guard fired) and the lesson would help
 * either way.
 */
function ruleH002(repo: RepoState, now: Date): boolean {
  if (repo.lessonsCount >= 1) return false;

  const cutoffMs = now.getTime() - RECENT_BLOCK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentBlock = repo.feedbackEvents.some((event) => {
    if (event.label !== "TP" && event.label !== "FP") return false;
    const ts = Date.parse(event.timestamp);
    return Number.isFinite(ts) && ts >= cutoffMs;
  });
  return recentBlock;
}

/**
 * H-003: feedback corpus is too small to compute a meaningful F1, and the
 * repo has enough commits that we'd expect *some* labels by now.
 */
function ruleH003(repo: RepoState): boolean {
  if (repo.feedbackEvents.length >= H003_LOW_FEEDBACK_LIMIT) return false;
  return repo.commitCount >= H003_MIN_COMMITS;
}

/**
 * H-004: repo looks "documented enough to deserve federation" (CHANGELOG or a
 * docs/ directory exists) AND has more than one contributor AND federation
 * isn't already wired up.
 */
function ruleH004(repo: RepoState): boolean {
  if (repo.hasFederationConfig) return false;
  if (!repo.hasChangelog && !repo.hasDocsDir) return false;
  return repo.contributorCount > 1;
}

// ───────────────────────────────────────────────────────────────────────────
// State gathering — read everything once so rules stay cheap.
// ───────────────────────────────────────────────────────────────────────────

function readRepoState(projectRoot: string): RepoState {
  const config = loadConfig(projectRoot);
  const configFileExists = ["defense.config.yml", "defend.config.yaml", ".defendrc.yml"]
    .some((name) => fs.existsSync(path.join(projectRoot, name)));

  // "DSPy wired" means the user has explicitly opted in via `useDspy: true`
  // on the hollow-artifact guard. The default merged config carries a
  // `dspyEndpoint` regardless, so we cannot rely on endpoint presence — only
  // the explicit boolean toggle proves the surface has been adopted.
  const hasDspyConfig = config.guards.hollowArtifact?.useDspy === true;
  const hasFederationConfig = config.guards.federation !== undefined;

  const lessonsCount = countLessons(projectRoot);
  const feedbackEvents = readFeedbackEventsSafe(projectRoot);
  const commitCount = countCommits(projectRoot);
  const contributorCount = countContributors(projectRoot);
  const hasChangelog = fs.existsSync(path.join(projectRoot, "CHANGELOG.md"));
  const hasDocsDir =
    fs.existsSync(path.join(projectRoot, "docs")) &&
    fs.statSync(path.join(projectRoot, "docs")).isDirectory();

  return {
    config,
    configFileExists,
    hasDspyConfig,
    hasFederationConfig,
    commitCount,
    contributorCount,
    hasChangelog,
    hasDocsDir,
    lessonsCount,
    feedbackEvents,
  };
}

function countLessons(projectRoot: string): number {
  const file = path.join(projectRoot, "lessons.jsonl");
  if (!fs.existsSync(file)) return 0;
  try {
    return fs
      .readFileSync(file, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0).length;
  } catch {
    return 0;
  }
}

function readFeedbackEventsSafe(projectRoot: string): FeedbackEvent[] {
  try {
    return readFeedback(projectRoot);
  } catch {
    return [];
  }
}

/** Count commits on the current HEAD. Returns 0 if the repo isn't initialised. */
function countCommits(projectRoot: string): number {
  try {
    const out = execFileSync("git", ["rev-list", "--count", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const n = Number(out.trim());
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** Count distinct author emails. Returns 0 outside a git repo. */
function countContributors(projectRoot: string): number {
  try {
    const out = execFileSync("git", ["log", "--format=%ae"], {
      cwd: projectRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const set = new Set<string>();
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length > 0) set.add(trimmed);
    }
    return set.size;
  } catch {
    return 0;
  }
}
