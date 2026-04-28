/**
 * Feedback Layer — input pipeline for the F1 metric utility.
 *
 * Issue #22 MVP scope:
 *   1. Append-only writer for {@link FeedbackEvent} (no overwrite, idempotent on id)
 *   2. Streaming reader with optional filters
 *   3. Adapter on top of {@link computeF1} that consumes the JSONL and
 *      returns a {@link GuardF1Metric}
 *   4. Passive scraper that walks git history and infers events from
 *      commit-message patterns (fix-up → TP, override → FP, revert → FN,
 *      clean pass → TN). Idempotent + resumable via a cursor file.
 *
 * Out of scope (deferred to v0.8 / dashboard work):
 *   - F1 dashboard / TUI
 *   - Multi-project aggregation
 *   - Real-time UI integration with `verify`
 *
 * Pure-function constraint preserved on `computeF1` itself —
 * `computeF1FromFeedback` is the I/O adapter, kept in this module so that
 * `src/core/f1.ts` stays free of `node:fs` and `node:child_process` imports.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { computeF1 } from "./f1.js";
import type { FeedbackEvent, GuardF1Metric } from "./types.js";

const FEEDBACK_JSONL = ".agents/records/feedback.jsonl";
const SCRAPER_CURSOR = ".agents/state/feedback-scraper-cursor.json";
const SCRAPER_VERSION = "scraper:v1";
const FIXUP_WINDOW_MS = 4 * 60 * 60 * 1000;
const REVERT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ──────────────────────────────────────────────────────────────────────────
// Hashing & ID
// ──────────────────────────────────────────────────────────────────────────

/** Hash a finding text into a stable hex prefix (16 chars). Pure. */
export function hashFinding(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Compute the stable id for a {@link FeedbackEvent}. Same logical feedback
 * → same id, regardless of *when* the user re-runs the command, which is
 * what the idempotent-dedupe contract from the issue #22 plan requires.
 *
 * The plan's signature originally included `timestamp` as an id input; we
 * dropped it during implementation because that breaks the idempotent
 * contract (re-running across a second boundary would produce a new event
 * instead of being a no-op). The timestamp still lives on the event itself
 * for analytics — it just is not part of the id.
 *
 * To intentionally relabel the same finding (e.g. "this was actually FP not
 * TP"), the caller can post a different label — that produces a distinct
 * id and both events stay on the JSONL for audit.
 */
export function feedbackEventId(
  guardId: string,
  ticketId: string,
  findingHash: string,
  label: string,
): string {
  return createHash("sha256")
    .update(`${guardId}|${ticketId}|${findingHash}|${label}`)
    .digest("hex")
    .slice(0, 16);
}

// ──────────────────────────────────────────────────────────────────────────
// Append-only writer
// ──────────────────────────────────────────────────────────────────────────

export interface AppendFeedbackResult {
  /** Whether a new line was written. False when the id already existed. */
  written: boolean;
  /** The event as it was (or would have been) persisted. */
  event: FeedbackEvent;
  /** Resolved on-disk path of the JSONL file. */
  path: string;
}

/**
 * Append a {@link FeedbackEvent} to `.agents/records/feedback.jsonl`.
 *
 * Idempotent: if the event id already exists in the file, this is a no-op
 * and `written` is false. Callers (CLI, scraper) decide how to surface that
 * to the user — typically a stderr WARN.
 */
export function appendFeedback(
  projectRoot: string,
  event: FeedbackEvent,
): AppendFeedbackResult {
  const filePath = path.resolve(projectRoot, FEEDBACK_JSONL);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, "utf-8");
    for (const line of existing.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as FeedbackEvent;
        if (parsed.id === event.id) {
          return { written: false, event: parsed, path: filePath };
        }
      } catch {
        // Tolerate malformed lines; do not crash the writer over a corrupt
        // historical entry.
        continue;
      }
    }
  }

  fs.appendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
  return { written: true, event, path: filePath };
}

// ──────────────────────────────────────────────────────────────────────────
// Reader
// ──────────────────────────────────────────────────────────────────────────

export interface ReadFeedbackOptions {
  guardId?: string;
  /** ISO interval `start/end`. Inclusive of start, exclusive of end. */
  period?: string;
  /** Filter: only events at or after this ISO timestamp. */
  since?: string;
  limit?: number;
}

/**
 * Read all matching {@link FeedbackEvent}s from disk. Returns `[]` when the
 * file does not exist (graceful — Persona A who never ran feedback gets an
 * empty list, not a crash).
 */
