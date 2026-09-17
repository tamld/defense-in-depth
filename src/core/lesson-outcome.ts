/**
 * Lesson Outcome Layer — meta-memory pipeline (issue #23 MVP).
 *
 * Two append-only JSONL stores parallel to feedback.jsonl:
 *   `.agents/records/lesson-recalls.jsonl`   — written eagerly at search time
 *   `.agents/records/lesson-outcomes.jsonl`  — written lazily by scanner / cli
 *
 * Producer/consumer split is intentional: a recall is observable at search
 * time (cheap, atomic), but whether the recall was *helpful* is only
 * knowable AFTER the user finishes the work. Two files = clean join on
 * `recallId` for the v0.8 RecallMetric aggregator.
 *
 * Idempotency contract (apply án lệ L-2026-04-29 from PR #26):
 *   id = sha256(<stable inputs without timestamp>) — re-running the same
 *   logical operation is a no-op. Timestamps live on the event for
 *   analytics, never in the id.
 *
 * Out of scope (deferred to v0.8):
 *   - RecallMetric aggregation (precision / coverageGap)
 *   - Dashboard / TUI
 *   - Auto-cron / background scanner
 *   - Multi-project aggregation
 *
 * Pure-function constraint: `evaluateRecallAgainstCommits` is pure (no I/O);
 * I/O lives in `scanOutcomes` and the writers.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as path from "node:path";
import { callDspy, DEFAULT_DSPY_ENDPOINT, DEFAULT_DSPY_TIMEOUT_MS } from "./dspy-client.js";
import {
  createJsonlStore,
  getOptionalString,
  getString,
  isObjectWithId,
  isStringEnum,
  type JsonlSchema,
  type JsonlStore,
} from "./jsonl-store.js";
import type { LessonOutcome, RecallEvent } from "./types.js";

const RECALLS_JSONL = ".agents/records/lesson-recalls.jsonl";
const OUTCOMES_JSONL = ".agents/records/lesson-outcomes.jsonl";
const SCANNER_VERSION = "scanner:v1";
/** Default 1-hour dedupe window for `recordRecall` (Q3 default in plan). */
export const RECALL_DEDUPE_WINDOW_MS = 60 * 60 * 1000;
/** How far back the scanner looks for diffs after a recall (default 30d). */
const SCAN_LOOKAHEAD_MS = 30 * 24 * 60 * 60 * 1000;

// JSONL schemas for recalls + outcomes (issue #43).
const RECALL_MATCH_METHODS = ["string", "semantic"] as const;
const RECALL_SOURCES = ["search", "cli-explicit"] as const;
const OUTCOME_SOURCES = ["cli-explicit", "scanner-pattern-match", "scanner-no-match"] as const;

const recallSchema: JsonlSchema<RecallEvent> = {
  validate(raw: unknown): RecallEvent | null {
    if (!isObjectWithId(raw)) return null;
    const lessonId = getString(raw, "lessonId");
    const ticketId = getString(raw, "ticketId");
    const queryHash = getString(raw, "queryHash");
    const matchMethod = isStringEnum(raw, "matchMethod", RECALL_MATCH_METHODS);
    const source = isStringEnum(raw, "source", RECALL_SOURCES);
    const timestamp = getString(raw, "timestamp");
    const executor = getString(raw, "executor");
    if (
      lessonId === null ||
      ticketId === null ||
      queryHash === null ||
      matchMethod === null ||
      source === null ||
      timestamp === null ||
      executor === null
    )
      return null;
    return {
      id: raw.id as string,
      lessonId,
      ticketId,
      queryHash,
      matchMethod,
      source,
      timestamp,
      executor,
    };
  },
  idOf: (e) => e.id,
  timestampOf: (e) => e.timestamp,
};

