import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { Lesson, GrowthMetric } from "./types.js";
import { callDspy, callDspyRank, DEFAULT_DSPY_ENDPOINT, DEFAULT_DSPY_TIMEOUT_MS } from "./dspy-client.js";
import { recordRecall } from "./lesson-outcome.js";

/**
 * Handles operations related to Layer 1 (Memory): lesson recording and growth metrics.
 *
 * v0.5.1: DSPy-powered lesson quality gate — rejects generic lessons
 * v0.5.2: DSPy-powered semantic search — replaces String.includes()
 */

// We assume these files live at the project root where defense-in-depth is executed
const LESSONS_FILE = "lessons.jsonl";
const GROWTH_METRICS_FILE = "growth_metrics.jsonl";

/** Options for DSPy-powered memory operations */
export interface MemoryDspyOptions {
  /** Enable DSPy for this operation (default: false) */
  enabled: boolean;
  /** DSPy HTTP endpoint */
  endpoint?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

/** Options for {@link searchLessons} that govern recall-event capture
 *  (issue #23). Defaults preserve backward compatibility — callers that
 *  pass nothing still get a recall event written with `executor="human"`. */
export interface SearchLessonsOptions {
  /** TKID to attribute the recall event to. Empty string allowed
   *  (Persona A on a standalone repo). */
  ticketId?: string;
  /** Executor label for the recall event. Defaults to `"human"`. */
  executor?: string;
  /** Disable recall-event capture entirely. Use when the caller is the
   *  scanner re-walking history (would create circular events). */
  captureRecall?: boolean;
}

/** Result of a lesson recording, including optional quality evaluation */
export interface RecordLessonResult {
  lesson: Lesson;
  /** Quality score from DSPy (null if DSPy disabled or unavailable) */
  qualityScore: number | null;
  /** Quality feedback from DSPy (null if DSPy disabled or unavailable) */
  qualityFeedback: string | null;
  /** Whether the lesson was persisted (false if quality gate rejected it) */
  persisted: boolean;
}

/** Search result with optional relevance score */
export interface LessonSearchResult {
  lesson: Lesson;
  /** Relevance score from DSPy semantic ranking (null if string-match mode) */
  relevanceScore: number | null;
  /** How the match was found */
  matchMethod: "string" | "semantic";
}

/**
 * Ensures the target file exists, creating it if necessary.
 * 
 * @param filepath - The absolute path of the target file to verify or create
 */
async function ensureFileExists(filepath: string): Promise<void> {
  try {
    await fs.access(filepath);
  } catch {
    // File does not exist, create it inside an empty block or just touch it
    await fs.writeFile(filepath, "", "utf-8");
  }
}

/**
 * Appends a JSON string followed by a newline to a file.
 * 
 * @param filepath - The absolute path of the target file
 * @param data - The JSON object to append
 */
async function appendJsonl(filepath: string, data: any): Promise<void> {
  await ensureFileExists(filepath);
  const line = JSON.stringify(data) + "\n";
  await fs.appendFile(filepath, line, "utf-8");
}

/**
 * Reads all lessons from the JSONL file.
 * 
 * @param projectRoot - Directory where the lessons.jsonl file resides
 * @returns Array of Lesson objects read from the file
 */
async function readAllLessons(projectRoot: string): Promise<Lesson[]> {
  const targetPath = path.join(projectRoot, LESSONS_FILE);
  try {
    const content = await fs.readFile(targetPath, "utf-8");
    const lines = content.split("\n").filter(line => line.trim().length > 0);
    return lines.map(line => JSON.parse(line));
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * Records a new lesson into the system.
 *
 * When `dspy.enabled` is true, the lesson is first evaluated for quality.
 * Generic lessons (score < 0.5) are REJECTED with feedback explaining why.
 *
 * Quality criteria evaluated by DSPy:
 *   - Specificity: Does it describe a concrete scenario, not a platitude?
 *   - Actionability: Can an agent act on the insight in a future task?
 *   - Recall-worthiness: Would this lesson be useful when recalled?
 *
 * @param fragment The lesson data excluding auto-generated id and createdAt
 * @param projectRoot The root directory where lessons.jsonl should be saved
 * @param dspy Optional DSPy configuration for quality gate
 * @returns RecordLessonResult with quality info and persistence status
 */
export async function recordLesson(
  fragment: Omit<Lesson, "id" | "createdAt">,
  projectRoot: string = process.cwd(),
  dspy?: MemoryDspyOptions,
): Promise<RecordLessonResult> {
  const lesson: Lesson = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: fragment.title,
    scenario: fragment.scenario,
    wrongApproach: fragment.wrongApproach,
    correctApproach: fragment.correctApproach,
    insight: fragment.insight,
    category: fragment.category,
    evidence: fragment.evidence,
    confidence: fragment.confidence,
  };
  
  if (fragment.searchTerms) lesson.searchTerms = [...fragment.searchTerms];
  if (fragment.tags) lesson.tags = [...fragment.tags];
  if (fragment.relatedLessons) lesson.relatedLessons = [...fragment.relatedLessons];

  // v0.5.1: DSPy Quality Gate
  let qualityScore: number | null = null;
  let qualityFeedback: string | null = null;

  if (dspy?.enabled) {
    const lessonText = [
      `Title: ${lesson.title}`,
      `Scenario: ${lesson.scenario}`,
      `Wrong Approach: ${lesson.wrongApproach}`,
      `Correct Approach: ${lesson.correctApproach}`,
      `Insight: ${lesson.insight}`,
    ].join("\n");

    const evalResult = await callDspy(
      { type: "lesson", id: lesson.id, content: lessonText },
      dspy.endpoint ?? DEFAULT_DSPY_ENDPOINT,
      dspy.timeoutMs ?? DEFAULT_DSPY_TIMEOUT_MS,
    );

    if (evalResult) {
      qualityScore = evalResult.score;
      qualityFeedback = evalResult.feedback ?? null;

      if (evalResult.score < 0.5) {
        // Quality gate REJECTS this lesson — do NOT persist
        return {
          lesson,
          qualityScore,
          qualityFeedback: qualityFeedback ?? "Lesson is too generic or vague to be recall-worthy.",
          persisted: false,
        };
      }
    } else {
      // DSPy was enabled but returned null (service unavailable / timeout / 500).
      // The lesson is still persisted below (graceful degradation preserves
      // progress), but we MUST signal the bypass so the user knows the quality
      // guarantee was skipped for this record. Without this WARN, users who
      // opt into --quality-gate get a false sense of safety during outages.
      process.stderr.write(
        "⚠  [quality-gate] DSPy evaluation skipped: service unavailable. " +
          "Lesson persisted WITHOUT quality check.\n",
      );
    }
  }

  const targetPath = path.join(projectRoot, LESSONS_FILE);
  await appendJsonl(targetPath, lesson);

  return { lesson, qualityScore, qualityFeedback, persisted: true };
}

/**
 * Searches lessons by keyword or semantic similarity.
 *
 * Mode 1 (default): String matching against title, insight, searchTerms, tags.
 * Mode 2 (semantic): DSPy ranks all lessons by semantic relevance to query.
 *   Falls back to Mode 1 if DSPy is unavailable.
 *
 * v0.7 (#23): every returned result is also written to
 * `.agents/records/lesson-recalls.jsonl` so the meta-memory layer can
 * later answer "which recalls were helpful?". Idempotent within a 1-hour
 * window, fire-and-forget — a disk error never breaks the search hot path.
 *
 * @param query The search query
 * @param projectRoot The root directory containing lessons.jsonl
 * @param dspy Optional DSPy configuration for semantic search
 * @param options Optional recall-capture context (ticketId, executor)
 * @returns Array of LessonSearchResult sorted by relevance
 */
export async function searchLessons(
  query: string,
  projectRoot: string = process.cwd(),
  dspy?: MemoryDspyOptions,
  options?: SearchLessonsOptions,
): Promise<LessonSearchResult[]> {
  const lessons = await readAllLessons(projectRoot);
  if (lessons.length === 0) return [];

  // v0.5.2: Semantic search via DSPy
  if (dspy?.enabled) {
    const candidates = lessons.map(l => ({
      id: l.id,
      content: `${l.title}. ${l.scenario}. ${l.insight}`,
    }));

    const ranked = await callDspyRank(
      query,
      candidates,
      dspy.endpoint ?? DEFAULT_DSPY_ENDPOINT,
      dspy.timeoutMs ?? DEFAULT_DSPY_TIMEOUT_MS,
    );

    if (ranked) {
      // DSPy returned rankings — map back to lessons
      const results: LessonSearchResult[] = [];
      for (const r of ranked) {
        if (r.score <= 0.3) continue; // Filter irrelevant results
        const lesson = lessons.find(l => l.id === r.id);
        if (!lesson) continue;
        results.push({
          lesson,
          relevanceScore: r.score,
          matchMethod: "semantic",
        });
      }
      captureRecalls(projectRoot, query, results, options);
      return results;
    }
    // DSPy failed (service unavailable / timeout / 500). Falling through to
    // string matching preserves progress (graceful degradation), but we MUST
    // signal the bypass — users who explicitly passed dspy.enabled=true
    // (CLI: `lesson search --semantic`) need to know they are reading a
    // string-match result, not a semantic one. Without this WARN, semantic
    // search silently downgrades to lower-recall string match. Same contract
    // as memory.recordLesson and cli/eval (án lệ L-2026-04-29-silent-tier1-
    // degradation; closes the search-mode site of issue #24).
    process.stderr.write(
      "⚠  [search] DSPy semantic ranking unavailable: falling back to string match. " +
        "Results may have lower recall.\n",
    );
  }

  // Mode 1: String matching (original implementation)
  const lowerQuery = query.toLowerCase();
  const stringResults: LessonSearchResult[] = lessons
    .filter(lesson => {
      if (lesson.title.toLowerCase().includes(lowerQuery)) return true;
      if (lesson.insight.toLowerCase().includes(lowerQuery)) return true;
      if (lesson.searchTerms?.some(t => t.toLowerCase().includes(lowerQuery))) return true;
      if (lesson.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      return false;
    })
    .map(lesson => ({
      lesson,
      relevanceScore: null,
      matchMethod: "string" as const,
    }));

  captureRecalls(projectRoot, query, stringResults, options);
  return stringResults;
}

/**
 * Fire-and-forget recall capture. Wraps {@link recordRecall} per result in
 * an isolated try/catch so a JSONL write error never propagates to the
 * search caller (the search hot path stays read-only from the caller's
 * perspective). Each failure is signalled to stderr but does not throw.
 *
 * Disable via `options.captureRecall === false` — the scanner uses this
 * to avoid creating circular events when re-walking history.
 */
function captureRecalls(
  projectRoot: string,
  query: string,
  results: LessonSearchResult[],
  options: SearchLessonsOptions | undefined,
): void {
  if (options?.captureRecall === false) return;
  if (results.length === 0) return;
  const ticketId = options?.ticketId ?? "";
  const executor = options?.executor ?? "human";
  for (const r of results) {
    try {
      recordRecall(projectRoot, {
        lessonId: r.lesson.id,
        ticketId,
        query,
        matchMethod: r.matchMethod,
        source: "search",
        executor,
      });
    } catch (err: unknown) {
      // Storage failure must not break search — surface to stderr only.
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `⚠  [recall] failed to record recall for lesson ${r.lesson.id}: ${message}\n`,
      );
    }
  }
}

/**
 * Records a growth metric into growth_metrics.jsonl.
 * @param metric The metric payload excluding measuredAt timestamp
 * @param projectRoot The project root
 */
export async function recordGrowthMetric(
  metric: Omit<GrowthMetric, "measuredAt">,
  projectRoot: string = process.cwd()
): Promise<GrowthMetric> {
  const fullMetric: GrowthMetric = {
    measuredAt: new Date().toISOString(),
    name: metric.name,
    value: metric.value,
    unit: metric.unit,
  };
  
  if (metric.source) fullMetric.source = metric.source;
  if (metric.trend) fullMetric.trend = metric.trend;

  const targetPath = path.join(projectRoot, GROWTH_METRICS_FILE);
  await appendJsonl(targetPath, fullMetric);

  return fullMetric;
}