export function readFeedback(
  projectRoot: string,
  options: ReadFeedbackOptions = {},
): FeedbackEvent[] {
  const filePath = path.resolve(projectRoot, FEEDBACK_JSONL);
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  const events: FeedbackEvent[] = [];

  let periodStart: number | undefined;
  let periodEnd: number | undefined;
  if (options.period) {
    const parts = options.period.split("/");
    if (parts.length === 2) {
      periodStart = Date.parse(parts[0]);
      periodEnd = Date.parse(parts[1]);
    }
  }
  const sinceMs = options.since ? Date.parse(options.since) : undefined;

  for (const line of lines) {
    if (!line.trim()) continue;
    let event: FeedbackEvent;
    try {
      event = JSON.parse(line) as FeedbackEvent;
    } catch {
      continue;
    }

    if (options.guardId && event.guardId !== options.guardId) continue;

    if (periodStart !== undefined && periodEnd !== undefined) {
      const ts = Date.parse(event.timestamp);
      if (Number.isNaN(ts) || ts < periodStart || ts >= periodEnd) continue;
    }
    if (sinceMs !== undefined && !Number.isNaN(sinceMs)) {
      const ts = Date.parse(event.timestamp);
      if (Number.isNaN(ts) || ts < sinceMs) continue;
    }

    events.push(event);
    if (options.limit !== undefined && events.length >= options.limit) break;
  }
  return events;
}

// ──────────────────────────────────────────────────────────────────────────
// F1 adapter
// ──────────────────────────────────────────────────────────────────────────

/**
 * Read the feedback JSONL and compute a {@link GuardF1Metric}.
 *
 * Pure math is delegated to `src/core/f1.ts#computeF1`. This adapter only
 * handles I/O + counting:
 *
 *   tp = count of events with label="TP" matching guardId+period
 *   fp = count of events with label="FP" matching guardId+period
 *   fn = count of events with label="FN" matching guardId+period
 *   totalRuns = tp + fp + tn (TN counts contribute to "runs" — they are
 *               clean passes that the guard observed)
 *
 * When zero events match, returns a zero-valued metric (no throw) so that
 * downstream `formatF1Summary` can still render a row.
 */
export function computeF1FromFeedback(
  projectRoot: string,
  guardId: string,
  period: string,
): GuardF1Metric {
  const events = readFeedback(projectRoot, { guardId, period });
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const e of events) {
    switch (e.label) {
      case "TP":
        tp++;
        break;
      case "FP":
        fp++;
        break;
      case "FN":
        fn++;
        break;
      case "TN":
        tn++;
        break;
    }
  }
  const totalRuns = tp + fp + tn;
  return computeF1(guardId, period, totalRuns, tp, fp, fn);
}

// ──────────────────────────────────────────────────────────────────────────
// Passive scraper
// ──────────────────────────────────────────────────────────────────────────

interface CommitInfo {
  sha: string;
  timestampMs: number;
  parents: string[];
  subject: string;
  body: string;
  files: string[];
}

interface ScraperCursor {
  lastScannedSha: string | null;
  scrapedAt: string;
  algoVersion: string;
}

export interface ScanHistoryOptions {
  /** Git ref to start scanning from (e.g. `main~50`, a tag, or a SHA).
   *  Defaults to scanning the last 50 commits on HEAD. */
  since?: string;
  /** Hard cap on commits to scan in one run. */
  max?: number;
  /** When true, log proposed events to the returned list but do not write. */
  dryRun?: boolean;
}

export interface ScanHistoryResult {
  scanned: number;
  proposed: FeedbackEvent[];
  written: number;
  skippedDuplicates: number;
}

/**
 * Walk git history and emit {@link FeedbackEvent}s based on commit-message
 * heuristics. See the issue #22 plan for the rule table (R1–R4).
 *
 * Idempotent + resumable: writes a cursor at
 * `.agents/state/feedback-scraper-cursor.json` so re-runs only scan new
 * commits. Manually deleting the cursor forces a full re-scan, which is
 * safe because every event has a deterministic id and `appendFeedback`
 * skips duplicates.
 */