const outcomeSchema: JsonlSchema<LessonOutcome> = {
  validate(raw: unknown): LessonOutcome | null {
    if (!isObjectWithId(raw)) return null;
    const recallId = getString(raw, "recallId");
    const lessonId = getString(raw, "lessonId");
    const source = isStringEnum(raw, "source", OUTCOME_SOURCES);
    const timestamp = getString(raw, "timestamp");
    const executor = getString(raw, "executor");
    const matchedPattern = getOptionalString(raw, "matchedPattern");
    const note = getOptionalString(raw, "note");
    if (
      recallId === null ||
      lessonId === null ||
      source === null ||
      timestamp === null ||
      executor === null ||
      matchedPattern === null ||
      note === null
    )
      return null;
    // `helpful: boolean | null` — must be one of the three; absent is invalid.
    const r = raw as Record<string, unknown>;
    if (!("helpful" in r)) return null;
    const helpful = r.helpful;
    if (helpful !== true && helpful !== false && helpful !== null) return null;
    const event: LessonOutcome = {
      id: raw.id as string,
      recallId,
      lessonId,
      helpful,
      source,
      timestamp,
      executor,
    };
    if (matchedPattern !== undefined) event.matchedPattern = matchedPattern;
    if (note !== undefined) event.note = note;
    return event;
  },
  idOf: (e) => e.id,
  timestampOf: (e) => e.timestamp,
};

function getRecallStore(projectRoot: string): JsonlStore<RecallEvent> {
  return createJsonlStore<RecallEvent>(path.resolve(projectRoot, RECALLS_JSONL), recallSchema);
}

function getOutcomeStore(projectRoot: string): JsonlStore<LessonOutcome> {
  return createJsonlStore<LessonOutcome>(path.resolve(projectRoot, OUTCOMES_JSONL), outcomeSchema);
}

// ──────────────────────────────────────────────────────────────────────────
// Hashing & ID
// ──────────────────────────────────────────────────────────────────────────