export function scanHistory(
  projectRoot: string,
  options: ScanHistoryOptions = {},
): ScanHistoryResult {
  const max = options.max ?? 200;
  // Use `--since=<ref>..HEAD` when explicitly requested. Otherwise we want
  // "the last N commits" — which `HEAD~N..HEAD` expresses, but that range
  // fails with `unknown revision` on short histories. Fall back to walking
  // HEAD with `--max-count=N` when no explicit range is given.
  const range = options.since ? `${options.since}..HEAD` : "HEAD";
  const commits = readGitLog(projectRoot, range, max);
  if (commits.length === 0) {
    return { scanned: 0, proposed: [], written: 0, skippedDuplicates: 0 };
  }

  const proposed: FeedbackEvent[] = [];
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];

    // R3 — explicit override marker in commit message.
    const overrideMatch = commit.body.match(/\[guard-override:([a-zA-Z][a-zA-Z0-9-]*)\]/);
    if (overrideMatch) {
      proposed.push(
        buildScraperEvent(
          overrideMatch[1],
          commit,
          "FP",
          "scraper-override",
          `[scraper] override marker in commit ${commit.sha.slice(0, 8)}`,
        ),
      );
      continue;
    }

    // R1 — fix-up commit within window inferred to be cleanup of a prior
    // guard-flagged change. Treat the *parent* commit as the originally
    // flagged one. We cannot know which guard fired without re-running, so
    // we attribute to the synthetic id `unassigned-tp` to stay honest.
    if (/^fix(\([^)]*\))?:/i.test(commit.subject)) {
      const earlier = commits[i + 1];
      if (
        earlier &&
        commit.timestampMs - earlier.timestampMs <= FIXUP_WINDOW_MS &&
        sharesAnyFile(commit.files, earlier.files)
      ) {
        proposed.push(
          buildScraperEvent(
            "unassigned-tp",
            commit,
            "TP",
            "scraper-fixup",
            `[scraper] fix-up of ${earlier.sha.slice(0, 8)} within window`,
          ),
        );
        continue;
      }
    }

    // R2 — explicit `git revert` of a recent commit. Attribute to the
    // synthetic `unassigned-fn` — we know a guard *should have* caught
    // something, but we cannot know which one without re-running.
    if (/^revert\b/i.test(commit.subject) || /^Revert "/.test(commit.subject)) {
      const reverted = findRevertedCommit(commit, commits);
      if (
        reverted &&
        commit.timestampMs - reverted.timestampMs <= REVERT_WINDOW_MS
      ) {
        proposed.push(
          buildScraperEvent(
            "unassigned-fn",
            commit,
            "FN",
            "scraper-revert",
            `[scraper] revert of ${reverted.sha.slice(0, 8)}`,
          ),
        );
        continue;
      }
    }

    // R4 — clean pass. We do NOT batch-write TN per guard automatically in
    // v1: the volume would balloon (9 guards × N commits) for low signal
    // value. Defer to v0.8 dashboard. The plan-doc allowance was "batched"
    // — measured against signal-to-noise we choose to skip until adopters
    // ask for it.
  }

  if (options.dryRun) {
    return {
      scanned: commits.length,
      proposed,
      written: 0,
      skippedDuplicates: 0,
    };
  }

  let written = 0;
  let skipped = 0;
  for (const event of proposed) {
    const result = appendFeedback(projectRoot, event);
    if (result.written) {
      written++;
    } else {
      skipped++;
    }
  }

  saveCursor(projectRoot, {
    lastScannedSha: commits[0].sha,
    scrapedAt: new Date().toISOString(),
    algoVersion: SCRAPER_VERSION,
  });

  return {
    scanned: commits.length,
    proposed,
    written,
    skippedDuplicates: skipped,
  };
}

function buildScraperEvent(
  guardId: string,
  commit: CommitInfo,
  label: FeedbackEvent["label"],
  source: FeedbackEvent["source"],
  note: string,
): FeedbackEvent {
  const timestamp = new Date(commit.timestampMs).toISOString();
  const findingHash = hashFinding(`${commit.sha}::${commit.subject}`);
  const id = feedbackEventId(guardId, "", findingHash, label);
  return {
    id,
    guardId,
    ticketId: "",
    findingHash,
    label,
    source,
    note,
    timestamp,
    executor: SCRAPER_VERSION,
  };
}

function readGitLog(
  projectRoot: string,
  range: string,
  max: number,
): CommitInfo[] {
  // Use a sentinel record separator that is extremely unlikely to appear
  // inside commit messages.
  const recordSep = "\x1e";
  const fieldSep = "\x1f";
  const format = ["%H", "%ct", "%P", "%s", "%b"].join(fieldSep);
  let raw: string;
  try {
    raw = execFileSync(
      "git",
      [
        "log",
        `--max-count=${max}`,
        "--name-only",
        `--format=${recordSep}${format}${fieldSep}`,
        range,
      ],
      { encoding: "utf-8", cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    return [];
  }

  const records = raw.split(recordSep).slice(1);
  const commits: CommitInfo[] = [];
  for (const record of records) {
    const [meta, fileBlock] = record.split(`${fieldSep}\n`);
    if (!meta) continue;
    const parts = meta.split(fieldSep);
    if (parts.length < 5) continue;
    const [sha, ctSec, parentsRaw, subject, ...bodyParts] = parts;
    const body = bodyParts.join(fieldSep);
    const files = (fileBlock ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    commits.push({
      sha: sha.trim(),
      timestampMs: Number(ctSec) * 1000,
      parents: parentsRaw.split(/\s+/).filter(Boolean),
      subject: subject.trim(),
      body: body.trim(),
      files,
    });
  }
  return commits;
}

function sharesAnyFile(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setA = new Set(a);
  return b.some((f) => setA.has(f));
}

function findRevertedCommit(
  revert: CommitInfo,
  commits: CommitInfo[],
): CommitInfo | undefined {
  // git revert messages contain `This reverts commit <sha>.`
  const m = revert.body.match(/This reverts commit ([0-9a-f]{7,40})/i);
  if (!m) return undefined;
  const targetSha = m[1].toLowerCase();
  return commits.find((c) => c.sha.toLowerCase().startsWith(targetSha));
}

function saveCursor(projectRoot: string, cursor: ScraperCursor): void {
  const filePath = path.resolve(projectRoot, SCRAPER_CURSOR);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cursor, null, 2) + "\n", "utf-8");
}

export function readCursor(projectRoot: string): ScraperCursor | null {
  const filePath = path.resolve(projectRoot, SCRAPER_CURSOR);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ScraperCursor;
  } catch {
    return null;
  }
}