/** Hex-prefix sha256 of an arbitrary string (16 chars). Pure. */
export function hashQuery(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/**
 * Compute the stable id for a {@link RecallEvent}. Same logical recall →
 * same id, regardless of *when* the search re-fires. See PR #26's
 * `feedbackEventId` for the precedent: timestamp in the id breaks the
 * idempotent contract across second boundaries.
 */
export function recallEventId(
  lessonId: string,
  ticketId: string,
  queryHash: string,
  matchMethod: RecallEvent["matchMethod"],
): string {
  return createHash("sha256")
    .update(`${lessonId}|${ticketId}|${queryHash}|${matchMethod}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Compute the stable id for a {@link LessonOutcome}. One outcome per
 * (recall, label) — re-running explicit cli with the same label is a
 * no-op; intentionally relabeling helpful → not-helpful (or vice-versa)
 * produces a distinct id and both events stay on the JSONL for audit.
 */
export function outcomeEventId(recallId: string, label: string): string {
  return createHash("sha256").update(`${recallId}|${label}`).digest("hex").slice(0, 16);
}

// ──────────────────────────────────────────────────────────────────────────
// Append-only writers
// ──────────────────────────────────────────────────────────────────────────

export interface AppendRecallResult {
  /** True if a new line was written; false on idempotent no-op (id existed
   *  OR a recent equivalent recall fell inside the dedupe window). */
  written: boolean;
  event: RecallEvent;
  path: string;
  /** Set when `written=false` and the no-op was caused by a window dedupe
   *  (not an exact-id match). Useful for callers that want to surface a
   *  different stderr message. */
  windowDeduped?: boolean;
}

export interface AppendOutcomeResult {
  written: boolean;
  event: LessonOutcome;
  path: string;
}

export interface AppendRecallOptions {
  /** Override the dedupe window (defaults to {@link RECALL_DEDUPE_WINDOW_MS}). */
  dedupeWindowMs?: number;
}

/**
 * Append a {@link RecallEvent} to `.agents/records/lesson-recalls.jsonl`.
 *
 * Two-layer dedupe:
 *   1. Exact-id match → no-op (id excludes timestamp, so re-search of the
 *      same `(lesson, ticket, query, matchMethod)` collapses).
 *   2. Time-window match → no-op for events with the same `(lessonId,
 *      ticketId, queryHash, matchMethod)` whose timestamp falls inside the
 *      dedupe window. This catches the rare case where two callers compute
 *      the id slightly differently (e.g. version bump) but the recall is
 *      still logically the same.
 */
export function appendRecall(
  projectRoot: string,
  event: RecallEvent,
  options: AppendRecallOptions = {},
): AppendRecallResult {
  const windowMs = options.dedupeWindowMs ?? RECALL_DEDUPE_WINDOW_MS;
  const result = getRecallStore(projectRoot).appendWithWindow(event, {
    windowMs,
    windowKeyOf: (e) => `${e.lessonId}|${e.ticketId}|${e.queryHash}|${e.matchMethod}`,
  });
  const out: AppendRecallResult = {
    written: result.written,
    event: result.event,
    path: result.path,
  };
  if (result.windowDeduped) out.windowDeduped = true;
  return out;
}

/**
 * Append a {@link LessonOutcome} to `.agents/records/lesson-outcomes.jsonl`.
 *
 * Idempotent on `id`. Same `(recallId, label)` → no-op.
 */
export function appendOutcome(projectRoot: string, event: LessonOutcome): AppendOutcomeResult {
  const result = getOutcomeStore(projectRoot).append(event);
  return { written: result.written, event: result.event, path: result.path };
}

// ──────────────────────────────────────────────────────────────────────────
// Readers
// ──────────────────────────────────────────────────────────────────────────

export interface ReadRecallsOptions {
  lessonId?: string;
  ticketId?: string;
  /** Filter: only events at or after this ISO timestamp. */
  since?: string;
  limit?: number;
}

export function readRecalls(projectRoot: string, options: ReadRecallsOptions = {}): RecallEvent[] {
  return getRecallStore(projectRoot).read({
    since: options.since,
    limit: options.limit,
    filter: (event) => {
      if (options.lessonId && event.lessonId !== options.lessonId) return false;
      if (options.ticketId && event.ticketId !== options.ticketId) return false;
      return true;
    },
  });
}

export interface ReadOutcomesOptions {
  recallId?: string;
  lessonId?: string;
  limit?: number;
}

export function readOutcomes(
  projectRoot: string,
  options: ReadOutcomesOptions = {},
): LessonOutcome[] {
  return getOutcomeStore(projectRoot).read({
    limit: options.limit,
    filter: (event) => {
      if (options.recallId && event.recallId !== options.recallId) return false;
      if (options.lessonId && event.lessonId !== options.lessonId) return false;
      return true;
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────
// recordRecall — the hot-path adapter called from searchLessons()
// ──────────────────────────────────────────────────────────────────────────

export interface RecordRecallInput {
  lessonId: string;
  ticketId?: string;
  query: string;
  matchMethod: RecallEvent["matchMethod"];
  source?: RecallEvent["source"];
  executor?: string;
  /** Override "now" for deterministic tests. */
  now?: Date;
}

/**
 * Build a {@link RecallEvent} and append it. Returns the result without
 * throwing — callers (search hot-path) want fire-and-forget semantics so a
 * disk hiccup never breaks search itself.
 */
export function recordRecall(
  projectRoot: string,
  input: RecordRecallInput,
  options: AppendRecallOptions = {},
): AppendRecallResult {
  const ticketId = input.ticketId ?? "";
  const queryHash = hashQuery(input.query);
  const id = recallEventId(input.lessonId, ticketId, queryHash, input.matchMethod);
  const now = input.now ?? new Date();
  const event: RecallEvent = {
    id,
    lessonId: input.lessonId,
    ticketId,
    queryHash,
    matchMethod: input.matchMethod,
    source: input.source ?? "search",
    timestamp: now.toISOString(),
    executor: input.executor ?? "human",
  };
  return appendRecall(projectRoot, event, options);
}

// ──────────────────────────────────────────────────────────────────────────
// Pure evaluation — pattern-match a recall against a set of commit diffs
// ──────────────────────────────────────────────────────────────────────────

export interface CommitDiff {
  sha: string;
  timestampMs: number;
  diff: string;
}

export interface EvaluateRecallInput {
  recall: RecallEvent;
  /** The lesson that was recalled — only `wrongApproachPattern` is read. */
  lesson: { wrongApproachPattern?: string };
  /** Commit diffs in the relevant time window. */
  commits: CommitDiff[];
}

export interface EvaluateRecallResult {
  helpful: boolean | null;
  source: LessonOutcome["source"];
  matchedPattern?: string;
}

/**
 * Decide whether a recall was helpful. Pure: takes already-fetched commits
 * and a lesson, returns a verdict. I/O lives in {@link scanOutcomes}.
 *
 * Decision tree (matches the plan's Q3 default):
 *   1. lesson has `wrongApproachPattern`?
 *        match found in any commit diff → helpful=false (recall failed —
 *          user did the wrong thing anyway), source="scanner-pattern-match"
 *        no match                       → helpful=true,
 *          source="scanner-no-match"
 *   2. no pattern → helpful=null, source="scanner-no-match" (we don't
 *      pretend to know).
 */
export function evaluateRecallAgainstCommits(input: EvaluateRecallInput): EvaluateRecallResult {
  const pattern = input.lesson.wrongApproachPattern?.trim();
  if (!pattern) {
    return { helpful: null, source: "scanner-no-match" };
  }
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "im");
  } catch {
    // Invalid user-supplied regex — fall back to literal substring.
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    regex = new RegExp(escaped, "im");
  }
  for (const commit of input.commits) {
    if (regex.test(commit.diff)) {
      return {
        helpful: false,
        source: "scanner-pattern-match",
        matchedPattern: pattern,
      };
    }
  }
  return { helpful: true, source: "scanner-no-match" };
}

// ──────────────────────────────────────────────────────────────────────────
// scanOutcomes — passive evaluator that walks git history
// ──────────────────────────────────────────────────────────────────────────

export interface ScanOutcomesOptions {
  /** Git ref to start scanning from (default: HEAD). */
  since?: string;
  /** Hard cap on commits to read per scan. */
  max?: number;
  /** Don't write any outcomes — return what would be written. */
  dryRun?: boolean;
  /** Maximum recall age to consider (defaults to 30 days). */
  lookbackMs?: number;
  /** Optional DSPy config to enable fuzzy match for lessons without
   *  wrongApproachPattern. When opt-in but the service is unavailable,
   *  emits the silent-degradation WARN per án lệ L-2026-04-29. */
  dspy?: { enabled: boolean; endpoint?: string; timeoutMs?: number };
  /** Override "now" for deterministic tests. */
  now?: Date;
}

export interface ScanOutcomesResult {
  scanned: number;
  proposed: LessonOutcome[];
  written: number;
  skippedDuplicates: number;
  /** True when DSPy was opted-in but unavailable — the user-facing WARN
   *  was emitted. Surfaced for tests. */
  dspyDegraded?: boolean;
}

interface LessonRow {
  id: string;
  wrongApproachPattern?: string;
  /** Persona A fallback — text that DSPy can fuzzy-match against diffs. */
  wrongApproach?: string;
}

/**
 * Walk recall events and write outcomes for any that have not been
 * evaluated yet. Idempotent: re-running is a no-op once each (recall,label)
 * pair has been recorded.
 *
 * Async because the optional DSPy fuzzy-match path goes over HTTP. The
 * git-plumbing and JSONL I/O remain sync (mirror of `feedback.ts`).
 */
export async function scanOutcomes(
  projectRoot: string,
  lessons: LessonRow[],
  options: ScanOutcomesOptions = {},
): Promise<ScanOutcomesResult> {
  const now = options.now ?? new Date();
  const lookback = options.lookbackMs ?? SCAN_LOOKAHEAD_MS;
  const recalls = readRecalls(projectRoot);
  const existingOutcomes = readOutcomes(projectRoot);
  const evaluated = new Set(existingOutcomes.map((o) => o.recallId));

  const lessonById = new Map<string, LessonRow>();
  for (const l of lessons) lessonById.set(l.id, l);

  const max = options.max ?? 200;
  const range = options.since ? `${options.since}..HEAD` : "HEAD";
  const commits = readGitDiffs(projectRoot, range, max);

  const proposed: LessonOutcome[] = [];
  let dspyDegraded = false;
  let dspyAvailable = options.dspy?.enabled ?? false;

  for (const recall of recalls) {
    if (evaluated.has(recall.id)) continue;
    const recallTs = Date.parse(recall.timestamp);
    if (Number.isNaN(recallTs)) continue;
    if (now.getTime() - recallTs > lookback) continue;

    const windowEnd = recallTs + lookback;
    const inWindow = commits.filter((c) => c.timestampMs >= recallTs && c.timestampMs <= windowEnd);

    const lesson = lessonById.get(recall.lessonId) ?? {
      id: recall.lessonId,
    };

    let verdict: EvaluateRecallResult;
    if (lesson.wrongApproachPattern) {
      verdict = evaluateRecallAgainstCommits({
        recall,
        lesson,
        commits: inWindow,
      });
    } else if (options.dspy?.enabled && dspyAvailable && lesson.wrongApproach) {
      const fuzzy = await fuzzyMatch(lesson.wrongApproach, inWindow, options.dspy);
      if (fuzzy === "unavailable") {
        // án lệ L-2026-04-29 — opt-in tier-1 feature degraded → must signal.
        if (!dspyDegraded) {
          process.stderr.write(
            "⚠  [scan-outcomes] DSPy fuzzy match unavailable: lessons " +
              "without wrongApproachPattern recorded as helpful=null. " +
              "Results reflect explicit-pattern lessons only.\n",
          );
          dspyDegraded = true;
          dspyAvailable = false;
        }
        verdict = { helpful: null, source: "scanner-no-match" };
      } else if (fuzzy.matched) {
        verdict = {
          helpful: false,
          source: "scanner-pattern-match",
          matchedPattern: `dspy:${fuzzy.score.toFixed(2)}`,
        };
      } else {
        verdict = { helpful: true, source: "scanner-no-match" };
      }
    } else {
      verdict = { helpful: null, source: "scanner-no-match" };
    }

    const label = verdict.helpful === null ? "null" : String(verdict.helpful);
    const id = outcomeEventId(recall.id, label);
    const outcome: LessonOutcome = {
      id,
      recallId: recall.id,
      lessonId: recall.lessonId,
      helpful: verdict.helpful,
      source: verdict.source,
      timestamp: now.toISOString(),
      executor: SCANNER_VERSION,
    };
    if (verdict.matchedPattern) outcome.matchedPattern = verdict.matchedPattern;
    proposed.push(outcome);
  }

  if (options.dryRun) {
    return {
      scanned: recalls.length,
      proposed,
      written: 0,
      skippedDuplicates: 0,
      ...(dspyDegraded ? { dspyDegraded: true } : {}),
    };
  }

  let written = 0;
  let skipped = 0;
  for (const outcome of proposed) {
    const result = appendOutcome(projectRoot, outcome);
    if (result.written) written++;
    else skipped++;
  }

  return {
    scanned: recalls.length,
    proposed,
    written,
    skippedDuplicates: skipped,
    ...(dspyDegraded ? { dspyDegraded: true } : {}),
  };
}

/**
 * Ask DSPy whether the concatenated commit diffs semantically match the
 * `wrongApproach` text. Returns `"unavailable"` on transport / 5xx /
 * timeout (so the caller can emit the silent-degradation WARN per án lệ
 * L-2026-04-29) or `{ matched, score }` on success.
 *
 * Threshold 0.7 mirrors the lesson-quality gate's "strong-similarity"
 * cutoff in `recordLesson`.
 */
async function fuzzyMatch(
  wrongApproach: string,
  commits: CommitDiff[],
  dspy: { enabled: boolean; endpoint?: string; timeoutMs?: number },
): Promise<"unavailable" | { matched: boolean; score: number }> {
  if (commits.length === 0) {
    return { matched: false, score: 0 };
  }
  const combined = commits.map((c) => c.diff).join("\n---\n");
  const result = await callDspy(
    {
      type: "recall",
      id: hashQuery(wrongApproach),
      content: combined,
      context: wrongApproach,
    },
    dspy.endpoint ?? DEFAULT_DSPY_ENDPOINT,
    dspy.timeoutMs ?? DEFAULT_DSPY_TIMEOUT_MS,
  );
  if (!result) return "unavailable";
  return { matched: result.score >= 0.7, score: result.score };
}

// ──────────────────────────────────────────────────────────────────────────
// Git plumbing — read commit diffs in a range
// ──────────────────────────────────────────────────────────────────────────

function readGitDiffs(projectRoot: string, range: string, max: number): CommitDiff[] {
  const recordSep = "\x1e";
  const fieldSep = "\x1f";
  const format = ["%H", "%ct"].join(fieldSep);
  let raw: string;
  try {
    raw = execFileSync(
      "git",
      ["log", `--max-count=${max}`, `--format=${recordSep}${format}`, "-p", range],
      {
        cwd: projectRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    return [];
  }

  const records = raw.split(recordSep).slice(1);
  const commits: CommitDiff[] = [];
  for (const record of records) {
    const newlineIdx = record.indexOf("\n");
    if (newlineIdx === -1) continue;
    const meta = record.slice(0, newlineIdx);
    const diff = record.slice(newlineIdx + 1);
    const parts = meta.split(fieldSep);
    if (parts.length < 2) continue;
    const [sha, ctSec] = parts;
    commits.push({
      sha: sha.trim(),
      timestampMs: Number(ctSec) * 1000,
      diff,
    });
  }
  return commits;
}
